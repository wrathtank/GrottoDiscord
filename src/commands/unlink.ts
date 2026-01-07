import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
} from 'discord.js';
import { BlockchainService } from '../services/blockchain';
import { BotConfig } from '../types';
import {
  getLinkedWallet,
  unlinkWallet,
  getRoleAssignments,
  removeRoleAssignment,
} from '../database';

export const data = new SlashCommandBuilder()
  .setName('unlink')
  .setDescription('Unlink your wallet and remove associated roles');

export async function execute(
  interaction: ChatInputCommandInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const wallet = getLinkedWallet(interaction.user.id);

  if (!wallet) {
    const embed = new EmbedBuilder()
      .setTitle('No Wallet Linked')
      .setDescription(config.messages.notLinked)
      .setColor(0xff0000);

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('⚠️ Unlink Wallet?')
    .setDescription(
      `Are you sure you want to unlink your wallet?\n\n` +
      `**Wallet:** \`${wallet.walletAddress.slice(0, 6)}...${wallet.walletAddress.slice(-4)}\`\n\n` +
      `This will remove all verification-based roles.`
    )
    .setColor(0xffa500);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`unlink_confirm_${interaction.user.id}`)
      .setLabel('Yes, Unlink')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`unlink_cancel_${interaction.user.id}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

export async function handleButton(
  interaction: ButtonInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const [, action, userId] = interaction.customId.split('_');

  if (userId !== interaction.user.id) {
    await interaction.reply({
      content: '❌ This button is not for you.',
      ephemeral: true,
    });
    return;
  }

  if (action === 'cancel') {
    const embed = new EmbedBuilder()
      .setTitle('Cancelled')
      .setDescription('Wallet unlink cancelled.')
      .setColor(0x5865f2);

    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  if (action === 'confirm') {
    const wallet = getLinkedWallet(interaction.user.id);
    if (!wallet) {
      await interaction.update({
        content: '❌ No wallet found to unlink.',
        embeds: [],
        components: [],
      });
      return;
    }

    const guild = interaction.guild;
    if (guild) {
      try {
        const member = await guild.members.fetch(interaction.user.id);
        const roleAssignments = getRoleAssignments(interaction.user.id);

        for (const roleId of roleAssignments) {
          const roleConfig = config.roles.find((r) => r.id === roleId);
          if (roleConfig) {
            const discordRole = guild.roles.cache.get(roleConfig.discordRoleId);
            if (discordRole && member.roles.cache.has(discordRole.id)) {
              await member.roles.remove(discordRole);
            }
            removeRoleAssignment(interaction.user.id, roleId);
          }
        }
      } catch (error) {
        console.error('[Unlink] Error removing roles:', error);
      }
    }

    unlinkWallet(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('✅ Wallet Unlinked')
      .setDescription(
        'Your wallet has been unlinked and all verification-based roles have been removed.\n\n' +
        'Use `/verify` to link a new wallet.'
      )
      .setColor(0x00ff00);

    await interaction.update({ embeds: [embed], components: [] });
  }
}
