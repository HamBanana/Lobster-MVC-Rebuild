import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Time } from '../tools/time.mjs';

/*
 * Centralised error handling for Lobster.
 *
 * Goals
 * -----
 * 1. Operator visibility: every error gets a single, structured line in
 *    log_lobster (mirrored to stdout) with name + code + message + stack +
 *    cause + any extra context the call site supplied.
 * 2. User feedback: callers can derive a short, human-friendly Discord
 *    reply via `userMessage(err)` so users don't see raw stacks.
 * 3. Detect-don't-swallow: typed subclasses (DatabaseError, DiscordError,
 *    ConfigError, NetworkError, ValidationError, PermissionError) let
 *    upstream code branch on `err.name`/`err.code` without string matching.
 *
 * `warn` is intentionally tolerant of every shape the legacy codebase
 * passes in (string, Error, mysql2 error object, undefined). Anything that
 * is not already an Error gets wrapped in one so its stack starts at the
 * point we noticed it.
 */

function resolveLogPath() {
    const root = process.env.LOBSTER_ROOT;
    if (!root) {
        // Fall back to a writable location next to cwd so we never silently lose logs.
        return path.join(process.cwd(), 'log_lobster');
    }
    return os.platform() === 'win32'
        ? path.join(root, '..', 'log_lobster')
        : path.join(root, '..', 'log_lobster');
}

export const logpath = resolveLogPath();

// ---------- Typed errors ------------------------------------------------

export class LobsterError extends Error {
    constructor(message, { code, cause, context } = {}) {
        super(message);
        this.name = 'LobsterError';
        if (code) this.code = code;
        if (cause !== undefined) this.cause = cause;
        if (context !== undefined) this.context = context;
    }
}

export class PermissionError extends LobsterError {
    constructor(msg = 'You are not allowed to do that here.', opts = {}) {
        super(msg, { code: 'PERMISSION_DENIED', ...opts });
        this.name = 'PermissionError';
    }
}

export class ConfigError extends LobsterError {
    constructor(msg, opts = {}) {
        super(msg, { code: 'CONFIG_ERROR', ...opts });
        this.name = 'ConfigError';
    }
}

export class DatabaseError extends LobsterError {
    constructor(msg, opts = {}) {
        super(msg, { code: opts.code || 'DB_ERROR', ...opts });
        this.name = 'DatabaseError';
        if (opts.operation) this.operation = opts.operation;
        if (opts.table) this.table = opts.table;
        // Preserve mysql2-specific fields when wrapping a driver error
        if (opts.cause && typeof opts.cause === 'object') {
            if (opts.cause.errno !== undefined) this.errno = opts.cause.errno;
            if (opts.cause.sqlState !== undefined) this.sqlState = opts.cause.sqlState;
            if (opts.cause.sqlMessage !== undefined) this.sqlMessage = opts.cause.sqlMessage;
        }
    }
}

export class DiscordError extends LobsterError {
    constructor(msg, opts = {}) {
        super(msg, { code: opts.code || 'DISCORD_ERROR', ...opts });
        this.name = 'DiscordError';
    }
}

export class NetworkError extends LobsterError {
    constructor(msg, opts = {}) {
        super(msg, { code: opts.code || 'NETWORK_ERROR', ...opts });
        this.name = 'NetworkError';
    }
}

export class ValidationError extends LobsterError {
    constructor(msg, opts = {}) {
        super(msg, { code: opts.code || 'VALIDATION_ERROR', ...opts });
        this.name = 'ValidationError';
    }
}

// ---------- Coercion + formatting --------------------------------------

/**
 * Normalise anything into an Error so downstream code can rely on `.name`,
 * `.message`, `.stack`. Strings, plain objects with a `message` field, and
 * `undefined` all become real Errors. Anything that is already an Error is
 * returned untouched so we don't lose the original stack.
 */
export function toError(value) {
    if (value instanceof Error) return value;
    if (value === null || value === undefined) {
        return new LobsterError('Unknown error (no value)');
    }
    if (typeof value === 'string') return new LobsterError(value);
    if (typeof value === 'object') {
        const msg = value.message || value.sqlMessage || JSON.stringify(value);
        const e = new LobsterError(msg);
        if (value.code) e.code = value.code;
        if (value.errno !== undefined) e.errno = value.errno;
        if (value.sqlState !== undefined) e.sqlState = value.sqlState;
        if (value.sqlMessage !== undefined) e.sqlMessage = value.sqlMessage;
        return e;
    }
    return new LobsterError(String(value));
}

/**
 * Build a single-line operator log entry that carries every useful field
 * we have. Multi-line stacks are preserved verbatim — the time tag at the
 * front is enough to anchor follow-up reads.
 *
 * Plain strings are formatted as plain log messages with no stack — they
 * are informational, not errors. Real Error instances and error-shaped
 * objects (anything with a code, sqlMessage, stack, etc.) get the full
 * structured treatment.
 */
