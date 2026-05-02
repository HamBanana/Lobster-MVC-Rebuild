import { Database } from "./database.mjs";
import { Lobster } from "../bot/lobster.mjs";
import { ConfigError, DatabaseError, warn } from "../core/error.mjs";
import { Discord } from "./discord.mjs";

/*
 * Boot sequence + process-level safety net.
 *
 * Anything that escapes a promise chain or a synchronous handler ends up
 * in `unhandledRejection` / `uncaughtException`. We log them through
 * warn() instead of letting Node print a raw stack and (for uncaught
 * exceptions) exit, so the operator gets a structured entry in
 * log_lobster and the bot keeps running. SIGINT/SIGTERM get a clean
 * acknowledgement so a `kill` shows up in the log.
 */
let _processHandlersInstalled = false;
function installProcessHandlers() {
  if (_processHandlersInstalled) return;
  _processHandlersInstalled = true;

  process.on("unhandledRejection", (reason, promise) => {
    warn(reason, { context: { source: "unhandledRejection" } });
  });

  process.on("uncaughtException", (err) => {
    // Per Node docs, after an uncaughtException the process is in an
    // undefined state — but we'd rather log richly and stay up than crash
    // silently. If something is truly broken we'll see it in the logs.
    warn(err, { context: { source: "uncaughtException" } });
  });

  process.on("warning", (w) => {
    warn(w, { context: { source: "process.warning" } });
  });

  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      warn("Received " + sig + ", shutting down.");
      // Give the log write a moment, then exit. Don't rely on any cleanup
      // chain — this path runs even when the bot is misbehaving.
      setTimeout(() => process.exit(0), 250);
    });
  }
}

export class Bootstrap {
  constructor() {
    warn("Application started.");
  }

  static load() {
    installProcessHandlers();
    warn("Bootstrap.load starting.");

    if (!process.env.DISCORD_TOKEN) {
      // Without a token we can't do anything useful — log loudly and bail
      // before we leave a half-initialised client lying around.
      warn(new ConfigError("DISCORD_TOKEN is not set in the environment."));
      // Don't process.exit — the operator may be running in a watchdog
      // that interprets a clean exit as "stop restarting me".
      return;
    }

    let db;
    try {
      db = Database.getInstance();
    } catch (err) {
      warn(err, { context: { stage: "Database.getInstance" } });
      return;
    }

    // Pools expose getConnection() to test connectivity. On failure we log
    // and continue — Discord still starts for partial functionality.
    db.connection.getConnection((err, conn) => {
      if (err) {
        warn(
          new DatabaseError(
            "Failed to acquire a database connection at boot.",
            { code: err.code, cause: err, operation: "getConnection" }
          )
        );
      } else {
        warn("Database connection established.");
        try {
          conn.release();
        } catch (relErr) {
          warn(relErr, { context: { stage: "boot connection release" } });
        }
      }

      const d = new Discord();
      d.login().catch((loginErr) => {
        // d.login() already logs internally, but catch here too so a
        // failed login can't escape as an unhandled rejection.
        warn(loginErr, { context: { stage: "Discord.login (bootstrap)" } });
      });
      try {
        // eslint-disable-next-line no-new
        new Lobster();
      } catch (botErr) {
        warn(botErr, { context: { stage: "new Lobster()" } });
      }
    });
  }
}
