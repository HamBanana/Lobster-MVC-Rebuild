import { Client, GatewayIntentBits, Collection } from "discord.js";
import { ConfigError, DiscordError, warn } from "./error.mjs";

/*
 * Wrapper around the discord.js Client.
 *
 * Adds:
 *   - DISCORD_TOKEN validation at login time so a missing / blank token
 *     fails with a meaningful message instead of a generic
 *     "TokenInvalid" buried in the discord.js stack.
 *   - client.on('error' | 'shardError' | 'warn') routed through warn()
 *     so transient gateway errors land in log_lobster instead of being
 *     printed as bare stacks (or, for 'warn', dropped silently).
 *   - login() returns a rejected Promise with a DiscordError that carries
 *     the original error as `cause`, so callers can branch on err.code.
 */
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

    // Surface gateway / shard errors. Without these the only feedback was
    // an UnhandledPromiseRejection on a disconnect.
    Discord.client.on("error", (err) => {
      warn(err, { context: { source: "discord client error" } });
    });
    Discord.client.on("shardError", (err, shardId) => {
      warn(err, { context: { source: "discord shardError", shardId } });
    });
    Discord.client.on("warn", (msg) => {
      warn("Discord client warn: " + msg);
    });
    Discord.client.on("invalidated", () => {
      warn(new DiscordError("Discord session was invalidated by the gateway."));
    });
  }

  login() {
    const token = process.env.DISCORD_TOKEN;
    if (!token || typeof token !== "string" || token.trim().length === 0) {
      const err = new ConfigError(
        "Cannot log in: DISCORD_TOKEN is missing or empty."
      );
      warn(err);
      return Promise.reject(err);
    }
    return Discord.client.login(token).catch((err) => {
      // discord.js throws errors like "TokenInvalid", "DisallowedIntents"
      // — preserve the original code while wrapping the message into
      // something we can match on later.
      const wrapped = new DiscordError(
        "Discord login failed: " + (err && err.message ? err.message : String(err)),
        { code: err && err.code ? err.code : "DISCORD_LOGIN_FAILED", cause: err }
      );
      warn(wrapped);
      throw wrapped;
    });
  }
}
