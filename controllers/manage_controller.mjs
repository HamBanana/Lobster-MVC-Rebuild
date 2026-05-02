import { Controller } from "../core/controller.mjs";
import * as sub from "child_process";
import { logpath, warn, ConfigError } from "../core/error.mjs";

import { Database } from "../core/database.mjs";
import { System } from "../bot/system.mjs";
import { REST, Routes } from "discord.js";

export class manage_controller extends Controller {
  perm = { users: ["330279218543984641"] };

  constructor(msg) {
    super(msg);
    this.auth(this.perm);
    this.controllername = "manage";

    const onWindows = process.platform === "win32";
    if (onWindows) {
      this.safeReply(
        "Lobster is currently running on Windows, don't expect any manage functions to work"
      );
    }

    const root = process.env.LOBSTER_ROOT;
    if (!root) {
      this.safeReply("LOBSTER_ROOT is not set; manage commands won't work.");
      warn(new ConfigError("LOBSTER_ROOT is not set"));
    }
    this.paths = {
      reboot: onWindows ? root + "\\utils\\win_reboot" : root + "/utils/reboot",
      pull: onWindows ? root + "\\utils\\win_pull.bat" : root + "/utils/pull",
      start: onWindows ? root + "\\utils\\win_start.bat" : root + "/utils/start",
    };
  }

  index() {}

  who() {
    sub.exec("whoami", (err, stdout) => {
      if (err) return this.reportError(err, { stage: "manage/who" });
      this.safeReply("I am " + stdout);
    });
  }

  reboot(args) {
    let { update } = this.extractArgs(args, "update");
    const db = Database.getInstance();
    update = update === "true";

    return new Promise((resolve, reject) => {
      const doReboot = () => {
        if (process.platform === "win32") {
          return reject(new Error("Restart Lobster manually on Windows."));
        }
        Promise.resolve(
          this.message.reply("<a:loading:1220396138860122162> Rebooting")
        )
          .then((m) => {
            const promises = [
              db.p_insert("system_vars", { name: "boot_mode", value: "reboot" }),
              db.p_insert("system_vars", {
                name: "boot_channel",
                value: this.message.channelId,
              }),
              db.p_insert("system_vars", {
                name: "boot_message",
                value: m.id,
              }),
            ];
            return Promise.all(promises).then(() => {
              sub.exec(this.paths.reboot, (err) => {
                if (err) {
                  return reject(
                    new Error("Reboot script failed: " + err.message, {
                      cause: err,
                    })
                  );
                }
                resolve(this.message.react("✅"));
              });
            });
          })
          .catch(reject);
      };

      if (update) {
        sub.exec(this.paths.pull, (err) => {
          if (err) {
            return reject(
              new Error("Pull failed before reboot: " + err.message, {
                cause: err,
              })
            );
          }
          doReboot();
        });
      } else {
        doReboot();
      }
    }).catch((err) => this.reportError(err, { stage: "manage/reboot" }));
  }

  // The previous implementation accepted arbitrary SQL from a Discord
  // message and ran it. Removed for safety: even gated to one user it's a
  // single-token compromise away from owning the database. If you need this
  // back, route it through specific named operations or a pre-vetted
  // statement allowlist.
  sql() {
    return this.safeReply(
      "`manage sql` was removed. Add a named operation in manage_controller.mjs " +
        "for the specific query you need."
    );
  }

  setvar(args) {
    const { name, value } = this.extractArgs(args, ["name", "value"]);
    if (!name) {
      return this.safeReply("Usage: !!manage setvar <name> <value>");
    }
    return System.setVar(name, value)
      .then(() => this.message.react("✅"))
      .catch((err) => this.reportError(err, { stage: "manage/setvar", name }));
  }

  getvar(args) {
    const { name } = this.extractArgs(args, "name");
    if (!name) return this.safeReply("Usage: !!manage getvar <name>");
    const value = System.getVar(name);
    if (value === undefined) {
      return this.safeReply('"' + name + '" is not set.');
    }
    return this.safeReply("Value: " + value);
  }

