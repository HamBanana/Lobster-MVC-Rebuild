import { Database } from "../core/database.mjs";
import * as sub from "child_process";
import { Discord } from "../core/discord.mjs";
import { lobby_controller } from "../controllers/lobby_controller.mjs";
import * as fs from "fs";
import path from "path";
import { ApplicationCommandOptionType, REST, Routes } from "discord.js";
import { fileURLToPath } from "url";
import {
  ConfigError,
  DiscordError,
  ValidationError,
  warn,
} from "../core/error.mjs";

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
      scheduled_time: "VARCHAR(10)",
      "PRIMARY KEY": "(host)",
    },
    lobby_subscription_queue: {
      id: "INT AUTO_INCREMENT",
      member_id: "VARCHAR(20)",
      host_id: "VARCHAR(20)",
      join_request_time: "BIGINT",
      "PRIMARY KEY": "(id)",
      "UNIQUE KEY uniq_sub_member": "(member_id, host_id)",
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
    setInterval(() => {
      // Wrap so a thrown error doesn't kill the timer.
      try {
        const ret = lobby_controller.clearOld();
        if (ret && typeof ret.catch === "function") {
          ret.catch((err) =>
            warn(err, { context: { source: "lobby_controller.clearOld" } })
          );
        }
      } catch (err) {
        warn(err, { context: { source: "lobby_controller.clearOld" } });
      }
    }, 10000);
  }

  static setVar(name, value) {
    if (typeof name !== "string" || name.length === 0) {
      return Promise.reject(
        new ValidationError("setVar requires a non-empty name")
      );
    }
    const db = Database.getInstance();
    return db.p_set("system_vars", { name }, { name, value });
  }

  static getVar(name) {
    return System.vars[name];
  }

  createTables() {
    const db = Database.getInstance();
    const promises = Object.entries(this.tables).map(([k, v]) =>
      db.p_create_table(k, v).catch((err) => {
        // Annotate with the table name and rethrow so Promise.all rejects
        // with a useful message instead of just the first failure's text.
        err.message = "createTables failed for " + k + ": " + err.message;
        throw err;
      })
    );
    return Promise.all(promises);
  }

  /**
   * Adds columns that were introduced after a table was first created.
   * Uses INFORMATION_SCHEMA so it's idempotent — safe to run on every boot.
   * Runs after createTables() so the tables are guaranteed to exist first.
   */
  migrate() {
    const db = Database.getInstance();
    const additions = [
      // lobby_active_lobbies columns added after initial table creation
      { table: "lobby_active_lobbies", column: "is_vc_lobby",      definition: "TINYINT(1) DEFAULT 0" },
      { table: "lobby_active_lobbies", column: "is_vanilla",        definition: "TINYINT(1) DEFAULT 1" },
      { table: "lobby_active_lobbies", column: "notes",             definition: "TEXT" },
      { table: "lobby_active_lobbies", column: "state",             definition: "VARCHAR(8)" },
      { table: "lobby_active_lobbies", column: "ongoing",           definition: "TINYINT(1) DEFAULT 0" },
      { table: "lobby_active_lobbies", column: "post_message_id",   definition: "VARCHAR(25)" },
      { table: "lobby_active_lobbies", column: "post_channel_id",   definition: "VARCHAR(25)" },
      { table: "lobby_active_lobbies", column: "voicechat",         definition: "VARCHAR(20)" },
      // lobby_subscriptions columns added after initial table creation
      { table: "lobby_subscriptions",  column: "scheduled_time",    definition: "VARCHAR(10)" },
    ];
    const addColumns = Promise.all(
      additions.map(({ table, column, definition }) =>
        new Promise((resolve) => {
          db.connection.query(
            "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
            [table, column],
            (checkErr, rows) => {
              if (checkErr) {
                warn(checkErr, { context: { stage: "migrate check", table, column } });
                return resolve();
              }
              if (rows && rows[0] && rows[0].cnt > 0) return resolve();
              db.connection.query(
                "ALTER TABLE `" + table + "` ADD COLUMN `" + column + "` " + definition,
                (alterErr) => {
                  if (alterErr) {
                    warn(alterErr, { context: { stage: "migrate alter", table, column } });
                  } else {
                    warn("Migration: added column " + column + " to " + table);
                  }
                  resolve();
                }
              );
            }
          );
        })
      )
    );

    return addColumns;
  }

  pull(onData = () => {}) {
    const onWindows = process.platform === "win32";
    const root = process.env.LOBSTER_ROOT;
    if (!root) {
      return Promise.reject(
        new ConfigError("LOBSTER_ROOT is not set; cannot resolve pull script.")
      );
    }
    const exe = onWindows
      ? root + "\\utils\\win_pull.bat"
      : root + "/utils/pull";
    return new Promise((resolve, reject) => {
      // BUGFIX: the previous version called resolve() inside the if-branch
      // but did not return, so `sub.spawn(exe)` ran anyway.
      if (process.env.NO_GIT_PULL) {
        resolve();
        return;
      }
      let child;
      try {
        child = sub.spawn(exe);
      } catch (err) {
        return reject(
          new ConfigError("Failed to spawn pull script: " + err.message, {
            cause: err,
          })
        );
      }
      child.on("error", (err) => {
        reject(
          new ConfigError("Pull script error: " + err.message, { cause: err })
        );
      });
      child.stdout.on("data", (data) => {
        try {
          onData(data);
        } catch (err) {
          warn(err, { context: { source: "pull onData callback" } });
        }
      });
      child.stderr.on("data", (data) => {
        warn("Pull stderr: " + String(data).trim());
      });
      child.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error("Pull script exited with code " + code));
        } else {
          resolve();
        }
      });
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
      const root = process.env.LOBSTER_ROOT;
      if (!root) {
        return reject(
          new ConfigError(
            "LOBSTER_ROOT is not set; cannot chmod utils directory."
          )
        );
      }
      sub.exec(
        "chmod +x " + root + "/utils/*",
        (err, stdout, stderr) => {
          if (err) {
            return reject(
              new Error(
                "Failed to chmod utils: " + err.message + (stderr ? " (" + stderr + ")" : "")
              )
            );
          }
          if (stderr) {
            // chmod printing to stderr is unusual but not always fatal; log
            // the stderr content but resolve so boot can proceed.
            warn("prepareUtils stderr: " + stderr);
          }
          resolve(stdout);
        }
      );
    });
  }

  npm(onData = () => {}) {
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = sub.spawn("npm install");
      } catch (err) {
        return reject(
          new Error("Failed to spawn npm: " + err.message, { cause: err })
        );
      }
      child.on("error", (err) => {
        reject(new Error("npm error: " + err.message, { cause: err }));
      });
      child.stderr.on("data", (data) => {
        // npm warnings come through stderr — only reject on non-empty data
        // and let the operator see the raw text in the log too.
        warn("npm stderr: " + String(data).trim());
        reject(new Error("npm reported: " + String(data).trim()));
      });
      child.stdout.on("data", (data) => {
        try {
          onData(data);
        } catch (err) {
          warn(err, { context: { source: "npm onData callback" } });
        }
      });
      child.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error("npm exited with code " + code));
        } else {
          resolve();
        }
      });
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
    return Promise.all(
      names.map((name) =>
        db.p_delete("system_vars", { name }).catch((err) => {
          warn(err, {
            context: { stage: "resetBootmode", name },
          });
          // Don't fail the whole boot for a single delete error.
          return null;
        })
      )
    );
  }

  static getBootMessage() {
    return new Promise((resolve, reject) => {
      if (!System.vars.boot_channel || !System.vars.boot_message) {
        return reject(
          new Error("Cannot get boot message: missing boot_channel or boot_message")
        );
      }
      const channel = Discord.client.channels.cache.get(System.vars.boot_channel);
      if (!channel) {
        return reject(
          new DiscordError(
            'Boot channel "' + System.vars.boot_channel + '" not in cache.',
            { code: "CHANNEL_NOT_FOUND" }
          )
        );
      }
      channel.messages
        .fetch(System.vars.boot_message)
        .then(resolve)
        .catch((err) =>
          reject(
            new DiscordError(
              "Couldn't fetch boot message: " + err.message,
              { code: err.code, cause: err }
            )
          )
        );
    }).catch((err) => {
      warn(err, { context: { stage: "getBootMessage" } });
      return null;
    });
  }

  registerSlashCommands = async () => {
    try {
      const botId = process.env.LOBSTER_ID;
      const serverId = process.env.DARKSIDE_ID;
      const token = process.env.DISCORD_TOKEN;
      if (!botId || !serverId || !token) {
        throw new ConfigError(
          "registerSlashCommands requires LOBSTER_ID, DARKSIDE_ID and DISCORD_TOKEN."
        );
      }

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const rest = new REST().setToken(token);
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
        try {
          const controllername = filename.substring(0, filename.indexOf("."));
          const module = await import("../controllers/" + filename);
          const ctrlcommands = module[controllername]?.commands;
          if (ctrlcommands) commands.push(...ctrlcommands);
        } catch (err) {
          warn(err, {
            context: {
              source: "registerSlashCommands import",
              filename,
            },
          });
        }
      });
      await Promise.all(importPromises);
      await rest.put(Routes.applicationGuildCommands(botId, serverId), {
        body: commands,
      });
    } catch (error) {
      warn(error, { context: { stage: "registerSlashCommands" } });
      throw error;
    }
  };
}
