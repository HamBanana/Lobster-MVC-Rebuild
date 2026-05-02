import { Controller } from "../core/controller.mjs";
import { Discord } from "../core/discord.mjs";
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { Database } from "../core/database.mjs";
import {
  DiscordError,
  PermissionError,
  warn,
} from "../core/error.mjs";
import { members } from "../core/statics.mjs";
import { lobby_controller } from "./lobby_controller.mjs";

// BUGFIX: previously this file ran top-level `await Discord.client.guilds.fetch(...)`
// at module load. `Discord.client` is null until Bootstrap.load constructs it,
// so any other module importing test_controller crashed at boot. Look it up
// lazily inside the methods that actually need it.

export class test_controller extends Controller {
  presence_example = (state = "In Lobby") => ({
    userId: "330279218543984641",
    guild: "817607509984018442",
    status: "online",
    activities: [
      {
        name: "Among Us",
        type: 0,
        url: null,
        details: null,
        state,
        applicationId: "477175586805252107",
        timestamps: { start: 1712357154000, end: null },
        party: { size: [4, 15], id: "LXFUFF" },
        syncId: null,
        assets: {
          largeText: null,
          smallText: null,
          largeImage: "481347538054545418",
          smallImage: null,
        },
        flags: 0,
        emoji: null,
        buttons: [],
        createdTimestamp: 1712357155178,
      },
    ],
    clientStatus: { desktop: "online" },
  });

  perm = { users: ["330279218543984641"] };

  constructor(msg) {
    super(msg);
    this.controllername = "test";
    this.auth(this.perm);
  }

  index() {
    this.view.content = "Update test";
    return Promise.resolve(this.post())
      .then((reply) => warn("test/index reply: " + (reply && reply.id)))
      .catch((err) => this.reportError(err, { stage: "test/index" }));
  }

  presence(args) {
    let oldState = args.oldState || args.default?.[0];
    let newState = args.newState || args.default?.[1];
    if (!oldState || oldState === "undefined") oldState = "In Menus";
    if (!newState || newState === "undefined") newState = "In Lobby";
    const oldPresence = this.presence_example(oldState);
    const newPresence = this.presence_example(newState);
    const lc = new lobby_controller(this.message);
    lc.testPresence(oldPresence, newPresence);
    return Promise.resolve(
      this.message.reply(
        'Simulating state switch from "' + oldState + '" to "' + newState + '"'
      )
    ).catch((err) =>
      warn(err, { context: { controller: "test", stage: "presence reply" } })
    );
  }

  getmember(args) {
    const { id } = this.extractArgs(args, "id");
    const member = members.get(id);
    warn("test/getmember: " + JSON.stringify(member));
  }

  helpexample() {
    return new Promise((resolve, reject) => {
      try {
        const helpMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("help_menu")
            .setPlaceholder("Help Menu")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions([
              { label: "Settings", description: "Change the bot settings", value: "settings", emoji: "🛠" },
              { label: "Activities", description: "Access the new Discord Activities Feature", value: "activities", emoji: "🎮" },
              { label: "Fun", description: "Shows all the fun commands", value: "fun", emoji: "🎲" },
            ])
        );

        const editEmbed = new EmbedBuilder()
          .setTitle("Help Menu")
          .setDescription("Choose an option from the menu below!")
          .setColor("Green");

        this.view.embeds.push(editEmbed);
        this.view.components.push(helpMenu);
        resolve(this.post());
      } catch (err) {
        reject(err);
      }
    }).catch((e) => this.reportError(e, { stage: "test/helpexample" }));
  }

  promise() {
    return new Promise((resolve, reject) => {
      Promise.resolve(this.message.reply("Outer"))
        .then(() => {
          resolve(
            new Promise((iresolve) => {
              iresolve("Inner");
            }).then(() => warn("Inner then"))
          );
        })
        .catch(reject);
    })
      .then(() => warn("Outer then"))
      .catch((err) => this.reportError(err, { stage: "test/promise" }));
  }

  say(args) {
    let { word, reply } = this.extractArgs(args, ["word", "reply"]);
    if (!word) return;
    reply = reply !== "false";
    if (reply) {
      this.view.type = "reply";
    } else {
      this.view.channelid = this.message.channel.id;
      this.view.type = "channel";
    }
    this.view.embeds[0] = new EmbedBuilder().setTitle(word);
    return this.post();
  }

  async getpresence() {
    try {
      // Lazy lookup — the client is now guaranteed to exist by the time a
      // user can run this command.
      const guild = await Discord.client.guilds.fetch("817607509984018442");
      const member = await guild.members.fetch({
        user: "330279218543984641",
        withPresences: true,
        force: true,
      });
      return await this.message.reply(
        member.presence?.activities?.[0]?.state || "no presence"
      );
    } catch (err) {
      return this.reportError(
        new DiscordError("Couldn't fetch presence: " + err.message, {
          code: err.code,
          cause: err,
        }),
        { stage: "test/getpresence" }
      );
    }
  }

  count() {
    const db = Database.getInstance();
    return db
      .p_getLatest("counting")
      .then((result) => {
        if (!result) {
          throw new Error("No counting rows yet.");
        }
        return Promise.resolve(this.message.reply("Result: " + result.count))
          .then(() => result.count);
      })
      .catch((err) => this.reportError(err, { stage: "test/count" }));
  }

  create() {
    const db = Database.getInstance();
    return db.p_create_table("test", { id: "INT" }, true).catch((err) =>
      this.reportError(err, { stage: "test/create" })
    );
  }

  fail(args) {
    const { type } = this.extractArgs(args, "type");
    switch (type) {
      case "permissionerror":
        throw new PermissionError();
      case "auth":
        this.auth({ users: ["noone"] });
        return;
      default:
        throw new Error("test fail");
    }
  }
}
