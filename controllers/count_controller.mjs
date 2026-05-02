import { Controller } from "../core/controller.mjs";
import { Database } from "../core/database.mjs";
import { channels, members } from "../core/statics.mjs";
import { Discord } from "../core/discord.mjs";

export class count_controller extends Controller {
  perm = { channels: [channels.counting] };

  static last_number;

  session = {
    id: null,
    score: null,
    last_correct: null,
    last_incorrect: null,
    most_active: null,
  };

  constructor(msg) {
    super(msg);
    this.auth(this.perm);

    this.client = Discord.client;
    this.db = Database.getInstance();

    // Schema is created at boot via System.createTables. Just load the latest
    // session here.
    this.db.connection.query(
      "SELECT * FROM counting_session ORDER BY id DESC LIMIT 1",
      (err, res) => {
        if (err) {
          if (this.message) this.message.reply("Error getting latest record: " + err.message);
          return;
        }
        if (res && res[0]) {
          const rec = res[0];
          this.session.id = rec.id;
          this.session.last_correct = rec.last_correct;
          this.session.last_incorrect = rec.last_incorrect;
          this.session.score = rec.score;
          this.session.most_active = rec.most_active;
        } else {
          this.makeNewSession();
        }
      }
    );
  }

  test_string() {
    if (process.platform === "win32") return;
    this.db = Database.getInstance();

    if (this.message.channelId !== channels.counting) return;

    const strtonum = parseInt(this.message.content, 10);
    if (!strtonum || strtonum < 0) return false;

    this.db.connection.query(
      "SELECT * FROM counting_session ORDER BY id DESC LIMIT 1",
      (err, res) => {
        if (err) {
          this.message.reply("Failed getting current value: " + err.message);
          return;
        }

        if (!res || !res[0]) {
          this.makeNewSession();
          return;
        }
        const rec = res[0];
        this.session.id = rec.id;
        this.session.score = rec.score;
        this.session.last_correct = rec.last_correct;
        this.session.last_incorrect = rec.last_incorrect;

        const count = parseInt(rec.score, 10);
        if (strtonum === count + 1) {
          this.session.score = strtonum;
          this.session.last_correct = this.message.author.id;
          this.message.react("✅");
        } else {
          if (!this.session.last_correct || !this.session.last_incorrect) return;
          this.session.last_incorrect = this.message.author.id;
          this.message.reply(
            "Result:\nScore: " +
              this.session.score +
              "\nLast correct number by: " +
              (this.client.users.cache.get(this.session.last_correct)?.username || "Noone") +
              "\nIncorrect number by: " +
              (this.client.users.cache.get(this.session.last_incorrect)?.username || "Noone")
          );
          this.makeNewSession();
          this.message.react("❌");
        }

        this.db.update(
          "counting_session",
          {
            score: this.session.score,
            last_correct: this.session.last_correct,
            last_incorrect: this.session.last_incorrect,
          },
          { id: rec.id },
          () => {
            this.session.score = 0;
          }
        );
      }
    );
  }

  test() {
    console.log(
      "TEST: " +
        JSON.stringify(this.client.users.cache.get("330279218543984641")?.username)
    );
  }

  highscore() {
    return new Promise((resolve, reject) => {
      const db = Database.getInstance();
      db.connection.query(
        "SELECT * FROM counting_session ORDER BY score DESC LIMIT 1",
        (err, res) => {
          if (err) {
            reject(err);
            return;
          }
          const session = res[0];
          this.view.template_path = "count/session";
          this.view.data.score = session.score;
          this.view.data.last_correct = session.last_correct
            ? members.get(session.last_correct)?.username || "Noone"
            : "Noone";
          this.view.data.last_incorrect = session.last_incorrect
            ? members.get(session.last_incorrect)?.username || "Noone"
            : "Noone";
          this.post();
          resolve();
        }
      );
    }).catch((err) => {
      console.error(err);
    });
  }

  set(args) {
    return new Promise((resolve, reject) => {
      const number = args["number"] ? args["number"] : args["default"][0];
      if (this.message.author.id !== "330279218543984641") return;

      this.db.connection.query(
        "SELECT * FROM counting_session ORDER BY id DESC LIMIT 1",
        (err, res) => {
          if (err) {
            this.message.reply("No, because: " + err.message);
            reject("No, because: " + err.message);
            return;
          }
          this.db.update(
            "counting_session",
            { score: parseInt(number, 10) },
            { id: res[0].id },
            (uErr) => {
              if (uErr) {
                this.message.reply("Can't update session, because: " + uErr.message);
                reject(uErr.message);
                return;
              }
              count_controller.last_number = parseInt(number, 10);
              this.message.react("✅");
              resolve();
            }
          );
        }
      );
    });
  }

  makeNewSession() {
    this.db.connection.query(
      "INSERT INTO counting_session VALUES (NULL, 0, NULL, NULL, NULL)"
    );
  }
}
