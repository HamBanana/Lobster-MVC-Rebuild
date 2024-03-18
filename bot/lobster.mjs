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
      let pf = '!lob';
      if (process.env.OS == 'Windows' && msg.author.id == members.Ham){
        pf = '!test';
      } else {
        pf = '!lob';
      }

      if (msg.content.toLowerCase().startsWith(pf)){
        let parser = new Parser(msg);
        //return this.parseCommand(msg)
        parser.parseCommand(msg)
        .then((command) => { 
          return parser.executeCommand(command)
          
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
