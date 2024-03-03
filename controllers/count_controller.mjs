import {Controller} from '../core/controller.mjs';
import { Database } from "../core/database.mjs";
import {channels} from '../core/statics.mjs';
import { Discord } from '../core/discord.mjs';

export class count_controller extends Controller{

  perm = {'channels': [channels.counting]};

  static last_number;

  table_session = "\
 id int auto_increment, \
 score int, \
 last_correct VARCHAR(21), \
 last_incorrect VARCHAR(21), \
 most_active VARCHAR(21), \
 PRIMARY KEY (id)\
   ";

   session = {
    'id': null,
    'score': null,
    'last_correct': null,
    'last_incorrect': null,
    'most_active': null
   }


  constructor(msg){
    super(msg);
    
    this.db = Database.getInstance();
    this.auth(this.perm);

    this.db.connection.query('CREATE TABLE IF NOT EXISTS counting_session ('+this.table_session+')');
    this.db.connection.query('select * from counting_session ORDER BY id DESC limit 1', (err, res) => {
      if (err){
        this.message.reply('Error getting latest record: ' + err.message);
      }
      if (res){
        let rec = res[0];
        this.session.id = rec.id;
        this.session.last_correct = rec.last_correct;
        this.session.last_incorrect = rec.last_incorrect;
        this.session.score = rec.score;
        this.session.most_active = rec.most_active;
      //TODO:Phase out last_number in favor of res.score.
      //count_controller.last_number = res.score;
    }
      if (!res) {
        this.makeNewSession();
      }
      //this.message.reply('Session: ' + JSON.stringify(this.session));
    });

  }

  test(){
    let client = Discord.client;
    /*this.message.reply(
      'Score: ' + this.session.score
      + '\nLast correct: ' + client.users.cache.get(this.session.last_correct)
      + '\nLast incorrect: ' + client.users.cache.get(this.session.last_incorrect)
      );*/
      this.message.reply(JSON.stringify(this.session));
  }

  test_string(){
    this.db = Database.getInstance();
    
    if (this.message.channelId != channels.counting){return;}
    
    let strtonum = parseInt(this.message.content);
     if (!strtonum || strtonum < 0){return false;}

     this.db.connection.query('select * from counting_session ORDER BY id DESC limit 1', (err, res) => {
      if (err){
        this.message.reply('Failed getting current value: ' + err.message);
        return;
      }

      let client = Discord.client;

      if (!res){this.makeNewSession();}
      let rec = res[0];
      this.session.id = rec.id;
      this.session.score = rec.score;
      this.session.last_correct = rec.last_correct;
      this.session.last_incorrect = rec.last_incorrect;
      //this.message.reply(JSON.stringify(rec));
      // Got the value, compare it to the input.
      let count = parseInt(rec.score);
    if ( strtonum === count + 1){
      // Update session
      this.session.score = strtonum;
      this.session.last_correct = this.message.author.id;

      this.message.react('✅');
      
      
    } else {
      // Display session result.
      this.session.last_incorrect = this.message.author.id;
      this.message.reply('Result:\
      \nScore: ' + this.session.score + '\
      \nLast correct number by: ' + client.users.cache.get(this.session.last_correct) + '\
      \nIncorrect number by: ' + client.users.cache.get(this.session.last_incorrect)
      );
     // Start new session
     this.makeNewSession();

     this.session.score = 0;
      this.message.react('❌');
    }
    
    this.db.connection.query('UPDATE counting_session SET \
    score = ' + this.session.score + ',\
    last_correct = "' + this.session.last_correct + '",\
    last_incorrect = "' + this.session.last_incorrect + '"\
    WHERE id = ' + rec.id );
  });
    
  }

  set(number){
      console.log(number);
    //this.auth({'users': 'hambanana#0000'});
    if (this.message.author.id !== "330279218543984641"){return;}
    number = parseInt(number['default'][0]);
    console.log('Number: '+number);
    this.db.set("count_last_number", number).then((value) => {
    count_controller.last_number = number;
    this.message.react('✅');
    });
  }

  makeNewSession(){
    this.db.connection.query('INSERT INTO counting_session VALUES (NULL, 0, NULL, NULL, NULL)');
  }
}
