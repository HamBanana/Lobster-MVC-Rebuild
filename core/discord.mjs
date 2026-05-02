import { Client, GatewayIntentBits, Collection } from "discord.js";

export class Discord {
  static client = null;

  constructor() {
    Discord.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
      ],
    });
    Discord.client.commands = new Collection();
  }

  login() {
    return Discord.client.login(process.env.DISCORD_TOKEN);
  }
}
