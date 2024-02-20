import {
  Controller
} from '../core/controller.mjs';
import {
  lobby_model
} from '../models/lobby_model.mjs';
import {Time} from '../tools/time.mjs';
import { channels } from '../core/statics.mjs';

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
  }

  index(args){
    console.log('lobby/index hit');
    return this.confirm_lobby(args);
  }

  test_input(input) {
    console.log(input);
    //console.log(input.default);
    //console.log(input['default']);
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
    let code = (args.code || args.default[0]).toUpperCase();
    const conf = this.model.getLobby(code);
    const server    = (conf.server || conf.default?.[1]);
    const host      = (conf.host || conf.default?.[2]);
    const pingtime  = (Time.now);

    this.model.updateLobby(code, {pingtime});
    this.view.data = this.model.getLobby(code);
    if (this.view.data === false){
      return this.message.reply('No! :eyes:');
    }

    this.view.data.pingtime_tag = Time.getTag(this.view.data.pingtime);
    this.view.template_path = 'lobby/confirm_lobby';

    let mentions = '';
    for (let i of lobby_model.active_lobbies[code].queue){
      mentions += '<@'+i+'> ';
    }
    lobby_model.active_lobbies[code].queue = [];

    this.view.data.mentions = mentions;

    this.view.reactions = {};

    this.post();
  }

  create(args) {
    if (!(args.code || args.default[0]) || !(args.server || args.default[1])){
      this.message.reply('create function must follow the format: !lob lobby create {code} {server}'); return;
    }
  let host = args['host'] || this.message.author.id;
  let code = (args.code || args.default[0]).toUpperCase() || null;
  let server = (args.server || args.default[1]).toUpperCase() || null;
  //let host = args['host'] || this.message.author.username;
  /*if ((!args.code && !args.default?.[0]) || 
  (!args.server && !args.default?.[1])){return;}*/
    console.log('args in create: '+JSON.stringify(args));
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
      this.post().then(() => {
        this.queue({code, is_in_queue: 0});
      });
    });

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
    const code = (args.code || args.default?.[0]).toUpperCase();
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
    console.log('code: ' + code);
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

  test(){
    this.post(':eyes:');
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

  

  testPresence(oldPresence, newPresence){
    if (!lobby_model.infohosts.includes(oldPresence?.userId)){return;}
    let oldActivity = oldPresence?.activities[0];
    let newActivity = newPresence?.activities[0];
    let client = Discord.client;
        let c = client.channels.cache.get('1200927450536890429');
    if (oldActivity && newActivity){
      if (oldActivity.name !== "Among Us" || newActivity.name !== "Among Us"){return;}
    }
    /*if (oldActivity){
      console.log('oldGame: ' + JSON.stringify(oldActivity));
    }
    if (newActivity){
      console.log('newGame: ' + JSON.stringify(newActivity));
    }*/

    if (newPresence){
      console.log('newPresence: ' + JSON.stringify(newPresence));
    }
    //if (newActivity !== 'Among Us')
      if (oldActivity?.state == 'In Menus' && newActivity?.state == 'In Lobby'){

        return c.send('Just started a lobby: ' + newActivity.party.id);

      }
      if (oldActivity?.state == "In Lobby" && newActivity?.state == "In Game"){
        return c.send('Game "' + oldActivity.party.id + '" started..');
      }
      if (oldActivity?.state == "In Game" && newActivity?.state == "In Lobby"){
        return c.send('Game "' + newActivity.party.id + '" back in lobby.');
      }
    

/*
oldGame: {"id":"c2ee28cca9f91a0a","name":"Among Us","type":"PLAYING","url":null,"details":null,"state":"In Menus",
"applicationId":"477175586805252107","timestamps":{"start":null,"end":null},"syncId":null,"platform":null,"party":{},"assets":{"largeText":null,"smallText":null,"largeImage":"481347538054545418","smallImage":null},"flags":0,"emoji":null,"sessionId":null,"buttons":[],"createdTimestamp":1708285670179}
newGame: {"id":"c2ee28cca9f91a0a","name":"Among Us","type":"PLAYING","url":null,"details":"Hosting a game","state":"In Lobby",
"applicationId":"477175586805252107","timestamps":{"start":null,"end":null},"syncId":null,"platform":null,"party":{"size":[1,15],"id":"ETSJBF"},"assets":{"largeText":"Ask to play!","smallText":null,"largeImage":"481347538054545418","smallImage":null},"flags":2,"emoji":null,"sessionId":"7a3226be744ff891e6d60ca190becd3d","buttons":[],"createdTimestamp":1708285687339}

*/
  }


  clearOld(){
    for (let [k, v] of Object.entries(lobby_model.active_lobbies)){
      if (Time.now - v.pingtime > (3 * 60 * 60)){
        console.log('Deleting '+k);
        delete lobby_model.active_lobbies[k];
      }
    }
  }
}
