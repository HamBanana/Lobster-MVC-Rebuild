import { Discord } from "./discord.mjs";
import { DiscordError, warn } from "./error.mjs";

export const channels = {
  "lob-test": "1200927450536890429",
  spam: "949274005511229520",
  "vanilla-codes": "967232458854629408",
  counting: "1135218372091588770",
  "vanilla-game-chat": "883526058236854312",
  "serious-topics": "992089336109617283",
  brainstuff: "1094311608815190038",
  venting: "1007147411552096376",
  lobtest: "1200927450536890429",
  get: (id) => {
    if (!Discord.client) return null;
    return Discord.client.channels.cache.get(id);
  },
};

export const roles = {
  archetype: "969663541911101440",
  "avant-garde": "904440695195070534",
};

export const members = {
  Ham: "330279218543984641",
  get: (id) => {
    if (!Discord.client) return null;
    const user = Discord.client.users.cache.get(id);
    if (!user) {
      warn('members.get: user "' + id + '" is not in cache');
    }
    return user;
  },
};

export const messages = {
  get: (channelId, messageId) => {
    return new Promise((resolve, reject) => {
      if (!Discord.client) {
        return reject(
          new DiscordError("messages.get called before Discord client was ready", {
            code: "CLIENT_NOT_READY",
          })
        );
      }
      const channel = Discord.client.channels.cache.get(channelId);
      if (!channel) {
        return reject(
          new DiscordError(
            'messages.get: channel "' + channelId + '" is not in cache.',
            { code: "CHANNEL_NOT_FOUND" }
          )
        );
      }
      if (!channel.messages || typeof channel.messages.fetch !== "function") {
        return reject(
          new DiscordError(
            'messages.get: channel "' + channelId + '" does not support messages.fetch.',
            { code: "CHANNEL_NO_MESSAGES" }
          )
        );
      }
      channel.messages
        .fetch(messageId)
        .then((message) => resolve(message))
        .catch((err) =>
          reject(
            new DiscordError(
              'messages.get: failed to fetch message "' +
                messageId +
                '" from channel "' +
                channelId +
                '": ' +
                err.message,
              { code: err.code, cause: err }
            )
          )
        );
    });
  },
};
