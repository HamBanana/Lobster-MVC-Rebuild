import {
  Controller
} from '../core/controller.mjs';
import {
  lobby_model
} from '../models/lobby_model.mjs';
import {Time} from '../tools/time.mjs';
import { channels, roles } from '../core/statics.mjs';

import {Discord} from '../core/discord.mjs';
import { Database } from '../core/database.mjs';

export class lobby_controller extends Controller {

  perm = {
    'channels': [channels['vanilla-game-chat'],
                channels['lob-test'],
                channels['vanilla-codes']
    ]
  }

  constructor(msg) {
    super(msg);
    this.auth(this.perm);
    this.model = new lobby_model();

    this.controllername = 'lobby';
    this.functions = {
      confirm_lobby: {
        alias: 'lobby',
        description: 'Confirm game has entered lobby.',
        arguments: {
          code: 'The code of the lobby.'
        }
      },
      create: {
        description: 'Creates a new lobby',
        arguments:{
          code:'The code for joining the lobby',
          server: 'The server for joining the lobby'
        }
      },
      register_infohost: {
        description: 'Registers yourself as infohost.\nAs infohost, you activity status will be used for tracking active Among Us lobbies.'
      },
      unregister_infohost: {
        description: 'Removes registration as infohost, Lobster will not read your activity status.'
      },

      delete: {
        description: 'Deletes a lobby',
        arguments: {
          code: 'The code of the lobby to be deleted.'
        }
      },

      queue:{
        description: 'Join the queue for a lobby.',
        alias: 'join',
        arguments: {
          code: 'The code of the lobby to join'
        }
      },
      unqueue:{
        description: 'Leave the queue for a lobby.',
        alias: 'unjoin',
        arguments: {
          code: 'The code of the lobby to unjoin from.'
        }
      },
      list:{
        description: 'Shows a list of active_lobbies'
      },
      announce:{
        description: 'Sets up a trigger that automatically posts the lobby code when you enter a lobby',
        arguments: {
          is_vc_lobby: 'true, if the lobby uses voice chat',
          is_vanilla: 'true, if the lobby is not modded'
        }
      },
      unannounce: {
        description: 'Removes trigger to post code when you enter a lobby'
      }
    };
  }

  index(args){
    
  }

  test_input(input) {
    console.log(input);
    
    if (input.default[0] == 'join'){
      input = input.default.join(' ');
    }
    input = input.toUpperCase();
    let code = /([^\w]|^)(\w{5}[FQ])([^\w]|$)/.exec(input)?.[2];
    if (!code) {
      console.log('Not a code');
      return;
    }
    let match_server = /([^\w]|^)((EU|EUR|EUROPE)|(NA|AMERICA|NORTH\sAMERICA|USA|US)|(ASIA))([^\w]|$)/.exec(input);
    let server;
    if (match_server?.[3]) {
      server = 'EUROPE';
    }
    if (match_server?.[4]) {
      server = 'NORTH AMERICA';
    }
    if (match_server?.[5]) {
      server = 'ASIA';
    }

    if (!code) {
      return;
    }

    if (!lobby_model.active_lobbies[code]) {
      return (server) ? this.prompt_create({
        default: [code, server]
      }) : this.prompt_server({
        default: [code]
      });
    }
    let lc = lobby_model.active_lobbies[code];
    code = lc.code;
    server = lc.server;
    return this.prompt_lobby({code, server});

  }

  prompt_lobby(args){
    const code      = (args.code || args.default?.[0]);
    const server    = (args.server || args.default?.[1]);
    const host      = (args.host || args.default?.[2]);
    const pingtime  = (args.pingtime);
    this.view.data = {code, server}

    this.view.addReaction('✅', (msg) => {
      console.log(args.code);
      return this.confirm_lobby({code:args.code});
    });
    this.view.addReaction('❌',(msg) => {
      return msg.delete();
    });

    this.view.template_path = 'lobby/prompt_lobby';
    this.post();
  }

