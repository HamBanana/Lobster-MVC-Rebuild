import { Database } from "../core/database.mjs";
import { Model } from "../core/model.mjs";
import { Time } from "../tools/time.mjs";
import { ValidationError, toError, warn } from "../core/error.mjs";

/*
 * In-memory caches.
 *
 * `active_lobbies` is keyed by lobby code. It is hydrated from MySQL on
 * boot (see `lobby_model.hydrate`) and kept in sync with the DB by every
 * mutator below — no caller should reach into MySQL directly without also
 * updating the cache, otherwise `clearOld` will drift.
 *
 * Error contract for callback methods: if a callback gets a non-null first
 * argument, it is *always* an Error instance (not a bare object) so the
 * caller can rely on err.code, err.message, and err.stack.
 */
export class lobby_model extends Model {
  static active_lobbies = {};
  static active_players = {};
  static infohosts = [];
  static subscription_queues = {}; // keyed by host_id → [member_id, ...]

  constructor() {
    super();
  }

  // ---------- one-time hydration --------------------------------------

  static async hydrate() {
    const db = Database.getInstance();
    try {
      const lobbies = await db.p_get("lobby_active_lobbies");
      for (const row of lobbies) {
        lobby_model.active_lobbies[row.code] = { ...row, queue: [] };
      }
    } catch (err) {
      // Hydrating active lobbies is important — if it fails, log loudly
      // but don't kill boot.
      warn(err, { context: { stage: "hydrate active_lobbies" } });
    }
    try {
      const queues = await db.p_get("lobby_queue");
      for (const row of queues) {
        const lobby = lobby_model.active_lobbies[row.lobby_code];
        if (lobby) lobby.queue.push(row.member_id);
      }
    } catch (err) {
      warn(err, { context: { stage: "hydrate lobby_queue" } });
    }
    try {
      const infohosts = await db.p_get("lobby_infohosts");
      for (const row of infohosts) {
        lobby_model.infohosts.push(row.member_id);
      }
    } catch (err) {
      warn(err, { context: { stage: "hydrate lobby_infohosts" } });
    }
    try {
      const subQueue = await db.p_get("lobby_subscription_queue");
      for (const row of subQueue) {
        if (!lobby_model.subscription_queues[row.host_id]) {
          lobby_model.subscription_queues[row.host_id] = [];
        }
        lobby_model.subscription_queues[row.host_id].push(row.member_id);
      }
    } catch (err) {
      warn(err, { context: { stage: "hydrate lobby_subscription_queue" } });
    }
  }

  // ---------- mutators -------------------------------------------------

  create(args, callback) {
    if (!args || !args.code) {
      return callback(new ValidationError("create requires a lobby code"));
    }
    const values = {
      code: args.code,
      server: args.server || null,
      host: args.host,
      creationtime: Time.now,
      pingtime: Time.now,
      is_vc_lobby: args.is_vc_lobby || 0,
      is_vanilla: args.is_vanilla || 1,
      notes: args.notes || "",
    };
    this.db.insert("lobby_active_lobbies", values, (err, res) => {
      if (err) {
        // Don't double-log here — the DB layer already wrapped it; the
        // controller will log via reportError.
        return callback(err, res);
      }
      lobby_model.active_lobbies[args.code] = { ...values, queue: [] };
      return callback(null, values);
    });
  }

  setLobbyState(args, callback) {
    if (!args || !args.code) {
      return callback(
        new ValidationError("Tried to update lobby without a code")
      );
    }
    const { code, ...set } = args;
    this.db.update("lobby_active_lobbies", set, { code }, (err, res) => {
      if (err) return callback(err);
      const cached = lobby_model.active_lobbies[code];
      if (cached) Object.assign(cached, set);
      return callback(null, res);
    });
  }

  getInfohosts(args, callback) {
    if (!args || !args.member_id) {
      return callback(new ValidationError("getInfohosts requires member_id"));
    }
    this.db.get(
      "*",
      "lobby_infohosts",
      { member_id: args.member_id },
      (err, res) => {
        if (err) return callback(err);
        return callback(null, res);
      }
    );
  }

  getLobby(code) {
    return new Promise((resolve, reject) => {
      if (!code) {
        return reject(new ValidationError("getLobby requires a code"));
      }
      this.db.connection.query(
        "SELECT * FROM lobby_active_lobbies WHERE code = ?",
        [code],
        (err, res) => {
          if (err) return reject(toError(err));
          resolve(res[0]);
        }
      );
    });
  }

