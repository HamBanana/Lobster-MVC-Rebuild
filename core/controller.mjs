//import {View} from './view.mjs';
import {Time} from '../tools/time.mjs';
import { Discord } from '../core/discord.mjs';

export class Controller {

  static message_retainer = {}

  allowed = true;

  constructor(msg) {
    this.client = Discord.client;

    this.view = {
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
      if (this.view.template_type === 'embed'){
        /*content = this.applyTemplate(JSON.stringify(template), this.view.data);
        console.log('Content: '+content+'\n\n');
        content = {embeds: [content]}*/
        content = template;
      } else {
        if (!content) {
          content = this.view.content
        }
        if (typeof(content) === 'string' && template) {
          content = this.applyTemplate(template, this.view.data);
        }
      }
        let output_message;
        switch (this.view.type) {
          case 'reply':
            output_message = this.message.reply(content);
            break;
          case 'channel':
            output_message = this.client.channels.cache.get(this.view.channelid).send(content);
            break;
        }
        return output_message
          .then((msg) => {
            // Reaction handling..
            let listen = false;
            for (let [r, c] of Object.entries(this.view.reactions)) {
              msg.react(r);
              if (c) {
                listen = true;
              }
            }
            return {
              listen,
              msg
            };
          });
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
              console.log('Reaction timeout hit!');
              ret.msg.delete();
            });
        }
        return ret.msg;
      })

    /*.catch((err) => {
      console.log('Error happened in controller.post()');
      console.log(err.message);
    });*/
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
    return new Promise((resolve, reject) => {
      if (typeof(permissions) == 'undefined'){resolve(true);}
    if (!this.message) {
      reject('Controller doesn\'t know about the message object.');
    }
    for (let [k, v] of Object.entries(permissions)) {
      for (let i of v) {
        if (k === 'channels') {
          if (!v.includes(this.message.channelId)) {
            console.log('Controller auth failed: channel denied');
            this.allowed = false;
          }
        }
        if (k === 'users') {
          if (!v.includes(this.message.author.id)) {
            console.log('Controller auth failed: user denied');
            this.allowed = false;
          }
        }
      }
      console.log('Allowed: ' + this.allowed);
      if (!this.allowed){
        resolve(false);
        return;
      }
      resolve(true);
    }

    });
  }

  help(args){
    
    this.message.reply(this.getAllFuncs([1, 3]));

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
