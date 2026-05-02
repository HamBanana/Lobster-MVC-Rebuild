import { Database } from "./database.mjs";
import { Lobster } from "../bot/lobster.mjs";
import { warn } from "../core/error.mjs";
import { Discord } from "./discord.mjs";

export class Bootstrap {
  constructor() {
    warn("Application started.");
  }

  static load() {
    const db = Database.getInstance();

    // Pools expose getConnection() to test connectivity. On failure we log
    // and continue — Discord still starts for partial functionality.
    db.connection.getConnection((err, conn) => {
      if (err) {
        warn("Failed to get database connection: " + err.code + " - " + err.message);
      } else {
        warn("Database connection established.");
        conn.release();
      }

      const d = new Discord();
      d.login();
      // eslint-disable-next-line no-new
      new Lobster();
    });
  }
}
