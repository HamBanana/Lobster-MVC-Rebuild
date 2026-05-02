import { Discord } from "../core/discord.mjs";
import { PermissionError, warn } from "../core/error.mjs";
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

  post(content) {
    let template_path = this.view.template_path;

    return new Promise((resolve) => {
      if (template_path) {
        template_path = template_path.toLowerCase();
        const spl = template_path.split("/");
        return import("../views/" + spl[0] + ".mjs").then((template_module) => {
          const template = template_module[spl[1]];
          resolve(template);
        });
      }
      resolve();
    })
      .then(
        (template) =>
          new Promise((resolve) => {
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
            let output_message;
            if (JSON.stringify(content) === '{"default":[]}') {
              const e = new Error("silent");
              e.code = "SILENT";
              throw e;
            }
            const channelId = this.view.channelid;
            switch (this.view.type) {
              case "reply":
                output_message = this.message.reply(content);
                break;
              case "channel":
                output_message = this.client.channels.cache.get(channelId).send(content);
                break;
              case "edit":
                messages.get(channelId, this.view.messageId).then((existing) => {
                  output_message = existing.edit(content);
                });
                break;
            }
            resolve(output_message);
          }).then((msg) => {
            let listen = false;
            for (const [r, c] of Object.entries(this.view.reactions)) {
              msg = msg.react(r);
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
                if (reaction.emoji.name === r) c(ret.msg);
              }
            })
            .catch(() => {
              warn("Reaction timeout hit!");
              ret.msg.delete();
            });
        }
        return ret.msg;
      })
      .catch((err) => {
        if (err?.code !== "SILENT") console.log("post() error: " + err?.message);
      });
  }

  applyTemplate(template, properties) {
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
        warn("Controller auth failed: " + scope + " denied");
        this.allowed = false;
        throw new PermissionError();
      }
    }
  }

  extractArgs(args, defaults = null) {
    const res = {};
    if (defaults !== null) {
      if (typeof defaults === "string") defaults = [defaults];
      for (const i in defaults) res[defaults[i]] = args.default[i];
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
