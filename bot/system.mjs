import { Database } from "../core/database.mjs";
import * as sub from "child_process";
import { Discord } from "../core/discord.mjs";
import { lobby_controller } from "../controllers/lobby_controller.mjs";
import * as fs from "fs";
import path from "path";
import { ApplicationCommandOptionType, REST, Routes } from "discord.js";
import { fileURLToPath } from "url";

export class System {
  os = process.env.OS;
  root = process.env.LOBSTER_ROOT;

  static vars = { boot_mode: "default" };
  /* Not using these yet
    static boot_flags = [];
    static BootFlag = Object.freeze({
        NPM_INSTALL: 1,
        GIT_PULL: 2
    });
    */

  tables = {
    lobby_active_lobbies: {
      id: "INT AUTO_INCREMENT NOT NULL",
      code: "CHAR(6) UNIQUE",
      server: "VARCHAR(20)",
      creationtime: "BIGINT",
      pingtime: "BIGINT",
      voicechat: "VARCHAR(20)",
      host: "VARCHAR(20) UNIQUE",
      is_vanilla: "TINYINT(1)",
      notes: "TEXT",
      state: "varchar(8)",
      ongoing: "tinyint(1)",
      post_message_id: "varchar(25)",
      post_channel_id: "varchar(25)",
      "PRIMARY KEY": "(id)",
    },
    lobby_queue: {
      id: "INT AUTO_INCREMENT",
      member_id: "VARCHAR(20) UNIQUE",
      join_request_time: "BIGINT",
      lobby_code: "VARCHAR(6)",
      "PRIMARY KEY": "(id)",
    },
    system_vars: {
      name: "VARCHAR(32) UNIQUE",
      value: "TEXT",
    },
    boot_flags: {
      flag: "INT UNIQUE",
      "PRIMARY KEY": "(flag)",
    },
  };

  constructor() {
    this.db = Database.getInstance();
    setInterval(lobby_controller.clearOld, 10000);
  }

  static setVar(name, value) {
    let db = Database.getInstance();
    return new Promise((resolve, reject) => {
      return db
        .p_set("system_vars", { name, value })
        .then((res) => {
          resolve(res);
        })
        .catch((err) => {
          reject();
        });
    });
  }

  static getVar(name) {
    return System.vars[name];
  }

  createTables(onData = () => {}) {
    return new Promise((resolve, reject) => {
      let db = Database.getInstance();
      let createpromises = [];
      for (let [k, v] of Object.entries(this.tables)) {
        let p = db.p_create_table(k, v).then((res) => {
          onData(res);
        });
        createpromises.push(p);
      }
      Promise.all(createpromises)
        .then(() => {
          resolve();
        })
        .catch((err) => {
          throw err;
        });
    }).catch((err) => {
      throw err;
    });
  }

  pull(onData = () => {}) {
    let w = process.env.OS == "Windows";
    let path = w
      ? process.env.LOBSTER_ROOT + "\\utils\\win_pull.bat"
      : process.env.LOBSTER_ROOT + "/utils/pull";
    return new Promise((resolve, reject) => {
      if (process.env.NO_GIT_PULL) {
        resolve();
      }
      let child = sub.spawn(path);
      //child.stderr.on('data', (data) => {reject(data);});
      child.stdout.on("data", (data) => {
        onData(data);
      });
      child.on("exit", () => {
        resolve();
      });
    }).catch((err) => {
      throw err;
    });
  }

  prepareUtils() {
    return new Promise((resolve, reject) => {
      if (process.env.OS == "Windows") {
        resolve();
      }
      sub.exec(
        "chmod +x " + process.env.LOBSTER_ROOT + "/utils/*",
        (err, stdout, stderr) => {
          if (err || stderr) {
            reject(err);
            return;
          }
          resolve(stdout);
        }
      );
    }).catch((err) => {
      throw err;
    });
  }

