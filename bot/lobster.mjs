import { Discord } from "../core/discord.mjs";
//import {View} from '../core/view.mjs';
import * as fs from "fs";
import * as count from "../controllers/count_controller.mjs";
import * as gif from "../tools/gif.mjs";
import { channels, members } from "../core/statics.mjs";
import { lobby_model } from "../models/lobby_model.mjs";
import { Parser } from "./parser.mjs";
import { Database } from "../core/database.mjs";
import { System } from "./system.mjs";
import { lobby_controller } from "../controllers/lobby_controller.mjs";
import { Events } from "discord.js";

export class Lobster {
  constructor() {
    console.log("Lobster started.");
    let client = Discord.client;

    let db = Database.getInstance();

    // Listen for Discord events.

    client.on("messageCreate", (msg) => {
      if (
        msg.author.bot ||
        msg.channelId == channels["serious-topics"] ||
        msg.channelID == channels["venting"] ||
        msg.content.length > 2000
      ) {
        return;
      }
      //console.log(msg);
      console.log("\n\nInput: " + JSON.stringify(msg));
      let pf;
      if (process.env.OS == "Linux") {
        pf = "!lob ";
      } else if (process.env.OS == "Windows" && msg.author.id == members.Ham) {
        pf = "!!";
      }

      if (msg.content.toLowerCase().startsWith(pf)) {
        let parser = new Parser(msg);

        console.log("Content before slice: " + msg.content);
        let cmd = msg.content.slice(pf.length, msg.content.length);
        console.log("CMD after slice: " + cmd);

        parser
          .parseCommand(cmd)
          .then((command) => {
            return parser.executeCommand(command);
          })
          .catch((err) => {
            if (typeof err == "string") {
              err = { message: err };
            }
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
                if (err.message.includes("is not a valid function of")) {
                  return msg.reply("That function does not exist");
                }
                msg.reply("Error because: " + err.message);
                console.log(
                  "Execute command failed:\n" +
                    "Message: " +
                    err.message +
                    "\nCode: " +
                    err.code +
                    "\nStack: " +
                    err.stack
                    ? err.stack
                    : "No stack."
                );
                return;
            }
          });
      } else {
        // Test the string for other triggers.
        return import("../controllers/end_controller.mjs")
          .then((module) => {
            return new module.end_controller(msg);
          })
          .then((ins) => {
            ins.auth(ins.perm);
            return ins;
          })
          .then((ins) => {
            return ins.test_input(msg.content);
          })
          .then(() => {
            try {
              let cc = new count.count_controller(msg);
              cc.test_string();
            } catch (error) {
              return;
            }
          })
          .then(() => {
            // input random eyes reaction..
            //if (Math.random() < 0.05){msg.react('👀').catch((err) => {console.log('Failed reacting to a message.')});}
          });
      }
    });