  confirm_lobby(args){
    let code = (args.code || args.default[0])?.toUpperCase();
    console.log('code: ' + code);
    const conf = lobby_model.active_lobbies[code];
    const server    = (conf.server || conf.default?.[1]);
    const state     = "In Lobby";
    const host      = (conf.host || conf.default?.[2]);
    const pingtime  = (Time.now);

    this.model.confirm_lobby({code, pingtime, state}, (err, res) => {
      if (err){
        if (this.message){ this.message.reply("Couldn't update lobby, because: " + err.message);}
        else {this.message.reply("Couldn't update lobby, because: " + err.message);}
      }
      
      // If all went well, post the confirm_lobby.
      this.view.template_path = 'lobby/confirm_lobby';
      let is_vanilla = (conf.is_vanilla) ? 'Yes' : 'No';
      let is_vc_lobby = (conf.is_vc_lobby) ? 'Yes' : 'No';
      this.view.data = {server, state, pingtime, host:this.client.users.cache.get(host).username, mentions: res.mentions, code, is_vanilla, is_vc_lobby};
      this.view.type = "channel";
      this.view.channelid = channels['vanilla-game-chat'];
      lobby_model.active_lobbies[code].queue = [];
      this.post();
    });
  }

  create(args) {
    if (!(args.code || args.default[0]) || !(args.server || args.default[1])){
      this.message.reply('create function must follow the format: !lob lobby create {code} {server}'); return;
    }
  let host = args['host'] || this.message.author.id;
  let code = (args.code || args.default[0]).toUpperCase() || null;
  let server = (args.server || args.default[1]).toUpperCase() || null;
    this.view.data['server'] = server;
    this.view.data['code'] = code;
    this.view.data['host'] = this.message.author.username;
    this.view.data['pingtime'] = Time.now;
    this.view.data['is_vc_lobby'] = args['is_vc_lobby'] || '0';
    this.view.data['is_vanilla'] = args['is_vanilla'] || '1';
    let {pingtime, is_vc_lobby, is_vanilla} = this.view.data;


    this.model.create({code, server, host}, (err, res = null) => {
      if (err){
        switch(err.code){
          case "ER_DUP_ENTRY": this.message.reply('Lobby "' + code + '" already exists.'); break;
          case "ER_DATA_TOO_LONG": this.message.reply('"' + code + '" is too long to be a lobby code'); break;
          default: this.message.reply("Could not create lobby because: " + err.message);
        }
        return;
      }
      this.view.reactions = {};
      this.view.template_path = 'lobby/create';
      this.post();
    });

  }

  edit(args){
    let { id, code, member_id, voicechat, is_vanilla, notes, server } = this.extractArgs(args, 'code');
    if (id){
      this.model.edit(args, 'id')
    }
  }

  register_infohost(){
    this.model.register_infohost({member_id: this.message.author.id}, (err, res) => {
      if (err){return this.message.reply("Couldn't register you as infohost, because: " + err.message);}
      return this.message.reply('Lobster will now use your activity info to ping when lobbies\nYou can use "!lob lobby announce" to automatically ping archetype when lobby starts.');
    });
  }

  unregister_infohost(){
    this.model.unregister_infohost({member_id: this.message.author.id}, (err, res) => {
      if (err){return this.message.reply("Couldn't unregister you as infohost, because: " + err.message);}
      return this.message.reply('You are no longer registered as infohost.');
    });
  }

  delete(args){
    //const code = (args.code || args.default?.[0]).toUpperCase();
    const { code } = this.extractArgs(args, 'code');
    if (!code){return this.message.reply('Delete what?');}
    //let host = this.model.getLobby(code).host;
    /*if (host !== this.message.author.username){
      this.message.reply('Only host can delete the lobby.');
      return false;
    }*/
    this.model.delete({code: code, user: this.message.author.id}, (err) => {
      if (err){
        return this.message.reply('Error while deleting lobby "' + code + '": ' + err.message);
      }
    return this.message.reply('Deleted: '+code);
    });
  }

  /*queue(args){
    let code = (args.code || args.default?.[0]).toUpperCase();
    if (this.model.queue(this.message.author.id, code)) {return this.message.react('👍');}
    return false;
  }*/



  queue(args){
    let code = (args.code || args.default?.[0]);
    if (!code ||code == '' || code == 'undefined' || code == undefined || typeof(code) == undefined){
      code = lobby_model.active_lobbies[0].code;
      this.message.reply('You forgot the code :eyes:')
      return;
    }

    let q_args = {
      member_id: this.message.author.id,
      usertag: this.message.author.username,
      code: code?.toUpperCase()
    };

    console.log('args in lobby_controller.queue: ' + JSON.stringify(q_args));
    
    this.model.queue(q_args, (err, res) => {
      if (err){
        switch (err.code){
          case "ER_DUP_ENTRY": this.message.reply("You are already in the queue."); return;
          default: this.message.reply("Couldn't join because: " + err.message); break;
        }
        
      if (err.sql){this.message.reply('sql: ' + err.sql);}
      return;
      }
      this.message.react('👍');
      return;
    });
  }

