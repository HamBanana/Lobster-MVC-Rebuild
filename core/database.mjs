import mysql from "mysql2";
import { LobsterConfig } from "../../secret.mjs";
import { warn } from "./error.mjs";

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
 */
export class Database {
  static _instance = null;

  connection = null;

  constructor() {
    // Pool, not single connection: lets the bot survive a transient
    // disconnect instead of failing every subsequent query with
    // PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR. Pools also expose getConnection()
    // which Bootstrap.load() uses to validate connectivity at boot.
    this.connection = mysql.createPool({
      ...LobsterConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    if (!this.connection) {
      warn("Error in creating database connection");
    } else {
      warn("Database connection created.");
    }
  }

  static getInstance() {
    if (Database._instance == null) {
      Database._instance = new Database();
    }
    return Database._instance;
  }

  // ---------- helpers --------------------------------------------------

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
    const entries = Object.entries(set);
    if (entries.length === 0) {
      throw new Error("Database update called with no fields to set");
    }
    const fragments = [];
    const params = [];
    for (const [k, v] of entries) {
      fragments.push("?? = ?");
      params.push(k, v);
    }
    return { sql: fragments.join(", "), params };
  }

  // ---------- INSERT ---------------------------------------------------

  insert(table, values, callback = () => {}) {
    return this.connection.query(
      "INSERT INTO ?? SET ?",
      [table, values],
      callback
    );
  }

  p_insert(table, values) {
    return new Promise((resolve, reject) => {
      this.connection.query(
        "INSERT INTO ?? SET ?",
        [table, values],
        (err, res) => (err ? reject(err) : resolve(res))
      );
    });
  }

  // ---------- CREATE TABLE --------------------------------------------
  // Schema definitions live in code (bot/system.mjs). Column definitions
  // are trusted and not user-supplied; column *names* and the table name
  // are still escaped via ?? to be safe against typos.

  create_table(name, columns, if_not_exists = true, callback = () => {}) {
    const sql = this.#buildCreateTableSql(name, columns, if_not_exists);
    return this.connection.query(sql, callback);
  }

  p_create_table(name, columns, if_not_exists = true) {
    const sql = this.#buildCreateTableSql(name, columns, if_not_exists);
    return new Promise((resolve, reject) => {
      this.connection.query(sql, (err, res) =>
        err ? reject(err) : resolve(res)
      );
    });
  }

  #buildCreateTableSql(name, columns, if_not_exists) {
    let body;
    if (typeof columns === "string") {
      body = columns;
    } else {
      body = Object.entries(columns)
        .map(([col, def]) => {
          // Allow constraint pseudo-keys like "PRIMARY KEY" through verbatim.
          if (/\s/.test(col)) {
            return `${col} ${def}`;
          }
          return `${mysql.escapeId(col)} ${def}`;
        })
        .join(", ");
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
    let sql = `SELECT ${select === "*" ? "*" : mysql.escapeId(select)} FROM ??`;
    const params = [from];
    if (where && typeof where === "object") {
      const w = Database.buildWhere(where, "AND");
      if (w.sql) {
        sql += ` WHERE ${w.sql}`;
        params.push(...w.params);
      }
    } else if (typeof where === "string" && where.length > 0) {
      throw new Error(
        "Database.get no longer accepts raw SQL where-clauses. Pass an object instead."
      );
    }
    return this.connection.query(sql, params, callback);
  }

  p_get(from, where = {}, operator = "AND") {
    return new Promise((resolve, reject) => {
      const w = Database.buildWhere(where, operator);
      let sql = "SELECT * FROM ??";
      const params = [from];
      if (w.sql) {
        sql += ` WHERE ${w.sql}`;
        params.push(...w.params);
      }
      this.connection.query(sql, params, (err, res) =>
        err ? reject(err) : resolve(res)
      );
    });
  }

  p_getLatest(table) {
    return new Promise((resolve, reject) => {
      this.connection.query(
        "SELECT * FROM ?? ORDER BY id DESC LIMIT 1",
        [table],
        (err, res) => (err ? reject(err) : resolve(res[0]))
      );
    });
  }

  // ---------- UPDATE ---------------------------------------------------

  /**
   * update(table, setObj, whereObj, callback)
   * Both setObj and whereObj must be plain objects.
   */
  update(table, set, where, callback = () => {}) {
    if (typeof set === "string" || typeof where === "string") {
      throw new Error(
        "Database.update no longer accepts raw SQL fragments. Pass objects."
      );
    }
    const s = Database.buildSet(set);
    const w = Database.buildWhere(where, "AND");
    const sql = `UPDATE ?? SET ${s.sql}${w.sql ? ` WHERE ${w.sql}` : ""}`;
    return this.connection.query(
      sql,
      [table, ...s.params, ...w.params],
      callback
    );
  }

  p_update(table, set, where) {
    return new Promise((resolve, reject) => {
      const s = Database.buildSet(set);
      const w = Database.buildWhere(where, "AND");
      const sql = `UPDATE ?? SET ${s.sql}${w.sql ? ` WHERE ${w.sql}` : ""}`;
      this.connection.query(
        sql,
        [table, ...s.params, ...w.params],
        (err, res) => (err ? reject(err) : resolve(res))
      );
    });
  }

  // ---------- DELETE ---------------------------------------------------

  delete(table, where, callback = () => {}) {
    if (typeof where === "string") {
      throw new Error(
        "Database.delete no longer accepts raw SQL where-clauses. Pass an object."
      );
    }
    const w = Database.buildWhere(where, "AND");
    const sql = `DELETE FROM ??${w.sql ? ` WHERE ${w.sql}` : ""}`;
    return this.connection.query(sql, [table, ...w.params], callback);
  }

  p_delete(table, where = {}) {
    return new Promise((resolve, reject) => {
      const w = Database.buildWhere(where, "AND");
      const sql = `DELETE FROM ??${w.sql ? ` WHERE ${w.sql}` : ""}`;
      this.connection.query(sql, [table, ...w.params], (err, res) =>
        err ? reject(err) : resolve(res)
      );
    });
  }

  // ---------- UPSERT ---------------------------------------------------

  p_set(table, key, values) {
    return this.p_delete(table, key).then(() =>
      this.p_insert(table, { ...key, ...values })
    );
  }
}