    // When client has logged in
    client.on("ready", (client) => {
      console.log("Logged in as " + client.user.tag);
      let c = client.channels.cache.get("1200927450536890429");
      let wm;
      let sys = new System();
      sys
        .createTables()
        .then(() => {
          return sys.loadVars();
        })
        .then(() => {
          //if (process.env.OS == "Linux") return sys.registerSlashCommands();
        })
        .then(() => {
          console.log("Boot mode is: " + System.vars.boot_mode);
          if (!System.vars.boot_mode) {
            System.vars.boot_mode = "default";
          }
          switch (System.vars.boot_mode) {
            case "default":
              wm = c.send("Hello?");
              break;
            default:
              wm = System.getBootMessage();
              break;
          }
          wm.then((m) => {
            console.log("m: " + JSON.stringify(m));
            // Begin initialization.
            return (
              sys
                .prepareUtils()
                //.then(() => {return sys.pull((data) => {m.edit((data) ? data : 'No data');}).catch((err) => {m.edit('Error in pull: ' + err.message)});})
                .then(
                  sys.resetBootmode /*((data) => {m.edit(data);})*/
                ) /*.catch((err) => {throw err;} )*/
                .then(() => {
                  switch (System.vars.boot_mode) {
                    case "reboot":
                      m.edit(":white_check_mark: Reboot complete");
                      break;
                    default:
                      m.edit(":white_check_mark: Lobster started");
                      break;
                  }
                })
                .catch((err) => {
                  throw err;
                })
            );
          }).catch((err) => {
            //let e_stack = "🥞";
            return console.log("Error on boot: " + err.message);
          });
        })
        .catch((err) => {
          //let e_stack = "🥞";
          return m.edit(
            "Something went wrong during boot: " +
              "\nMessage: " +
              err.message +
              "\nStack: \n" +
              err.stack +
              (err.sql ? "\nSQL: " + err.sql : "")
          );
        });
      // })
    });

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const safeReply = (content) => {
        if (interaction.replied || interaction.deferred) {
          return interaction.followUp({ content, ephemeral: true });
        }
        return interaction.reply({ content, ephemeral: true });
      };

      let parser = new Parser(interaction);

      try {
        if (interaction.commandName === "lob") {
          let controller = interaction.options.get("controller");
          let method = interaction.options.get("function");

          console.log("controllername: " + JSON.stringify(controller));
          console.log("functionname: " + JSON.stringify(method));

          if (!controller) {
            return interaction.reply({ content: "Please specify a controller.", ephemeral: true });
          }

          return await parser
            .executeCommand({
              controller: controller.value,
              method: method?.value || "index",
              args: { default: [] },
            })
            .catch((err) => {
              console.error(err);
              return safeReply("Then this happened: " + err.message);
            });
        }

        if (interaction.commandName === "ping") {
          return interaction.reply("Yay :eyes:");
        }

        // Route individual controller slash commands
        const lobbyCommands = [
          "confirm_lobby", "create", "delete", "queue", "unqueue",
          "list", "announce", "unannounce",
        ];
        if (lobbyCommands.includes(interaction.commandName)) {
          let args = { default: [] };
          for (let opt of interaction.options.data) {
            args[opt.name] = opt.value;
          }
          return await parser
            .executeCommand({
              controller: "lobby",
              method: interaction.commandName,
              args,
            })
            .catch((err) => {
              console.error(err);
              return safeReply("Error: " + err.message);
            });
        }

        if (!interaction.replied) {
          return interaction.reply({ content: "Unknown command.", ephemeral: true });
        }
      } catch (err) {
        console.error("InteractionCreate handler error:", err);
        safeReply("Something went wrong: " + err.message).catch(console.error);
      }
    });

    client.on("presenceUpdate", (oldPresence, newPresence) => {
      //let c = client.channels.cache.get('1200927450536890429');
      if (oldPresence == null && newPresence == null) {
        console.log("presenceUpdate, but no presence is present");
        return;
      }
      //console.log('oldPresence:'+ JSON.stringify(oldPresence || 'oldPresence is null'));
      //console.log('newPresence:'+ JSON.stringify(newPresence || 'newPresence is null'));
      let lc = new lobby_controller();
      lc.testPresence(oldPresence, newPresence);
    });

    /*this.client.on('reactionCreate', (reaction) => {
  console.log('Reaction: '+reaction);
  });*/

    client.on("messageReactionAdd", (reaction, user) => {
      console.log(user.username + " reacted with: " + reaction.emoji.name);
    });

    client.on("messageReactionRemove", (reaction, user) => {
      console.log(user.username + " removed reaction: " + reaction.emoji.name);
    });

    /*this.client.setInterval(() => {
      console.log('setInterval hit..');
    })*/
  }

  interval() {
    /*import('../controllers/lobby_controller.mjs')
    .then((mod) => {
      let ins = new mod.lobby_controller();
      ins.clearOld();
    });*/
  }
}
