import {Controller} from '../core/controller.mjs';
import { Database } from '../core/database.mjs';
import { Discord } from '../core/discord.mjs';

export class my_controller extends Controller{

  table_users = "\
 id int auto_increment, \
 preferred_name VARCHAR(64), \
 username VARCHAR(64), \
 userid VARCHAR(21) UNIQUE, \
 prefix VARCHAR(21), \
 PRIMARY KEY (id)\
   ";

   user = {
    'id': null,
    'preferred_name': null,
    'username': null,
    'userid': null,
    'prefix': '!lob'
   }


  constructor(msg){
    super(msg);
    
    let db = Database.getInstance();
    //this.auth(this.perm).catch((err) => {return console.log('Error in count: ' + err.message);});

    db.connection.query('CREATE TABLE IF NOT EXISTS members ('+this.table_users+')');

  }

  index(){
    return new Promise((resolve, reject) => {
    let db = Database.getInstance();
    db.get("*", 'members', "userid = " + this.message.author.id, (err, res) => {
      res = res[0];
      if (err){throw err;}
      let user = "```"
        + "Username: " + res["username"]
        + "\nPreferred name: " + res['preferred_name']
        + "\nPrefix: " + res['prefix']
        + "```";
        resolve(user);
    });
      
    })
    .then((user) => {
      this.message.reply("Your config: \n" + user);
    })
  }

  create(args){
    let client = Discord.client;
    let { name, prefix } = this.extractArgs(args, 'name');
    let db = Database.getInstance();
    db.insert('members', {
      preferred_name: name ||'you',
      username: client.users.cache.get(this.message.author.id).username,
      userid: this.message.author.id,
      prefix: '!lob'
    }, (err, res) => {
      if (err){throw err;}
      console.log('Inserted row in members: ' + JSON.stringify(res));
      this.message.react('✅');
    });
  }

  forget(args){
    let db = Database.getInstance();
    db.delete('members', 'userid = ' + this.message.author.id, (err, res) => {
      if (err){throw err;}
      this.message.react('✅');
    });
  }

  prefix(args){
    let { prefix } = this.extractArgs(args, 'prefix');

    let db = Database.getInstance();
    db.get('prefix', 'members', 'userid = "' + this.message.author.id + '"', (err, res) => {
      if (err){throw err;}
      
      this.message.reply("Your prefix is: " + this.user['prefix'] + "\nPretty sure you already knew that :eyes:");

    });
  }

}
