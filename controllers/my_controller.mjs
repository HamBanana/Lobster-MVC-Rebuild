import {Controller} from '../core/controller.mjs';
import { Database } from '../core/database.mjs';

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
    'prefix': null
   }


  constructor(msg){
    super(msg);
    
    let db = Database.getInstance();
    //this.auth(this.perm).catch((err) => {return console.log('Error in count: ' + err.message);});

    db.connection.query('CREATE TABLE IF NOT EXISTS users ('+this.table_users+')');

  }

  index(){
    this.message.reply(JSON.stringify(this.user) || 'I dunno :eyes:');
  }

  prefix(args){
    let { prefix } = this.extractArgs(args, 'prefix');
    console.log('args: ' + JSON.stringify(args));
  }

}
