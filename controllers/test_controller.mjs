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
}
  
  index() {
    this.view.content = 'Update test';
    this.post()
    .then((reply) => {
    console.log(reply);
    })
  }

  promise(args){
    return new Promise((resolve, reject) => {
      this.message.reply('Outer');
      resolve(
        new Promise((iresolve, ireject) => {
        iresolve('Inner');
      })
      .then(() => {
        console.log('Inner then');
      })
      );
    })
    .then(() => {
      console.log('Outer then');
    });
  }

  say(args){
    //let word = (args['word']) ? args['word'] : args['default'][0];
    let { word, reply } = this.extractArgs(args, ['word', 'reply']);
    if (!word){
      return;
    }
    if (reply){
      this.view.type = 'reply';
    } else {
    this.view.channelid = this.message.channel.id;
    this.view.type = 'channel';
    }
    //let channel = client.channels.cache.get('1200927450536890429');
    //channel.send(word);
    this.post(word);
  }

  getpresence(){
    
    this.message.reply(member.presence.activities[0].state);
    //console.log(JSON.stringify(this.message.guild));
    //this.message.reply(JSON.stringify(this.message.author));
    //this.message.reply('Hi, I work :eyes:');
  }

  count(){
    return new Promise((resolve, reject0) => {
      let db = Database.getInstance();
  
      db.p_getLatest('counting')
      .then((result) => {
        this.message.reply('Result: ' + result.count);
        resolve(result.count);
      })
      .catch((err) => {
        this.message.reply('Error: ' + err.message);
        reject(err);
      });
    });
  }

  create(){
    let db = Database.getInstance();
    db.create_table('test', 'id int', true);
  }

  fail(args){
    let { promise } = this.extractArgs(args, 'promise');
    if (!promise){promise = "false";}
    
    if (promise == "true"){
      return new Promise((resolve, reject) => {
        reject('Error thrown in promise');
      });
    } else { 
    throw Error;
    }

  }

}