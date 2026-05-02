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
      description: "Creates a new lobby",
      options: [
        { name: "code", description: "The code for joining the lobby", type: ApplicationCommandOptionType.String },
        { name: "server", description: "The server lobby is hosted on", type: ApplicationCommandOptionType.String },
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

    const match_server =
      /([^\w]|^)((EU|EUR|EUROPE)|(NA|AMERICA|NORTH\sAMERICA|USA|US)|(ASIA))([^\w]|$)/.exec(input);
    let server;
    if (match_server?.[3]) server = "EUROPE";
    if (match_server?.[4]) server = "NORTH AMERICA";
    if (match_server?.[5]) server = "ASIA";

    if (!lobby_model.active_lobbies[code]) {
      return server
        ? this.prompt_create({ default: [code, server] })
        : this.prompt_server({ default: [code] });
    }
    const lc = lobby_model.active_lobbies[code];
    return this.prompt_lobby({ code: lc.code, server: lc.server });
  }

  prompt_lobby(args) {
    const code = args.code || args.default?.[0];
    const server = args.server || args.default?.[1];
    this.view.data = { code, server };

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
    const server = conf.server;
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
        server,
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
      lobby_model.active_lobbies[code].queue = [];
      this.post();
    });
  }

  create(args) {
    if (!(args.code || args.default?.[0]) || !(args.server || args.default?.[1])) {
      return this._reply(
        "create function must follow the format: !lob lobby create {code} {server}"
      );
    }
    const host = args.host || this.message.author.id;
    const code = (args.code || args.default[0]).toUpperCase();
    const server = (args.server || args.default[1]).toUpperCase();
    this.view.data.server = server;
    this.view.data.code = code;
    this.view.data.host = this.message.author.username;
    this.view.data.pingtime = Time.now;
    this.view.data.is_vc_lobby = args.is_vc_lobby || "0";
    this.view.data.is_vanilla = args.is_vanilla || "1";

    this.model.create({ code, server, host }, (err) => {
      if (err) {
        // Specific cases get their own friendly message; everything else
        // funnels through reportError so the operator sees the full error
        // and the user sees a clean translation.
        switch (err.code) {
          case "ER_DUP_ENTRY":
            return this._reply('Lobby "' + code + '" already exists.');
          case "ER_DATA_TOO_LONG":
            return this._reply('"' + code + '" is too long to be a lobby code');
          default:
            return this.reportError(err, { stage: "lobby/create", code });
        }
      }
      this.view.reactions = {};
      this.view.template_path = "lobby/create";
      this.post();
    });
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
    const { code } = this.extractArgs(args, "code");
    if (!code) return this._reply("Delete what?");
    this.model.delete({ code, user: this.message.author.id }, (err) => {
      if (err) {
        return this.reportError(err, { stage: "lobby/delete", code });
      }
      return this._reply("Deleted: " + code);
    });
  }

  queue(args) {
    let code = args.code || args.default?.[0];
    if (!code) {
      return this._reply("You forgot the code :eyes:");
    }
    const q_args = {
      member_id: this.message.author.id,
      usertag: this.message.author.username,
      code: code.toUpperCase(),
    };
    this.model.queue(q_args, (err) => {
      if (err) {
        switch (err.code) {
          case "ER_DUP_ENTRY":
            return this._reply("You are already in the queue.");
          default:
            return this.reportError(err, { stage: "lobby/queue", code });
        }
      }
      this._react("👍");
    });
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
    this.view.data.server = (args.server || args.default?.[1]).toUpperCase();
    this.view.data.code = (args.code || args.default?.[0]).toUpperCase();
    this.view.data.host = args.host || this.message.author.username;
    this.view.template_path = "lobby/prompt_create";
    this.view.reaction_options.time = 15000;

    this.view.addReaction("✅", (msg) => {
      const { code, server, host } = this.view.data;
      Promise.resolve(msg.delete())
        .catch((err) =>
          warn(err, { context: { stage: "prompt_create accept delete" } })
        )
        .then(() => this.create({ code, server, host }));
    });
    this.view.addReaction("❌", (msg) =>
      Promise.resolve(msg.delete()).catch((err) =>
        warn(err, { context: { stage: "prompt_create cancel delete" } })
      )
    );

    this.post();
  }

  prompt_server(args) {
    if (!args.code && !args.default[0]) return;
    this.view.data.code = (args.code || args.default[0]).toUpperCase();
    this.view.data.host = this.message.author.username;

    const setServerAndCreate = (msg, server) => {
      this.view.data.server = server;
      Promise.resolve(msg.delete())
        .catch((err) =>
          warn(err, { context: { stage: "prompt_server " + server + " delete" } })
        )
        .then(() => this.create(this.view.data));
    };

    this.view.addReaction("🇪🇺", (msg) => setServerAndCreate(msg, "EUROPE"));
    this.view.addReaction("🇺🇸", (msg) => setServerAndCreate(msg, "NORTH AMERICA"));
    this.view.addReaction("🇯🇵", (msg) => setServerAndCreate(msg, "ASIA"));
    this.view.addReaction("❌", () => this._reply("Lobby creation cancelled"));

    this.view.template_path = "lobby/prompt_server";
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
            "\n" +
            v.code +
            " - " +
            v.server +
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
    this._reply(
      'Please ensure that you have enabled "Share your activity status with others" in Activity settings'
    );
    let { is_vanilla } = this.extractArgs(args);
    if (!is_vanilla) is_vanilla = 1;

    this.model.announce(
      {
        host: this.message.author.id,
        is_vanilla,
        ongoing: 0,
      },
      (err) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return this._reply(
              'You have already announced a lobby.\nTo change lobby settings, run "!lob lobby edit".'
            );
          }
          return this.reportError(err, { stage: "lobby/announce" });
        }
        this._react("👍");
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

  testPresence(oldPresence, newPresence) {
    if (oldPresence == null && newPresence == null) return;

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
        const sub = rows[0]; // BUGFIX: rows is an array; previous code mixed `res.x` and `res[0].y`.

        this.view.template_path = "lobby/autocreate";
        this.view.data.host =
          this.client.users.cache.get(newPresence.userId)?.username || "unknown";
        this.view.data.code = newActivity.party?.id;
        this.view.data.server = sub.server;
        this.view.data.is_vc_lobby = sub.is_vc_lobby ? "Yes" : "No";
        this.view.data.is_vanilla = sub.is_vanilla ? "Yes" : "No";
        this.view.data.notes = sub.notes || "Not really";
        this.view.data.pingtime = Time.now;
        this.view.data.playercount_current = newActivity.party?.size?.[0];
        this.view.data.playercount_max = newActivity.party?.size?.[1];

        this.view.type = sub.post_message_id ? "edit" : "channel";
        this.view.channelid = sub.post_channel_id || channels["lob-test"];
        if (this.view.type === "edit") {
          this.view.messageId = sub.post_message_id;
        }

        Promise.resolve(this.post())
          .then((message) => {
            const create_vals = {
              code: newActivity.party?.id,
              host: newPresence.userId,
              state: newActivity.state,
              pingtime: Time.now,
              ongoing: 1,
              post_channel_id: sub.post_channel_id || channels["lob-test"],
              post_message_id: sub.post_message_id || message?.id,
            };
            return this.model.edit(create_vals, { host: newPresence.userId });
          })
          .catch((err) =>
            warn(err, { context: { stage: "testPresence post+edit" } })
          );
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
