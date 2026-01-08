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
    .setTitle('THE GROTTO')
    .setDescription(
      'Verify your wallet to unlock exclusive roles based on your holdings.\n\n' +
      '**Supported Assets**\n' +
      '• $HERESY Token\n' +
      '• Analog Distortions NFT\n' +
      '• Staked AD'
    )
    .setColor(0x8b0000)
    .addFields(
      {
        name: 'How to Verify',
        value:
          '1. Type `/verify`\n' +
          '2. Click the verify button\n' +
          '3. Connect wallet & sign\n' +
          '4. Roles assigned automatically',
        inline: false,
      },
      {
        name: 'Commands',
        value:
          '`/refresh` - Update your roles\n' +
          '`/status` - Check your wallet\n' +
          '`/unlink` - Disconnect wallet',
        inline: false,
      }
    )
    .setFooter({ text: 'GGrotto!' });

  // Send to the channel (not ephemeral)
  await interaction.reply({ content: 'Welcome message posted!', ephemeral: true });

  if (interaction.channel && 'send' in interaction.channel) {
    await interaction.channel.send({ embeds: [embed] });
  }
}
