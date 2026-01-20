import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { BlockchainService } from '../services/blockchain';
import { BotConfig } from '../types';
import { getLinkedWallets, getRoleAssignments } from '../database/unified';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Check your current wallet status and holdings');

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

  const walletAddresses = wallets.map(w => w.walletAddress);
  const results = await blockchain.verifyAllRolesMultiWallet(config.roles, walletAddresses);
  const currentRoles = await getRoleAssignments(interaction.user.id);

  // Build wallet list for display
  const walletList = wallets.map((w, i) =>
    `${i + 1}. \`${w.walletAddress.slice(0, 6)}...${w.walletAddress.slice(-4)}\``
  ).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📊 Wallet Status')
    .setDescription(
      wallets.length === 1
        ? `**Wallet:** \`${wallets[0].walletAddress}\``
        : `**Linked Wallets (${wallets.length}):**\n${walletList}\n\n*Balances are combined across all wallets*`
    )
    .setColor(0x5865f2)
    .setTimestamp()
    .setFooter({ text: `Last verified: ${new Date(wallets[0].lastVerified).toLocaleString()}` });

  for (const result of results) {
    const roleConfig = config.roles.find((r) => r.id === result.roleId);
    if (!roleConfig) continue;

    const requirementDetails = result.details.map((d) => {
      const decimals = roleConfig.requirements.find(
        (r) => r.contractAddress.toLowerCase() === d.contractAddress.toLowerCase()
      )?.decimals || 0;

      const actualFormatted = d.type === 'erc721' || d.type === 'erc1155'
        ? d.actual
        : blockchain.formatBalance(d.actual, decimals);

      const requiredFormatted = d.type === 'erc721' || d.type === 'erc1155'
        ? d.required
        : blockchain.formatBalance(d.required, decimals);

      const status = d.passed ? '✅' : '❌';
      return `${status} ${d.type.toUpperCase()}: ${actualFormatted} / ${requiredFormatted} required`;
    });

    const hasRole = currentRoles.includes(roleConfig.id);
    const statusIcon = result.qualified ? '🟢' : '🔴';
    const roleStatus = hasRole ? '(Role Assigned)' : result.qualified ? '(Eligible)' : '';

    embed.addFields({
      name: `${statusIcon} ${roleConfig.name} ${roleStatus}`,
      value: requirementDetails.join('\n') || 'No requirements',
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
