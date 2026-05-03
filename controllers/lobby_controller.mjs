import { Controller } from "../core/controller.mjs";
import { lobby_model } from "../models/lobby_model.mjs";
import { Time } from "../tools/time.mjs";
import { channels } from "../core/statics.mjs";
import { warn } from "../core/error.mjs";

import { Database } from "../core/database.mjs";
import {
  ApplicationCommandOptionType,
  SlashCommandBuilder,
} from "discord.js";

export class lobby_controller extends Controller {
  perm = {
    channels: [
      channels["vanilla-game-chat"],
      channels["lob-test"],
      channels["vanilla-codes"],
    ],
  };

  static commands = [
    {
      name: "confirm_lobby",
      alias: "lobby",
      description: "Confirm game has entered lobby.",
      options: [
        {
          name: "code",
          description: "The code of the lobby.",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: "create",
      description: "Creates a new lobby (uses your current Among Us lobby code if omitted)",
      options: [
        { name: "code", description: "The code for joining the lobby", type: ApplicationCommandOptionType.String },
      ],
    },
    {
      name: "delete",
      description: "Deletes a lobby",
      arguments: { code: "The code of the lobby to be deleted." },
    },
    {
      name: "queue",
      description: "Join the queue for a lobby.",
      alias: "join",
      arguments: { code: "The code of the lobby to join" },
    },
    {
      name: "unqueue",
      description: "Leave the queue for a lobby.",
      alias: "unjoin",
      arguments: { code: "The code of the lobby to unjoin from." },
    },
    { name: "list", description: "Shows a list of active_lobbies" },
    { name: "testpresence", description: "Shows what Among Us activity the bot currently sees for you" },
    { name: "state", description: "Dumps active_lobbies cache and DB rows (debug)" },
    {
      name: "announce",
      description:
        "Sets up a trigger that automatically posts the lobby code when you enter a lobby",
      arguments: {
        is_vc_lobby: "true, if the lobby uses voice chat",
        is_vanilla: "true, if the lobby is not modded",
      },
    },
    { name: "unannounce", description: "Removes trigger to post code when you enter a lobby" },
    new SlashCommandBuilder().setName("test").setDescription("test"),
  ];

  constructor(msg) {
    super(msg);
    this.auth(this.perm);
    this.model = new lobby_model();
    this.controllername = "lobby";
  }

  index() {}

  test_input(input) {
    if (input.default[0] === "join") {
      input = input.default.join(" ");
    }
    input = input.toUpperCase();
    const code = /([^\w]|^)(\w{5}[FQ])([^\w]|$)/.exec(input)?.[2];
    if (!code) return;

    if (!lobby_model.active_lobbies[code]) {
      return this.prompt_create({ default: [code] });
    }
    const lc = lobby_model.active_lobbies[code];
    return this.prompt_lobby({ code: lc.code });
  }

  prompt_lobby(args) {
    const code = args.code || args.default?.[0];
    this.view.data = { code };

    this.view.addReaction("✅", () => this.confirm_lobby({ code }));
    this.view.addReaction("❌", (msg) =>
      Promise.resolve(msg.delete()).catch((err) =>
        warn(err, { context: { stage: "prompt_lobby cancel delete" } })
      )
    );

    this.view.template_path = "lobby/prompt_lobby";
    this.post();
  }

  confirm_lobby(args) {
    const code = (args.code || args.default?.[0])?.toUpperCase();
    if (!code) {
      return this._reply("confirm_lobby called with no code.");
    }
    const conf = lobby_model.active_lobbies[code];
    if (!conf) {
      return this._reply("That lobby is no longer active.");
    }
    const state = "In Lobby";
    const host = conf.host;
    const pingtime = Time.now;

    this.model.confirm_lobby({ code, pingtime, state }, (err, res) => {
      if (err) {
        return this.reportError(err, { stage: "lobby/confirm_lobby", code });
      }

      this.view.template_path = "lobby/confirm_lobby";
      const is_vanilla = conf.is_vanilla ? "Yes" : "No";
      const is_vc_lobby = conf.is_vc_lobby ? "Yes" : "No";
      this.view.data = {
        state,
        pingtime,
        host: this.client.users.cache.get(host)?.username || "unknown",
        mentions: res.mentions,
        code,
        is_vanilla,
        is_vc_lobby,
      };
      this.view.type = "channel";
      this.view.channelid = channels["vanilla-game-chat"];
      //this.view.channelid = channels["vanilla-game-chat"];
      lobby_model.active_lobbies[code].queue = [];
      this.post();
    });
  }

  create(args) {
    const host = args.host || this.message?.author?.id;
    let code = (args.code || args.default?.[0])?.toUpperCase();

    if (!code) {
      // Fall back to the user's current Among Us party ID
      const guild = this.client?.guilds?.cache?.first();
      const member = this.message?.member
        || (host && guild?.members?.cache?.get(host));
      const activity = member?.presence?.activities?.find(
        (a) => a.name === "Among Us"
      );
      code = activity?.party?.id?.toUpperCase();
      if (!code) {
        return this._reply(
          "No code provided and you don't appear to be in an Among Us lobby."
        );
      }
    }

    // Performs the actual DB insert and posts the announcement to #vanilla-codes.
    const doCreate = (confirmMsg) => {
      if (confirmMsg) {
        Promise.resolve(confirmMsg.delete()).catch((err) =>
          warn(err, { context: { stage: "create confirm delete" } })
        );
      }
      this.model.create({ code, host }, (err, res) => {
        if (err) {
          switch (err.code) {
            case "ER_DUP_ENTRY":
              return this._reply('Lobby "' + code + '" already exists.');
            case "ER_DATA_TOO_LONG":
              return this._reply('"' + code + '" is too long to be a lobby code');
            default:
              return this.reportError(err, { stage: "lobby/create", code });
          }
        }
        this.view.data = {
          code,
          host: this.client.users.cache.get(host)?.username || "unknown",
          is_vanilla: res.is_vanilla ? "Yes" : "No",
          is_vc_lobby: res.is_vc_lobby ? "Yes" : "No",
          notes: res.notes || "",
          pingtime: res.pingtime,
          mentions: "",
        };
        this.view.reactions = {};
        this.view.template_path = "lobby/confirm_lobby";
        this.view.type = "channel";
        //this.view.channelid = channels["lobtest"];
        this.view.channelid = channels["vanilla-codes"];
        this.post();
      });
    };

    if (this.message) {
      // User-command path: ask for confirmation before creating.
      this.view.data = {
        code,
        host: this.client.users.cache.get(host)?.username || "unknown",
        mentions: "",
      };
      this.view.template_path = "lobby/prompt_create";
      this.view.reaction_options.time = 30000;
      this.view.addReaction("✅", (msg) => doCreate(msg));
      this.view.addReaction("❌", (msg) =>
        Promise.resolve(msg.delete()).catch((err) =>
          warn(err, { context: { stage: "create cancel delete" } })
        )
      );
      this.post();
    } else {
      // Auto-create path (testPresence): no message to reply to, create immediately.
      doCreate(null);
    }
  }

  edit(args) {
    args = this.extractArgs(args);
    this.model
      .edit(args, { host: this.message.author.id })
      .then(() => this._react("👍"))
      .catch((err) => this.reportError(err, { stage: "lobby/edit" }));
  }

  register_infohost() {
    this.model.register_infohost(
      { member_id: this.message.author.id },
      (err) => {
        if (err) {
          return this.reportError(err, { stage: "lobby/register_infohost" });
        }
        return this._reply(
          'Lobster will now use your activity info to ping when lobbies\nYou can use "!lob lobby announce" to automatically ping archetype when lobby starts.'
        );
      }
    );
  }

  unregister_infohost() {
    this.model.unregister_infohost(
      { member_id: this.message.author.id },
      (err) => {
        if (err) {
          return this.reportError(err, { stage: "lobby/unregister_infohost" });
        }
        return this._reply("You are no longer registered as infohost.");
      }
    );
  }

  delete(args) {
    const { code: rawCode } = this.extractArgs(args, "code");
    if (!rawCode) return this._reply("Delete what?");
    const code = rawCode.toUpperCase();
    this.model.delete({ code, user: this.message.author.id }, (err) => {
      if (err) {
        return this.reportError(err, { stage: "lobby/delete", code });
      }
      return this._reply("Deleted: " + code);
    });
  }

  queue(args) {
    const code = (args.code || args.default?.[0])?.toUpperCase();

    const queueFor = (lobbyCode) => {
      this.model.queue(
        { member_id: this.message.author.id, usertag: this.message.author.username, code: lobbyCode },
        (err) => {
          if (err) {
            switch (err.code) {
              case "ER_DUP_ENTRY":
                return this._reply("You are already in the queue.");
              default:
                return this.reportError(err, { stage: "lobby/queue", code: lobbyCode });
            }
          }
          this._react("👍");
        }
      );
    };

    if (code) {
      return queueFor(code);
    }

    const lobbies = Object.values(lobby_model.active_lobbies);

    if (lobbies.length === 0) {
      return this._reply("There are no active lobbies.");
    }

    if (lobbies.length === 1) {
      return queueFor(lobbies[0].code);
    }

    // Multiple active lobbies — let the user pick with number reactions.
    const NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
    const options = lobbies.slice(0, NUMBERS.length);
    const lines = options.map((lob, i) => {
      const hostName = this.client.users.cache.get(lob.host)?.username || lob.host;
      return NUMBERS[i] + " — " + lob.code + " (hosted by " + hostName + ")";
    });
    const listText = "Multiple lobbies are active. React to choose one:\n" + lines.join("\n");

    Promise.resolve(this.message.reply(listText))
      .then((msg) => {
        const addNext = (i) => {
          if (i >= options.length) return;
          Promise.resolve(msg.react(NUMBERS[i])).then(() => addNext(i + 1)).catch((err) =>
            warn(err, { context: { stage: "queue select react", emoji: NUMBERS[i] } })
          );
        };
        addNext(0);

        msg
          .awaitReactions({
            filter: (reaction, user) =>
              user.id === this.message.author.id &&
              options.some((_, i) => reaction.emoji.name === NUMBERS[i]),
            max: 1,
            time: 30000,
          })
          .then((collected) => {
            const picked = collected.first();
            if (!picked) return;
            const idx = NUMBERS.indexOf(picked.emoji.name);
            if (idx === -1 || idx >= options.length) return;
            Promise.resolve(msg.delete()).catch((err) =>
              warn(err, { context: { stage: "queue select delete" } })
            );
            queueFor(options[idx].code);
          })
          .catch(() => {
            Promise.resolve(msg.delete()).catch((err) =>
              warn(err, { context: { stage: "queue select timeout delete" } })
            );
          });
      })
      .catch((err) =>
        warn(err, { context: { stage: "lobby/queue select reply" } })
      );
  }

  unqueue(args) {
    const code = args.code || args.default?.[0];
    if (!code) return this._reply("Unqueue from which lobby?");
    this.model.unqueue(
      { lobby_code: code.toUpperCase(), member_id: this.message.author.id },
      (err) => {
        if (err) {
          return this.reportError(err, { stage: "lobby/unqueue", code });
        }
        return this._react("👍");
      }
    );
  }

  prompt_create(args) {
    this.view.data.code = (args.code || args.default?.[0]).toUpperCase();
    this.view.data.host = args.host || this.message.author.username;
    this.view.data.mentions = "";
    this.view.template_path = "lobby/prompt_create";
    this.view.reaction_options.time = 15000;

    this.view.addReaction("✅", (msg) => {
      const { code, host } = this.view.data;
      Promise.resolve(msg.delete())
        .catch((err) =>
          warn(err, { context: { stage: "prompt_create accept delete" } })
        )
        .then(() => this.create({ code, host }));
    });
    this.view.addReaction("❌", (msg) =>
      Promise.resolve(msg.delete()).catch((err) =>
        warn(err, { context: { stage: "prompt_create cancel delete" } })
      )
    );

    this.post();
  }

  list() {
    if (Object.keys(lobby_model.active_lobbies).length === 0) {
      return this._reply("There are no active lobbies :eyes:");
    }
    for (const v of Object.values(lobby_model.active_lobbies)) {
      Promise.resolve(
        this.message.reply(
          "Hosted by: " +
            v.host +
            "\nCode: " +
            v.code +
            "\nLast active: " +
            Time.getTag(v.pingtime) +
            '\nWrite "!lob join ' +
            v.code +
            '", to join this lobby.'
        )
      ).catch((err) =>
        warn(err, { context: { stage: "lobby/list reply", code: v.code } })
      );
    }
  }

  announce(args) {
    let { is_vanilla, time } = this.extractArgs(args);
    if (!is_vanilla) is_vanilla = 1;

    this.model.announce(
      {
        host: this.message.author.id,
        is_vanilla,
        ongoing: 0,
        scheduled_time: time || null,
      },
      (err) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return this._reply(
              'You have already announced a lobby.\nTo change lobby settings, run "!lob lobby unannounce" first.'
            );
          }
          return this.reportError(err, { stage: "lobby/announce" });
        }
        const timeNote = time ? ` Lobby scheduled for ${time}.` : "";
        this._reply(
          'Lobby announced.' + timeNote +
          '\nMake sure "Share your activity status with others" is enabled in Activity settings.'
        );
      }
    );
  }

  unannounce() {
    this.model.unannounce({ host: this.message.author.id }, (err, res) => {
      if (err) {
        return this.reportError(err, { stage: "lobby/unannounce" });
      }
      if (!res || res.affectedRows < 1) {
        return this._reply("You have no announced lobbies.");
      }
      this._react("👍");
    });
  }

  /**
   * Sweeps stale active lobbies. Runs from system.mjs's setInterval.
   * Now updates the in-memory `active_lobbies` cache when it deletes from
   * the DB, so the two stay aligned.
   *
   * Returns the promise so the caller can attach a single error handler;
   * we also catch ourselves so a transient DB blip never bubbles up as an
   * unhandled rejection.
   */
  static clearOld() {
    const db = Database.getInstance();
    return db
      .p_get("lobby_active_lobbies")
      .then((lobbies) => {
        const work = [];
        for (const lobby of lobbies) {
          if (Time.now - lobby.pingtime > 180000) {
            work.push(
              db
                .p_delete("lobby_active_lobbies", { code: lobby.code })
                .then((res) => {
                  if (res) {
                    delete lobby_model.active_lobbies[lobby.code];
                    warn("Deleted stale lobby: " + lobby.code);
                  }
                })
                .catch((err) =>
                  warn(err, {
                    context: { stage: "clearOld delete", code: lobby.code },
                  })
                )
            );
          }
        }
        return Promise.all(work);
      })
      .catch((err) =>
        warn(err, { context: { stage: "clearOld select" } })
      );
  }

  state() {
    const cached = Object.keys(lobby_model.active_lobbies);
    const cacheStr = cached.length
      ? cached.map((k) => `${k} (host: ${lobby_model.active_lobbies[k].host})`).join(", ")
      : "(empty)";

    const db = this.model.db;
    db.connection.query("SELECT code, host FROM `lobby_active_lobbies`", (err, rows) => {
      const dbStr = err
        ? "DB error: " + err.message
        : rows.length
          ? rows.map((r) => `"${r.code}" (host: ${r.host})`).join(", ")
          : "(empty)";
      this._reply("Cache: " + cacheStr + "\nDB: " + dbStr);
    });
  }

  testpresence(args) {
    const guild = this.client?.guilds?.cache?.first();
    const member = this.message?.member
      || (guild?.members?.cache?.get(this.message?.author?.id));
    const presence = member?.presence;

    if (!presence) {
      return this._reply("I can't see your presence right now (no presence data).");
    }

    const activities = presence.activities;
    if (!activities || activities.length === 0) {
      return this._reply("You have no activities showing.");
    }

    const lines = activities.map((a) => {
      const parts = [a.name];
      if (a.state) parts.push("state: " + a.state);
      if (a.details) parts.push("details: " + a.details);
      if (a.party?.id) parts.push("party: " + a.party.id);
      return parts.join(" | ");
    });

    return this._reply("Presence status: " + presence.status + "\n" + lines.join("\n"));
  }

  handlePresenceUpdate(oldPresence, newPresence) {
    if (oldPresence == null && newPresence == null) return;

    // Find the Among Us activity in either presence — it isn't necessarily
    // activities[0] when the user has Spotify or another rich-presence app
    // running alongside the game.
    const oldAmongUs = oldPresence?.activities?.find((a) => a.name === "Among Us");
    const newAmongUs = newPresence?.activities?.find((a) => a.name === "Among Us");

    // When the host of an active lobby transitions into "In Lobby" from
    // anything else (no activity, "In Menus", "In Game", another app, etc.),
    // automatically run confirm_lobby so everyone in the queue gets pinged.
    // Gate on the queue actually having members so we don't spam the channel
    // on every re-entry to lobby between rounds.
    if (newAmongUs?.state === "In Lobby" && oldAmongUs?.state !== "In Lobby") {
      const hostId = newPresence?.userId;
      if (hostId) {
        for (const lobby of Object.values(lobby_model.active_lobbies)) {
          if (lobby.host !== hostId) continue;
          if (!lobby.queue || lobby.queue.length === 0) continue;
          this.confirm_lobby({ code: lobby.code });
        }
      }
    }

    // The remainder of this method handles the announce-subscription flow,
    // which only cares about Among-Us-to-Among-Us activity transitions.
    const oldActivity = oldPresence?.activities?.[0];
    const newActivity = newPresence?.activities?.[0];

    if (oldActivity && newActivity) {
      if (oldActivity.name !== "Among Us" || newActivity.name !== "Among Us") return;
    }

    if (oldActivity?.state === "In Menus" && newActivity?.state === "In Lobby") {
      this.model.getAnnounced({ host: newPresence.userId }, (err, rows) => {
        if (err) {
          warn(err, {
            context: { stage: "testPresence getAnnounced", host: newPresence.userId },
          });
          return;
        }
        if (!rows || rows.length < 1) return;

        const code = newActivity.party?.id;
        if (!code) {
          warn("testPresence: no party ID in Among Us activity; skipping auto-create");
          return;
        }

        // Mark subscription ongoing so this host doesn't re-trigger until they unannounce.
        this.model
          .editSubscription({ ongoing: 1 }, { host: newPresence.userId })
          .catch((e) =>
            warn(e, { context: { stage: "testPresence editSubscription" } })
          );

        this.create({ code, host: newPresence.userId });
      });
    }

    // The "In Lobby" → "In Game" and inverse transitions used to live here
    // but were `return;`-disabled. Removed entirely until the flow is
    // designed properly.
  }

  // ---------- helpers --------------------------------------------------
  _reply(text) {
    if (!this.message || typeof this.message.reply !== "function") return;
    return Promise.resolve(this.message.reply(text)).catch((err) =>
      warn(err, { context: { controller: "lobby", stage: "_reply" } })
    );
  }

  _react(emoji) {
    if (!this.message || typeof this.message.react !== "function") return;
    return Promise.resolve(this.message.react(emoji)).catch((err) =>
      warn(err, { context: { controller: "lobby", stage: "_react", emoji } })
    );
  }
}
