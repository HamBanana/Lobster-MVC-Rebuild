import { Client, GatewayIntentBits, Partials } from "discord.js";
//import {DISCORD_TOKEN} from '../../secret.mjs';

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
        GatewayIntentBits.MessageContent
      ], 
      //partials: [Partials.GuildMember, Partials.Channel]
    });
  }

  login() {
    return Discord.client.login(process.env.DISCORD_TOKEN);
  }
}
