import { Database } from "../core/database.mjs";
import * as sub from "child_process";
import { Discord } from "../core/discord.mjs";
import { lobby_controller } from "../controllers/lobby_controller.mjs";
import * as fs from "fs";
import path from "path";
import { ApplicationCommandOptionType, REST, Routes } from "discord.js";
import { fileURLToPath } from "url";

export class System {
  os = process.platform;
  root = process.env.LOBSTER_ROOT;

  static vars = { boot_mode: "default" };

  // Schema for tables we own. Column definitions are trusted (they live in
  // code); only the column *names* and table name are routed through ?? in
  // Database#create_table.
  tables = {
    lobby_active_lobbies: {
      id: "INT AUTO_INCREMENT NOT NULL",
      code: "CHAR(6) UNIQUE",
      server: "VARCHAR(20)",
      creationtime: "BIGINT",
      pingtime: "BIGINT",
      voicechat: "VARCHAR(20)",
      // BUGFIX: previously UNIQUE on host, which prevented hosts from
      // ever creating a second lobby (and conflated with the announce
      // table). Drop the UNIQUE constraint here.
      host: "VARCHAR(20)",
      is_vc_lobby: "TINYINT(1)",
      is_vanilla: "TINYINT(1)",
      notes: "TEXT",
      state: "VARCHAR(8)",
      ongoing: "TINYINT(1)",
      post_message_id: "VARCHAR(25)",
      post_channel_id: "VARCHAR(25)",
      "PRIMARY KEY": "(id)",
    },
    // BUGFIX: lobby_queue.member_id was UNIQUE — meant a user could be in
    // exactly one queue across all lobbies. Composite uniqueness is what
    // we actually want.
    lobby_queue: {
      id: "INT AUTO_INCREMENT",
      member_id: "VARCHAR(20)",
      join_request_time: "BIGINT",
      lobby_code: "VARCHAR(6)",
      is_infohost: "TINYINT(1)",
      "PRIMARY KEY": "(id)",
      "UNIQUE KEY uniq_member_lobby": "(member_id, lobby_code)",
    },
    // New table — split out of lobby_active_lobbies. Stores per-host
    // preferences for auto-announcing on lobby state changes.
    lobby_subscriptions: {
      host: "VARCHAR(20) NOT NULL",
      is_vanilla: "TINYINT(1) DEFAULT 1",
      is_vc_lobby: "TINYINT(1) DEFAULT 0",
      ongoing: "TINYINT(1) DEFAULT 0",
      creationtime: "BIGINT",
      server: "VARCHAR(20)",
      notes: "TEXT",
      post_channel_id: "VARCHAR(25)",
      post_message_id: "VARCHAR(25)",
      "PRIMARY KEY": "(host)",
    },
    lobby_infohosts: {
      member_id: "VARCHAR(20) NOT NULL",
      "PRIMARY KEY": "(member_id)",
    },
    system_vars: {
      name: "VARCHAR(32) UNIQUE",
      value: "TEXT",
    },
    boot_flags: {
      flag: "INT UNIQUE",
      "PRIMARY KEY": "(flag)",
    },
    // The tables previously created from inside the controllers' constructors
    // are bootstrapped here too, so each controller doesn't need to issue
    // CREATE TABLE on every Discord message.
    counting_session: {
      id: "INT AUTO_INCREMENT",
      score: "INT",
      last_correct: "VARCHAR(21)",
      last_incorrect: "VARCHAR(21)",
      most_active: "VARCHAR(21)",
      "PRIMARY KEY": "(id)",
    },
    members: {
      id: "INT AUTO_INCREMENT",
      preferred_name: "VARCHAR(64)",
      username: "VARCHAR(64)",
      userid: "VARCHAR(21) UNIQUE",
      prefix: "VARCHAR(21)",
      "PRIMARY KEY": "(id)",
    },
  };

