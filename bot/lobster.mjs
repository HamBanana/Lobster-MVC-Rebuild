import {Discord} from '../core/discord.mjs';
//import {View} from '../core/view.mjs';
import * as fs from 'fs';
import * as count from '../controllers/count_controller.mjs';
import * as gif from '../tools/gif.mjs';
import { channels, members } from '../core/statics.mjs';
import { lobby_controller } from '../controllers/lobby_controller.mjs';
import {Parser} from './parser.mjs';

export class Lobster extends Discord{

  #method_alias = {
    'd'   : 'random.dice',
    'dice': 'random.dice',
    'c'   : 'random.coin',
    'coin': 'random.coin',
    'join': 'lobby.queue',
    'unjoin': 'lobby.unqueue',
    'list': 'lobby.list',
    'code': 'lobby.list',
    'kill': 'lobby.delete',
    'create': 'lobby.create',
    'reboot': 'manage.reboot'
  }

  static channels = {
    'spam': '949274005511229520',
    'game-codes': '883526058236854312'
  }

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

      if (msg.content.toLowerCase().startsWith('!lob')){
        let parser = new Parser(msg);
      //return this.parseCommand(msg)
      return parser.parseCommand(msg).then((command) => { parser.executeCommand(command); })
      .catch((err) => {
        if (err.message == "Cannot read properties of undefined (reading 'bind')"){
          return msg.reply("That's not a function.");
        }
        if (err){
          switch (err.code){
            case "ERR_MODULE_NOT_FOUND":
              return msg.reply("That's not a thing.");
            default:
            if (msg.channelId == channels['lob-test']){
              msg.reply('Error: ' + err.code);
              msg.reply('Error: ' + err.message);
              console.log('Error: ' + JSON.stringify(err));
            } else {
              msg.reply(gif.random('denied'));
            }
            return;
          }
        }
        //msg.reply(gif.random('denied'));
        //console.log('Controller import failed: '+err.message);
      });

      }
        // Test the string for other triggers.
        import('../controllers/end_controller.mjs')
        .then((module) => {
          let ins = new module.end_controller(msg);
          if (!ins.allowed){
            console.log('Permission error');
            return;
          }
          return ins.test_input(msg.content);
        })
        .then(() => {
          let cc = new count.count_controller(msg);
            cc.test_string();
        })
        .then(() => {
      // input random eyes reaction..
      //if (Math.random() < 0.05){msg.react('👀').catch((err) => {console.log('Failed reacting to a message.')});}
          })
          .catch((err) => {
            return console.log('Error in other triggers: ' + err.message);
          });
    });

    client.on('interactionCreate', (interaction) => {
      console.log('interaction: '+interaction);
    });

    // When client has logged in
    client.on("ready", (client) => {
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

  let lm = new lobby_controller();
  lm.testPresence(oldPresence, newPresence);

})

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
