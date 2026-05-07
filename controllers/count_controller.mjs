import { Controller } from "../core/controller.mjs";
import { Database } from "../core/database.mjs";
import { channels, members } from "../core/statics.mjs";
import { Discord } from "../core/discord.mjs";
import { warn, userMessage } from "../core/error.mjs";

export class count_controller extends Controller {
  // Production: only construct in the dedicated counting channel.
  // Windows test bot: don't gate the constructor on channel — the explicit
  // `submit` entrypoint enforces its own channel restriction (so it can
  // produce a useful reply on mismatch instead of a silent :no: react),
  // and the passive `test_string` path is win32-disabled regardless.
  perm =
    process.platform === "win32"
      ? {}
      : { channels: [channels.counting] };

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
    // Passive trigger from non-command messages. Disabled on the Windows
    // test bot so an idle "5" in some random channel doesn't surprise
    // anyone — explicit testing goes through `submit` instead.
    if (process.platform === "win32") return;
    this.db = Database.getInstance();

    if (this.message.channelId !== channels.counting) return;

    const strtonum = parseInt(this.message.content, 10);
    if (!strtonum || strtonum < 0) return false;

    this.#runCount(strtonum, this.message.author.id);
  }

  // Explicit test entrypoint. Routed to from the parser's numeric
  // shortcut: typing `!!1` on the Windows test bot becomes
  // `count submit 1`, which lands here and exercises the same logic as
  // a real counting message — without needing the production counting
  // channel to exist on the test server. Restricted to the test bot so
  // it can't be used to spoof counting from production.
  submit(args) {
    // `!!`-prefix test commands are gated by author (Ham) only — no
    // channel restriction. The Windows-only check keeps this entrypoint
    // off the production bot so it can't be used to spoof counting from
    // a non-counting channel on prod.
    if (process.platform !== "win32") {
      return this.post(
        "`count submit` is a test-bot command. Just type the number directly in #counting."
      );
    }
    if (this.message.author.id !== members.Ham) {
      return this.post("Only Ham can use `count submit`.");
    }
    this.db = Database.getInstance();

    const raw = (args && args.default && args.default[0]) || "";
    const strtonum = parseInt(raw, 10);
    if (!strtonum || strtonum < 0) {
      return this.post('"' + raw + '" is not a positive integer.');
    }

    this.#runCount(strtonum, this.message.author.id);
  }

  // The actual counting logic. Atomic conditional update: succeed only
  // if the most-recent session's score is exactly strtonum - 1. The
  // nested SELECT is required because MySQL forbids updating a table
  // you're also selecting from in the same statement; wrapping the inner
  // query in a derived table sidesteps that.
  //
  // Doing this in one statement (rather than SELECT-then-UPDATE) closes
  // the race where two correct numbers arriving back-to-back both read
  // the same stale score and the second one was wrongly treated as
  // incorrect — ending the run despite the right number being entered.
  #runCount(strtonum, authorId) {
    this.db.connection.query(
      "UPDATE counting_session " +
        "SET score = ?, last_correct = ? " +
        "WHERE id = (" +
        "  SELECT id FROM (" +
        "    SELECT id FROM counting_session ORDER BY id DESC LIMIT 1" +
        "  ) AS latest" +
        ") AND score = ?",
      [strtonum, authorId, strtonum - 1],
      (err, res) => {
        if (err) {
          warn(err, { context: { stage: "count runCount update" } });
          this.reportError(err, { stage: "runCount" });
          return;
        }

        if (res && res.affectedRows === 1) {
          // Correct: the conditional update matched the latest session and
          // applied atomically.
          this.safeReact("✅");
          return;
        }

        // Either the number was wrong, or no session row exists yet.
        this.#handleWrongOrMissing(authorId);
      }
    );
  }

  // Wrong-number / no-session fallback. Split out so test_string stays
  // focused on the happy path. Always reacts ❌ so the user gets feedback
  // even on fresh sessions where there is nothing to summarize yet — the
  // previous version returned silently in that case, which is why some
  // wrong numbers appeared to "do nothing".
  #handleWrongOrMissing(authorId) {
    this.db.connection.query(
      "SELECT * FROM counting_session ORDER BY id DESC LIMIT 1",
      (selErr, rows) => {
        if (selErr) {
          warn(selErr, { context: { stage: "count handleWrong select" } });
          this.reportError(selErr, { stage: "test_string" });
          return;
        }

        if (!rows || !rows[0]) {
          // No session has ever existed. Bootstrap one and react ❌ so the
          // user knows their number didn't count.
          this.makeNewSession();
          this.safeReact("❌");
          return;
        }

        const rec = rows[0];

        // Only post the "Result:" summary when an actual run was in
        // progress (someone has counted at least one correct number).
        // Otherwise there's nothing meaningful to report.
        if (rec.last_correct) {
          this.safeReply(
            "Result:\nScore: " +
              rec.score +
              "\nLast correct number by: " +
              (this.client.users.cache.get(rec.last_correct)?.username || "Noone") +
              "\nIncorrect number by: " +
              (this.client.users.cache.get(authorId)?.username || "Noone")
          );
        }

        this.makeNewSession();
        this.safeReact("❌");
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
