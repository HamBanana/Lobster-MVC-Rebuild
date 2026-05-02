import { Controller } from "../core/controller.mjs";
import { Database } from "../core/database.mjs";
import { channels, members } from "../core/statics.mjs";
import { Discord } from "../core/discord.mjs";
import { warn, userMessage } from "../core/error.mjs";

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
    this.controllername = "count";

    this.client = Discord.client;
    this.db = Database.getInstance();

    // Schema is created at boot via System.createTables. Just load the latest
    // session here.
    this.db.connection.query(
      "SELECT * FROM counting_session ORDER BY id DESC LIMIT 1",
      (err, res) => {
        if (err) {
          warn(err, { context: { stage: "count_controller load latest" } });
          if (this.message) {
            Promise.resolve(
              this.message.reply("Couldn't load counting session: " + userMessage(err))
            ).catch((rErr) =>
              warn(rErr, { context: { stage: "count load reply" } })
            );
          }
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
          warn(err, { context: { stage: "count test_string select" } });
          this.reportError(err, { stage: "test_string" });
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
          this.safeReact("✅");
        } else {
          if (!this.session.last_correct || !this.session.last_incorrect) return;
          this.session.last_incorrect = this.message.author.id;
          this.safeReply(
            "Result:\nScore: " +
              this.session.score +
              "\nLast correct number by: " +
              (this.client.users.cache.get(this.session.last_correct)?.username || "Noone") +
              "\nIncorrect number by: " +
              (this.client.users.cache.get(this.session.last_incorrect)?.username || "Noone")
          );
          this.makeNewSession();
          this.safeReact("❌");
        }

        this.db.update(
          "counting_session",
          {
            score: this.session.score,
            last_correct: this.session.last_correct,
            last_incorrect: this.session.last_incorrect,
          },
          { id: rec.id },
          (uErr) => {
            if (uErr) {
              warn(uErr, { context: { stage: "count test_string update" } });
              return;
            }
            this.session.score = 0;
          }
        );
      }
    );
  }

  test() {
    warn(
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
          if (err) return reject(err);
          if (!res || !res[0]) {
            return reject(new Error("No counting sessions exist yet."));
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
      this.reportError(err, { stage: "highscore" });
    });
  }

  set(args) {
    return new Promise((resolve, reject) => {
      const number = args["number"] ? args["number"] : args["default"][0];
      if (this.message.author.id !== "330279218543984641") {
        return reject(new Error("Only Ham can set the count."));
      }
      const parsed = parseInt(number, 10);
      if (Number.isNaN(parsed)) {
        return reject(new Error('"' + number + '" is not a number.'));
      }

      this.db.connection.query(
        "SELECT * FROM counting_session ORDER BY id DESC LIMIT 1",
        (err, res) => {
          if (err) return reject(err);
          if (!res || !res[0]) {
            return reject(new Error("No counting session exists yet."));
          }
          this.db.update(
            "counting_session",
            { score: parsed },
            { id: res[0].id },
            (uErr) => {
              if (uErr) return reject(uErr);
              count_controller.last_number = parsed;
              this.safeReact("✅");
              resolve();
            }
          );
        }
      );
    }).catch((err) => {
      this.reportError(err, { stage: "set" });
    });
  }

  makeNewSession() {
    this.db.connection.query(
      "INSERT INTO counting_session VALUES (NULL, 0, NULL, NULL, NULL)",
      (err) => {
        if (err) {
          warn(err, { context: { stage: "makeNewSession insert" } });
        }
      }
    );
  }

  // Helpers used above. Reactions/replies fail silently to the user
  // (with a log entry) so a missing-permissions error doesn't cascade
  // into a second user-facing error.
  safeReact(emoji) {
    if (!this.message || typeof this.message.react !== "function") return;
    Promise.resolve(this.message.react(emoji)).catch((err) =>
      warn(err, { context: { stage: "count safeReact", emoji } })
    );
  }

  safeReply(text) {
    if (!this.message || typeof this.message.reply !== "function") return;
    Promise.resolve(this.message.reply(text)).catch((err) =>
      warn(err, { context: { stage: "count safeReply" } })
    );
  }
}
