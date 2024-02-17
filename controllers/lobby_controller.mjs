import {
  Controller
} from '../core/controller.mjs';
import {
  lobby_model
} from '../models/lobby_model.mjs';
import {Time} from '../tools/time.mjs';
import { channels } from '../core/statics.mjs';

import {Discord} from '../core/discord.mjs';

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
  let host = args['host'] || this.message.author.id;
  //let host = args['host'] || this.message.author.username;
  if ((!args.code && !args.default?.[0]) || 
  (!args.server && !args.default?.[1])){return;}
    console.log('args in create: '+JSON.stringify(args));
    this.view.data['server'] = (args.server || args.default[1]).toUpperCase();
    this.view.data['code'] = (args.code || args.default[0]).toUpperCase();
    this.view.data['host'] = this.message.author.username;
    this.view.data['pingtime'] = Time.now;
    this.view.data['is_vc_lobby'] = args['is_vc_lobby'] || '0';
    this.view.data['is_vanilla'] = args['is_vanilla'] || '1';
    let {code, server, pingtime, is_vc_lobby, is_vanilla} = this.view.data;

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
      return this.post();
    });

  }

  delete(args){
    const code = (args.code || args.default?.[0]).toUpperCase();
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
    if (!code){
      code = lobby_model.active_lobbies[0].code;
    }

    let q_args = {
      member_id: this.message.author.id,
      usertag: this.message.author.username,
      code: code?.toUpperCase()
    };

    console.log('args in queue_controller: ' + JSON.stringify(q_args));
    
    this.model.queue(q_args, (err, res) => {
      if (err){this.message.reply("Couldn't join because: " + err.message); 
      if (err.sql){this.message.reply('sql: ' + err.sql);}
      return;}
      this.message.react('👍');
    });
    return false;
  }

  unqueue(args){
    console.log('args: '+JSON.stringify(args));
    let code = (args.code || args.default?.[0]);
    if (!code){
    const al = lobby_model.active_lobbies;
    const ok = Object.keys(al);
    code = al[ok[ok.length - 1]].code;
      console.log('code: '+code);
    }
    code = code.toUpperCase();
    this.model.unqueue({code, usertag: this.message.author.id}, (err, res) => {
      if (err){this.message.reply("Couldn't unjoin because: " + err.message);}
      return this.message.react('👍');
    });
    return false;
  }

  /*create(args){
    this.view.data['server'] = (args.server || args.default?.[1]).toUpperCase();
    this.view.data['code'] = (args.code || args.default?.[0]).toUpperCase();
    this.view.template_path = 'lobby/create';
    this.post();
  }*/

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

  clearOld(){
    for (let [k, v] of Object.entries(lobby_model.active_lobbies)){
      if (Time.now - v.pingtime > (3 * 60 * 60)){
        console.log('Deleting '+k);
        delete lobby_model.active_lobbies[k];
      }
    }
  }
}
