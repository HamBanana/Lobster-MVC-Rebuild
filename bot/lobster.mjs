import {Discord} from '../core/discord.mjs';
//import {View} from '../core/view.mjs';
import * as fs from 'fs';
import * as count from '../controllers/count_controller.mjs';
import * as gif from '../tools/gif.mjs';
import { channels, members } from '../core/statics.mjs';
import { lobby_model } from '../models/lobby_model.mjs';
import {Parser} from './parser.mjs';
import { Database } from '../core/database.mjs';

export class Lobster extends Discord{

  constructor(){
    super();
    console.log('Lobster started.');
    let client = Discord.client;
    this.login();
    setInterval(this.interval, 10000);

    // Listen for Discord events.

    client.on('messageCreate', (msg) => {
      if (msg.author.bot 
          || msg.channelId == channels['serious-topics']
          || msg.channelID == channels['venting'] 
         || msg.content.length > 2000) {return;}
      //console.log(msg);
      console.log('Input: '+msg.content);
      let pf;
      if (process.env.OS == 'Windows' && msg.author.id == members.Ham){
        pf = '!';
      } else {
        pf = '!lob ';
      }

      if (msg.content.toLowerCase().startsWith(pf)){
        let parser = new Parser(msg);

        console.log('Content before slice: ' + msg.content);
        let cmd = msg.content.slice(pf.length, msg.content.length);
        console.log('CMD after slice: ' + cmd);

        parser.parseCommand(cmd)
        .then((command) => { 
          return parser.executeCommand(command)
          
        })
        .catch((err) => {
          if (typeof(err) == 'string'){err = {'message':err};}
          console.log('Error code: ' + err.code);
          switch(err.code){
            case 'ERR_MODULE_NOT_FOUND': return msg.reply('The controller doesn\'t exist, I guess?');
            case 'PERMISSION_DENIED': return msg.react('<:no:1047889973631782994>');
            case 'ENOENT': return msg.reply("That controller doesn't exist");
            default:
              if (err.message == "Cannot read properties of undefined (reading 'bind')"){
                return msg.reply('That function does not exist');
              }
            msg.reply('Error because: ' + err.message); 
            console.log('Execute command failed:\n' 
            + 'Message: ' + err.message
            + '\nCode: ' + err.code
            + '\nStack: ' + (err.stack) ? err.stack : 'No stack.'
            );
            return;
          }
        });
      } else {
        // Test the string for other triggers.
        return import('../controllers/end_controller.mjs')
      .then((module) => { return new module.end_controller(msg); })
      .then((ins) => { ins.auth(ins.perm); return ins;})
      .then((ins) => {
        return ins.test_input(msg.content);
      })
        .then(() => {
          let cc = new count.count_controller(msg);
            cc.test_string();
        })
        .then(() => {
      // input random eyes reaction..
      //if (Math.random() < 0.05){msg.react('👀').catch((err) => {console.log('Failed reacting to a message.')});}
          });
      }
          
    });

    client.on('interactionCreate', (interaction) => {
      console.log('interaction: '+interaction);
    });

    // When client has logged in
    client.on("ready", (client) => {
      let db = Database.getInstance();
      let message = "";
      if (process.env.OS == "Windows"){
        
      }
  console.log("Logged in as " + client.user.tag);
  let c = client.channels.cache.get('1200927450536890429');
  if (!c){
    console.log("Could not send startup message, channel not found.");
  } else if (c == undefined) {
    console.log('Can\'t get channel for startup message');
  } else {
    c.send('Hello?');
  }
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
  //let c = client.channels.cache.get('1200927450536890429');
  if (oldPresence == null && newPresence == null){
    console.log('presenceUpdate, but no presence is present');
    return;
  }
  //console.log('oldPresence:'+ JSON.stringify(oldPresence || 'oldPresence is null'));
  //console.log('newPresence:'+ JSON.stringify(newPresence || 'newPresence is null'));

  let lm = new lobby_model();
  lm.testPresence(oldPresence, newPresence);

});

  /*this.client.on('reactionCreate', (reaction) => {
  console.log('Reaction: '+reaction);
  });*/

    client.on("messageReactionAdd", (reaction, user) => {
      console.log(user.username+' reacted with: '+reaction.emoji.name);
    });

    client.on("messageReactionRemove", (reaction, user) => {
      console.log(user.username+' removed reaction: '+reaction.emoji.name);
    });

    /*this.client.setInterval(() => {
      console.log('setInterval hit..');
    })*/;
  }

  interval(){
    /*import('../controllers/lobby_controller.mjs')
    .then((mod) => {
      let ins = new mod.lobby_controller();
      ins.clearOld();
    });*/
  }

}
