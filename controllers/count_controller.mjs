import {Controller} from '../core/controller.mjs';
import { Database } from "../core/database.mjs";

export class count_controller extends Controller{

  perm = {'channels': ['1135218372091588770']};

  static last_number;


  constructor(msg){
    super(msg);
    
    this.db = Database.getInstance();

    /*this.db.get("count_last_number").then( (value) => {
      console.log(value);
      count_controller.last_number = (value) ? value : 0;
    } );*/
    this.auth(this.perm);
    //this.post('It\'s the count controller');
  }

  test_string(){
    this.db = Database.getInstance();
    count_controller.last_number = parseInt(count_controller.last_number);
    
    if (this.message.channelId != 1135218372091588770){return;}
    
    let strtonum = parseInt(this.message.content);
     if (!strtonum || strtonum < 0){return false;}

     this.db.get('count', 'Lobster.counting', 'id = 1', (err, res) => {
      if (err){
        this.message.reply('Failed getting current value: ' + err.message);
        return;
      }
      // Got the value, compare it to the input.
      let count = parseInt(res[0].count);
      //this.message.reply('Count before: ' + count);
      //this.db.get("count_last_number").then( 
        //(value) => {
    //console.log('strtonum: '+strtonum + ' = ' + count_controller.last_number + 1);
    if ( strtonum === count + 1){
      count_controller.last_number = strtonum;
      this.message.react('✅');
      
      
    } else {
     
      count_controller.last_number = 0;
      this.message.react('❌');
    }
    
    let c = count_controller.last_number.toString();
    //this.message.reply('Count after: ' + c);

    // Update the database with the new value.
    this.db.update('counting', 'count='+ c, 'id = 1', (err, res) => {
    });
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
}
