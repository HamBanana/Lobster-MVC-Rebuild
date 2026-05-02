import mysql from "mysql2";
import { LobsterConfig } from "../../secret.mjs";
import {
  DatabaseError,
  ValidationError,
  warn,
  toError,
} from "./error.mjs";

/*
 * Thin wrapper around mysql2's callback-style API.
 *
 * Every method here uses `?` (value placeholder) and `??` (identifier
 * placeholder) so user-supplied values never reach the SQL grammar. Callers
 * that previously passed raw SQL fragments (e.g. `"code = '" + code + "'"`)
 * have been migrated to pass plain objects (`{ code }`) instead.
 *
 * The callback variants exist for legacy callers; new code should prefer the
 * `p_*` (Promise) variants.
 *
 * Error handling:
 *   - Driver errors are wrapped in DatabaseError so callers can branch on
 *     err.code (e.g. ER_DUP_ENTRY) and operators get a single line in the
 *     log with operation + table + sqlMessage.
 *   - Programmer errors (missing table name, bad arg shapes) throw a
 *     ValidationError synchronously so they show up at the call site
 *     instead of as a generic mysql syntax error.
 *   - Pool-level 'error' events are forwarded to warn() so a connection
 *     dying mid-flight ends up in the log instead of vanishing.
 */
export class Database {
  static _instance = null;

  connection = null;

  constructor() {
    // Pool, not single connection: lets the bot survive a transient
    // disconnect instead of failing every subsequent query with
    // PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR. Pools also expose getConnection()
    // which Bootstrap.load() uses to validate connectivity at boot.
    try {
      this.connection = mysql.createPool({
        ...LobsterConfig,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    } catch (err) {
      // createPool throws synchronously on bad config (missing host, etc.)
      const wrapped = new DatabaseError(
        "Failed to construct database pool: " +
          (err && err.message ? err.message : String(err)),
        { code: err && err.code, cause: err, operation: "createPool" }
      );
      warn(wrapped);
      throw wrapped;
    }

    if (!this.connection) {
      const err = new DatabaseError(
        "mysql.createPool returned no pool instance.",
        { operation: "createPool" }
      );
      warn(err);
      throw err;
    }

    // Surface driver-level errors that aren't tied to a specific query
    // (e.g. a connection dropping while idle).
    this.connection.on("error", (err) => {
      warn(
        new DatabaseError("Database pool error.", {
          code: err && err.code,
          cause: err,
          operation: "pool.error",
        })
      );
    });

    warn("Database connection pool created.");
  }

  static getInstance() {
    if (Database._instance == null) {
      Database._instance = new Database();
    }
    return Database._instance;
  }

  // ---------- helpers --------------------------------------------------

  static #requireTable(table, operation) {
    if (typeof table !== "string" || table.trim().length === 0) {
      throw new ValidationError(
        "Database." + operation + " called with invalid table name: " + JSON.stringify(table)
      );
    }
  }

  /**
   * Build a parameterised "WHERE" clause from a plain object.
   * Returns { sql: "?? = ? AND ?? = ?", params: [k1, v1, k2, v2] }
   * If the object is empty, returns { sql: "", params: [] }.
   *
   * Null/undefined values translate to `?? IS NULL` rather than `?? = ?`,
   * because in SQL `col = NULL` is never true — it has to be `col IS NULL`.
   * Without this, callers like clearOld() that pass `{ code: null }` would
   * silently match zero rows forever.
   */
  static buildWhere(where = {}, joiner = "AND") {
    if (where === null || typeof where !== "object") {
      throw new ValidationError(
        "Database where-clause must be an object, got " + typeof where
      );
    }
    const entries = Object.entries(where);
    if (entries.length === 0) return { sql: "", params: [] };
    const fragments = [];
    const params = [];
    for (const [k, v] of entries) {
      if (v === null || v === undefined) {
        fragments.push("?? IS NULL");
        params.push(k);
      } else {
        fragments.push("?? = ?");
        params.push(k, v);
      }
    }
    return { sql: fragments.join(` ${joiner} `), params };
  }

  static buildSet(set = {}) {
    if (set === null || typeof set !== "object") {
      throw new ValidationError(
        "Database set-clause must be an object, got " + typeof set
      );
    }
    const entries = Object.entries(set);
    if (entries.length === 0) {
      throw new ValidationError("Database update called with no fields to set");
    }
    const fragments = [];
    const params = [];
    for (const [k, v] of entries) {
      fragments.push("?? = ?");
      params.push(k, v);
    }
    return { sql: fragments.join(", "), params };
  }

  // Wrap a raw mysql2 error with operation/table context. Always returns a
  // DatabaseError that preserves the driver code so callers can keep
  // matching on ER_DUP_ENTRY etc.
  static #wrapDriverError(err, operation, table) {
    if (!err) return null;
    if (err instanceof DatabaseError) return err;
    const e = toError(err);
    return new DatabaseError(
      e.sqlMessage || e.message || "Database operation failed",
      { code: e.code, cause: err, operation, table }
    );
  }

