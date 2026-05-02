import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { ValidationError } from "../core/error.mjs";

// Properties that exist on every object's prototype chain. Allowing these as
// "method names" would let a Discord user invoke `Object.prototype.constructor`
// or similar via `!lob lobby constructor`. Refuse them up front.
const FORBIDDEN_METHODS = new Set([
  "constructor",
  "__proto__",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "toString",
  "valueOf",
]);

// Controller and method tokens come from Discord input. Restrict to a safe
// alphabet so we never have to think about Unicode lookalikes or path
// separators getting through.
const SAFE_TOKEN = /^[a-z0-9_]+$/;

export class Parser {
  message;

  constructor(msg) {
    this.message = msg;
  }

  #method_alias = {
    d: "random dice",
    dice: "random dice",
    c: "random coin",
    coin: "random coin",
    join: "lobby queue",
    unjoin: "lobby unqueue",
    list: "lobby list",
    code: "lobby list",
    kill: "lobby delete",
    create: "lobby create",
    reboot: "manage reboot",
  };

  parseCommand(msg) {
    return new Promise((resolve, reject) => {
      try {
        let c;
        if (typeof msg === "string") {
          c = msg.toLowerCase();
        } else if (msg && typeof msg.content === "string") {
          c = msg.content.toLowerCase();
        } else {
          return reject(
            new ValidationError(
              "parseCommand expected a string or message with .content, got " +
                typeof msg
            )
          );
        }
        let parms = c.split(" ");

        if (parms[0] in this.#method_alias) {
          c = c.replace(parms[0], this.#method_alias[parms[0]]);
        }

        parms = this.splitStringBySpaces(c);

        const command = {
          controller: parms[0] || "index",
          method: parms[1] || "index",
          args: parms.splice(2),
        };

        const args = { default: [] };
        for (const i of command.args) {
          if (i.includes(":")) {
            const spl = i.split(":");
            args[spl[0]] = spl[1];
          } else {
            args.default.push(i);
          }
        }
        command.args = args;

        resolve(command);
      } catch (err) {
        reject(
          new ValidationError("Failed to parse command: " + err.message, {
            cause: err,
          })
        );
      }
    });
  }

  executeCommand(command) {
    return new Promise((resolve, reject) => {
      if (!command || typeof command !== "object") {
        return reject(
          new ValidationError("executeCommand called with no command object")
        );
      }
      if (
        typeof command.controller !== "string" ||
        typeof command.method !== "string"
      ) {
        return reject(
          new ValidationError(
            "executeCommand: controller and method must be strings."
          )
        );
      }
      if (
        !SAFE_TOKEN.test(command.controller) ||
        !SAFE_TOKEN.test(command.method)
      ) {
        const err = new ValidationError(
          'Invalid controller or method name "' +
            command.controller +
            "." +
            command.method +
            '". Allowed characters: a-z 0-9 _',
          { code: "ERR_INVALID_TOKEN" }
        );
        err.controller = command.controller;
        return reject(err);
      }
      if (FORBIDDEN_METHODS.has(command.method)) {
        const err = new Error(
          command.method + " is not callable as a controller method."
        );
        err.code = "PERMISSION_DENIED";
        return reject(err);
      }

      const ctrlpath = "../controllers/" + command.controller + "_controller.mjs";
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      try {
        fs.statSync(path.resolve(__dirname, ctrlpath));
        resolve(ctrlpath);
      } catch (statErr) {
        const err = new Error(
          'The controller "' + command.controller + '" does not exist.'
        );
        err.code = "ERR_MODULE_NOT_FOUND";
        err.controller = command.controller;
        err.cause = statErr;
        reject(err);
      }
    })
      .then((ctrlpath) =>
        import(ctrlpath).catch((importErr) => {
          // Two distinct cases: file is missing (handled above) vs. file
          // imported but threw at top-level. Preserve the underlying
          // message so the operator can debug syntax errors etc.
          const err = new Error(
            'Failed to load controller "' +
              command.controller +
              '": ' +
              (importErr && importErr.message ? importErr.message : importErr)
          );
          err.code = importErr && importErr.code ? importErr.code : "ERR_MODULE_NOT_FOUND";
          err.controller = command.controller;
          err.cause = importErr;
          throw err;
        })
      )
      .then((module) => {
        // Bracket-access replaces the previous eval. The class name is
        // already validated by SAFE_TOKEN above.
        const className = command.controller + "_controller";
        const ctor = module[className];
        if (typeof ctor !== "function") {
          const err = new Error(
            'Controller "' +
              command.controller +
              '" is malformed (no exported class "' +
              className +
              '").'
          );
          err.code = "ERR_MODULE_NOT_FOUND";
          err.controller = command.controller;
          throw err;
        }
        try {
          return new ctor(this.message);
        } catch (ctorErr) {
          // PermissionError thrown inside the constructor is normal; let
          // it bubble untouched so lobster.mjs can render the no-react.
          if (ctorErr && ctorErr.code === "PERMISSION_DENIED") throw ctorErr;
          // Anything else is an actual instantiation failure.
          const wrapped = new Error(
            'Failed to construct "' +
              command.controller +
              '": ' +
              (ctorErr && ctorErr.message ? ctorErr.message : ctorErr)
          );
          wrapped.code = ctorErr && ctorErr.code ? ctorErr.code : "CTOR_FAILED";
          wrapped.controller = command.controller;
          wrapped.cause = ctorErr;
          throw wrapped;
        }
      })
      .then((ins) => {
        const fn = ins[command.method];
        // hasOwnProperty check would miss inherited methods (post, etc.);
        // typeof + denylist is enough to keep prototype keys out.
        if (typeof fn !== "function") {
          const err = new Error(
            command.method +
              " is not a valid function of " +
              command.controller
          );
          err.code = "ERR_FUNCTION_NOT_FOUND";
          err.controller = command.controller;
          err.method = command.method;
          throw err;
        }
        try {
          const result = fn.call(ins, command.args);
          if (result && typeof result.then === "function") {
            return result;
          }
          return result;
        } catch (callErr) {
          // PermissionError from auth() inside a method -> let it bubble
          // unchanged.
          if (callErr && callErr.code === "PERMISSION_DENIED") throw callErr;
          throw callErr;
        }
      })
      .catch((err) => {
        // Don't double-log here — the caller (lobster.mjs) is responsible
        // for the operator log entry. We just enrich the error with what
        // we know about the command so the log line is useful.
        if (err && typeof err === "object") {
          if (!err.controller) err.controller = command && command.controller;
          if (!err.method) err.method = command && command.method;
        }
        throw err;
      });
  }

  splitStringBySpaces(str) {
    const regex = /['"]([^'"]+)['"]/g;
    const replacedStr = str.replace(regex, (_, capture) => capture.replace(/\s/g, "ø"));
    const segments = replacedStr.split(/\s+/);
    return segments.map((segment) => segment.replace(/ø/g, " "));
  }

  splitStringByQuotes(str) {
    const segments = str.split('"');
    const enclosedSegments = [];
    for (const i in segments) {
      if (i % 2 === 0) {
        enclosedSegments.push(segments[i]);
      } else {
        enclosedSegments.push(...segments[i].split(" "));
      }
    }
    return enclosedSegments;
  }
}
