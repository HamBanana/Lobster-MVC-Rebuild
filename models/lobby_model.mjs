import { Database } from '../core/database.mjs';
import { Model } from '../core/model.mjs';
import { Time } from '../tools/time.mjs';

export class lobby_model extends Model {

  static active_lobbies = {};
  static active_players = {};
  static infohosts = [];

  table_active_lobbies = "\
  id INT AUTO_INCREMENT NOT NULL, \
  code CHAR(6) UNIQUE NOT NULL, \
  server VARCHAR(6), \
  creationtime BIGINT, \
  pingtime BIGINT, \
  is_vc_lobby TINYINT(1), \
  host VARCHAR(20), \
  is_vanilla TINYINT(1), \
  notes TEXT, \
  infohost VARCHAR(25), \
  state varchar(8), \
  PRIMARY KEY (id)\
  ";

  table_infohosts = 
  'id INT AUTO_INCREMENT NOT NULL, '
  +'member_id VARCHAR(25) UNIQUE, '
  +'PRIMARY KEY (id)';

  object_lobby = {
    
  }

  table_queue = "\
  id INT AUTO_INCREMENT, \
  member_id VARCHAR(20) UNIQUE, \
  usertag VARCHAR(40), \
  join_request_time BIGINT, \
  lobby_code VARCHAR(6), \
  is_infohost TINYINT(1), \
  PRIMARY KEY (id) \
  "

  constructor(){
    super();
    console.log('lobby_model constructor');
  }
  
  create(args, callback) {
    //if (lobby_model.active_lobbies[code]) {
    //  return false;
    //}
    return this.db.create_table('lobby_active_lobbies', this.table_active_lobbies, true, (error) => {
      if (error){
        console.log('Error when trying to create lobby_active_lobbies: ' + error.message);
        callback(err, res);
        return;
      }
      let values = {
        code: args.code,
        server: args.server,
        host: args.host,
        creationtime: Time.now,
        pingtime: Time.now,
        is_vc_lobby: args.is_vc_lobby || 0,
        notes: args.notes || ''
      };
      this.db.insert('lobby_active_lobbies', values, (err, res) => {
        if (err){
          console.log('Error while inserting new active lobby: ' + err.message);
          callback(err);
          console.log('Error when inserting new player: ' + err.message);
          return;
        }
        console.log('res = ' + JSON.stringify(res));
        // No error happened
        lobby_model.active_lobbies[args.code] = values;
        callback(err, res);
      });
    });
  }

  getLobby(code) {
    return lobby_model.active_lobbies[code] || false;
  }

  delete(args, callback)
  {
    let code = args.code;
    let user = args.user;
    this.db.get('*', 'lobby_active_lobbies', 'host = "' + user + '" AND code = "' + code + '"', (err, res) => {
        if (err){
          callback(err); return;
        }
        //console.log("Result of testing for host and code: " + JSON.stringify(res));
        //callback({ message: JSON.stringify(res)});
        if (res.length == 0){
          callback({message: "Can't delete \" " + code + " \": The lobby doesn't exist, or you are not host."}); return;
        }
        this.db.delete('lobby_active_lobbies', 'code = "' + code + '"', (err) => {
          if (err){
            return callback(err);
          }
          this.db.delete('lobby_queue', 'lobby_code = "' + code + '"', (err, res) => {
            delete lobby_model.active_lobbies[code];
            return callback();
          });
        });
    });
  }

  updateLobby(code, values){
    console.log('code: '+code);
    console.log('values: '+JSON.stringify(values));
    if (!lobby_model.active_lobbies[code]){return false;}
    for (let [k, v] of Object.entries(values)){
      lobby_model.active_lobbies[code][k] = v;
    }
    return true;
  }

  queue(args, callback) {
    if (!lobby_model.active_lobbies[args.code]){
      return callback({message: 'The lobby "' + args.code + '" does not exist.'});
    }
    if (!lobby_model.active_lobbies[args.code].queue) { lobby_model.active_lobbies[args.code].queue = []; }
    //for (let [k, v] of Object.entries(lobby_model.active_players)){
    //}
    /*if (lobby_model.active_lobbies[args.code].queue?.indexOf(args.member_id) < 0){
      return callback({message: 'You are already in the queue.'});
    }*/
    console.log('args in queue: ' + JSON.stringify(args));
      this.db.insert('lobby_queue', {
        member_id: args.member_id,
        usertag: args.usertag,
        join_request_time: Time.now,
        lobby_code: args.code,
        is_infohost: 0
      }, (err, res) => {
        if (err){callback(err, res); return;}
  
        lobby_model.active_lobbies[args.code]?.queue.push(args.member_id);
        console.log('Result of inserting active_player: ' + JSON.stringify(res));
  
        callback(err, res);
        return;
      });
    
  }

