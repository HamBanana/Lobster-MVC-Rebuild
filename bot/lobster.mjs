import { Discord } from "../core/discord.mjs";
import * as count from "../controllers/count_controller.mjs";
import { channels, members } from "../core/statics.mjs";
import { lobby_model } from "../models/lobby_model.mjs";
import { Parser } from "./parser.mjs";
import { System } from "./system.mjs";
import { lobby_controller } from "../controllers/lobby_controller.mjs";
import { warn, userMessage, toError } from "../core/error.mjs";
import { Events } from "discord.js";

/*
 * Top-level event wiring.
 *
 * Every Discord event handler is wrapped in a guard that:
 *   - logs unexpected errors via warn() with rich context
 *   - never lets a handler throw out of the discord.js event loop
 *   - replies with a meaningful, friendly message via userMessage(err)
 *     when the failure originated from a user action (a `!lob` command)
 *
 * The previous implementation printed errors with `console.log` (so they
 * never reached log_lobster) and reported "Error because: {raw message}"
 * to users (so a stack-style message landed in chat).
 */
export class Lobster {
  constructor() {
    warn("Lobster instance created.");
    const client = Discord.client;
    if (!client) {
      // Fail loud here — Bootstrap is supposed to have constructed the
      // client by the time we get here.
      warn("Lobster constructed before Discord.client was set; event handlers not attached.");
      return;
    }

    client.on("messageCreate", (msg) => {
      try {
        if (
          msg.author.bot ||
          msg.channelId === channels["serious-topics"] ||
          msg.channelId === channels.venting || // BUGFIX: was msg.channelID (capital ID).
          msg.content.length > 2000
        ) {
          return;
        }

        let pf;
        const onLinux = process.platform !== "win32";
        if (onLinux) {
          pf = "!lob ";
        } else if (msg.author.id === members.Ham) {
          pf = "!!";
        }
        if (!pf) return;

        if (msg.content.toLowerCase().startsWith(pf)) {
          const parser = new Parser(msg);
          const cmd = msg.content.slice(pf.length);

          parser
            .parseCommand(cmd)
            .then((command) => parser.executeCommand(command))
            .catch((rawErr) => {
              const err = toError(rawErr);
              // Log the full thing for the operator first.
              warn(err, {
                context: {
                  source: "command pipeline",
                  command: cmd,
                  user: msg.author?.username,
                  channelId: msg.channelId,
                },
              });
              // Then translate to a user-facing reply.
              switch (err.code) {
                case "ERR_MODULE_NOT_FOUND":
                  return safeReply(msg, "I don't have a command group called \"" + (err.controller || "that") + "\".");
                case "ERR_FUNCTION_NOT_FOUND":
                  return safeReply(msg, "That command doesn't have that function.");
                case "ERR_INVALID_TOKEN":
                  return safeReply(msg, "That command name has characters I don't accept.");
                case "PERMISSION_DENIED":
                  return safeReact(msg, "<:no:1047889973631782994>");
                case "ENOENT":
                  return safeReply(msg, "I'm missing a file I need for that command.");
                case "SILENT":
                  return;
                default:
                  return safeReply(msg, userMessage(err));
              }
            });
        } else {
          return import("../controllers/end_controller.mjs")
            .then((module) => new module.end_controller(msg))
            .then((ins) => {
              ins.auth(ins.perm);
              //return ins.test_input(msg.content);
            })
            .then(() => {
              try {
                const cc = new count.count_controller(msg);
                cc.test_string();
              } catch (err) {
                // Permission errors etc. for non-counting channels are
                // expected and fine; everything else is worth logging.
                if (err?.code !== "PERMISSION_DENIED") {
                  warn(err, {
                    context: { source: "count_controller passive trigger" },
                  });
                }
              }
            })
            .catch((err) => {
              if (err?.code !== "PERMISSION_DENIED") {
                warn(err, {
                  context: { source: "trigger pipeline (non-command)" },
                });
              }
            });
        }
      } catch (handlerErr) {
        // Anything that escapes the synchronous portion of the handler.
        warn(handlerErr, { context: { source: "messageCreate handler" } });
      }
    });

    client.on("ready", () => {
      try {
        warn("Logged in as " + (client.user && client.user.tag));
        const c = client.channels.cache.get(channels["lob-test"]);
        if (!c) {
          warn(
            "Boot channel \"lob-test\" not in cache — boot announce will be skipped.",
            { context: { channelId: channels["lob-test"] } }
          );
        }
        const sys = new System();
        let wm;
        sys
          .createTables()
          // Add any columns introduced after a table already existed.
          .then(() => sys.migrate())
          // Hydrate in-memory lobby state from the freshly-ensured tables. This
          // prevents `clearOld` from deleting still-active lobbies after a
          // restart.
          .then(() => lobby_model.hydrate())
          .then(() => sys.loadVars())
          .then(() => {
            if (!System.vars.boot_mode) System.vars.boot_mode = "default";
            switch (System.vars.boot_mode) {
              case "default":
                if (c) {
                  wm = c.send("Hello?").catch((sendErr) => {
                    warn(sendErr, { context: { stage: "boot Hello?" } });
                    return null;
                  });
                } else {
                  wm = Promise.resolve(null);
                }
                break;
              default:
                wm = System.getBootMessage();
                break;
            }
            return Promise.resolve(wm).then((m) => {
              return sys
                .prepareUtils()
                .then(() => sys.resetBootmode())
                .then(() => {
                  if (!m || typeof m.edit !== "function") return;
                  if (System.vars.boot_mode === "reboot") {
                    return m.edit(":white_check_mark: Reboot complete");
                  }
                  return m.edit(":white_check_mark: Lobster started");
                })
                .catch((err) => {
                  warn(err, { context: { stage: "boot finalize" } });
                });
            });
          })
          .catch((err) => {
            warn(err, { context: { stage: "boot pipeline" } });
          });
      } catch (err) {
        warn(err, { context: { source: "ready handler" } });
      }
    });

    client.on(Events.InteractionCreate, async (interaction) => {
      try {
        const parser = new Parser(interaction);
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName === "lob") {
          const controller = interaction.options.get("controller");
          const method = interaction.options.get("function");

          if (!controller) {
            await safeInteractionReply(
              interaction,
              "You must specify a controller."
            );
            return;
          }

          parser
            .executeCommand({
              controller: controller.value,
              method: method?.value || "index",
              args: { default: [] },
            })
            .catch((rawErr) => {
              const err = toError(rawErr);
              warn(err, {
                context: {
                  source: "slash /lob",
                  controller: controller.value,
                  method: method?.value || "index",
                  user: interaction.user?.username,
                },
              });
              return safeInteractionReply(interaction, userMessage(err));
            });
        }

        if (interaction.commandName === "ping") {
          await safeInteractionReply(interaction, "Yay :eyes:");
        }
      } catch (err) {
        warn(err, { context: { source: "InteractionCreate handler" } });
      }
    });

