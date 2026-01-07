import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { BlockchainService } from './services/blockchain';
import { BotConfig, RpcConfig } from './types';
import { commands, commandData } from './commands';

export class GrottoBot {
  private client: Client;
  private blockchain: BlockchainService;
  private config: BotConfig;
  private token: string;
  private clientId: string;
  private guildId?: string;

  constructor(
    token: string,
    clientId: string,
    rpcConfig: RpcConfig,
    botConfig: BotConfig,
    guildId?: string
  ) {
    this.token = token;
    this.clientId = clientId;
    this.guildId = guildId;
    this.config = botConfig;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
      ],
    });

    this.blockchain = new BlockchainService(rpcConfig, botConfig.customAbis);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once(Events.ClientReady, (client) => {
      console.log(`[Bot] Logged in as ${client.user.tag}`);
      console.log(`[Bot] Serving ${client.guilds.cache.size} guild(s)`);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      try {
        await this.handleInteraction(interaction);
      } catch (error) {
        console.error('[Bot] Error handling interaction:', error);

        if (interaction.isRepliable()) {
          const content = '❌ An error occurred while processing your request.';
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content, ephemeral: true }).catch(() => {});
          } else {
            await interaction.reply({ content, ephemeral: true }).catch(() => {});
          }
        }
      }
    });

    this.client.on(Events.Error, (error) => {
      console.error('[Bot] Client error:', error);
    });
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand()) {
      await this.handleCommand(interaction);
    } else if (interaction.isButton()) {
      await this.handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await this.handleModal(interaction);
    }
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const commandName = interaction.commandName as keyof typeof commands;
    const command = commands[commandName];

    if (!command) {
      await interaction.reply({
        content: '❌ Unknown command.',
        ephemeral: true,
      });
      return;
    }

    console.log(`[Bot] Command: /${commandName} by ${interaction.user.tag}`);
    await command.execute(interaction, this.blockchain, this.config);
  }

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId.startsWith('verify_')) {
      await commands.verify.handleButton(interaction, this.blockchain, this.config);
    } else if (customId.startsWith('unlink_')) {
      await commands.unlink.handleButton(interaction, this.blockchain, this.config);
    }
  }

  private async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId.startsWith('verify_modal_')) {
      await commands.verify.handleModal(interaction, this.blockchain, this.config);
    }
  }

  async registerCommands(): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(this.token);

    try {
      console.log('[Bot] Registering slash commands...');

      const commandJson = commandData.map((cmd) => cmd.toJSON());

      if (this.guildId) {
        await rest.put(Routes.applicationGuildCommands(this.clientId, this.guildId), {
          body: commandJson,
        });
        console.log(`[Bot] Registered ${commandJson.length} guild commands`);
      } else {
        await rest.put(Routes.applicationCommands(this.clientId), {
          body: commandJson,
        });
        console.log(`[Bot] Registered ${commandJson.length} global commands`);
      }
    } catch (error) {
      console.error('[Bot] Failed to register commands:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    await this.registerCommands();
    await this.client.login(this.token);
  }

  async stop(): Promise<void> {
    console.log('[Bot] Shutting down...');
    this.client.destroy();
  }

  getClient(): Client {
    return this.client;
  }

  getBlockchain(): BlockchainService {
    return this.blockchain;
  }
}
