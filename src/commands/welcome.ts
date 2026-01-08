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
  // Main welcome embed with ASCII-style header
  const embed = new EmbedBuilder()
    .setTitle('༺ THE GROTTO ༻')
    .setDescription(
      '```\n' +
      '▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄\n' +
      '█ WALLET VERIFICATION PORTAL █\n' +
      '▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀\n' +
      '```\n' +
      '> *Verify your wallet to unlock exclusive roles*\n> *based on your on-chain holdings...*\n\n' +
      '**🩸 SUPPORTED ASSETS**\n' +
      '╔══════════════════════════╗\n' +
      '║ ◈ `$HERESY` Token        ║\n' +
      '║ ◈ Analog Distortions NFT ║\n' +
      '║ ◈ Staked AD              ║\n' +
      '╚══════════════════════════╝'
    )
    .setColor(0x8b0000)
    .setThumbnail('https://i.imgur.com/YourLogo.png') // Replace with your logo
    .addFields(
      {
        name: '⛧ HOW TO VERIFY ⛧',
        value:
          '```diff\n' +
          '+ Step 1: Type /verify\n' +
          '+ Step 2: Click "🔥 Verify Wallet"\n' +
          '+ Step 3: Connect wallet & sign\n' +
          '+ Step 4: Roles assigned automatically!\n' +
          '```',
        inline: false,
      },
      {
        name: '🔄 UPDATE ROLES',
        value: '> Holdings changed? Use `/refresh` anytime.',
        inline: true,
      },
      {
        name: '🔗 CHECK STATUS',
        value: '> Use `/status` to view your wallet.',
        inline: true,
      },
      {
        name: '⚠️ TROUBLESHOOTING',
        value:
          '```\n' +
          '• Wrong wallet? Use /unlink first\n' +
          '• Roles not showing? Check /refresh\n' +
          '• Still stuck? Contact a mod\n' +
          '```',
        inline: false,
      }
    )
    .setImage('https://i.imgur.com/YourBanner.png') // Replace with your banner
    .setFooter({ text: '🦴 GGrotto! • Descend into the darkness...' })
    .setTimestamp();

  // Send to the channel (not ephemeral)
  await interaction.reply({ content: 'Welcome message posted!', ephemeral: true });

  if (interaction.channel && 'send' in interaction.channel) {
    await interaction.channel.send({ embeds: [embed] });
  }
}
