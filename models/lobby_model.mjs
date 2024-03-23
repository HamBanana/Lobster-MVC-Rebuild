import { Database } from '../core/database.mjs';
import { Model } from '../core/model.mjs';
import { Time } from '../tools/time.mjs';

export class lobby_model extends Model {

  static active_lobbies = {};
  static active_players = {};
  static infohosts = [];

  table_infohosts = 
  'id INT AUTO_INCREMENT NOT NULL, '
  +'member_id VARCHAR(25) UNIQUE, '
  +'PRIMARY KEY (id)';

  object_lobby = {
    
  }

  table_announced = 
  'id INT AUTO_INCREMENT, '
  +'member_id VARCHAR(25) UNIQUE, '
  +'is_vanilla TINYINT(1), '
  +'is_vc_lobby TINYINT(1), '
  +'PRIMARY KEY(id)';

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
      let letter = args.code.slice(-1);
      let server = '';
      if (letter == 'F' || letter == 'Q'){server = "Europe, probably";}
      else if (letter == 'G'){server = 'North America';}
      else if (letter == '') {server = 'Asia';}
      else {server = "Idk, Asia maybe."}
      let values = {
        code: args.code,
        server: args.server || server,
        host: args.host,
        creationtime: Time.now,
        pingtime: Time.now,
        is_vc_lobby: args.is_vc_lobby || 0,
        is_vanilla: args.is_vanilla || 1,
        notes: args.notes || ''
      };
      this.db.insert('lobby_active_lobbies', values, (err, res) => {
        if (err){
          console.log('Error while inserting new active lobby: ' + err.message);
          return callback(err, res);
        }
        //console.log('res = ' + JSON.stringify(res));
        // No error happened
        lobby_model.active_lobbies[args.code] = values;
        return callback(err, values);
      });
    });
  }

  setLobbyState(args, callback){
    if (!args.code){
      return callback({message: "Tried to update lobby, without a code"});
    }
    this.db.update('lobby_active_lobbies', args, "code = " + args.code, (err, res) => {
      if (err){return callback(err)}
      return callback(err, res);
    });
  }

  getInfohosts(args, callback){
    this.db.get('*', 'lobby_infohosts', 'member_id = ' + args.member_id, (err, res) => {
      if (err){return callback(err);}
      return callback(err, res);
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
    if (!lobby_model.infohosts.includes(args.member_id)){return callback({message: 'You are not infohost.'});}
    this.db.delete('lobby_infohosts', 'member_id = "'+args.member_id+'"', (err, res) => {
      lobby_model.infohosts = lobby_model.infohosts.filter((e) =>{e !== args.member_id;});
      return callback(err, res);
    });
  }

  announce(args, callback){
    this.db.insert('lobby_announced', args, (err, res) => {
      return callback(err, res);
    });
  }

  unannounce(args, callback){
    this.db.delete('lobby_announced', "member_id = " + args.member_id, (err, res) => {
      return callback(err, res);
    });
  }

  getAnnounced(args, callback){
    if (!args.member_id){return console.log('lobby_model.getAnnounced was called without a member_id');}
    this.db.get('*', 'lobby_announced', "member_id = " + args.member_id, (err, res) => {
      return callback(err, res);
    });
  }

  confirm_lobby(args, callback){
    if (!args.code){return callback({message: "You need to include the lobby code, for now at least."});}

    lobby_model.active_lobbies[args.code].state = args.state;
    // Gather ids from the queue.
    let mentions = "";
    for (let i in lobby_model.active_lobbies[args.code].queue){
      let mention = lobby_model.active_lobbies[args.code].queue[i];
      mentions += "<@" + mention + "> "
      console.log('Mentioning: ' + mention);
      // Clear the queue from db.
      this.db.delete('lobby_queue', 'member_id = "' + mention + '" AND lobby_code = "' + args.code + '"');
    }
    return callback(null, {mentions});
  }

  assign_infohost(args, callback){
    if (!args.code){return callback({message: 'assign_infohost was called with no lobby code'});}
    this.db.get('*', 'lobby_infohosts', 'lobby_code = "' + args.code + '"', (err, res) => {
      if (err){return callback(err, res);}
      if (res.length < 1){
        return callback({message: 'No infohosts are available'});
      }
      lobby_model.active_lobbies[args.code].infohost = res[0].member.id;
    });
  }
  
/*
  static createtables(){
      let lm = new lobby_model();
      lm.db.create_table('lobby_infohosts', lm.table_infohosts, true, (err, res) => {
        if (err){return console.log('Error while creating lobby_infohosts table: ' + err.message);}
        console.log('lobby_infohosts table is up.');
        lm.db.get('*', 'lobby_infohosts', undefined, (gerr, gres) => {
          if (err){console.log('Error while getting infohosts: ' + gerr.message);}
          for (let i in gres){
            lobby_model.infohosts.push(gres[i].member_id);
          }
        });
      });

      lm.db.create_table('lobby_announced', lm.table_announced, true, (err, res) => {
        if (err){return console.log('Error while creating lobby_announced: ' + err.message)}
        console.log('lobby_announced table was created');
      })


      lm.db.create_table('lobby_active_lobbies', lm.table_active_lobbies, true, (err, res) => {
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

      });
      

      lm.db.create_table('lobby_queue', lm.table_queue, true, (qerr, qres) => {
        if (qerr){return console.log('Error while creating lobby_queue table: ' + qerr.message);}
        console.log('lobby_queue table is up.');

        lm.db.get('*', 'lobby_queue', undefined, (gqerr, gqres) => {
          if (gqerr){return callback(gqerr, gqres);}
          for (let i = 0; i < gqres.length; i++){
            lobby_model.active_lobbies[gqres[i].lobby_code].queue.push(gqres[i].member_id);
          }
        });

      });

        console.log('Active lobbies:\n' + JSON.stringify(res));
      });
  }
  */

  
  testPresence(oldPresence, newPresence){
    console.log('Infohosts: ' + JSON.stringify(lobby_model.infohosts));
    if (!lobby_model.infohosts.includes(oldPresence?.userId)){return;}
    let oldActivity = oldPresence?.activities[0];
    let newActivity = newPresence?.activities[0];
        //let c = this.client.channels.cache.get('1200927450536890429');
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
        let member_id = newPresence.userId;
        this.model.getAnnounced({member_id: newPresence.userId}, (err, res) => {
          if (err)
          {return console.log('Error while getting announced lobbies in lobby_controller.testPresence');
        }
          if (res.length < 1){
            //channels.get(channels['lob-test']).send('Lobby started, but the host is not infohost');
            return;
          }

          let create_vals = {
            code: newActivity.party.id, 
            host: member_id,
            state: newActivity.state,
            infohost: member_id
          }

          this.model.create(create_vals
          , (cerr, cres) => {
            // Unannounce the upcoming lobby, as it has started.
            this.model.unannounce({member_id}, (err, res) => {
              if (err){return console.log('Unannounce failed because: ' + err.message);}
            });
            
            
            if (cerr){console.log('Error creating lobby from testPresence: ' + cerr.message);}
            else if (!res){console.log('There are somehow no announced lobbies (we have just determined that there is, so this is a coding error.)');}
            else {console.log('Created lobby from testPresence: ' + newActivity.party.id);}

            // Create the view
            this.view.template_path = 'lobby/autocreate';
            this.view.data['host'] = this.client.users.cache.get(newPresence.userId).username;
            this.view.data['code'] = newActivity.party.id;
            this.view.data['server'] = cres.server;
            this.view.data['is_vc_lobby'] = cres.is_vc_lobby;
            this.view.data['is_vanilla'] = cres.is_vanilla;
            this.view.data['notes'] = cres.notes;
            this.view.data['pingtime'] = cres.pingtime;
            this.view.data['pingrole'] = (cres.is_vanilla) ? roles['archetype'] : roles['avant-garde'];

            this.view.type = "channel";
            //this.view.channelid = channels['lob-test'];
            this.view.channelid = channels['vanilla-codes'];
            this.post();
          });

        });

      }

      if (oldActivity.state == "In Lobby" && newActivity.state == "In Game"){
        // Code for when a game is started.
      }

      if (oldActivity.state == "In Game" && newActivity.state == "In Lobby"){
        let code = newActivity.party.id;
        if (!lobby_model.active_lobbies[code].infohost == newActivity.userId){return;}
        this.confirm_lobby({code: newActivity.party.id});
      }

      if ((oldActivity.state == "In Lobby" || oldActivity.state == "In Game") && newActivity.state == "In Menus"){
        // Infohost left a game
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

  /*static interval(){
    let db = Database.getInstance();
    db.get('*', 'lobby_active_lobbies', null, (err, res) => {
      if (err){return console.log('Error in lobby_model.interval: ' + err.message);}
      for (let i in res){
        if (res[i].pingtime){

        }
      }
    });
  }*/

}

//await lobby_model.createtables();