  restart() {
    return new Promise((resolve, reject) => {
      sub.exec("chmod +x " + this.paths.start, (chmodErr) => {
        if (chmodErr) {
          return reject(
            new Error("chmod start failed: " + chmodErr.message, {
              cause: chmodErr,
            })
          );
        }
        if (process.platform === "win32") {
          return reject(new Error("Restart not supported on Windows."));
        }
        let child;
        try {
          child = sub.spawn(this.paths.start, [], { detached: true });
          child.unref();
        } catch (spawnErr) {
          return reject(
            new Error("Failed to spawn start script: " + spawnErr.message, {
              cause: spawnErr,
            })
          );
        }
        Promise.resolve(
          this.message.reply("<a:loading:1220396138860122162> Restarting")
        )
          .then((m) => {
            const timerId = setTimeout(() => {
              m.edit("\\:white_check_mark: Shutting down :)").catch((eErr) =>
                warn(eErr, { context: { stage: "restart timer edit" } })
              );
              process.exit();
            }, 15000);
            child.stdout.on("data", (data) => warn("Restart stdout: " + data));
            child.stderr.on("data", (data) => {
              m.edit("Error: " + data).catch((eErr) =>
                warn(eErr, { context: { stage: "restart stderr edit" } })
              );
            });
            child.on("error", (err) => {
              warn(err, { context: { stage: "restart child error" } });
            });
            child.on("exit", () => {
              clearTimeout(timerId);
              m.edit("\\:white_check_mark: Shutting down :)").catch((eErr) =>
                warn(eErr, { context: { stage: "restart exit edit" } })
              );
              this.message.react("✅").catch((rErr) =>
                warn(rErr, { context: { stage: "restart exit react" } })
              );
              resolve();
            });
          })
          .catch(reject);
      });
    }).catch((err) => this.reportError(err, { stage: "manage/restart" }));
  }

  slash(args) {
    const { action } = this.extractArgs(args, "action");
    switch (action) {
      case "deploy":
        return new Promise((resolve, reject) => {
          const token = process.env.DISCORD_TOKEN;
          const botId = process.env.LOBSTER_ID;
          const serverId = process.env.DARKSIDE_ID;
          if (!token || !botId || !serverId) {
            return reject(
              new ConfigError(
                "slash deploy needs DISCORD_TOKEN, LOBSTER_ID and DARKSIDE_ID to be set."
              )
            );
          }
          const rest = new REST().setToken(token);
          rest
            .put(Routes.applicationGuildCommands(botId, serverId), {
              body: [{ name: "ping", description: "Test if Lobster is alive" }],
            })
            .then((r) => resolve(r))
            .catch((err) => reject(err));
        })
          .then(() => this.message.react("✅"))
          .catch((err) =>
            this.reportError(err, { stage: "manage/slash deploy" })
          );
      default:
        return this.safeReply('Unknown slash action "' + action + '"');
    }
  }

  enable() {
    sub.exec(
      "chmod +x " + process.env.LOBSTER_ROOT + "/utils/*",
      (err) => {
        if (err) return this.reportError(err, { stage: "manage/enable" });
        this.safeReply("Shell scripts can now be executed");
      }
    );
  }

  disable() {
    sub.exec(
      "chmod -x " + process.env.LOBSTER_ROOT + "/utils/*",
      (err) => {
        if (err) return this.reportError(err, { stage: "manage/disable" });
        this.safeReply("Execute permission for shell scripts are removed");
      }
    );
  }

  gitlog() {
    sub.exec(
      "cd " + process.env.LOBSTER_ROOT + " && git log | head -5",
      (err, stdout, stderr) => {
        if (err) return this.reportError(err, { stage: "manage/gitlog" });
        if (stderr) {
          warn("gitlog stderr: " + stderr);
          return this.safeReply("git stderr: " + stderr);
        }
        this.safeReply(stdout || "Nothing here.");
      }
    );
  }

  ppull() {
    return new Promise((resolve, reject) => {
      let child;
      try {
        child = sub.spawn(this.paths.pull);
      } catch (err) {
        return reject(
          new Error("Failed to spawn pull: " + err.message, { cause: err })
        );
      }
      Promise.resolve(
        this.message.reply("<a:loading:1220396138860122162> Beginning pull")
      )
        .then((omsg) => {
          child.on("error", (err) =>
            reject(new Error("Pull child error: " + err.message))
          );
          child.stdout.on("data", (data) =>
            omsg.edit("\\:loading: " + data).catch((e) =>
              warn(e, { context: { stage: "ppull stdout edit" } })
            )
          );
          child.stderr.on("data", (data) =>
            omsg.edit("\\:fail: " + data).catch((e) =>
              warn(e, { context: { stage: "ppull stderr edit" } })
            )
          );
          child.on("exit", (code) => {
            omsg
              .edit("\\:white_check_mark: Pull done (exit " + code + ")")
              .catch((e) => warn(e, { context: { stage: "ppull exit edit" } }));
            resolve();
          });
        })
        .catch(reject);
    }).catch((err) => this.reportError(err, { stage: "manage/ppull" }));
  }