  unqueue(args, callback) {
    if (!args.lobby_code ||args.lobby_code == undefined){
      args.lobby_code = lobby_model.active_players[args.member_id].lobby_code;
    }
    console.log('args in unqueue: ' + JSON.stringify(args));
    this.db.delete('lobby_queue', 
    'lobby_code = "' + args.lobby_code + '" AND member_id = "' + args.member_id + '"', (err, res) => {
      if (err){callback(err, res); return;}
      if (res.affectedRows < 1){
        return callback({message: "You're not in the lobby \"" + args.lobby_code + "\""});
      }
      console.log('Result of deleting player from lobby_queue:\n' + JSON.stringify(res));

      console.log('Active lobbies: ' + JSON.stringify(lobby_model.active_lobbies));

      let arr = lobby_model.active_lobbies[args.lobby_code]?.queue;
      if (!arr){
       return callback({message: "The lobby \"" + args.lobby_code + "\" doesn't exist."});
      }
      console.log(args.code + ' queue before splice: ' + arr[0]);
      if (!arr || arr == undefined){callback({message: 'A queue does not exist for the lobby. (This should never happen)'}); return;}
      if (arr.splice(arr.indexOf(args.member_id), 1)) {
        console.log(args.code + ' queue after splice: ' + arr[0]);
        //return callback(err, res);
      }
      
      // Remove from active_players
      delete lobby_model.active_players[args.member_id];
      callback(null, {message: 'Unjoin successful'});

    });
  }

  register_infohost(args, callback){
    if (lobby_model.infohosts.includes(args.member_id)){
      return callback({message: 'You are already infohost.'});
    }
    this.db.insert('lobby_infohosts', args, (err, res) => {
      console.log(JSON.stringify(lobby_model.infohosts));
      lobby_model.infohosts.push(args.member_id);
      return callback(err, res);
    });
  }

  unregister_infohost(args, callback){
    if (lobby_model.infohosts.includes(args.member_id)){return callback({message: 'You are not infohost.'});}
    this.db.delete('lobby_infohosts', 'member_id = "'+args.member_id+'"', (err, res) => {
      lobby_model.infohosts = lobby_model.infohosts.filter((e) =>{e !== args.member_id;});
      return callback(err, res);
    });
  }
  

  static createtables(){
      let lm = new lobby_model();
      lm.db.create_table('lobby_infohosts', lm.table_infohosts, (err, res) => {
        if (err){return console.log('Error while creating lobby_infohosts table: ' + err.message);}
        console.log('lobby_infohosts table is up.');
        lm.db.get('*', 'lobby_infohosts', undefined, (gerr, gres) => {
          if (err){console.log('Error while getting infohosts: ' + gerr.message);}
          for (let i in gres)
          lobby_model.infohosts.push(gres[i].member_id);
        });
      });


      lm.db.create_table('lobby_active_lobbies', lm.table_active_lobbies, (err, res) => {
        if (err){return console.log('Error while creating lobby_active_lobbies table: ' + err.message);}
        console.log('lobby_active_lobbies table is up.');

      lm.db.get('*', 'lobby_active_lobbies', undefined, (gerr, gres) => {
        if (gerr){
          console.log('Error getting active lobbies: ' + gerr.message);
          if (gerr.sql){console.log('sql: ' + gerr.sql);}
          return;
        }
        for (let i = 0; i<gres.length;i++){
          lobby_model.active_lobbies[gres[i].code] = gres[i]
          lobby_model.active_lobbies[gres[i].code].queue = [];
        }

        lm.db.create_table('lobby_queue', lm.table_queue, (qerr, qres) => {
          if (qerr){return console.log('Error while creating lobby_queue table: ' + qerr.message);}
          console.log('lobby_queue table is up.');
  
          lm.db.get('*', 'lobby_queue', undefined, (gqerr, gqres) => {
            if (gqerr){return callback(gqerr, gqres);}
            for (let i = 0; i < gres.length; i++){
              lobby_model.active_players[gqres[i]] = gqres[i];
            }
          });
  
        });

      });

        console.log('Active lobbies:\n' + JSON.stringify(res));
      });
  }

}

await lobby_model.createtables();

class LobbyConfig {
  host = '';
  code = '';
  server = '';
  pingtime = '';
  queue = [];

  constructor(code, server, host, pingtime) {
    this.code = code;
    this.server = server;
    this.host = host;
    this.pingtime = pingtime;
  }
}
