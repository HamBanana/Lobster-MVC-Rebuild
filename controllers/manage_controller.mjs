import { Controller } from "../core/controller.mjs";
import * as sub from "child_process";
import { logpath } from "../core/error.mjs";

import { warn } from "../core/error.mjs";
import { Database } from "../core/database.mjs";
import { System } from "../bot/system.mjs";
import { REST, Routes } from "discord.js";

export class manage_controller extends Controller {
  perm = { users: ["330279218543984641"] };

  constructor(msg) {
    super(msg);
    this.auth(this.perm);

    const onWindows = process.platform === "win32";
    if (onWindows) {
      this.message.reply(
        "Lobster is currently running on Windows, don't expect any manage functions to work"
      );
    }

    const root = process.env.LOBSTER_ROOT;
    this.paths = {
      reboot: onWindows ? root + "\\utils\\win_reboot" : root + "/utils/reboot",
      pull: onWindows ? root + "\\utils\\win_pull.bat" : root + "/utils/pull",
      start: onWindows ? root + "\\utils\\win_start.bat" : root + "/utils/start",
    };
  }

  index() {}

  who() {
    sub.exec("whoami", (err, stdout) => {
      if (err) throw err;
      this.message.reply("I am " + stdout);
    });
  }

  reboot(args) {
    let { update } = this.extractArgs(args, "update");
    const db = Database.getInstance();
    update = update === "true";

    return new Promise((resolve, reject) => {
      if (update) {
        sub.exec(this.paths.pull, (err) => {
          if (err) {
            reject("Error while pulling for reboot: " + err.message);
            return;
          }
        });
      }
      if (process.platform === "win32") {
        reject("Restart Lobster manually.");
        return;
      }
      this.message.reply("<a:loading:1220396138860122162> Rebooting").then((m) => {
        const promises = [
          db.p_insert("system_vars", { name: "boot_mode", value: "reboot" }),
          db.p_insert("system_vars", { name: "boot_channel", value: this.message.channelId }),
          db.p_insert("system_vars", { name: "boot_message", value: m.id }),
        ];
        Promise.all(promises).then(() => {
          sub.exec(this.paths.reboot, (err) => {
            if (err) {
              reject("Error rebooting: " + err.message);
              return;
            }
            resolve(this.message.react("✅"));
          });
        });
      });
    }).catch((err) => {
      this.message.reply("Error: " + JSON.stringify(err.message));
    });
  }

  // The previous implementation accepted arbitrary SQL from a Discord
  // message and ran it. Removed for safety: even gated to one user it's a
  // single-token compromise away from owning the database. If you need this
  // back, route it through specific named operations or a pre-vetted
  // statement allowlist.
  sql() {
    return this.message.reply(
      "`manage sql` was removed. Add a named operation in manage_controller.mjs " +
        "for the specific query you need."
    );
  }

  setvar(args) {
    const { name, value } = this.extractArgs(args, ["name", "value"]);
    return System.setVar(name, value)
      .then(() => this.message.react("✅"))
      .catch((err) => {
        this.message.reply("Error: " + err.message);
        throw err;
      });
  }

  getvar(args) {
    const { name } = this.extractArgs(args, "name");
    const value = System.getVar(name);
    if (value === undefined) {
      return this.message.reply('"' + name + '" is not set.');
    }
    return this.message.reply("Value: " + value);
  }

  restart() {
    return new Promise((resolve, reject) => {
      sub.exec("chmod +x " + this.paths.start, () => {
        if (process.platform === "win32") return;
        const child = sub.spawn(this.paths.start, [], { detached: true });
        child.unref();
        return this.message
          .reply("<a:loading:1220396138860122162> Restarting")
          .then((m) => {
            const timerId = setTimeout(() => {
              m.edit("\\:white_check_mark: Shutting down :)");
              process.exit();
            }, 15000);
            child.stdout.on("data", (data) => {
              warn("Data: " + data);
            });
            child.stderr.on("data", (data) => {
              m.edit("Error: " + data);
            });
            child.on("exit", () => {
              clearTimeout(timerId);
              m.edit("\\:white_check_mark: Shutting down :)");
              this.message.react("✅");
            });
          });
      });
    }).catch((err) => {
      this.message.reply("Error: " + err.message);
    });
  }

  slash(args) {
    const { action } = this.extractArgs(args, "action");
    switch (action) {
      case "deploy":
        return new Promise((resolve, reject) => {
          const rest = new REST().setToken(process.env.DISCORD_TOKEN);
          const botId = process.env.LOBSTER_ID;
          const serverId = process.env.DARKSIDE_ID;
          rest
            .put(Routes.applicationGuildCommands(botId, serverId), {
              body: [{ name: "ping", description: "Test if Lobster is alive" }],
            })
            .then((r) => resolve(r))
            .catch((err) => reject(err));
        })
          .then(() => this.message.react("✅"))
          .catch((err) => console.error(err));
      default:
        return this.message.reply('Unknown slash action "' + action + '"');
    }
  }

