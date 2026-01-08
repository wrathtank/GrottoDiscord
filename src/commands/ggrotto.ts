import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { ethers } from 'ethers';

// Analog Distortions NFT contract on AVAX
const AD_CONTRACT = '0x0a337be2ea71e3aea9c82d45b036ac6a6123b6d0';
const AVAX_RPC = 'https://api.avax.network/ext/bc/C/rpc';

// Simple ERC721 ABI for tokenURI and totalSupply
const ERC721_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function totalSupply() view returns (uint256)',
];

export const data = new SlashCommandBuilder()
  .setName('ggrotto')
  .setDescription('GGrotto! Shows a random Analog Distortion');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Defer reply since fetching metadata might take a moment
    await interaction.deferReply();

    const provider = new ethers.JsonRpcProvider(AVAX_RPC);
    const contract = new ethers.Contract(AD_CONTRACT, ERC721_ABI, provider);

    // Get total supply to pick a random token
    let totalSupply: number;
    try {
      totalSupply = Number(await contract.totalSupply());
    } catch {
      // Fallback if totalSupply doesn't exist
      totalSupply = 1000;
    }

    // Pick a random token ID (1-indexed typically)
    const randomTokenId = Math.floor(Math.random() * totalSupply) + 1;

    // Get the token URI
    let tokenUri: string;
    try {
      tokenUri = await contract.tokenURI(randomTokenId);
    } catch (error) {
      // If we can't get metadata, just send a simple response
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🦴 GGrotto!')
            .setDescription('*The Grotto welcomes you*')
            .setColor(0xff0033)
        ]
      });
      return;
    }

    // Handle IPFS URIs
    if (tokenUri.startsWith('ipfs://')) {
      tokenUri = tokenUri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    // Fetch the metadata
    let metadata: any = null;
    try {
      const response = await fetch(tokenUri, {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      metadata = await response.json();
    } catch {
      // If fetch fails, just show simple message
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🦴 GGrotto!')
            .setDescription('*The Grotto welcomes you*')
            .setColor(0xff0033)
        ]
      });
      return;
    }

    // Get image URL
    let imageUrl = metadata.image || metadata.image_url || '';
    if (imageUrl.startsWith('ipfs://')) {
      imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    // Build the embed
    const embed = new EmbedBuilder()
      .setTitle(`🦴 GGrotto!`)
      .setDescription(`**${metadata.name || `Analog Distortion #${randomTokenId}`}**`)
      .setColor(0xff0033)
      .setFooter({ text: `Analog Distortions #${randomTokenId}` });

    if (imageUrl) {
      embed.setImage(imageUrl);
    }

    // Add some attributes if available
    if (metadata.attributes && Array.isArray(metadata.attributes)) {
      const attrs = metadata.attributes
        .slice(0, 4) // Max 4 attributes
        .map((a: any) => `**${a.trait_type}:** ${a.value}`)
        .join('\n');

      if (attrs) {
        embed.addFields({ name: 'Traits', value: attrs, inline: false });
      }
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('[GGrotto] Error:', error);

    // Fallback response
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🦴 GGrotto!')
          .setDescription('*The Grotto welcomes you*')
          .setColor(0xff0033)
      ]
    });
  }
}