  npm(onData = () => {}) {
    return new Promise((resolve, reject) => {
      let child = sub.spawn("npm install");
      child.stderr.on("data", (data) => {
        reject(data);
      });
      child.stdout.on("data", (data) => {
        onData(data);
      });
      child.on("exit", () => {
        resolve();
      });
    }).catch((err) => {
      throw err;
    });
  }

  loadVars() {
    return new Promise((resolve, reject) => {
      let db = Database.getInstance();
      db.p_get("system_vars")
        .then((res) => {
          for (let i in res) {
            System.vars[res[i].name] = res[i].value;
          }
          resolve(res);
        })
        .catch((err) => {
          throw err;
        });
    });
  }

  resetBootmode(onData = (data) => {}) {
    return new Promise((resolve, reject) => {
      let db = Database.getInstance();
      console.log("resetBootmode is running");
      let promises = [];
      promises.push(
        db.p_delete("system_vars", { name: "boot_mode" }).then((res) => {
          console.log("Boot_mode deleted");
          // onData('Boot_mode deleted');
        })
      );
      promises.push(
        db.p_delete("system_vars", { name: "boot_channel" }).then((res) => {
          console.log("Boot_channel deleted");
          // onData('Boot_channel deleted');
        })
      );
      promises.push(
        db.p_delete("system_vars", { name: "boot_message" }).then((res) => {
          console.log("Boot_message deleted");
          // onData('Boot_message deleted');
        })
      );

      Promise.all(promises)
        .then(() => {
          // onData('Bootmode is reset');
          db.p_get("system_vars").then((res) => {
            console.log("Vars after delete: " + JSON.stringify(res));
          });
          resolve();
        })
        .catch((err) => {
          throw new Error(
            "Promise.all in resetBootmode failed because: " + err.message
          );
        });
    });
  }

  static getBootMessage() {
    return new Promise((resolve, reject) => {
      if (!System.vars.boot_channel || !System.vars.boot_message) {
        reject("Cannot get boot message");
      }
      let channel = Discord.client.channels.cache.get(System.vars.boot_channel);
      channel.messages.fetch(System.vars.boot_message).then((m) => {
        console.log("Boot message:\n" + JSON.stringify(m));
        resolve(m);
      });
    }).catch((err) => {
      console.log("Can't get boot message, because: " + err.message);
    });
  }

  registerSlashCommands = async () => {
    try {
      const botId = process.env.LOBSTER_ID;
      const serverId = process.env.DARKSIDE_ID;

      let __filename = fileURLToPath(import.meta.url);
      let __dirname = path.dirname(__filename);

      let rest = new REST().setToken(process.env.DISCORD_TOKEN);
      let ctrldir = __dirname + "/../controllers/";

      let importpromises = [];

      await fs.readdir(ctrldir, async (err, res) => {
        if (err) {
          return console.error(err);
        }

        let commands = [];
        /*******  Default commands *******/
        commands.push({
          name: "lob",
          description: "Run message-based command as slash-command",
          options: [
            {
              name: "controller",
              description: "The category of function",
              type: ApplicationCommandOptionType.String,
              required: true,
            },
            {
              name: "function",
              description: "The function to call",
              type: ApplicationCommandOptionType.String,
            },
          ],
        });

        for (let i in res) {
          let filename = res[i];
          let commandname = res[i].substring(0, res[i].indexOf("_"));
          let controllername = res[i].substring(0, res[i].indexOf("."));

          importpromises.push(
            import("../controllers/" + filename)
              .then((module) => {
                let ctrlcommands = module[controllername].commands;
                if (ctrlcommands) {
                  commands.push(...ctrlcommands);
                }
              })
              .catch((err) => {
                throw err;
              })
          );
        }

        Promise.all(importpromises).then(async () => {
          await rest.put(Routes.applicationGuildCommands(botId, serverId), {
            body: commands,
          });
        });
      });
    } catch (error) {
      console.error(error);
    }
  };
}
