import { Database } from '../core/database.mjs';
import {
  Model
} from '../core/model.mjs';

export class lobby_model extends Model {

  static active_lobbies = {}

  table_active_lobbies = "\
  id INT AUTO_INCREMENT NOT NULL, \
  code CHAR(6) UNIQUE NOT NULL, \
  server VARCHAR(6), \
  creationtime BIGINT, \
  host VARCHAR(20), \
  PRIMARY KEY (id)\
  ";

  object_lobby = {
    
  }

  table_active_players = "\
  id INT AUTO_INCREMENT, \
  join_request_time BIGINT, \
  lobbyID int, \
  ping TINYINT(1), \
  is_infohost TINYINT(1), \
  PRIMARY KEY (id), \
  FOREIGN KEY (lobbyID) references active_lobbies(id)\
  "

  constructor(){
    super();
    console.log('lobby_model constructor');
  }

  create(code, server, host, pingtime) {
    if (lobby_model.active_lobbies[code]) {
      return false;
    }
    this.db.insert();

    lobby_model.active_lobbies[code] = new LobbyConfig(code, server, host, pingtime);
    return true;
  }

  getLobby(code) {
    return lobby_model.active_lobbies[code] || false;
  }

  deleteLobby(code){
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

  queue(usertag, code) {
    if (lobby_model.active_lobbies[code]?.queue.includes(usertag)) {
      return false;
    }
    if (lobby_model.active_lobbies[code]?.queue.push(usertag)) {
      return true;
    };
    
    return false;
  }

  unqueue(usertag, code) {
    if (!lobby_model.active_lobbies[code].queue.includes(usertag)) {
      return false;
    }
    let arr = lobby_model.active_lobbies[code].queue;
    if (arr.splice(arr.indexOf(usertag), 1)) {
      return true;
    };
    return false;
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

    db.create_table('lobby_active_lobbies', this.table_active_lobbies, true, (alError) => {
      if (alError){console.log('Error when creating lobby_active_lobbies table: ' + alError.message); return;}
      db.create_table('lobby_active_players', this.table_active_players, true, (createError, createRes) => {
        if (createError){console.log('createError: ' + createError.message); return;}
        db.get('*', 'lobby_active_players', 'is_infohost = 1', (err, res, fields) => {
          if (err){console.log('Error in getting infohosts: ' + err.message); return;}
          console.log('Result of getting infohosts: ' + JSON.stringify(res));
        });
      });
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

}
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
