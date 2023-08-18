export class LobbyManager {

  active_lobbies = {}

  static detectCode(input) {
    input = input.toUpperCase();
    console.log('input: '+input);
    let code = /([^\w]|^)(\w{5}[FQ])([^\w]|$)/.exec(input)?.[2];
    console.log(code);
    if (!code){return;}
    let match_server = /([^\w]|^)((EU|EUR|EUROPE)|(NA|AMERICA|NORTH\sAMERICA|USA|US)|(ASIA))([^\w]|$)/.exec(input);
    let server = 'Unknown';
    if (match_server?.[3]) {
      server = 'EUROPE';
    }
    if (match_server?.[4]) {
      server = 'NORTH AMERICA';
    }
    if (match_server?.[5]) {
      server = 'ASIA';
    }

    return {code, server};
  }

  /*detectCode(input, sender) {
    input = input.toUpperCase();
    let lc = new LobbyConfig();
    lc.host = sender;
    lc.code = /([^\w]|^)(\w{5}[FQ])([^\w]|$)/.exec(input)?.[2];
    lc.pingtime = Math.floor(new Date().getTime() / 1000.0);

    let exists = this.exists(lc);
    if (exists.host) {
      return exists;
    }



    let match_server = /([^\w]|^)((EU|EUR|EUROPE)|(NA|AMERICA|NORTH\sAMERICA|USA|US)|(ASIA))([^\w]|$)/.exec(input);
    if (match_server?.[3]) {
      lc.server = 'EUROPE';
    }
    if (match_server?.[4]) {
      lc.server = 'NORTH AMERICA';
    }
    if (match_server?.[5]) {
      lc.server = 'ASIA';
    }
    return lc;
  }*/

  exists(config) {
    let return_status = {
      host: false,
      code: false
    };
    for (const [k, v] of Object.entries(this.active_lobbies)) {
      if (k === config.host) {
        return_status.host = true;
        if (v.code === config.code) {
          return_status.code = true;
        }
        return return_status;
      }
    }
    return return_status;
  }
}

export class LobbyConfig {

  code = null;
  server = null;
  host = null;
  pingtime = null;
  post_id = null;
  pending_join = [];
}
