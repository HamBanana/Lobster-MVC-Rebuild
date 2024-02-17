import { Database } from '../core/database.mjs';
import { Model } from '../core/model.mjs';
import { Time } from '../tools/time.mjs';

export class lobby_model extends Model {

  static active_lobbies = {}
  static active_players = {}

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
  PRIMARY KEY (id)\
  ";

  object_lobby = {
    
  }

  table_active_players = "\
  id INT AUTO_INCREMENT, \
  member_id VARCHAR(20) UNIQUE, \
  usertag VARCHAR(40), \
  join_request_time BIGINT, \
  lobby_code VARCHAR(6), \
  is_in_queue TINYINT(1), \
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
          callback(err); return;
        });
    });
    let lobs = lobby_model.active_lobbies;
    if (!lobs[code]){return false;}
    delete lobs[code];
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

  cancel(code) {
    if (!lobby_model.active_lobbies[code]) {
      return false;
    }
    delete lobby_model.active_lobbies[code];
    return true;
  }

  queue(args, callback) {
    if (!lobby_model.active_lobbies[args.code]){
      return callback({message: 'The lobby "' + args.code + '" does not exist.'});
    }
    if (!lobby_model.active_lobbies[args.code].queue) { lobby_model.active_lobbies[args.code].queue = []; }
    if (lobby_model.active_lobbies[args.code].queue?.indexOf(args.member_id) < 0){
      return callback({message: 'You are already in the queue.'});
    }
    console.log('args in queue: ' + JSON.stringify(args));
      this.db.insert('lobby_active_players', {
        member_id: args.member_id,
        usertag: args.usertag,
        join_request_time: Time.now,
        lobby_code: args.code,
        is_in_queue: 1,
        is_infohost: 0
      }, (err, res) => {
        if (err){callback(err, res); return;}
  
        lobby_model.active_lobbies[args.code]?.queue.push(args.member_id)
  
        callback(err, res);
        return;
      });
    
  }

  unqueue(args, callback) {
    this.db.delete('lobby_active_players', 
    'lobby_code = "' + args.lobby_code + '" AND member_id = "' + args.member_id + '"', (err, res) => {
      if (err){callback(err, res); return;}

      let arr = lobby_model.active_lobbies[args.code].queue;
      if (!arr || arr == undefined){callback({message: 'A queue does not exist for the lobby. (This should never happen)'}); return;}
      if (arr.splice(arr.indexOf(args.usertag), 1)) {
        return callback(err, res);
      }
      return false;
    });
  }

  testPresence(oldPresence, newPresence){
    let oldActivity = oldPresence?.activities[0];
    let newActivity = newPresence?.activities[0];
    if (oldActivity && newActivity){
      if (oldActivity.name !== "Among Us" && newActivity.name !== "Among Us"){return;}
    }
    if (oldActivity){
      console.log('oldGame: ' + JSON.stringify(oldActivity.name));
    }
    if (newActivity){
      console.log('newGame: ' + JSON.stringify(newActivity.name));
    }
    //if (newActivity !== 'Among Us')
    let db = Database.getInstance();

        db.get('*', 'lobby_active_players', 'is_infohost = 1', (err, res, fields) => {
          if (err){console.log('Error in getting infohosts: ' + err.message); return;}
          console.log('Result of getting infohosts: ' + JSON.stringify(res));
        });
    


    /*oldPresence:{
      "userId":"330279218543984641",
      "guild":"817607509984018442",
      "status":"online",
      "activities":[{"id":"d7995e21d2fc74f2",
      "name":"Among Us",
      "type":"PLAYING",
      "url":null,
      "details":null,
      "state":"In Lobby",
      "applicationId":"477175586805252107",
      "timestamps":{"start":1708028961000,"end":null},
      "syncId":null,
      "platform":null,
      "party":{"size":[13,15],"id":"LWWTJF"},
      "assets":{"largeText":null,
      "smallText":null,"largeImage":"481347538054545418",
      "smallImage":null},
      "flags":0,
      "emoji":null,
      "sessionId":null,
      "buttons":[],
      "createdTimestamp":1708033343678}],
      "clientStatus":{"desktop":"online"}}
newPresence:{"userId":"330279218543984641","guild":"817607509984018442","status":"online","activities":[{"id":"d7995e21d2fc74f2","name":"Among Us","type":"PLAYING","url":null,"details":"Playing","state":"In Game","applicationId":"477175586805252107","timestamps":{"start":1708028961000,"end":null},"syncId":null,"platform":null,"party":{},"assets":{"largeText":null,"smallText":null,"largeImage":"481347538054545418","smallImage":null},"flags":0,"emoji":null,"sessionId":null,"buttons":[],"createdTimestamp":1708033387219}],"clientStatus":{"desktop":"online"}}
    */
  }
  

  static createtables(){
      console.log('createtable called with await works');
      let lm = new lobby_model();
      lm.db.create_table('lobby_active_lobbies', lm.table_active_lobbies);
      lm.db.create_table('lobby_active_players', lm.table_active_players, (err, res) => {
        if (err){
          console.log('Error initializing lobby_active_players: ' + err.message);
        }
      });

      lm.db.get('*', 'lobby_active_lobbies', undefined, (err, res) => {
        if (err){
          console.log('Error getting active lobbies: ' + err.message);
          if (err.sql){console.log('sql: ' + err.sql);}
          return;
        }
        for (let i = 0; i<res.length;i++){
          lobby_model.active_lobbies[res[i].code] = res[i]
          lobby_model.active_lobbies[res[i].code].queue = [];
        }
        lm.db.get('*', 'lobby_active_players', undefined, (err, res) => {
          if (err){return callback(err, res);}
          for (let i = 0; i < res.length; i++){
            lobby_model.active_players[res[i]] = res[i];
          }
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
