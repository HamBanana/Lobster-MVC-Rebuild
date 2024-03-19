import {Controller} from '../core/controller.mjs';
import { Discord } from '../core/discord.mjs';
//import {Test} from '../core/database.js';
import { Database } from '../core/database.mjs';
import { PermissionError } from '../core/error.mjs';
import { MessageEmbed } from 'discord.js';

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
    reply = (reply !== "false");
    if (reply){
      this.view.type = 'reply';
    } else {
    this.view.channelid = this.message.channel.id;
    this.view.type = 'channel';
    }
    //this.view.content = word;
    this.view.embeds[0] = new MessageEmbed().setTitle(word);
    
    this.post();
  }

  getpresence(){
    
    this.message.reply(member.presence.activities[0].state);
    //console.log(JSON.stringify(this.message.guild));
    //this.message.reply(JSON.stringify(this.message.author));
    //this.message.reply('Hi, I work :eyes:');
  }

  count(){
    return new Promise((resolve, reject) => {
      let db = Database.getInstance();
  
      db.p_getLatest('counting')
      .then((result) => {
        this.message.reply('Result: ' + result.count);
        resolve(result.count);
      })
      .catch((err) => {
        this.message.reply('Error: ' + err.message);
        //reject(err);
      });
    });
  }

  create(){
    let db = Database.getInstance();
    db.create_table('test', 'id int', true);
  }

  fail(args){
    let { type } = this.extractArgs(args, 'type');

    switch(type){
      case 'permissionerror':
        throw new PermissionError();
      case 'auth': this.auth({'users':['noone']});
      default: throw Error;
    }

  }

}