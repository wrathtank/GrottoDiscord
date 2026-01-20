import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { BlockchainService } from '../services/blockchain';
import { BotConfig } from '../types';
import {
  getLinkedWallet,
  getLinkedWallets,
  unlinkWallet,
  getRoleAssignments,
  removeRoleAssignment,
} from '../database/unified';

export const data = new SlashCommandBuilder()
  .setName('unlink')
  .setDescription('Unlink your wallet(s) and remove associated roles');

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

  if (wallets.length === 1) {
    // Single wallet - simple confirmation
    const wallet = wallets[0];
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
        .setCustomId(`unlink_confirm_all_${interaction.user.id}`)
        .setLabel('Yes, Unlink')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`unlink_cancel_${interaction.user.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  } else {
    // Multiple wallets - show selection
    const walletList = wallets.map((w, i) =>
      `${i + 1}. \`${w.walletAddress.slice(0, 6)}...${w.walletAddress.slice(-4)}\``
    ).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Unlink Wallet(s)?')
      .setDescription(
        `You have ${wallets.length} wallets linked:\n\n${walletList}\n\n` +
        `Select which wallet to unlink, or unlink all.`
      )
      .setColor(0xffa500);

    const selectOptions = wallets.map((w, i) => ({
      label: `Wallet ${i + 1}`,
      description: `${w.walletAddress.slice(0, 10)}...${w.walletAddress.slice(-8)}`,
      value: w.walletAddress,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`unlink_select_${interaction.user.id}`)
      .setPlaceholder('Select a wallet to unlink')
      .addOptions(selectOptions);

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`unlink_confirm_all_${interaction.user.id}`)
        .setLabel('Unlink All Wallets')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`unlink_cancel_${interaction.user.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [selectRow, buttonRow], ephemeral: true });
  }
}

export async function handleButton(
  interaction: ButtonInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const [, action, target, userId] = interaction.customId.split('_');

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

  if (action === 'confirm' && target === 'all') {
    // Unlink all wallets
    const wallets = await getLinkedWallets(interaction.user.id);
    if (wallets.length === 0) {
      await interaction.update({
        content: '❌ No wallets found to unlink.',
        embeds: [],
        components: [],
      });
      return;
    }

    const guild = interaction.guild;
    if (guild) {
      try {
        // Fetch all guild roles to populate the cache
        await guild.roles.fetch();

        const member = await guild.members.fetch(interaction.user.id);
        const roleAssignments = await getRoleAssignments(interaction.user.id);

        for (const roleId of roleAssignments) {
          const roleConfig = config.roles.find((r) => r.id === roleId);
          if (roleConfig) {
            const discordRole = guild.roles.cache.get(roleConfig.discordRoleId);
            if (discordRole && member.roles.cache.has(discordRole.id)) {
              await member.roles.remove(discordRole);
            }
            await removeRoleAssignment(interaction.user.id, roleId);
          }
        }
      } catch (error) {
        console.error('[Unlink] Error removing roles:', error);
      }
    }

    // Unlink all wallets (no address = all)
    await unlinkWallet(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('✅ All Wallets Unlinked')
      .setDescription(
        `${wallets.length} wallet(s) have been unlinked and all verification-based roles have been removed.\n\n` +
        'Use `/verify` to link a new wallet.'
      )
      .setColor(0x00ff00);

    await interaction.update({ embeds: [embed], components: [] });
  }
}

export async function handleSelectMenu(
  interaction: StringSelectMenuInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const [, , userId] = interaction.customId.split('_');

  if (userId !== interaction.user.id) {
    await interaction.reply({
      content: '❌ This menu is not for you.',
      ephemeral: true,
    });
    return;
  }

  const walletAddress = interaction.values[0];

  // Unlink specific wallet
  const success = await unlinkWallet(interaction.user.id, walletAddress);

  if (!success) {
    await interaction.update({
      content: '❌ Failed to unlink wallet.',
      embeds: [],
      components: [],
    });
    return;
  }

  // Check if user still has other wallets - if so, re-verify roles
  const remainingWallets = await getLinkedWallets(interaction.user.id);

  if (remainingWallets.length > 0) {
    // Re-verify with remaining wallets
    const guild = interaction.guild;
    if (guild) {
      try {
        // Fetch all guild roles to populate the cache
        await guild.roles.fetch();

        const member = await guild.members.fetch(interaction.user.id);
        const walletAddresses = remainingWallets.map(w => w.walletAddress);
        const results = await blockchain.verifyAllRolesMultiWallet(config.roles, walletAddresses);

        // Update roles based on new verification
        for (const result of results) {
          const roleConfig = config.roles.find((r) => r.id === result.roleId);
          if (!roleConfig) continue;

          const discordRole = guild.roles.cache.get(roleConfig.discordRoleId);
          if (!discordRole) continue;

          const hasRole = member.roles.cache.has(discordRole.id);

          if (result.qualified && !hasRole) {
            await member.roles.add(discordRole);
          } else if (!result.qualified && hasRole) {
            await member.roles.remove(discordRole);
            await removeRoleAssignment(interaction.user.id, roleConfig.id);
          }
        }
      } catch (error) {
        console.error('[Unlink] Error updating roles:', error);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ Wallet Unlinked')
      .setDescription(
        `Wallet \`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\` has been unlinked.\n\n` +
        `You still have ${remainingWallets.length} wallet(s) linked. Roles have been re-verified.`
      )
      .setColor(0x00ff00);

    await interaction.update({ embeds: [embed], components: [] });
  } else {
    // No wallets left - remove all roles
    const guild = interaction.guild;
    if (guild) {
      try {
        // Fetch all guild roles to populate the cache
        await guild.roles.fetch();

        const member = await guild.members.fetch(interaction.user.id);
        const roleAssignments = await getRoleAssignments(interaction.user.id);

        for (const roleId of roleAssignments) {
          const roleConfig = config.roles.find((r) => r.id === roleId);
          if (roleConfig) {
            const discordRole = guild.roles.cache.get(roleConfig.discordRoleId);
            if (discordRole && member.roles.cache.has(discordRole.id)) {
              await member.roles.remove(discordRole);
            }
            await removeRoleAssignment(interaction.user.id, roleId);
          }
        }
      } catch (error) {
        console.error('[Unlink] Error removing roles:', error);
      }
    }

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