    client.on("presenceUpdate", (oldPresence, newPresence) => {
      try {
        if (oldPresence == null && newPresence == null) {
          warn("presenceUpdate fired with no presence on either side");
          return;
        }
        const lc = new lobby_controller();
        lc.handlePresenceUpdate(oldPresence, newPresence);
      } catch (err) {
        warn(err, { context: { source: "presenceUpdate handler" } });
      }
    });

    client.on("messageReactionAdd", (reaction, user) => {
      try {
        warn(
          (user.username || user.id) + " reacted with: " +
          (reaction.emoji?.name || "unknown")
        );
      } catch (err) {
        warn(err, { context: { source: "messageReactionAdd handler" } });
      }
    });

    client.on("messageReactionRemove", (reaction, user) => {
      try {
        warn(
          (user.username || user.id) + " removed reaction: " +
          (reaction.emoji?.name || "unknown")
        );
      } catch (err) {
        warn(err, { context: { source: "messageReactionRemove handler" } });
      }
    });
  }
}

// ---------- helpers ----------------------------------------------------

function safeReply(msg, text) {
  if (!text) return Promise.resolve(null);
  if (!msg || typeof msg.reply !== "function") return Promise.resolve(null);
  return Promise.resolve(msg.reply(text)).catch((err) => {
    warn(err, { context: { stage: "safeReply", text } });
  });
}

function safeReact(msg, emoji) {
  if (!msg || typeof msg.react !== "function") return Promise.resolve(null);
  return Promise.resolve(msg.react(emoji)).catch((err) => {
    warn(err, { context: { stage: "safeReact", emoji } });
  });
}

function safeInteractionReply(interaction, text) {
  if (!text || !interaction || typeof interaction.reply !== "function") {
    return Promise.resolve(null);
  }
  // If we've already replied (e.g. the command did its own reply before
  // erroring), use followUp instead so we don't get an InteractionAlreadyReplied.
  const replyFn =
    interaction.replied || interaction.deferred
      ? interaction.followUp.bind(interaction)
      : interaction.reply.bind(interaction);
  return Promise.resolve(replyFn(text)).catch((err) => {
    warn(err, { context: { stage: "safeInteractionReply", text } });
  });
}