export function formatError(err, context) {
    // Plain string => informational log line, not an error. Don't synthesize
    // a stack trace just because it went through warn().
    if (typeof err === 'string') {
        let line = err;
        if (context) line += '\n  context: ' + safeStringify(context);
        return line;
    }

    const e = toError(err);
    const parts = [];
    parts.push(e.name || 'Error');
    if (e.code) parts.push('[' + e.code + ']');
    parts.push(': ' + (e.message || '(no message)'));
    if (context) parts.push('\n  context: ' + safeStringify(context));
    if (e.context) parts.push('\n  err.context: ' + safeStringify(e.context));
    if (e.operation) parts.push('\n  operation: ' + e.operation);
    if (e.table) parts.push('\n  table: ' + e.table);
    if (e.sqlMessage && e.sqlMessage !== e.message) {
        parts.push('\n  sqlMessage: ' + e.sqlMessage);
    }
    if (e.sqlState) parts.push('\n  sqlState: ' + e.sqlState);
    if (e.errno !== undefined) parts.push('\n  errno: ' + e.errno);
    if (e.stack) {
        parts.push('\n  stack: ' + e.stack);
    }
    if (e.cause) {
        const c = toError(e.cause);
        parts.push('\n  caused by: ' + (c.name || 'Error') +
            (c.code ? ' [' + c.code + ']' : '') +
            ': ' + (c.message || '(no message)'));
        if (c.stack) parts.push('\n    ' + c.stack.split('\n').join('\n    '));
    }
    return parts.join('');
}

function safeStringify(v) {
    try {
        return JSON.stringify(v);
    } catch (_) {
        return String(v);
    }
}

/**
 * Translate any error into a short, friendly string suitable for posting
 * into Discord. Falls back to the message if no specific mapping exists.
 */
export function userMessage(err) {
    const e = toError(err);
    switch (e.code) {
        case 'PERMISSION_DENIED':
            return e.message || "You can't do that here.";
        case 'ER_DUP_ENTRY':
            return 'That already exists.';
        case 'ER_DATA_TOO_LONG':
            return "That value doesn't fit.";
        case 'ER_NO_SUCH_TABLE':
            return "I'm missing a table I need. Check the boot log.";
        case 'ER_BAD_FIELD_ERROR':
            return "I tried to read a column that doesn't exist. Check the boot log.";
        case 'ER_ACCESS_DENIED_ERROR':
            return "I can't talk to the database (auth refused).";
        case 'ECONNREFUSED':
            return "I can't reach a service I need (connection refused).";
        case 'ETIMEDOUT':
        case 'ESOCKETTIMEDOUT':
            return 'A service I need timed out.';
        case 'ENOTFOUND':
        case 'EAI_AGAIN':
            return "I can't resolve a hostname I need.";
        case 'ENOENT':
            return "I'm missing a file I need.";
        case 'CONFIG_ERROR':
            return 'Lobster is misconfigured: ' + e.message;
        case 'VALIDATION_ERROR':
            return e.message;
        case 'SILENT':
            return null;
        default:
            return e.message || 'Something went wrong.';
    }
}

// ---------- warn -------------------------------------------------------

let _logSetupFailed = false;

/**
 * Append a structured entry to log_lobster and mirror it to stdout.
 *
 * Usage:
 *   warn("plain string message")
 *   warn(err)                       // an Error or mysql2 result
 *   warn(err, { context: { ... } }) // attach extra context
 *
 * The legacy `warn(err, fail)` shape is still accepted: passing `true` as
 * the second argument re-throws after logging so callers that depended on
 * the old behaviour keep working.
 */
export function warn(error, opts = {}) {
    // Back-compat: warn(error, true) used to mean "log and throw".
    let fail = false;
    let context;
    if (typeof opts === 'boolean') {
        fail = opts;
    } else if (opts && typeof opts === 'object') {
        fail = !!opts.fail;
        context = opts.context;
    }

    const formatted = formatError(error, context);
    const line = '<t:' + Time.now + ':t>: ' + formatted;
    // Mirror to console so the operator sees what's happening live even if
    // the file write fails (bad LOBSTER_ROOT, no permissions, full disk).
    console.log(line);

    const writePromise = fs.appendFile(logpath, line + '\n')
        .catch((err) => {
            // Don't recurse into warn() — that would loop. Print once and
            // remember we've already complained so we don't spam stdout
            // every message after the first failure.
            if (!_logSetupFailed) {
                _logSetupFailed = true;
                console.error(
                    'Warn file write failed (' + (err && err.message) +
                    ') for log path "' + logpath + '". Further log-write errors will be suppressed.'
                );
            }
        });

    if (fail) {
        // Re-throw the *original* error so the caller's catch sees its
        // type, not a synthetic wrapper.
        throw (error instanceof Error) ? error : toError(error);
    }
    return writePromise;
}
