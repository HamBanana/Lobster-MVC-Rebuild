import { Database } from "../core/database.mjs";
import { Model } from "../core/model.mjs";
import { Time } from "../tools/time.mjs";

/*
 * In-memory caches.
 *
 * `active_lobbies` is keyed by lobby code. It is hydrated from MySQL on
 * boot (see `lobby_model.hydrate`) and kept in sync with the DB by every
 * mutator below — no caller should reach into MySQL directly without also
 * updating the cache, otherwise `clearOld` will drift.
 */
export class lobby_model extends Model {
  static active_lobbies = {};
  static active_players = {};
  static infohosts = [];

  constructor() {
    super();
  }

  // ---------- one-time hydration --------------------------------------

  static async hydrate() {
    const db = Database.getInstance();
    const lobbies = await db.p_get("lobby_active_lobbies");
    for (const row of lobbies) {
      lobby_model.active_lobbies[row.code] = { ...row, queue: [] };
    }
    try {
      const queues = await db.p_get("lobby_queue");
      for (const row of queues) {
        const lobby = lobby_model.active_lobbies[row.lobby_code];
        if (lobby) lobby.queue.push(row.member_id);
      }
    } catch (err) {
      console.log("hydrate: lobby_queue not ready yet:", err.message);
    }
    try {
      const infohosts = await db.p_get("lobby_infohosts");
      for (const row of infohosts) {
        lobby_model.infohosts.push(row.member_id);
      }
    } catch (err) {
      console.log("hydrate: lobby_infohosts not ready yet:", err.message);
    }
  }

  // ---------- mutators -------------------------------------------------

  create(args, callback) {
    const values = {
      code: args.code,
      server: args.server || "Unknown",
      host: args.host,
      creationtime: Time.now,
      pingtime: Time.now,
      is_vc_lobby: args.is_vc_lobby || 0,
      is_vanilla: args.is_vanilla || 1,
      notes: args.notes || "",
    };
    this.db.insert("lobby_active_lobbies", values, (err, res) => {
      if (err) {
        console.log("Error while inserting new active lobby: " + err.message);
        return callback(err, res);
      }
      lobby_model.active_lobbies[args.code] = { ...values, queue: [] };
      return callback(err, values);
    });
  }

  setLobbyState(args, callback) {
    if (!args.code) {
      return callback({ message: "Tried to update lobby, without a code" });
    }
    const { code, ...set } = args;
    this.db.update("lobby_active_lobbies", set, { code }, (err, res) => {
      if (err) return callback(err);
      const cached = lobby_model.active_lobbies[code];
      if (cached) Object.assign(cached, set);
      return callback(err, res);
    });
  }

  getInfohosts(args, callback) {
    this.db.get("*", "lobby_infohosts", { member_id: args.member_id }, (err, res) => {
      if (err) return callback(err);
      return callback(err, res);
    });
  }

  getLobby(code) {
    return new Promise((resolve, reject) => {
      this.db.connection.query(
        "SELECT * FROM lobby_active_lobbies WHERE code = ?",
        [code],
        (err, res) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(res[0]);
        }
      );
    });
  }

  delete(args, callback) {
    const code = args.code;
    const user = args.user;
    this.db.get("*", "lobby_active_lobbies", { host: user, code }, (err, res) => {
      if (err) return callback(err);
      if (res.length === 0) {
        return callback({
          message:
            'Can\'t delete "' + code + '": the lobby doesn\'t exist, or you are not host.',
        });
      }
      this.db.delete("lobby_active_lobbies", { code }, (delErr) => {
        if (delErr) return callback(delErr);
        this.db.delete("lobby_queue", { lobby_code: code }, () => {
          delete lobby_model.active_lobbies[code];
          return callback();
        });
      });
    });
  }

  updateLobby(code, values) {
    if (!lobby_model.active_lobbies[code]) {
      return false;
    }
    Object.assign(lobby_model.active_lobbies[code], values);
    return true;
  }

  queue(args, callback) {
    if (!lobby_model.active_lobbies[args.code]) {
      return callback({
        message: 'The lobby "' + args.code + '" does not exist.',
      });
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
        callback(err, res);
      }
    );
  }

  unqueue(args, callback) {
    if (!args.lobby_code) {
      args.lobby_code = lobby_model.active_players[args.member_id]?.lobby_code;
    }
    this.db.delete(
      "lobby_queue",
      { lobby_code: args.lobby_code, member_id: args.member_id },
      (err, res) => {
        if (err) return callback(err, res);
        if (!res || res.affectedRows < 1) {
          return callback({
            message: "You're not in the lobby \"" + args.lobby_code + '"',
          });
        }
        const arr = lobby_model.active_lobbies[args.lobby_code]?.queue;
        if (!arr) {
          return callback({
            message: 'The lobby "' + args.lobby_code + "\" doesn't exist.",
          });
        }
        const idx = arr.indexOf(args.member_id);
        if (idx >= 0) arr.splice(idx, 1);
        delete lobby_model.active_players[args.member_id];
        callback(null, { message: "Unjoin successful" });
      }
    );
  }

  register_infohost(args, callback) {
    if (lobby_model.infohosts.includes(args.member_id)) {
      return callback({ message: "You are already infohost." });
    }
    this.db.insert("lobby_infohosts", args, (err, res) => {
      if (!err) lobby_model.infohosts.push(args.member_id);
      return callback(err, res);
    });
  }

  unregister_infohost(args, callback) {
    if (!lobby_model.infohosts.includes(args.member_id)) {
      return callback({ message: "You are not infohost." });
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
    const values = {
      host: args.host,
      is_vanilla: args.is_vanilla ?? 1,
      is_vc_lobby: args.is_vc_lobby ?? 0,
      ongoing: args.ongoing ?? 0,
      creationtime: Time.now,
    };
    this.db.insert("lobby_subscriptions", values, (err, res) =>
      callback(err, res)
    );
  }

  unannounce(args, callback) {
    this.db.delete(
      "lobby_subscriptions",
      { host: args.host },
      (err, res) => callback(err, res)
    );
  }

  getAnnounced(args, callback) {
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
        .catch(reject);
    });
  }

  confirm_lobby(args, callback) {
    if (!args.code) {
      return callback({
        message: "You need to include the lobby code, for now at least.",
      });
    }
    const lobby = lobby_model.active_lobbies[args.code];
    if (!lobby) {
      return callback({
        message: 'No active lobby with code "' + args.code + '"',
      });
    }
    lobby.state = args.state;
    let mentions = "";
    for (const mention of lobby.queue || []) {
      mentions += "<@" + mention + "> ";
      this.db.delete("lobby_queue", { member_id: mention, lobby_code: args.code });
    }
    return callback(null, { mentions });
  }

  assign_infohost(args, callback) {
    if (!args.code) {
      return callback({
        message: "assign_infohost was called with no lobby code",
      });
    }
    this.db.get(
      "*",
      "lobby_infohosts",
      { lobby_code: args.code },
      (err, res) => {
        if (err) return callback(err, res);
        if (res.length < 1) {
          return callback({ message: "No infohosts are available" });
        }
        const lobby = lobby_model.active_lobbies[args.code];
        if (lobby) lobby.infohost = res[0].member_id;
        return callback(null, res[0]);
      }
    );
  }
}