  pull() {
    sub.exec(this.paths.pull, (err, stdout) => {
      if (err) return this.reportError(err, { stage: "manage/pull" });
      warn("Pull: " + stdout);
      this.safeReact("✅");
    });
  }

  run_backup() {
    sub.exec(process.env.LOBSTER_ROOT + "/utils/run_backup", (err) => {
      if (err) return this.reportError(err, { stage: "manage/run_backup" });
      this.safeReact("✅");
    });
  }

  run_main() {
    sub.exec(process.env.LOBSTER_ROOT + "/utils/start", (err) => {
      if (err) return this.reportError(err, { stage: "manage/run_main" });
      this.safeReact("✅");
    });
  }

  backup() {
    sub.exec(process.env.LOBSTER_ROOT + "/utils/backup", (err) => {
      if (err) return this.reportError(err, { stage: "manage/backup" });
      this.safeReact("✅");
    });
  }

  gitstatus() {
    sub.exec(process.env.LOBSTER_ROOT + "/utils/gitstatus", (err, stdout) => {
      if (err) return this.reportError(err, { stage: "manage/gitstatus" });
      this.safeReply("Output: " + stdout);
    });
  }

  kill() {
    Promise.resolve(this.message.reply("Shutting down.."))
      .then(() => process.exit())
      .catch((err) => {
        warn(err, { context: { stage: "manage/kill" } });
        process.exit();
      });
  }

  drop_table(args) {
    const { table } = this.extractArgs(args, "table");
    if (!table) return this.safeReply("Usage: !!manage drop_table <name>");
    const allowed = new Set([
      "lobby_active_lobbies",
      "lobby_queue",
      "lobby_subscriptions",
      "lobby_infohosts",
      "members",
      "counting_session",
    ]);
    if (!allowed.has(table)) {
      return this.safeReply('Refusing to drop unknown table "' + table + '"');
    }
    const db = Database.getInstance();
    db.connection.query("DROP TABLE IF EXISTS ??", [table], (err) => {
      if (err) return this.reportError(err, { stage: "manage/drop_table", table });
      this.safeReact("✅");
    });
  }

  log(args) {
    let { lines, clear } = this.extractArgs(args, "lines");

    if (clear === "true") {
      const success = (err) => {
        if (err) return this.reportError(err, { stage: "manage/log clear" });
        this.safeReact("✅");
      };
      if (process.platform === "win32") {
        sub.exec("rem " + logpath, success);
      } else {
        sub.exec("rm " + logpath, success);
      }
      sub.exec('"" > ' + logpath, (err) => {
        if (err) warn(err, { context: { stage: "manage/log truncate" } });
      });
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
      child.on("error", (err) =>
        this.reportError(err, { stage: "manage/log spawn powershell" })
      );
      child.stdout.on("data", (data) => {
        out += data;
      });
      child.stderr.on("data", (data) => {
        out += "ERROR: " + data;
      });
      child.on("exit", () => {
        this.safeReply(out !== "" ? out : "Log is empty");
      });
    } else {
      sub.exec("tail -" + lines + " " + logpath, (err, stdout) => {
        if (err) return this.reportError(err, { stage: "manage/log tail" });
        this.safeReply("Output: " + stdout);
      });
    }
  }

  // ---------- helpers --------------------------------------------------
  safeReply(text) {
    if (!this.message || typeof this.message.reply !== "function") return;
    return Promise.resolve(this.message.reply(text)).catch((err) =>
      warn(err, { context: { controller: "manage", stage: "safeReply" } })
    );
  }

  safeReact(emoji) {
    if (!this.message || typeof this.message.react !== "function") return;
    return Promise.resolve(this.message.react(emoji)).catch((err) =>
      warn(err, { context: { controller: "manage", stage: "safeReact", emoji } })
    );
  }
}
