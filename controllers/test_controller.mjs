import {Controller} from '../core/controller.mjs';
import { Discord } from '../core/discord.mjs';
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
//import {Test} from '../core/database.js';
import { Database } from '../core/database.mjs';
import { PermissionError } from '../core/error.mjs';
import { members } from '../core/statics.mjs';
import { lobby_controller } from './lobby_controller.mjs';

//import pkg from 'discord.js';
//const { EmbedBuilder, MessageActionRow, StringSelectMenuBuilder } = pkg;

const guild = await Discord.client.guilds.fetch('817607509984018442');

const member = await guild.members.fetch
({user:'330279218543984641', withPresences: true, force: true});

export class test_controller extends Controller{


  perm = {
    'users': ['330279218543984641']
  };

  presence_example = (state = "In Lobby") => {
    return {"userId":"330279218543984641","guild":"817607509984018442","status":"online","activities":[{
      "name":"Among Us","type":0,"url":null,"details":null,"state":state,"applicationId":"477175586805252107",
      "timestamps":{"start":1712357154000,"end":null},"party":{"size":[4,15],"id":"LXFUFF"},"syncId":null,
      "assets":{"largeText":null,"smallText":null,"largeImage":"481347538054545418","smallImage":null},
      "flags":0,"emoji":null,"buttons":[],"createdTimestamp":1712357155178}],"clientStatus":{"desktop":"online"}}
  }
  
constructor(msg){
  super(msg);
  this.auth(this.perm);
}
  
  index() {
    this.view.content = 'Update test';
    this.post()
    .then((reply) => {
    console.log(reply);
    })
  }

  presence(args){
    console.log('Testing presence change: ' + JSON.stringify(args));
    //let { oldState, newState } = this.extractArgs(args);
    let oldState = args.oldState || args.default?.[0];
    let newState = args.newState || args.default?.[1];
    console.log('oldState:' + oldState);
    console.log('newState:' + newState);
    if (!oldState || oldState == "undefined"){oldState = "In Menus";}
    if (!newState || newState == "undefined"){newState = "In Lobby";}
    let oldPresence = this.presence_example(oldState);
    let newPresence = this.presence_example(newState);
    let lc = new lobby_controller(this.message);
    lc.testPresence(oldPresence, newPresence);
    this.message.reply('Simulating state switch from "' + oldState + '" to "'+newState+'"');
  }

  getmember(args){
    let { id } = this.extractArgs(args, 'id');
    let member = members.get(id);
    console.log('From test_controller: ' + JSON.stringify(member));
  }

  helpexample(){
      return new Promise((resolve, reject) => {

        let helpMenu = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("help_menu")
              .setPlaceholder('Help Menu')
              .setMinValues(1)
              .setMaxValues(1)
              .addOptions([
                {
                  label: "Settings",
                  description: "Change the bot settings",
                  value: "settings",
                  emoji: "🛠"
                },
                {
                  label: "Activities",
                  description: "Access the new Discord Activities Feature",
                  value: "activities",
                  emoji: "🎮"
                },
                {
                  label: "Fun",
                  description: "Shows all the fun commands",
                  value: "fun",
                  emoji: "🎲"
                },
                /*{
                  label: "Image",
                  description: "Shows all the image commands",
                  value: "image",
                  emoji: "🖼"
                },
                {
                  label: "Information",
                  description: "Shows all the information commands",
                  value: "info",
                  emoji: "📢"
                },
                {
                  label: "Moderation",
                  description: "Shows all the moderation commands",
                  value: "moderation",
                  emoji: "🔒"
                },
                {
                  label: "Music",
                  description: "Shows all the Music commands!",
                  value: "music",
                  emoji: "🎵"
                },
                {
                  label: "NSFW",
                  description: "Shows all the NSFW commands",
                  value: "nsfw",
                  emoji: "🔞"
                },
                {
                  label: "Utility",
                  description: "Shows all the utility commands",
                  value: "utility",
                  emoji: "🔧"
                },
                {
                  label: "Games",
                  description: "Shows all the game commands",
                  value: "game",
                  emoji: "🎮"
                }*/
              ])
          );

        let editEmbed = new EmbedBuilder()
          .setTitle('Help Menu')
          .setDescription('Choose an option from the menu below!')
          .setColor("Green");

        this.view.embeds.push(editEmbed);
        this.view.components.push(this.helpMenu);
        this.post();
      }).catch((e) => {
        this.message.reply("That didn't work, because: " + e.message);
      });
  }

  promise(args){
    return new Promise((resolve, reject) => {
      this.message.reply('Outer');
      resolve(
        new Promise((iresolve, ireject) => {
        iresolve('Inner');
      })
      .then(() => {
        console.log('Inner then');
      })
      );
    })
    .then(() => {
      console.log('Outer then');
    });
  }

  say(args){
    //let word = (args['word']) ? args['word'] : args['default'][0];
    let { word, reply } = this.extractArgs(args, ['word', 'reply']);
    if (!word){
      return;
    }
    reply = (reply !== "false");
    if (reply){
      this.view.type = 'reply';
    } else {
    this.view.channelid = this.message.channel.id;
    this.view.type = 'channel';
    }
    //this.view.content = word;
    this.view.embeds[0] = new EmbedBuilder().setTitle(word);
    
    this.post();
  }

  getpresence(){
    
    this.message.reply(member.presence.activities[0].state);
    //console.log(JSON.stringify(this.message.guild));
    //this.message.reply(JSON.stringify(this.message.author));
    //this.message.reply('Hi, I work :eyes:');
  }

  count(){
    return new Promise((resolve, reject) => {
      let db = Database.getInstance();
  
      db.p_getLatest('counting')
      .then((result) => {
        this.message.reply('Result: ' + result.count);
        resolve(result.count);
      })
      .catch((err) => {
        this.message.reply('Error: ' + err.message);
        //reject(err);
      });
    });
  }

  create(){
    let db = Database.getInstance();
    db.create_table('test', 'id int', true);
  }

  fail(args){
    let { type } = this.extractArgs(args, 'type');

    switch(type){
      case 'permissionerror':
        throw new PermissionError();
      case 'auth': this.auth({'users':['noone']});
      default: throw Error;
    }

  }

}