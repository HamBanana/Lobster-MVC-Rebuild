import { Discord } from "../core/discord.mjs";
import {
  DiscordError,
  PermissionError,
  ValidationError,
  warn,
  userMessage,
} from "../core/error.mjs";
import { messages } from "./statics.mjs";

export class Controller {
  static message_retainer = {};
  functions = {};
  controllername = "";

  client = Discord.client;

  constructor(msg) {
    this.client = Discord.client;
    this.allowed = true;

    this.view = {
      components: [],
      content: "",
      type: "reply",
      channelid: "",
      // Both spellings exist in legacy code; alias them so neither path
      // silently no-ops if a controller sets the wrong one.
      get channelId() {
        return this.channelid;
      },
      set channelId(v) {
        this.channelid = v;
      },
      data: {},
      reactions: {},
      reaction_options: {
        filter: (reaction, user) => user.id === this.message.author.id,
        max: 1,
        time: 30000,
        errors: ["time"],
      },
      encoding: "utf8",
      template_path: "",
      template_type: "string",
      addReaction: (emoji, callback = null) => {
        this.view.reactions[emoji] = callback;
      },
      embeds: [],
    };

    this.message = msg;
  }

  /*
   * Reply to the user with a friendly message describing why something
   * went wrong, *and* log the full error for the operator. Used by every
   * post() catch path and by callers that want a uniform error reply.
   *
   * - SILENT errors don't reply.
   * - PermissionError replies with a short refusal (or the error's own
   *   message, if it has one).
   * - Anything else gets userMessage(err), which maps known codes
   *   (ER_DUP_ENTRY, ECONNREFUSED, etc.) to friendly strings.
   *
   * Replying itself can fail (channel deleted, missing perms) — we catch
   * that too so the original error doesn't get hidden by a follow-on
   * crash.
   */
  reportError(err, context = {}) {
    warn(err, { context: { controller: this.controllername, ...context } });
    const friendly = userMessage(err);
    if (friendly === null) return Promise.resolve(null); // SILENT
    if (!this.message || typeof this.message.reply !== "function") {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.message.reply(friendly)).catch((replyErr) => {
      warn(replyErr, {
        context: {
          controller: this.controllername,
          stage: "reportError reply failed",
        },
      });
    });
  }

