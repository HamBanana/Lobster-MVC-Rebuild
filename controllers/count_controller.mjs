import {Controller} from '../core/controller.mjs';
import Database from "@replit/database";

export class count_controller extends Controller{

  perm = {'channels': ['1135218372091588770']};

  static last_number;


  constructor(msg){
    super(msg);
    
    this.db = new Database();

    /*this.db.get("count_last_number").then( (value) => {
      console.log(value);
      count_controller.last_number = (value) ? value : 0;
    } );*/
    this.auth(this.perm);
    //this.post('It\'s the count controller');
  }

  test_string(){
    count_controller.last_number = parseInt(count_controller.last_number);
    this.db.list().then((val) => {
      console.log('list:');
      console.log(val);
      this.db.get("count_last_number").then((val) => {
      console.log("count_last_number");
        console.log(val);
      });
    });
    
    if (this.message.channelId != 1135218372091588770){return;}
    
    let strtonum = parseInt(this.message.content);
     if (!strtonum){return false;}
      //this.db.get("count_last_number").then( 
        //(value) => {
    console.log('strtonum: '+strtonum + ' = ' + count_controller.last_number + 1);
    if ( strtonum === count_controller.last_number + 1){
      //count_controller.last_number = strtonum + 1;
      this.message.react('✅');
      
      this.db.set("count_last_number", count_controller.last_number+1).then(() => {
        count_controller.last_number++;
      });
      
    } else {
      count_controller.last_number = 0;
      this.db.set("count_last_number", 0).then(() => {
      this.message.react('❌');
      });
    }
      //});
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
