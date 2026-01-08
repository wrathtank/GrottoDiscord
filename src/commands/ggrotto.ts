import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ggrotto')
  .setDescription('GGrotto!');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply('GGrotto');
}
