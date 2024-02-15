import {
  Model
} from '../core/model.mjs';

export class lobby_model extends Model {

  static active_lobbies = {}

  create(code, server, host, pingtime) {
    if (lobby_model.active_lobbies[code]) {
      return false;
    }
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
