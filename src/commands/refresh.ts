import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BlockchainService } from '../services/blockchain';
import { BotConfig } from '../types';
import {
  getLinkedWallet,
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
  const wallet = await getLinkedWallet(interaction.user.id);

  if (!wallet) {
    const embed = new EmbedBuilder()
      .setTitle('No Wallet Linked')
      .setDescription(config.messages.notLinked)
      .setColor(0xff0000);

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const results = await blockchain.verifyAllRoles(config.roles, wallet.walletAddress);

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

  await updateLastVerified(interaction.user.id);

  const summaryEmbed = new EmbedBuilder()
    .setTitle('🔄 Roles Refreshed')
    .setDescription(`Wallet: \`${wallet.walletAddress.slice(0, 6)}...${wallet.walletAddress.slice(-4)}\``)
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