  // ---------- INSERT ---------------------------------------------------

  insert(table, values, callback = () => {}) {
    try {
      Database.#requireTable(table, "insert");
    } catch (err) {
      // Synchronously bad calls still flow through callback so legacy
      // callers don't get a thrown exception they don't expect.
      callback(err);
      return;
    }
    return this.connection.query(
      "INSERT INTO ?? SET ?",
      [table, values],
      (err, res) => callback(Database.#wrapDriverError(err, "insert", table), res)
    );
  }

  p_insert(table, values) {
    return new Promise((resolve, reject) => {
      try {
        Database.#requireTable(table, "p_insert");
      } catch (err) {
        return reject(err);
      }
      this.connection.query(
        "INSERT INTO ?? SET ?",
        [table, values],
        (err, res) => {
          if (err) return reject(Database.#wrapDriverError(err, "p_insert", table));
          resolve(res);
        }
      );
    });
  }

  // ---------- CREATE TABLE --------------------------------------------
  // Schema definitions live in code (bot/system.mjs). Column definitions
  // are trusted and not user-supplied; column *names* and the table name
  // are still escaped via ?? to be safe against typos.

  create_table(name, columns, if_not_exists = true, callback = () => {}) {
    let sql;
    try {
      Database.#requireTable(name, "create_table");
      sql = this.#buildCreateTableSql(name, columns, if_not_exists);
    } catch (err) {
      callback(err);
      return;
    }
    return this.connection.query(sql, (err, res) =>
      callback(Database.#wrapDriverError(err, "create_table", name), res)
    );
  }

  p_create_table(name, columns, if_not_exists = true) {
    return new Promise((resolve, reject) => {
      let sql;
      try {
        Database.#requireTable(name, "p_create_table");
        sql = this.#buildCreateTableSql(name, columns, if_not_exists);
      } catch (err) {
        return reject(err);
      }
      this.connection.query(sql, (err, res) => {
        if (err) return reject(Database.#wrapDriverError(err, "p_create_table", name));
        resolve(res);
      });
    });
  }

  #buildCreateTableSql(name, columns, if_not_exists) {
    let body;
    if (typeof columns === "string") {
      body = columns;
    } else if (columns && typeof columns === "object") {
      body = Object.entries(columns)
        .map(([col, def]) => {
          // Allow constraint pseudo-keys like "PRIMARY KEY" through verbatim.
          if (/\s/.test(col)) {
            return `${col} ${def}`;
          }
          return `${mysql.escapeId(col)} ${def}`;
        })
        .join(", ");
    } else {
      throw new ValidationError(
        "create_table called with invalid columns spec: " + typeof columns
      );
    }
    const safeName = mysql.escapeId(name);
    const guard = if_not_exists ? "IF NOT EXISTS" : "";
    return `CREATE TABLE ${guard} ${safeName} (${body})`;
  }

  // ---------- SELECT ---------------------------------------------------

  /**
   * Legacy signature kept for compatibility:
   *   get(select, from, where, callback)
   * `where` may be an object (preferred) or `undefined`. Raw-string `where`
   * fragments are no longer accepted — pass `{ col: value }` instead.
   */
  get(select, from, where = undefined, callback = () => {}) {
    let sql;
    let params;
    try {
      Database.#requireTable(from, "get");
      sql = `SELECT ${select === "*" ? "*" : mysql.escapeId(select)} FROM ??`;
      params = [from];
      if (where && typeof where === "object") {
        const w = Database.buildWhere(where, "AND");
        if (w.sql) {
          sql += ` WHERE ${w.sql}`;
          params.push(...w.params);
        }
      } else if (typeof where === "string" && where.length > 0) {
        throw new ValidationError(
          "Database.get no longer accepts raw SQL where-clauses. Pass an object instead."
        );
      }
    } catch (err) {
      callback(err);
      return;
    }
    return this.connection.query(sql, params, (err, res) =>
      callback(Database.#wrapDriverError(err, "get", from), res)
    );
  }

  p_get(from, where = {}, operator = "AND") {
    return new Promise((resolve, reject) => {
      let sql;
      let params;
      try {
        Database.#requireTable(from, "p_get");
        const w = Database.buildWhere(where, operator);
        sql = "SELECT * FROM ??";
        params = [from];
        if (w.sql) {
          sql += ` WHERE ${w.sql}`;
          params.push(...w.params);
        }
      } catch (err) {
        return reject(err);
      }
      this.connection.query(sql, params, (err, res) => {
        if (err) return reject(Database.#wrapDriverError(err, "p_get", from));
        resolve(res);
      });
    });
  }

  p_getLatest(table) {
    return new Promise((resolve, reject) => {
      try {
        Database.#requireTable(table, "p_getLatest");
      } catch (err) {
        return reject(err);
      }
      this.connection.query(
        "SELECT * FROM ?? ORDER BY id DESC LIMIT 1",
        [table],
        (err, res) => {
          if (err) return reject(Database.#wrapDriverError(err, "p_getLatest", table));
          resolve(res[0]);
        }
      );
    });
  }

  // ---------- UPDATE ---------------------------------------------------

  /**
   * update(table, setObj, whereObj, callback)
   * Both setObj and whereObj must be plain objects.
   */
  update(table, set, where, callback = () => {}) {
    let sql;
    let params;
    try {
      Database.#requireTable(table, "update");
      if (typeof set === "string" || typeof where === "string") {
        throw new ValidationError(
          "Database.update no longer accepts raw SQL fragments. Pass objects."
        );
      }
      const s = Database.buildSet(set);
      const w = Database.buildWhere(where, "AND");
      sql = `UPDATE ?? SET ${s.sql}${w.sql ? ` WHERE ${w.sql}` : ""}`;
      params = [table, ...s.params, ...w.params];
    } catch (err) {
      callback(err);
      return;
    }
    return this.connection.query(sql, params, (err, res) =>
      callback(Database.#wrapDriverError(err, "update", table), res)
    );
  }

  p_update(table, set, where) {
    return new Promise((resolve, reject) => {
      let sql;
      let params;
      try {
        Database.#requireTable(table, "p_update");
        const s = Database.buildSet(set);
        const w = Database.buildWhere(where, "AND");
        sql = `UPDATE ?? SET ${s.sql}${w.sql ? ` WHERE ${w.sql}` : ""}`;
        params = [table, ...s.params, ...w.params];
      } catch (err) {
        return reject(err);
      }
      this.connection.query(sql, params, (err, res) => {
        if (err) return reject(Database.#wrapDriverError(err, "p_update", table));
        resolve(res);
      });
    });
  }

  // ---------- DELETE ---------------------------------------------------

  delete(table, where, callback = () => {}) {
    let sql;
    let params;
    try {
      Database.#requireTable(table, "delete");
      if (typeof where === "string") {
        throw new ValidationError(
          "Database.delete no longer accepts raw SQL where-clauses. Pass an object."
        );
      }
      const w = Database.buildWhere(where, "AND");
      sql = `DELETE FROM ??${w.sql ? ` WHERE ${w.sql}` : ""}`;
      params = [table, ...w.params];
    } catch (err) {
      callback(err);
      return;
    }
    return this.connection.query(sql, params, (err, res) =>
      callback(Database.#wrapDriverError(err, "delete", table), res)
    );
  }

  p_delete(table, where = {}) {
    return new Promise((resolve, reject) => {
      let sql;
      let params;
      try {
        Database.#requireTable(table, "p_delete");
        const w = Database.buildWhere(where, "AND");
        sql = `DELETE FROM ??${w.sql ? ` WHERE ${w.sql}` : ""}`;
        params = [table, ...w.params];
      } catch (err) {
        return reject(err);
      }
      this.connection.query(sql, params, (err, res) => {
        if (err) return reject(Database.#wrapDriverError(err, "p_delete", table));
        resolve(res);
      });
    });
  }

  // ---------- UPSERT ---------------------------------------------------

  p_set(table, key, values) {
    return this.p_delete(table, key).then(() =>
      this.p_insert(table, { ...key, ...values })
    );
  }
}
