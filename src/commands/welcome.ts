import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Post the welcome/verification instructions to this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🔥 Welcome to The Grotto 🔥')
    .setDescription(
      'Verify your wallet to unlock exclusive roles based on your holdings!\n\n' +
      '**Supported Assets:**\n' +
      '• $HERESY Token\n' +
      '• Analog Distortions NFTs\n' +
      '• Staked Analog Distortions\n'
    )
    .setColor(0xff0033)
    .addFields(
      {
        name: '📋 How to Verify',
        value:
          '**1.** Type `/verify` in any channel\n' +
          '**2.** Click the **"🔥 Verify Wallet"** button\n' +
          '**3.** Connect your wallet on the verification page\n' +
          '**4.** Sign the message (this proves you own the wallet)\n' +
          '**5.** Done! Your roles will be assigned automatically',
        inline: false,
      },
      {
        name: '🔄 Update Your Roles',
        value:
          'Holdings changed? Use `/refresh` to update your roles anytime.',
        inline: false,
      },
      {
        name: '❓ Need Help?',
        value:
          '• Make sure you\'re using the wallet with your assets\n' +
          '• Use `/status` to check your linked wallet\n' +
          '• Use `/unlink` to disconnect and start fresh',
        inline: false,
      }
    )
    .setFooter({ text: 'GGrotto! 🦴' })
    .setTimestamp();

  // Send to the channel (not ephemeral)
  await interaction.reply({ content: 'Welcome message posted!', ephemeral: true });

  if (interaction.channel && 'send' in interaction.channel) {
    await interaction.channel.send({ embeds: [embed] });
  }
}
