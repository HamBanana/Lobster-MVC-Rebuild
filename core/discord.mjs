import { Client, Intents } from "discord.js";
//import {DISCORD_TOKEN} from '../../secret.mjs';

export class Discord {
  static client = null;

  constructor() {
    Discord.client = new Client({
      intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_PRESENCES,
        Intents.FLAGS.GUILD_MEMBERS
      ]
    });
  }

  login() {
    return Discord.client.login(process.env.DISCORD_TOKEN);
  }

  addReaction(messageid, reaction) {}
  editMessage(messageid, callback) {}
}
