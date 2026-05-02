import { Discord } from "../core/discord.mjs";
import * as count from "../controllers/count_controller.mjs";
import { channels, members } from "../core/statics.mjs";
import { lobby_model } from "../models/lobby_model.mjs";
import { Parser } from "./parser.mjs";
import { System } from "./system.mjs";
import { lobby_controller } from "../controllers/lobby_controller.mjs";
import { Events } from "discord.js";

export class Lobster {
  constructor() {
    console.log("Lobster started.");
    const client = Discord.client;

    client.on("messageCreate", (msg) => {
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
          .catch((err) => {
            if (typeof err === "string") err = { message: err };
            console.log("Error code: " + err.code);
            switch (err.code) {
              case "ERR_MODULE_NOT_FOUND":
                return msg.reply("The controller doesn't exist, I guess?");
              case "PERMISSION_DENIED":
                return msg.react("<:no:1047889973631782994>");
              case "ENOENT":
                return msg.reply("That controller doesn't exist");
              case "SILENT":
                return;
              default:
                if (err.message?.includes("is not a valid function of")) {
                  return msg.reply("That function does not exist");
                }
                msg.reply("Error because: " + err.message);
                // BUGFIX: previous code had `... err.stack ? err.stack : "..."`
                // which always evaluated to err.stack due to operator precedence.
                console.log(
                  "Execute command failed:\n" +
                    "Message: " + err.message +
                    "\nCode: " + err.code +
                    "\nStack: " + (err.stack ?? "No stack.")
                );
            }
          });
      } else {
        return import("../controllers/end_controller.mjs")
          .then((module) => new module.end_controller(msg))
          .then((ins) => {
            ins.auth(ins.perm);
            return ins.test_input(msg.content);
          })
          .then(() => {
            try {
              const cc = new count.count_controller(msg);
              cc.test_string();
            } catch (_) {
              // Permission errors etc. for non-counting channels are fine.
            }
          })
          .catch((err) => {
            if (err?.code !== "PERMISSION_DENIED") {
              console.log("Trigger pipeline error: " + (err?.message || err));
            }
          });
      }
    });

    client.on("ready", () => {
      console.log("Logged in as " + client.user.tag);
      const c = client.channels.cache.get(channels["lob-test"]);
      const sys = new System();
      let wm;
      sys
        .createTables()
        // Hydrate in-memory lobby state from the freshly-ensured tables. This
        // prevents `clearOld` from deleting still-active lobbies after a
        // restart.
        .then(() => lobby_model.hydrate())
        .then(() => sys.loadVars())
        .then(() => {
          if (!System.vars.boot_mode) System.vars.boot_mode = "default";
          switch (System.vars.boot_mode) {
            case "default":
              wm = c.send("Hello?");
              break;
            default:
              wm = System.getBootMessage();
              break;
          }
          return wm.then((m) => {
            return sys
              .prepareUtils()
              .then(() => sys.resetBootmode())
              .then(() => {
                if (System.vars.boot_mode === "reboot") {
                  m.edit(":white_check_mark: Reboot complete");
                } else {
                  m.edit(":white_check_mark: Lobster started");
                }
              })
              .catch((err) => {
                console.log("Error on boot: " + err.message);
              });
          });
        })
        .catch((err) => {
          console.log("Something went wrong during boot: " + err.message);
        });
    });

    client.on(Events.InteractionCreate, async (interaction) => {
      const parser = new Parser(interaction);
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName === "lob") {
        const controller = interaction.options.get("controller");
        const method = interaction.options.get("function");

        parser
          .executeCommand({
            controller: controller.value,
            method: method?.value || "index",
            args: { default: [] },
          })
          .catch((err) => {
            console.error(err);
            return interaction.reply("Then this happened: " + err.message);
          });
      }

      if (interaction.commandName === "ping") {
        interaction.reply("Yay :eyes:");
      }
    });

    client.on("presenceUpdate", (oldPresence, newPresence) => {
      if (oldPresence == null && newPresence == null) {
        console.log("presenceUpdate, but no presence is present");
        return;
      }
      const lc = new lobby_controller();
      lc.testPresence(oldPresence, newPresence);
    });

    client.on("messageReactionAdd", (reaction, user) => {
      console.log(user.username + " reacted with: " + reaction.emoji.name);
    });

    client.on("messageReactionRemove", (reaction, user) => {
      console.log(user.username + " removed reaction: " + reaction.emoji.name);
    });
  }
}