  delete(args, callback) {
    if (!args || !args.code) {
      return callback(new ValidationError("delete requires a code"));
    }
    const code = args.code;
    const user = args.user;
    this.db.connection.query(
      "SELECT * FROM `lobby_active_lobbies` WHERE UPPER(`code`) = ?",
      [code.toUpperCase()],
      (err, res) => {
        if (err) return callback(toError(err));
        if (!res || res.length === 0) {
          return callback(new ValidationError('Lobby "' + code + '" doesn\'t exist.'));
        }
        if (res[0].host !== user) {
          return callback(new ValidationError('You are not the host of "' + code + '".'));
        }
        const storedCode = res[0].code;
        this.db.delete("lobby_active_lobbies", { code: storedCode }, (delErr) => {
          if (delErr) return callback(delErr);
          this.db.delete("lobby_queue", { lobby_code: storedCode }, (queueDelErr) => {
            if (queueDelErr) {
              warn(queueDelErr, {
                context: { stage: "delete orphan queue rows", code: storedCode },
              });
            }
            delete lobby_model.active_lobbies[storedCode];
            delete lobby_model.active_lobbies[code];
            return callback(null);
          });
        });
      }
    );
  }

  updateLobby(code, values) {
    if (!lobby_model.active_lobbies[code]) {
      return false;
    }
    Object.assign(lobby_model.active_lobbies[code], values);
    return true;
  }

  queue(args, callback) {
    if (!args || !args.code) {
      return callback(new ValidationError("queue requires a code"));
    }
    if (!lobby_model.active_lobbies[args.code]) {
      return callback(
        new ValidationError('The lobby "' + args.code + '" does not exist.')
      );
    }
    if (!lobby_model.active_lobbies[args.code].queue) {
      lobby_model.active_lobbies[args.code].queue = [];
    }
    this.db.insert(
      "lobby_queue",
      {
        member_id: args.member_id,
        join_request_time: Time.now,
        lobby_code: args.code,
        is_infohost: 0,
      },
      (err, res) => {
        if (err) return callback(err, res);
        lobby_model.active_lobbies[args.code]?.queue.push(args.member_id);
        callback(null, res);
      }
    );
  }

  unqueue(args, callback) {
    if (!args || !args.member_id) {
      return callback(new ValidationError("unqueue requires a member_id"));
    }
    if (!args.lobby_code) {
      args.lobby_code = lobby_model.active_players[args.member_id]?.lobby_code;
    }
    if (!args.lobby_code) {
      return callback(
        new ValidationError(
          "unqueue: no lobby_code given and the member is not in any active lobby."
        )
      );
    }
    this.db.delete(
      "lobby_queue",
      { lobby_code: args.lobby_code, member_id: args.member_id },
      (err, res) => {
        if (err) return callback(err, res);
        if (!res || res.affectedRows < 1) {
          return callback(
            new ValidationError(
              "You're not in the lobby \"" + args.lobby_code + '"'
            )
          );
        }
        const arr = lobby_model.active_lobbies[args.lobby_code]?.queue;
        if (!arr) {
          return callback(
            new ValidationError(
              'The lobby "' + args.lobby_code + "\" doesn't exist."
            )
          );
        }
        const idx = arr.indexOf(args.member_id);
        if (idx >= 0) arr.splice(idx, 1);
        delete lobby_model.active_players[args.member_id];
        callback(null, { message: "Unjoin successful" });
      }
    );
  }

  register_infohost(args, callback) {
    if (!args || !args.member_id) {
      return callback(
        new ValidationError("register_infohost requires member_id")
      );
    }
    if (lobby_model.infohosts.includes(args.member_id)) {
      return callback(new ValidationError("You are already infohost."));
    }
    this.db.insert("lobby_infohosts", args, (err, res) => {
      if (!err) lobby_model.infohosts.push(args.member_id);
      return callback(err, res);
    });
  }

  unregister_infohost(args, callback) {
    if (!args || !args.member_id) {
      return callback(
        new ValidationError("unregister_infohost requires member_id")
      );
    }
    if (!lobby_model.infohosts.includes(args.member_id)) {
      return callback(new ValidationError("You are not infohost."));
    }
    this.db.delete(
      "lobby_infohosts",
      { member_id: args.member_id },
      (err, res) => {
        if (!err) {
          // BUGFIX: previous version's filter callback returned undefined,
          // wiping the entire list. Use an arrow expression that returns.
          lobby_model.infohosts = lobby_model.infohosts.filter(
            (e) => e !== args.member_id
          );
        }
        return callback(err, res);
      }
    );
  }

  // ---------- announcement subscriptions ------------------------------
  // Stored in their own table now, so a host can both have an active
  // lobby AND a subscription to auto-announce future lobbies.

  announce(args, callback) {
    if (!args || !args.host) {
      return callback(new ValidationError("announce requires a host"));
    }
    const values = {
      host: args.host,
      is_vanilla: args.is_vanilla ?? 1,
      is_vc_lobby: args.is_vc_lobby ?? 0,
      ongoing: args.ongoing ?? 0,
      creationtime: Time.now,
      scheduled_time: args.scheduled_time || null,
    };
    this.db.insert("lobby_subscriptions", values, (err, res) =>
      callback(err, res)
    );
  }

