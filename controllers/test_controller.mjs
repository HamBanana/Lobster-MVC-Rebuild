import {Controller} from '../core/controller.mjs';
import { Discord } from '../core/discord.mjs';
//import {Test} from '../core/database.js';
import { Database } from '../core/database.mjs';

const guild = await Discord.client.guilds.fetch('817607509984018442');

const member = await guild.members.fetch
({user:'330279218543984641', withPresences: true, force: true});

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

  getpresence(){
    
    this.message.reply(member.presence.activities[0].state);
    //console.log(JSON.stringify(this.message.guild));
    //this.message.reply(JSON.stringify(this.message.author));
    //this.message.reply('Hi, I work :eyes:');
  }

  count(){
    let db = Database.getInstance();
    //db.connection.connect((err) => {
    //  if (err){
    //    return this.message.reply('Connect failed because: '+err.message);
    //  }

    db.get('count', 'Lobster.counting', 'id=1', (error, results, fields) => {
      if (error){
        this.message.reply('Error in db.get:' + error.message);
        return;
      }
      this.message.reply('Result:'+ results[0].count);
    });

      //db.connection.query('select count from Lobster.counting WHERE id=1', );
    //})
  }
  create(){
    let db = Database.getInstance();
    db.create_table('test', 'id int', true);
  }

}