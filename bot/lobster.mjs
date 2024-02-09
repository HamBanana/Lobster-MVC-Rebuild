import {Discord} from '../core/discord.mjs';
//import {View} from '../core/view.mjs';
import * as fs from 'fs';
import * as count from '../controllers/count_controller.mjs';
import * as gif from '../tools/gif.mjs';

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
          || msg.channelId == 992089336109617283 
          || msg.channelID == 1007147411552096376
         || msg.content.length > 2000) {return;}
      //console.log(msg);
      console.log('Input: '+msg.content);
      if (msg.content.toLowerCase().startsWith('!lob')){
      return this.parseCommand(msg)
      .catch((err) => {
        console.log('command failed to parse: ' + err);
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
      if (Math.random() < 0.05){msg.react('👀').catch((err) => {console.log('Failed reacting to a message.')});}
          });
    });

    client.on('interactionCreate', (interaction) => {
      console.log('interaction: '+interaction);
    });

    client.on("ready", (client) => {
  console.log("Logged in as " + client.user.tag);
  client.guilds.cache.get("1200927450536890429").channels.cache.get("1200927450536890429").send('Hello?');
  let c = client.channels.fetch('1200927450536890429');
  if (!c){
    console.log("Could not send startup message, channel not found.");
  } else {
    console.log('Startup message: '+c.id);
  }
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

  parseCommand(msg){
    return new Promise((resolve, reject)=> {
      let c = (typeof(msg) === 'string') ? msg : msg.content.toLowerCase();
      if (!c.startsWith('!lob') && c.startsWith('!lobster')){return;}
      let parms = c.split(" ");

      let command = {
        'controller': parms[1] || 'index',
        'method'    : parms[2] || 'index',
        'args'      : parms.splice(3)
      };

      //Test if command is an alias
      for (let [k, v] of Object.entries(this.#method_alias)){
        if (k !== parms[1]){continue;}
        let spl = v.split('.');
        command = {
          'controller': spl[0],
          'method'    : spl[1],
          'args'      :parms.splice(2)
        };
      }
        {
          let args = {'default': []};
          for (let i of command.args){
            if (i.includes(":")){
              let spl = i.split(":")
              args[spl[0]] = spl[1];
            } else {
              args['default'].push(i);
            }
          }
          command['args'] = args;
        }
        let ctrlpath = "../controllers/"+command.controller+"_controller.mjs";
        if (fs.existsSync(ctrlpath)){
          console.log(command.controller+' is not a valid controller.');
          return;
        }
      return import(ctrlpath).then((module) => {
        let cons = eval('module.'+command.controller+'_controller');
        let ins = new cons(msg);
        if (!ins.allowed) {
          reject('Permission denied!');
          msg.react('<:no:1047889973631782994>');
          return;
        }
        let func = eval("ins."+command.method+'.bind(ins)');
        if (typeof(func) !== 'function'){reject(String(func)+' is not a valid function of '+command.controller);}
      // Execute the parsed function.
        resolve(func(command.args));
        })
        .catch((err) => {
          msg.reply(gif.random('denied'));
          if (msg.channelID == '1200927450536890429'){
            msg.reply('Error: ' + err.message);
          }
          console.log('Controller import failed: '+err.message);});
    })
      .catch((err) => {
        //client.channels.get('1200927450536890429').send('Error: '+err.message);
        this.message.reply("Error: "+err.message);
      });
  }

  interval(){
    import('../controllers/lobby_controller.mjs')
    .then((mod) => {
      let ins = new mod.lobby_controller();
      ins.clearOld();
    });
  }

}