  queue_for_subscription(args, callback) {
    if (!args || !args.member_id) {
      return callback(new ValidationError("queue_for_subscription requires member_id"));
    }
    this.db.get("*", "lobby_subscriptions", { ongoing: 0 }, (err, rows) => {
      if (err) return callback(err);
      if (!rows || rows.length === 0) {
        const e = new ValidationError("There are no announced games to queue for.");
        e.code = "NO_SUBSCRIPTION";
        return callback(e);
      }
      const host = rows[0].host;
      this.db.insert(
        "lobby_subscription_queue",
        { member_id: args.member_id, host_id: host, join_request_time: Time.now },
        (insertErr) => {
          if (insertErr) return callback(insertErr);
          if (!lobby_model.subscription_queues[host]) {
            lobby_model.subscription_queues[host] = [];
          }
          if (!lobby_model.subscription_queues[host].includes(args.member_id)) {
            lobby_model.subscription_queues[host].push(args.member_id);
          }
          callback(null);
        }
      );
    });
  }

  get_subscription_queue(args, callback) {
    if (!args || !args.host) {
      return callback(new ValidationError("get_subscription_queue requires host"));
    }
    const cached = lobby_model.subscription_queues[args.host];
    if (cached !== undefined) return callback(null, cached);
    this.db.get("member_id", "lobby_subscription_queue", { host_id: args.host }, (err, rows) => {
      if (err) return callback(err);
      const ids = (rows || []).map((r) => r.member_id);
      lobby_model.subscription_queues[args.host] = ids;
      callback(null, ids);
    });
  }

  clear_subscription_queue(args, callback) {
    if (!args || !args.host) {
      return callback(new ValidationError("clear_subscription_queue requires host"));
    }
    this.db.delete("lobby_subscription_queue", { host_id: args.host }, (err) => {
      if (!err) lobby_model.subscription_queues[args.host] = [];
      callback(err);
    });
  }

  editSubscription(args, where) {
    return new Promise((resolve, reject) => {
      this.db
        .p_update("lobby_subscriptions", args, where)
        .then(resolve)
        .catch((err) => reject(toError(err)));
    });
  }

  unannounce(args, callback) {
    if (!args || !args.host) {
      return callback(new ValidationError("unannounce requires a host"));
    }
    this.db.delete(
      "lobby_subscriptions",
      { host: args.host },
      (err, res) => callback(err, res)
    );
  }

  getAnnounced(args, callback) {
    if (!args || !args.host) {
      return callback(new ValidationError("getAnnounced requires a host"));
    }
    this.db.get(
      "*",
      "lobby_subscriptions",
      { host: args.host, ongoing: 0 },
      (err, res) => callback(err, res)
    );
  }

  edit(args, where) {
    return new Promise((resolve, reject) => {
      this.db
        .p_update("lobby_active_lobbies", args, where)
        .then(() => this.db.p_get("lobby_active_lobbies", where, "AND"))
        .then((rows) => {
          // Keep cache aligned.
          if (rows && rows[0]) {
            const cached = lobby_model.active_lobbies[rows[0].code];
            if (cached) Object.assign(cached, args);
          }
          resolve(rows && rows[0]);
        })
        .catch((err) => reject(toError(err)));
    });
  }

  confirm_lobby(args, callback) {
    if (!args || !args.code) {
      return callback(
        new ValidationError(
          "You need to include the lobby code, for now at least."
        )
      );
    }
    const lobby = lobby_model.active_lobbies[args.code];
    if (!lobby) {
      return callback(
        new ValidationError('No active lobby with code "' + args.code + '"')
      );
    }
    lobby.state = args.state;
    let mentions = "";
    for (const mention of lobby.queue || []) {
      mentions += "<@" + mention + "> ";
      this.db.delete(
        "lobby_queue",
        { member_id: mention, lobby_code: args.code },
        (err) => {
          if (err) {
            warn(err, {
              context: {
                stage: "confirm_lobby queue cleanup",
                code: args.code,
                member_id: mention,
              },
            });
          }
        }
      );
    }
    return callback(null, { mentions });
  }

  assign_infohost(args, callback) {
    if (!args || !args.code) {
      return callback(
        new ValidationError("assign_infohost was called with no lobby code")
      );
    }
    this.db.get(
      "*",
      "lobby_infohosts",
      { lobby_code: args.code },
      (err, res) => {
        if (err) return callback(err, res);
        if (res.length < 1) {
          return callback(new ValidationError("No infohosts are available"));
        }
        const lobby = lobby_model.active_lobbies[args.code];
        if (lobby) lobby.infohost = res[0].member_id;
        return callback(null, res[0]);
      }
    );
  }
}