  constructor() {
    this.db = Database.getInstance();
    setInterval(lobby_controller.clearOld, 10000);
  }

  static setVar(name, value) {
    const db = Database.getInstance();
    return db.p_set("system_vars", { name }, { name, value });
  }

  static getVar(name) {
    return System.vars[name];
  }

  createTables() {
    return new Promise((resolve, reject) => {
      const db = Database.getInstance();
      const promises = Object.entries(this.tables).map(([k, v]) =>
        db.p_create_table(k, v)
      );
      Promise.all(promises).then(() => resolve()).catch(reject);
    });
  }

  pull(onData = () => {}) {
    const onWindows = process.platform === "win32";
    const exe = onWindows
      ? process.env.LOBSTER_ROOT + "\\utils\\win_pull.bat"
      : process.env.LOBSTER_ROOT + "/utils/pull";
    return new Promise((resolve) => {
      // BUGFIX: the previous version called resolve() inside the if-branch
      // but did not return, so `sub.spawn(exe)` ran anyway.
      if (process.env.NO_GIT_PULL) {
        resolve();
        return;
      }
      const child = sub.spawn(exe);
      child.stdout.on("data", (data) => onData(data));
      child.on("exit", () => resolve());
    });
  }

  prepareUtils() {
    return new Promise((resolve, reject) => {
      // BUGFIX: same shape as pull() — early resolve without return
      // continued executing chmod afterwards.
      if (process.platform === "win32") {
        resolve();
        return;
      }
      sub.exec(
        "chmod +x " + process.env.LOBSTER_ROOT + "/utils/*",
        (err, stdout, stderr) => {
          if (err || stderr) {
            reject(err || new Error(stderr));
            return;
          }
          resolve(stdout);
        }
      );
    });
  }

  npm(onData = () => {}) {
    return new Promise((resolve, reject) => {
      const child = sub.spawn("npm install");
      child.stderr.on("data", (data) => reject(data));
      child.stdout.on("data", (data) => onData(data));
      child.on("exit", () => resolve());
    });
  }

  loadVars() {
    const db = Database.getInstance();
    return db.p_get("system_vars").then((res) => {
      for (const row of res) System.vars[row.name] = row.value;
      return res;
    });
  }

  resetBootmode() {
    const db = Database.getInstance();
    const names = ["boot_mode", "boot_channel", "boot_message"];
    return Promise.all(names.map((name) => db.p_delete("system_vars", { name })));
  }

  static getBootMessage() {
    return new Promise((resolve, reject) => {
      if (!System.vars.boot_channel || !System.vars.boot_message) {
        reject(new Error("Cannot get boot message"));
        return;
      }
      const channel = Discord.client.channels.cache.get(System.vars.boot_channel);
      channel.messages.fetch(System.vars.boot_message).then(resolve).catch(reject);
    }).catch((err) => {
      console.log("Can't get boot message, because: " + err.message);
    });
  }

  registerSlashCommands = async () => {
    try {
      const botId = process.env.LOBSTER_ID;
      const serverId = process.env.DARKSIDE_ID;

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const rest = new REST().setToken(process.env.DISCORD_TOKEN);
      const ctrldir = __dirname + "/../controllers/";

      // BUGFIX: previous code used callback-style fs.readdir with `await`
      // wrapping it, which never blocked. Use the promise variant.
      const files = await fs.promises.readdir(ctrldir);
      const commands = [
        {
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
        },
      ];

      const importPromises = files.map(async (filename) => {
        const controllername = filename.substring(0, filename.indexOf("."));
        const module = await import("../controllers/" + filename);
        const ctrlcommands = module[controllername]?.commands;
        if (ctrlcommands) commands.push(...ctrlcommands);
      });
      await Promise.all(importPromises);
      await rest.put(Routes.applicationGuildCommands(botId, serverId), {
        body: commands,
      });
    } catch (error) {
      console.error(error);
    }
  };
}
