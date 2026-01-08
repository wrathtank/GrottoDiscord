import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { BlockchainService } from '../services/blockchain';
import { BotConfig } from '../types';
import {
  getAllLinkedWallets,
  getLinkedWallet,
  unlinkWallet,
  getRoleAssignments,
  removeRoleAssignment,
  cleanExpiredSessions,
} from '../database/unified';

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin commands for managing the verification bot')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('stats')
      .setDescription('View bot statistics')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('health')
      .setDescription('Check RPC health status')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('lookup')
      .setDescription('Look up a user\'s linked wallet')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('The user to look up')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('forceunlink')
      .setDescription('Force unlink a user\'s wallet')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('The user to unlink')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('refreshall')
      .setDescription('Refresh all linked wallets (may take a while)')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('cleanup')
      .setDescription('Clean up expired verification sessions')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('roles')
      .setDescription('List all configured roles and their requirements')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'stats':
      await handleStats(interaction, blockchain, config);
      break;
    case 'health':
      await handleHealth(interaction, blockchain);
      break;
    case 'lookup':
      await handleLookup(interaction, blockchain, config);
      break;
    case 'forceunlink':
      await handleForceUnlink(interaction, blockchain, config);
      break;
    case 'refreshall':
      await handleRefreshAll(interaction, blockchain, config);
      break;
    case 'cleanup':
      await handleCleanup(interaction);
      break;
    case 'roles':
      await handleRoles(interaction, config);
      break;
  }
}

