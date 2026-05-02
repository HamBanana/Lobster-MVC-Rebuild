import { Controller } from "../core/controller.mjs";
import { Database } from "../core/database.mjs";
import { Discord } from "../core/discord.mjs";

export class my_controller extends Controller {
  // Default values for in-memory state. The schema lives in bot/system.mjs
  // so the table is created exactly once at boot.
  user = {
    id: null,
    preferred_name: null,
    username: null,
    userid: null,
    prefix: "!lob",
  };

  constructor(msg) {
    super(msg);
  }

  index() {
    return new Promise((resolve, reject) => {
      const db = Database.getInstance();
      db.get("*", "members", { userid: this.message.author.id }, (err, res) => {
        if (err) {
          reject(err);
          return;
        }
        const row = res[0];
        if (!row) {
          resolve("No record found. Run \"!lob my create\" first.");
          return;
        }
        const summary =
          "```" +
          "Username: " +
          row.username +
          "\nPreferred name: " +
          row.preferred_name +
          "\nPrefix: " +
          row.prefix +
          "```";
        resolve(summary);
      });
    }).then((user) => {
      this.message.reply("Your config: \n" + user);
    });
  }

  create(args) {
    const client = Discord.client;
    const { name } = this.extractArgs(args, "name");
    const db = Database.getInstance();
    db.insert(
      "members",
      {
        preferred_name: name || "you",
        username: client.users.cache.get(this.message.author.id)?.username || "unknown",
        userid: this.message.author.id,
        prefix: "!lob",
      },
      (err) => {
        if (err) {
          this.message.reply("Couldn't add row: " + err.message);
          return;
        }
        this.message.react("✅");
      }
    );
  }

  forget() {
    const db = Database.getInstance();
    db.delete("members", { userid: this.message.author.id }, (err) => {
      if (err) {
        this.message.reply("Couldn't forget: " + err.message);
        return;
      }
      this.message.react("✅");
    });
  }

  prefix() {
    const db = Database.getInstance();
    db.get("prefix", "members", { userid: this.message.author.id }, (err, res) => {
      if (err) {
        this.message.reply("Couldn't read prefix: " + err.message);
        return;
      }
      const value = res?.[0]?.prefix || this.user.prefix;
      this.message.reply("Your prefix is: " + value);
    });
  }
}