  enable() {
    sub.exec("chmod +x " + process.env.LOBSTER_ROOT + "/utils/*", (err) => {
      if (err) {
        this.message.reply(
          "Error enabling execute permissions to shell scripts: " + err.message
        );
        return;
      }
      this.message.reply("Shell scripts can now be executed");
    });
  }

  disable() {
    sub.exec("chmod -x " + process.env.LOBSTER_ROOT + "/utils/*", (err) => {
      if (err) {
        this.message.reply(
          "Failed removing permissions on shell scripts: " + err.message
        );
        return;
      }
      this.message.reply("Execute permission for shell scripts are removed");
    });
  }

  gitlog() {
    sub.exec("cd " + process.env.LOBSTER_ROOT + " && git log | head -5", (err, stdout, stderr) => {
      if (err) {
        this.message.reply("Error in exec:" + err.message);
        return;
      }
      if (stderr) {
        this.message.reply("stderror in exec:" + stderr);
        return;
      }
      this.message.reply(stdout || "Nothing here.");
    });
  }

  ppull() {
    return new Promise((resolve, reject) => {
      const child = sub.spawn(this.paths.pull);
      this.message.reply("<a:loading:1220396138860122162> Beginning pull").then((omsg) => {
        child.stdout.on("data", (data) => omsg.edit("\\:loading: " + data));
        child.stderr.on("data", (data) => omsg.edit("\\:fail: " + data));
        child.on("exit", () => omsg.edit("\\:white_check_mark: Pull done"));
      });
    }).catch((err) => {
      this.message.reply("Error: " + err.message);
    });
  }

  pull() {
    sub.exec(this.paths.pull, (err, stdout) => {
      if (err) {
        this.message.reply("Error in pull: " + err.message);
        return;
      }
      warn("Pull: " + stdout);
      this.message.react("✅");
    });
  }

  run_backup() {
    sub.exec(process.env.LOBSTER_ROOT + "/utils/run_backup", (err) => {
      if (err) {
        this.message.reply("Error in run_backup: " + err.message);
        return;
      }
      this.message.react("✅");
    });
  }

  run_main() {
    sub.exec(process.env.LOBSTER_ROOT + "/utils/start", (err) => {
      if (err) {
        this.message.reply("Error in run_main: " + err.message);
        return;
      }
      this.message.react("✅");
    });
  }

  backup() {
    sub.exec(process.env.LOBSTER_ROOT + "/utils/backup", (err) => {
      if (err) {
        this.message.reply("Error in backup: " + err.message);
        return;
      }
      this.message.react("✅");
    });
  }

  gitstatus() {
    sub.exec(process.env.LOBSTER_ROOT + "/utils/gitstatus", (err, stdout) => {
      if (err) {
        this.message.reply("Error in gitstatus: " + err.message);
        return;
      }
      this.message.reply("Output: " + stdout);
    });
  }

  kill() {
    this.message.reply("Shutting down..").then(() => {
      process.exit();
    });
  }

  drop_table(args) {
    const { table } = this.extractArgs(args, "table");
    if (!table) return this.message.reply("Usage: !!manage drop_table <name>");
    const allowed = new Set([
      "lobby_active_lobbies",
      "lobby_queue",
      "lobby_subscriptions",
      "lobby_infohosts",
      "members",
      "counting_session",
    ]);
    if (!allowed.has(table)) {
      return this.message.reply('Refusing to drop unknown table "' + table + '"');
    }
    const db = Database.getInstance();
    db.connection.query("DROP TABLE IF EXISTS ??", [table], (err) => {
      if (err) return this.message.reply("Error: " + err.message);
      this.message.react("✅");
    });
  }

  log(args) {
    let { lines, clear } = this.extractArgs(args, "lines");

    if (clear === "true") {
      const success = (err) => {
        if (err) this.message.reply("Log error: " + err.message);
        this.message.react("✅");
      };
      if (process.platform === "win32") {
        sub.exec("rem " + logpath, success);
      } else {
        sub.exec("rm " + logpath, success);
      }
      sub.exec('"" > ' + logpath);
      return;
    }

    if (!lines) lines = 10;
    if (process.platform === "win32") {
      const child = sub.spawn("powershell.exe", [
        process.env.LOBSTER_ROOT +
          "\\utils\\win_logtail.ps1 -path " +
          logpath +
          " -lines " +
          lines,
      ]);
      let out = "";
      child.stdout.on("data", (data) => {
        out += data;
      });
      child.stderr.on("data", (data) => {
        out += "ERROR: " + data;
      });
      child.on("exit", () => {
        this.message.reply(out !== "" ? out : "Log is empty");
      });
    } else {
      sub.exec("tail -" + lines + " " + logpath, (err, stdout) => {
        if (err) return this.message.reply("Can't get log, because: " + err.message);
        this.message.reply("Output: " + stdout);
      });
    }
  }
}
