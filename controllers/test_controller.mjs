import {Controller} from '../core/controller.mjs';
import { Discord } from '../core/discord.mjs';
//import {Test} from '../core/database.js';
import { Database } from '../core/database.mjs';


export class test_controller extends Controller{

  perm = {
    'users': ['330279218543984641']
  };
  
constructor(msg){
  super(msg);
  this.auth(this.perm);
}
  
  index() {
    this.view.content = 'Update test';
    this.post()
    .then((reply) => {
    console.log(reply);
    })
  }

  say(args){
    let word = (args['word']) ? args['word'] : args['default'][0];
    if (!word){
      return;
    }
    let client = Discord.client;
    let channel = client.channels.cache.get('1200927450536890429');
    channel.send(word);
  }

  count(){
    let db = Database.getInstance();
    db.db.connect((err) => {
      if (err){
        this.message.reply(err.message);
      }
      this.message.reply('Error did not happen, yay :eyes:');
      db.db.query('select * from Lobster.counting');
    })
  }
  create(){
    let db = Database.getInstance();

    db.create_table('Test', this.message);
  }

}