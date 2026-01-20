import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BlockchainService } from '../services/blockchain';
import { BotConfig } from '../types';
import {
  getLinkedWallets,
  updateLastVerified,
  recordRoleAssignment,
  removeRoleAssignment,
  getRoleAssignments,
} from '../database/unified';

export const data = new SlashCommandBuilder()
  .setName('refresh')
  .setDescription('Re-verify your holdings and update your roles');

export async function execute(
  interaction: ChatInputCommandInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const wallets = await getLinkedWallets(interaction.user.id);

  if (wallets.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle('No Wallet Linked')
      .setDescription(config.messages.notLinked)
      .setColor(0xff0000);

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // Get all wallet addresses and verify with multi-wallet support
  const walletAddresses = wallets.map(w => w.walletAddress);
  const results = await blockchain.verifyAllRolesMultiWallet(config.roles, walletAddresses);

  // Try interaction.guild first, then fetch as fallback
  let guild = interaction.guild;
  if (!guild && process.env.DISCORD_GUILD_ID) {
    guild = await interaction.client.guilds.fetch(process.env.DISCORD_GUILD_ID).catch(() => null);
  }
  if (!guild) {
    await interaction.editReply({ content: '❌ Could not find guild.' });
    return;
  }

  const member = await guild.members.fetch(interaction.user.id);
  const previousRoles = await getRoleAssignments(interaction.user.id);
  const addedRoles: string[] = [];
  const removedRoles: string[] = [];
  const keptRoles: string[] = [];
  const embeds: EmbedBuilder[] = [];

  // First pass: collect all Discord role IDs that the user qualifies for
  // This handles cases where multiple config entries share the same Discord role
  const qualifiedDiscordRoleIds = new Set<string>();
  for (const result of results) {
    if (result.qualified) {
      const roleConfig = config.roles.find((r) => r.id === result.roleId);
      if (roleConfig) {
        qualifiedDiscordRoleIds.add(roleConfig.discordRoleId);
      }
    }
  }

  // Second pass: add/remove roles
  for (const result of results) {
    const roleConfig = config.roles.find((r) => r.id === result.roleId);
    if (!roleConfig) continue;

    const discordRole = guild.roles.cache.get(roleConfig.discordRoleId);
    if (!discordRole) continue;

    const hasRole = member.roles.cache.has(discordRole.id);
    const wasTracked = previousRoles.includes(roleConfig.id);

    if (result.qualified) {
      if (!hasRole) {
        try {
          await member.roles.add(discordRole);
          await recordRoleAssignment(interaction.user.id, roleConfig.id);
          addedRoles.push(roleConfig.name);

          if (roleConfig.assignEmbed) {
            const roleEmbed = new EmbedBuilder()
              .setTitle(roleConfig.assignEmbed.title)
              .setDescription(roleConfig.assignEmbed.description);

            if (roleConfig.assignEmbed.color) {
              roleEmbed.setColor(parseInt(roleConfig.assignEmbed.color.replace('#', ''), 16));
            }

            if (roleConfig.assignEmbed.thumbnail) {
              roleEmbed.setThumbnail(roleConfig.assignEmbed.thumbnail);
            }

            if (roleConfig.assignEmbed.image) {
              roleEmbed.setImage(roleConfig.assignEmbed.image);
            }

            if (roleConfig.assignEmbed.fields) {
              roleEmbed.addFields(roleConfig.assignEmbed.fields);
            }

            embeds.push(roleEmbed);
          }
        } catch (error) {
          console.error(`[Refresh] Failed to add role ${roleConfig.name}:`, error);
        }
      } else {
        keptRoles.push(roleConfig.name);
      }
    } else {
      if (hasRole && config.verification.autoRevokeOnFailure) {
        // Don't remove if another config entry qualified for same Discord role
        if (qualifiedDiscordRoleIds.has(roleConfig.discordRoleId)) {
          keptRoles.push(roleConfig.name);
        } else {
          try {
            await member.roles.remove(discordRole);
            await removeRoleAssignment(interaction.user.id, roleConfig.id);
            removedRoles.push(roleConfig.name);
          } catch (error) {
            console.error(`[Refresh] Failed to remove role ${roleConfig.name}:`, error);
          }
        }
      }
    }
  }

  await updateLastVerified(interaction.user.id);

  // Build wallet description
  const walletDesc = wallets.length === 1
    ? `Wallet: \`${wallets[0].walletAddress.slice(0, 6)}...${wallets[0].walletAddress.slice(-4)}\``
    : `Wallets (${wallets.length}): ${wallets.map(w => `\`${w.walletAddress.slice(0, 6)}...${w.walletAddress.slice(-4)}\``).join(', ')}`;

  const summaryEmbed = new EmbedBuilder()
    .setTitle('🔄 Roles Refreshed')
    .setDescription(walletDesc)
    .setColor(0x5865f2)
    .setTimestamp();

  if (addedRoles.length > 0) {
    summaryEmbed.addFields({
      name: '✅ Roles Added',
      value: addedRoles.map((r) => `• ${r}`).join('\n'),
      inline: true,
    });
  }

  if (removedRoles.length > 0) {
    summaryEmbed.addFields({
      name: '❌ Roles Removed',
      value: removedRoles.map((r) => `• ${r}`).join('\n'),
      inline: true,
    });
  }

  if (keptRoles.length > 0) {
    summaryEmbed.addFields({
      name: '📌 Roles Kept',
      value: keptRoles.map((r) => `• ${r}`).join('\n'),
      inline: true,
    });
  }

  if (addedRoles.length === 0 && removedRoles.length === 0 && keptRoles.length === 0) {
    summaryEmbed.addFields({
      name: 'Status',
      value: 'No role changes. You don\'t currently qualify for any tracked roles.',
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [summaryEmbed, ...embeds] });
}