async function handleStats(
  interaction: ChatInputCommandInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const allWallets = await getAllLinkedWallets();
  const chainNames = blockchain.getChainNames();

  const embed = new EmbedBuilder()
    .setTitle('📈 Bot Statistics')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Linked Wallets', value: allWallets.length.toString(), inline: true },
      { name: 'Configured Roles', value: config.roles.length.toString(), inline: true },
      { name: 'Configured Chains', value: chainNames.join(', '), inline: true }
    )
    .setTimestamp();

  // Add info for each chain
  for (const chainName of chainNames) {
    try {
      const info = await blockchain.getNetworkInfo(chainName);
      embed.addFields({
        name: `${info.name} (${chainName})`,
        value: `Chain ID: ${info.chainId}\nBlock: ${info.blockNumber}`,
        inline: true,
      });
    } catch {
      embed.addFields({
        name: chainName,
        value: '❌ Error fetching info',
        inline: true,
      });
    }
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleHealth(
  interaction: ChatInputCommandInteraction,
  blockchain: BlockchainService
) {
  await interaction.deferReply({ ephemeral: true });

  const health = await blockchain.healthCheck();

  let allHealthy = true;
  let anyHealthy = false;

  const embed = new EmbedBuilder()
    .setTitle('🏥 RPC Health Check')
    .setTimestamp();

  for (const [chainKey, status] of Object.entries(health)) {
    const primaryStatus = status.primary ? '✅' : '❌';
    const secondaryStatus = status.secondary ? '✅' : '❌';

    if (!status.primary) allHealthy = false;
    if (status.primary || status.secondary) anyHealthy = true;

    embed.addFields({
      name: `${status.name} (${chainKey})`,
      value: `Primary: ${primaryStatus}\nSecondary: ${secondaryStatus}`,
      inline: true,
    });
  }

  embed.setColor(allHealthy ? 0x00ff00 : anyHealthy ? 0xffa500 : 0xff0000);

  await interaction.editReply({ embeds: [embed] });
}

async function handleLookup(
  interaction: ChatInputCommandInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const user = interaction.options.getUser('user', true);
  const wallet = await getLinkedWallet(user.id);

  if (!wallet) {
    await interaction.reply({
      content: `❌ ${user.tag} does not have a linked wallet.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const results = await blockchain.verifyAllRoles(config.roles, wallet.walletAddress);
  const roleAssignments = await getRoleAssignments(user.id);

  const embed = new EmbedBuilder()
    .setTitle(`🔍 Wallet Lookup: ${user.tag}`)
    .setDescription(`**Wallet:** \`${wallet.walletAddress}\``)
    .setColor(0x5865f2)
    .addFields(
      {
        name: 'Linked At',
        value: new Date(wallet.linkedAt).toLocaleString(),
        inline: true,
      },
      {
        name: 'Last Verified',
        value: new Date(wallet.lastVerified).toLocaleString(),
        inline: true,
      },
      {
        name: 'Assigned Roles',
        value: roleAssignments.length > 0
          ? roleAssignments.map((r) => config.roles.find((role) => role.id === r)?.name || r).join(', ')
          : 'None',
        inline: false,
      }
    )
    .setTimestamp();

  const qualifiedRoles = results.filter((r) => r.qualified).map((r) => r.roleName);
  embed.addFields({
    name: 'Currently Qualifies For',
    value: qualifiedRoles.length > 0 ? qualifiedRoles.join(', ') : 'None',
    inline: false,
  });

  await interaction.editReply({ embeds: [embed] });
}

async function handleForceUnlink(
  interaction: ChatInputCommandInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const user = interaction.options.getUser('user', true);
  const wallet = await getLinkedWallet(user.id);

  if (!wallet) {
    await interaction.reply({
      content: `❌ ${user.tag} does not have a linked wallet.`,
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  if (guild) {
    try {
      const member = await guild.members.fetch(user.id);
      const roleAssignments = await getRoleAssignments(user.id);

      for (const roleId of roleAssignments) {
        const roleConfig = config.roles.find((r) => r.id === roleId);
        if (roleConfig) {
          const discordRole = guild.roles.cache.get(roleConfig.discordRoleId);
          if (discordRole && member.roles.cache.has(discordRole.id)) {
            await member.roles.remove(discordRole);
          }
          await removeRoleAssignment(user.id, roleId);
        }
      }
    } catch (error) {
      console.error('[Admin] Error removing roles:', error);
    }
  }

  await unlinkWallet(user.id);

  await interaction.reply({
    content: `✅ Successfully unlinked wallet for ${user.tag} and removed all verification roles.`,
    ephemeral: true,
  });
}

async function handleRefreshAll(
  interaction: ChatInputCommandInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const allWallets = await getAllLinkedWallets();

  if (allWallets.length === 0) {
    await interaction.reply({
      content: '❌ No linked wallets to refresh.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: '❌ Could not find guild.' });
    return;
  }

  let processed = 0;
  let errors = 0;

  for (const wallet of allWallets) {
    try {
      const results = await blockchain.verifyAllRoles(config.roles, wallet.walletAddress);
      const member = await guild.members.fetch(wallet.discordId).catch(() => null);

      if (member) {
        for (const result of results) {
          const roleConfig = config.roles.find((r) => r.id === result.roleId);
          if (!roleConfig) continue;

          const discordRole = guild.roles.cache.get(roleConfig.discordRoleId);
          if (!discordRole) continue;

          const hasRole = member.roles.cache.has(discordRole.id);

          if (result.qualified && !hasRole) {
            await member.roles.add(discordRole);
          } else if (!result.qualified && hasRole && config.verification.autoRevokeOnFailure) {
            await member.roles.remove(discordRole);
          }
        }
      }
      processed++;
    } catch (error) {
      console.error(`[Admin] Error refreshing wallet ${wallet.walletAddress}:`, error);
      errors++;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('🔄 Refresh Complete')
    .setColor(errors === 0 ? 0x00ff00 : 0xffa500)
    .addFields(
      { name: 'Total Wallets', value: allWallets.length.toString(), inline: true },
      { name: 'Processed', value: processed.toString(), inline: true },
      { name: 'Errors', value: errors.toString(), inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleCleanup(interaction: ChatInputCommandInteraction) {
  const cleaned = await cleanExpiredSessions();

  await interaction.reply({
    content: `✅ Cleaned up ${cleaned} expired verification session(s).`,
    ephemeral: true,
  });
}

async function handleRoles(
  interaction: ChatInputCommandInteraction,
  config: BotConfig
) {
  const embed = new EmbedBuilder()
    .setTitle('📋 Configured Roles')
    .setColor(0x5865f2);

  for (const role of config.roles) {
    const requirements = role.requirements.map((r) => {
      let desc = `${r.type.toUpperCase()}`;
      if (r.symbol) desc += ` (${r.symbol})`;
      if (r.name) desc += ` - ${r.name}`;
      desc += `\nContract: \`${r.contractAddress.slice(0, 10)}...\``;
      desc += `\nMin: ${r.minBalance}`;
      if (r.tokenId) desc += ` (Token ID: ${r.tokenId})`;
      return desc;
    });

    const logic = role.requireAll ? '(ALL required)' : '(ANY required)';

    embed.addFields({
      name: `${role.name} ${logic}`,
      value: requirements.join('\n\n') || 'No requirements',
      inline: false,
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