  post(content) {
    let template_path = this.view.template_path;

    return new Promise((resolve, reject) => {
      if (template_path) {
        template_path = template_path.toLowerCase();
        const spl = template_path.split("/");
        if (spl.length !== 2) {
          return reject(
            new ValidationError(
              'view.template_path must be of the form "view/exportName", got "' +
                this.view.template_path +
                '"'
            )
          );
        }
        return import("../views/" + spl[0] + ".mjs")
          .then((template_module) => {
            const template = template_module[spl[1]];
            if (template === undefined) {
              return reject(
                new ValidationError(
                  'Template "' + spl[1] + '" not found in views/' + spl[0] + '.mjs'
                )
              );
            }
            resolve(template);
          })
          .catch((importErr) => {
            // Distinguish "view file missing" from a runtime error inside
            // the view module so the operator gets a useful log line.
            if (importErr instanceof ValidationError) return; // already handled
            reject(
              new ValidationError(
                'Failed to load view "' + this.view.template_path + '": ' + importErr.message,
                { cause: importErr }
              )
            );
          });
      }
      resolve();
    })
      .then(
        (template) =>
          new Promise((resolve, reject) => {
            try {
              if (this.view.template_type === "embed") {
                content = this.applyTemplate(JSON.stringify(template), this.view.data);
                content = JSON.parse(content);
                content = { embeds: [content] };
              } else {
                if (!content) content = this.view.content;
                if (typeof content === "string" && template) {
                  content = this.applyTemplate(template, this.view.data);
                }
                if (this.view.embeds.length > 0 || this.view.components.length > 0) {
                  content = {
                    embeds: this.view.embeds,
                    components: this.view.components,
                  };
                }
              }
            } catch (err) {
              return reject(
                new ValidationError(
                  "Failed to render template: " + err.message,
                  { cause: err }
                )
              );
            }
            let output_message;
            if (JSON.stringify(content) === '{"default":[]}') {
              const e = new Error("silent");
              e.code = "SILENT";
              return reject(e);
            }
            const channelId = this.view.channelid;
            switch (this.view.type) {
              case "reply":
                if (!this.message || typeof this.message.reply !== "function") {
                  return reject(
                    new DiscordError(
                      "view.type='reply' but no message to reply to.",
                      { code: "NO_MESSAGE" }
                    )
                  );
                }
                output_message = this.message.reply(content);
                break;
              case "channel": {
                const channel =
                  this.client && this.client.channels.cache.get(channelId);
                if (!channel) {
                  return reject(
                    new DiscordError(
                      'Cannot post to channel "' + channelId + '": channel is not in cache or does not exist.',
                      { code: "CHANNEL_NOT_FOUND" }
                    )
                  );
                }
                output_message = channel.send(content);
                break;
              }
              case "edit":
                if (!channelId || !this.view.messageId) {
                  return reject(
                    new DiscordError(
                      'view.type="edit" requires both channelid and messageId.',
                      { code: "EDIT_TARGET_MISSING" }
                    )
                  );
                }
                output_message = messages
                  .get(channelId, this.view.messageId)
                  .then((existing) => existing.edit(content))
                  .catch((editErr) => {
                    throw new DiscordError(
                      "Failed to edit message " + this.view.messageId + ": " + editErr.message,
                      { code: editErr.code, cause: editErr }
                    );
                  });
                break;
              default:
                return reject(
                  new ValidationError(
                    'Unknown view.type "' + this.view.type + '"'
                  )
                );
            }
            resolve(output_message);
          }).then((msg) => {
            let listen = false;
            for (const [r, c] of Object.entries(this.view.reactions)) {
              Promise.resolve(msg.react(r)).catch((rxErr) =>
                warn(rxErr, {
                  context: {
                    controller: this.controllername,
                    stage: "post react",
                    emoji: r,
                  },
                })
              );
              if (c) listen = true;
            }
            return { msg, listen };
          })
      )
      .then((ret) => {
        if (ret.listen) {
          ret.msg
            .awaitReactions(this.view.reaction_options)
            .then((collected) => {
              if (!collected) return;
              const reaction = collected.first();
              for (const [r, c] of Object.entries(this.view.reactions)) {
                if (reaction.emoji.name === r) {
                  try {
                    c(ret.msg);
                  } catch (cbErr) {
                    warn(cbErr, {
                      context: {
                        controller: this.controllername,
                        stage: "reaction callback",
                        emoji: r,
                      },
                    });
                  }
                }
              }
            })
            .catch((awaitErr) => {
              // The "time" filter rejects with a Map on timeout, which is
              // expected; only log if it's a real error.
              if (awaitErr instanceof Error) {
                warn(awaitErr, {
                  context: {
                    controller: this.controllername,
                    stage: "awaitReactions",
                  },
                });
              } else {
                warn("Reaction timeout hit!");
              }
              if (ret.msg && typeof ret.msg.delete === "function") {
                Promise.resolve(ret.msg.delete()).catch((delErr) => {
                  warn(delErr, {
                    context: {
                      controller: this.controllername,
                      stage: "post-timeout msg.delete",
                    },
                  });
                });
              }
            });
        }
        return ret.msg;
      })
      .catch((err) => {
        if (err && err.code === "SILENT") return;
        // Log + reply with a meaningful message. We don't rethrow because
        // post() callers historically don't expect to catch — that's why
        // the original implementation just printed and ate the error.
        return this.reportError(err, { stage: "post" });
      });
  }

  applyTemplate(template, properties) {
    if (typeof template !== "string") {
      throw new ValidationError(
        "applyTemplate expected string template, got " + typeof template
      );
    }
    let returnValue = "";
    const templateFragments = template.split("{{");
    returnValue += templateFragments[0];
    for (let i = 1; i < templateFragments.length; i++) {
      const fragmentSections = templateFragments[i].split("}}", 2);
      returnValue += properties[fragmentSections[0]];
      returnValue += fragmentSections[1];
    }
    return returnValue;
  }

  auth(permissions) {
    if (!permissions || !this.message) return;
    for (const [scope, allowed] of Object.entries(permissions)) {
      let value;
      if (scope === "channels") value = this.message.channelId;
      else if (scope === "users") value = this.message.author.id;
      else continue;
      if (!allowed.includes(value)) {
        const err = new PermissionError(
          "Not allowed: " + scope + " check failed for " + value
        );
        warn(err, {
          context: {
            controller: this.controllername,
            scope,
            value,
          },
        });
        this.allowed = false;
        throw err;
      }
    }
  }

  extractArgs(args, defaults = null) {
    const res = {};
    if (!args || typeof args !== "object") {
      throw new ValidationError(
        "extractArgs expected an args object, got " + typeof args
      );
    }
    if (defaults !== null) {
      if (typeof defaults === "string") defaults = [defaults];
      const defaultArr = Array.isArray(args.default) ? args.default : [];
      for (const i in defaults) res[defaults[i]] = defaultArr[i];
    }
    delete args.default;
    for (const [k, v] of Object.entries(args)) res[k] = v;
    return res;
  }

  getAllFuncs(toCheck) {
    const props = [];
    let obj = toCheck;
    do {
      props.push(...Object.getOwnPropertyNames(obj));
    } while ((obj = Object.getPrototypeOf(obj)));
    return props.sort().filter((e, i, arr) => {
      if (e !== arr[i + 1] && typeof toCheck[e] === "function") return true;
      return false;
    });
  }
}