  unqueue(args){
    let code = (args.code || args.default?.[0]);
    code = code.toUpperCase();
    this.model.unqueue({lobby_code: code, member_id: this.message.author.id}, (err, res) => {
      if (err){return this.message.reply("Couldn't unjoin because: " + err.message);}
      return this.message.react('👍');
    });
    return false;
  }

  prompt_create(args) {
    this.view.data['server'] = (args.server || args.default?.[1]).toUpperCase();
    this.view.data['code'] = (args.code || args.default?.[0]).toUpperCase();
    this.view.data['host'] = args['host'] || this.message.author.username;
    this.view.template_path = 'lobby/prompt_create';
    this.view.reaction_options.time = 15000;

    this.view.addReaction('✅', (msg) => {
      let {code, server, host} = this.view.data;
      msg.delete();
      this.create({code, server, host});
    });
    this.view.addReaction('❌', (msg) => {
      msg.delete();
    });

    this.post();
  }

  prompt_server(args) {
    if (!args.code && !args.default[0]) {
      return;
    }
    this.view.data['code'] = (args.code || args.default[0]).toUpperCase();
    this.view.data['host'] = this.message.author.username;

    Promise.all([
      this.view.addReaction('🇪🇺', (msg) => {
        this.view.data['server'] = 'EUROPE';
        msg.delete().then(() => {
        this.create(this.view.data);
        });
      }),
      this.view.addReaction('🇺🇸', (msg) => {
        msg.delete();
        this.view.data['server'] = 'NORTH AMERICA';
        this.create(this.view.data);
      }),
      this.view.addReaction('🇯🇵', (msg) => {
        msg.delete();
        this.view.data['server'] = 'ASIA';
        this.create(this.view.data);
      }),
      this.view.addReaction('❌', (msg) => {
        this.model.cancel(this.view.data['code']);
        this.message.reply('Lobby creation cancelled');
      })
    ]);
    this.view.template_path = 'lobby/prompt_server';
    this.post();
  }

  list(args){
    this.view.template_path = 'lobby/confirm_lobby';
    if (Object.keys(lobby_model.active_lobbies).length === 0){
      return this.message.reply('There are no active lobbies :eyes:');
    }
    for(let [k, v] of Object.entries(lobby_model.active_lobbies)){
      new Promise((resolve, reject) => {
       this.view.data = v;
        resolve(this.message.reply('Hosted by: '+v.host+'\n'+v.code+' - '+v.server+'\nLast active: '+Time.getTag(v.pingtime)+'\nWrite "!lob join '+v.code+'", to join this lobby.'));
        //resolve(this.post());
      }).catch((err) => {
      console.log('Failed in lobby/list: '+err);
    });
    }
  }

  /*getAnnounced(args, callback){
    if (!args.member_id){return callback({message: "getAnnounced only works with a member_id"});}
    this.db.get('*', 'lobby_announced', "member_id = " + args.member_id, (err, res) => {
      return callback(err, res);
    });
  }*/

  announce(args){
    /*if (lobby_model.infohosts.indexOf(this.message.author.id) < 0){
      return this.message.reply('Please run "!lob lobby register_infohost" register as infohost, before using "announce"');
    }*/
    this.message.reply('Please ensure that you have enabled "Share your activity status with others" in Activity settings');
    let {is_vanilla} = this.extractArgs(args);
    if (!is_vanilla){is_vanilla = 1;}

    this.model.announce({host: this.message.author.id, is_vanilla}, (err, res) => {
      if (err){
        switch (err.code){
          case "ER_DUP_ENTRY": return this.message.reply('You have already announced a lobby.\nTo change lobby settings, run "!lob lobby unannounce" first.');
          default: return this.message.reply("Can't announce lobby, because: " + err.message)
        }
      }
      this.message.react('👍');
    });
  }

  unannounce(){
    this.model.unannounce({member_id: this.message.author.id}, (err, res) => {
      if (err){
        switch (err.code){
          default: return this.message.reply("Can't unannounce lobby, because: " + err.message);
        }
      }
      if (res.affectedRows < 1){return this.message.reply('You have no announced lobbies.');}
      this.message.react('👍');
    });
  }


  static clearOld(){
    let db = Database.getInstance();
    db.p_get('lobby_active_lobbies').then((lobbies) => {
      for (let i in lobbies){
        let lobby = lobbies[i];
        if(Time.now - lobby.pingtime > 180000){
          db.p_delete('lobby_active_lobbies', {code:lobby.code}).then((res) => {
            if (res){
              console.log('Deleted: ' + lobby.code);
            }
          });
        }
      }
    });
  }
  
