import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  ButtonInteraction,
} from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import { BlockchainService } from '../services/blockchain';
import { BotConfig } from '../types';
import {
  getLinkedWallet,
  linkWallet,
  createVerificationSession,
  getVerificationSession,
  deleteVerificationSession,
  updateLastVerified,
  recordRoleAssignment,
  removeRoleAssignment,
  getWalletByAddress,
} from '../database/unified';

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Link and verify your wallet to get roles based on your holdings');

export async function execute(
  interaction: ChatInputCommandInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const existingWallet = await getLinkedWallet(interaction.user.id);

  if (existingWallet) {
    const embed = new EmbedBuilder()
      .setTitle('Wallet Already Linked')
      .setDescription(
        `You already have a wallet linked: \`${existingWallet.walletAddress.slice(0, 6)}...${existingWallet.walletAddress.slice(-4)}\`\n\nUse \`/refresh\` to update your roles or \`/unlink\` to remove it.`
      )
      .setColor(0xffa500);

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const sessionId = uuidv4();
  const nonce = uuidv4().replace(/-/g, '').slice(0, 16);
  const expiryMinutes = parseInt(process.env.VERIFICATION_EXPIRY_MINUTES || '10');

  await createVerificationSession(sessionId, interaction.user.id, nonce, expiryMinutes);

  const timestamp = Date.now();
  const message = blockchain.generateSignatureMessage(nonce, timestamp);

  // Build embed based on whether signature is required
  const embed = new EmbedBuilder()
    .setTitle('🔐 Wallet Verification')
    .setDescription(config.messages.verificationStart)
    .setColor(0x5865f2)
    .setFooter({ text: `Session expires in ${expiryMinutes} minutes • ID: ${sessionId.slice(0, 8)}` });

  if (config.verification.requireSignature) {
    // Build the web verification URL
    const webUrl = process.env.VERIFY_WEB_URL || 'https://grotto-verify.vercel.app';
    const verifyLink = `${webUrl}?nonce=${nonce}&timestamp=${timestamp}`;

    embed.addFields(
      {
        name: '🔥 Step 1: Open Verification Page',
        value: `**[Click here to verify your wallet](${verifyLink})**`,
        inline: false,
      },
      {
        name: '🔗 Step 2: Connect & Sign',
        value: '• Connect your wallet (MetaMask, etc.)\n' +
          '• Click "Sign Message" and approve\n' +
          '• Copy the signature when complete',
        inline: false,
      },
      {
        name: '✅ Step 3: Submit Below',
        value: 'Click the button and paste:\n• Your wallet address\n• The signature you copied',
        inline: false,
      }
    );
  } else {
    embed.addFields({
      name: '✅ Enter Your Wallet',
      value: 'Click the button below and enter your wallet address (0x...)',
      inline: false,
    });
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`verify_start_${sessionId}`)
      .setLabel(config.verification.requireSignature ? 'Enter Wallet & Signature' : 'Enter Wallet Address')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔗')
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

export async function handleButton(
  interaction: ButtonInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const [, action, sessionId] = interaction.customId.split('_');

  if (action === 'start') {
    const session = await getVerificationSession(sessionId);

    if (!session) {
      await interaction.reply({
        content: '❌ Session expired. Please use `/verify` again.',
        ephemeral: true,
      });
      return;
    }

    if (session.discordId !== interaction.user.id) {
      await interaction.reply({
        content: '❌ This verification session belongs to another user.',
        ephemeral: true,
      });
      return;
    }

    if (Date.now() > session.expiresAt) {
      await deleteVerificationSession(sessionId);
      await interaction.reply({
        content: '❌ Session expired. Please use `/verify` again.',
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`verify_modal_${sessionId}`)
      .setTitle('Wallet Verification');

    const walletInput = new TextInputBuilder()
      .setCustomId('wallet_address')
      .setLabel('Your Wallet Address')
      .setPlaceholder('0x1234...abcd')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(42)
      .setMaxLength(42);

    const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(walletInput);
    modal.addComponents(firstRow);

    // Only add signature field if required
    if (config.verification.requireSignature) {
      const signatureInput = new TextInputBuilder()
        .setCustomId('signature')
        .setLabel('Signature (from Snowtrace)')
        .setPlaceholder('Paste the signature you got from Snowtrace here...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(signatureInput);
      modal.addComponents(secondRow);
    }

    await interaction.showModal(modal);
  }
}

export async function handleModal(
  interaction: ModalSubmitInteraction,
  blockchain: BlockchainService,
  config: BotConfig
) {
  const [, , sessionId] = interaction.customId.split('_');

  const session = await getVerificationSession(sessionId);

  if (!session || session.discordId !== interaction.user.id) {
    await interaction.reply({
      content: '❌ Invalid or expired session. Please use `/verify` again.',
      ephemeral: true,
    });
    return;
  }

  const walletAddress = interaction.fields.getTextInputValue('wallet_address').trim();

  // Get signature only if the field exists
  let signature: string | undefined;
  try {
    signature = interaction.fields.getTextInputValue('signature')?.trim();
  } catch {
    // Signature field doesn't exist (requireSignature is false)
    signature = undefined;
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    await interaction.reply({
      content: '❌ Invalid wallet address format. Must be a valid Ethereum address.',
      ephemeral: true,
    });
    return;
  }

  const existingLink = await getWalletByAddress(walletAddress);
  if (existingLink && existingLink.discordId !== interaction.user.id) {
    await interaction.reply({
      content: '❌ This wallet is already linked to another Discord account.',
      ephemeral: true,
    });
    return;
  }

  // Verify signature if required
  if (config.verification.requireSignature) {
    if (!signature) {
      await interaction.reply({
        content: '❌ Signature is required. Please sign the message on Snowtrace and paste the signature.',
        ephemeral: true,
      });
      return;
    }

    const timestamp = session.createdAt;
    const message = blockchain.generateSignatureMessage(session.nonce, timestamp);

    if (!blockchain.verifySignature(message, signature, walletAddress)) {
      await interaction.reply({
        content: '❌ Signature verification failed. Make sure you:\n' +
          '1. Signed the exact message shown (copy it carefully)\n' +
          '2. Used the same wallet address you entered\n' +
          '3. Copied the full signature from Snowtrace',
        ephemeral: true,
      });
      return;
    }
  }

  await interaction.deferReply({ ephemeral: true });

  await linkWallet(interaction.user.id, walletAddress, signature, session.nonce);
  await deleteVerificationSession(sessionId);

  const results = await blockchain.verifyAllRoles(config.roles, walletAddress);
  const qualifiedRoles = results.filter((r) => r.qualified);

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: '❌ Could not find guild.' });
    return;
  }

  const member = await guild.members.fetch(interaction.user.id);
  const assignedRoles: string[] = [];
  const embeds: EmbedBuilder[] = [];

  for (const result of qualifiedRoles) {
    const roleConfig = config.roles.find((r) => r.id === result.roleId);
    if (!roleConfig) continue;

    try {
      const discordRole = guild.roles.cache.get(roleConfig.discordRoleId);
      if (discordRole && !member.roles.cache.has(discordRole.id)) {
        await member.roles.add(discordRole);
        await recordRoleAssignment(interaction.user.id, roleConfig.id);
        assignedRoles.push(roleConfig.name);

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

          if (roleConfig.assignEmbed.footer) {
            roleEmbed.setFooter({ text: roleConfig.assignEmbed.footer });
          }

          embeds.push(roleEmbed);
        }
      }
    } catch (error) {
      console.error(`[Verify] Failed to assign role ${roleConfig.name}:`, error);
    }
  }

  if (assignedRoles.length > 0) {
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Verification Successful!')
      .setDescription(config.messages.verificationSuccess)
      .addFields({
        name: 'Roles Assigned',
        value: assignedRoles.map((r) => `• ${r}`).join('\n'),
        inline: false,
      })
      .setColor(0x00ff00)
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed, ...embeds] });
  } else {
    const failEmbed = new EmbedBuilder()
      .setTitle('Wallet Linked')
      .setDescription(
        `Your wallet has been linked, but you don't currently meet the requirements for any roles.\n\n${config.messages.verificationFailed}`
      )
      .setColor(0xffa500);

    await interaction.editReply({ embeds: [failEmbed] });
  }
}
