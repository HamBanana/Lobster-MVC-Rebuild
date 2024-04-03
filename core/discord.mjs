import { Client, GatewayIntentBits, Partials, Collection, Events } from "discord.js";
import * as fs from 'node:fs';
import * as path from 'node:path';
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
    Discord.client.commands = new Collection();

    //const foldersPath = path.join(__dirname, 'commands');
    const foldersPath = process.env.LOBSTER_ROOT + '\\commands'
  }

  login() {
    return Discord.client.login(process.env.DISCORD_TOKEN);
  }
}