  testPresence(oldPresence, newPresence){
    console.log('Infohosts: ' + JSON.stringify(lobby_model.infohosts));
    let oldActivity = oldPresence?.activities[0];
    let newActivity = newPresence?.activities[0];
        //let c = this.client.channels.cache.get('1200927450536890429');
    if (oldActivity && newActivity){
      if (oldActivity.name !== "Among Us" || newActivity.name !== "Among Us"){return;}
    }
    
      if (oldActivity?.state == 'In Menus' && newActivity?.state == 'In Lobby'){
        /* Check if lobby has been announced */
        this.model.getAnnounced({host: newPresence.userId}, (err, res) => {
          if (err){
            return console.log('Error while getting announced lobbies in lobby_controller.testPresence: ' + err.message);
          }
          if (res.length < 1){
            return;
          }

          let create_vals = {
            code: newActivity.party.id, 
            host: newPresence.userId,
            state: newActivity.state
          }

          this.model.edit(create_vals, { host: newPresence.userId })
          .then((res) => {
            // Unannounce the upcoming lobby, as it has started.
            /*this.model.unannounce({newPresence}, (err) => {
              if (err){return console.log('Unannounce failed because: ' + err.message);}
            });*/
            
            
            //if (cerr){return console.log('Error creating lobby from testPresence: ' + cerr.message);}
            //else if (!res){console.log('There are somehow no announced lobbies (we have just determined that there is, so this is a coding error.)');}
            //else {console.log('Created lobby from testPresence: ' + newActivity.party.id);}

            // Create the view
            this.view.template_path = 'lobby/autocreate';
            this.view.data['host'] = this.client.users.cache.get(newPresence.userId).username;
            this.view.data['code'] = newActivity.party.id;
            this.view.data['server'] = res.server;
            this.view.data['is_vc_lobby'] = res.is_vc_lobby;
            this.view.data['is_vanilla'] = res.is_vanilla;
            this.view.data['notes'] = res.notes;
            this.view.data['pingtime'] = res.pingtime;
            this.view.data['pingrole'] = (res.is_vanilla) ? roles['archetype'] : roles['avant-garde'];

            this.view.type = "channel";
            this.view.channelid = channels['lob-test'];
            //this.view.channelid = channels['vanilla-codes'];
            this.post();
          });

        });

      }

      if (oldActivity?.state == "In Lobby" && newActivity?.state == "In Game"){
        // Code for when a game is started.
        return;
      }

      if (oldActivity?.state == "In Game" && newActivity?.state == "In Lobby"){
        // When game ends, ping the relevant queue
        return;
        let code = newActivity.party.id;
        if (!lobby_model.active_lobbies[code].infohost == newActivity.userId){return;}
        this.confirm_lobby({code: newActivity.party.id});
      }

      if ((oldActivity?.state == "In Lobby" || oldActivity?.state == "In Game") && (newActivity?.state == "In Menus" || newActivity == undefined)){
        // Infohost left a game
        return;
        let code = oldActivity.party.id;
        this.model.assign_infohost(code, (err, res) => {
          
        });
      }
      /*if (oldActivity?.state == "In Lobby" && newActivity?.state == "In Game"){
        return c.send('Game "' + oldActivity.party.id + '" started..');
      }
      if (oldActivity?.state == "In Game" && newActivity?.state == "In Lobby"){
        return c.send('Game "' + newActivity.party.id + '" back in lobby.');
      }*/
    

/*
oldGame: {"id":"c2ee28cca9f91a0a","name":"Among Us","type":"PLAYING","url":null,"details":null,"state":"In Menus",
"applicationId":"477175586805252107","timestamps":{"start":null,"end":null},"syncId":null,"platform":null,"party":{},"assets":{"largeText":null,"smallText":null,"largeImage":"481347538054545418","smallImage":null},"flags":0,"emoji":null,"sessionId":null,"buttons":[],"createdTimestamp":1708285670179}
newGame: {"id":"c2ee28cca9f91a0a","name":"Among Us","type":"PLAYING","url":null,"details":"Hosting a game","state":"In Lobby",
"applicationId":"477175586805252107","timestamps":{"start":null,"end":null},"syncId":null,"platform":null,"party":{"size":[1,15],"id":"ETSJBF"},"assets":{"largeText":"Ask to play!","smallText":null,"largeImage":"481347538054545418","smallImage":null},"flags":2,"emoji":null,"sessionId":"7a3226be744ff891e6d60ca190becd3d","buttons":[],"createdTimestamp":1708285687339}

*/
  }
}
