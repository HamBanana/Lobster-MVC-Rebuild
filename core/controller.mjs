//import {View} from './view.mjs';
import {Time} from '../tools/time.mjs';
import { Discord } from '../core/discord.mjs';
import { PermissionError, warn } from '../core/error.mjs';
import { EmbedBuilder } from 'discord.js';

export class Controller {

  static message_retainer = {}
  functions = {};
  controllername = "";

  client = Discord.client;

  constructor(msg) {
    this.client = Discord.client;

    this.allowed = true;

    this.view = {
      components: [],
      content: '',
      type: 'reply',
      channelid: '',
      data: {},
      reactions: {},
      reaction_options: {
        filter: (reaction, user) => {
          return user.id === this.message.author.id
        },
        max: 1,
        time: 30000,
        errors: ['time']

      },
      encoding: 'utf8',
      template_path: '',
      template_type: 'string',
      addReaction: (emoji, callback = null) => {
        this.view.reactions[emoji] = callback;
      },
      embeds: []
    };

    this.message = msg;

  }

  post(content) {
    let view = this.view;
    let template_path = this.view.template_path;

    return new Promise((resolve, reject) => {
        if (template_path) {
          template_path = template_path.toLowerCase();
          var spl = template_path.split('/');
          return import('../views/' + spl[0] + '.mjs')
            .then((template_module) => {
              let template = template_module[spl[1]];
              resolve(template);
            });
        } else {
          resolve();
        }
      })
      .then((template) => {
        return new Promise((resolve, reject) => { 
          if (this.view.template_type === 'embed'){
            content = this.applyTemplate(JSON.stringify(template), this.view.data);
            content = JSON.parse(content);
            content = {embeds: [content]}
            //content = template;
          } else {
            if (!content) {
              content = this.view.content
            }
            if (typeof(content) === 'string' && template) {
              content = this.applyTemplate(template, this.view.data);
            }
            if (this.view.embeds.length > 0 || this.view.components.length > 0){
              content = {embeds:this.view.embeds, components: this.view.components};
            }
          }
            let output_message;
            if (JSON.stringify(content) == '{"default":[]}'){throw new Error({code:'SILENT'});}
            switch (this.view.type) {
              case 'reply':
                output_message = this.message.reply(content);
                break;
              case 'channel':
                output_message = this.client.channels.cache.get(this.view.channelid).send(content);
                break;
            }
            return output_message
        })
        .then((msg) => {
            // Reaction handling..
            let listen = false;
            for (let [r, c] of Object.entries(this.view.reactions)) {
              msg.react(r);
              if (c) {
                listen = true;
              }
            }
            resolve( {
              listen,
              msg
            } );
          })
      })
      .then((ret) => {
        if (ret.listen) {
          /*const filter = (reaction, user) => {
            return user.id === this.message.author.id
          };*/
          ret.msg.awaitReactions(this.view.reaction_options)
            .then((collected) => {
              if (!collected) {
                return;
              }
              let reaction = collected.first();
              for (let [r, c] of Object.entries(this.view.reactions)) {
                if (reaction.emoji.name === r) {
                  c(ret.msg);
                }
              }
            })
            .catch((err) => {
              warn('Reaction timeout hit!');
              ret.msg.delete();
            });
        }
        return ret.msg;
      })
      .catch((err) => {
        return;
      });
      
  }

  applyTemplate(template, properties) {
    var returnValue = "";

    var templateFragments = template.split("{{");

    returnValue += templateFragments[0];

    for (var i = 1; i < templateFragments.length; i++) {
      var fragmentSections = templateFragments[i].split("}}", 2);
      returnValue += properties[fragmentSections[0]];
      returnValue += fragmentSections[1];
    }

    return returnValue;
  }

  auth(permissions) {
      if (typeof(permissions) == 'undefined'){return;}
    if (!this.message) {
      warn('Controller doesn\'t know about the message object.');
      return;
    }
    for (let [k, v] of Object.entries(permissions)) {
      for (let i of v) {
        if (k === 'channels') {
          if (!v.includes(this.message.channelId)) {
            warn('Controller auth failed: channel denied');
            this.allowed = false;
          }
        }
        if (k === 'users') {
          if (!v.includes(this.message.author.id)) {
            warn('Controller auth failed: user denied');
            this.allowed = false;
          }
        }
      }
      if (!this.allowed){
        throw new PermissionError();
      }
      return;
    }
  }

  extractArgs(args, defaults = null){
    let res = {};
    if (defaults !== null){
      if (typeof(defaults) === 'string'){
        defaults = [defaults];
      }

      for (let i in defaults){
        res[defaults[i]] = args.default[i];
      }
    }

    delete args.default;

    for (let [k, v] of Object.entries(args)){
      res[k] = v;
    }

    return res;

  }

  /*help(args){

    //this.message.reply("Idk if it's helpful, but " + JSON.stringify(this.getAllFuncs(this)));
    
    return new Promise((resolve, reject) => {
      if (!this.controllername){resolve(this.message.reply('```No help here yet```')); return;}
      let {fun} = this.extractArgs(args, 'fun');
      let e = new EmbedBuilder();
      //this.view.embeds[0] = new EmbedBuilder()
      e.setTitle('Help for ' + this.controllername);
      for (let [k, v] of Object.entries(this.functions)){
        let a = v.arguments;
        e.addFields({
          name: k + ((a) ? ' ('+Object.keys(a).join(', ')+')' : '') 
          + ((k == "index") ? ' (Default function)' : ''
          + ((v.alias) ? ' (Same as !lob ' + v.alias + ')' : '')), 
          value: v.description});
      }
      this.view.embeds[0] = e;
      resolve(this.post());
    });

  }*/

  getAllFuncs(toCheck) {
    const props = [];
    let obj = toCheck;
    do {
        props.push(...Object.getOwnPropertyNames(obj));
    } while (obj = Object.getPrototypeOf(obj));
    
    return props.sort().filter((e, i, arr) => { 
       if (e!=arr[i+1] && typeof toCheck[e] == 'function') return true;
    });
}
}
