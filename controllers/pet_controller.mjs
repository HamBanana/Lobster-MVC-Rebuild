import {Controller} from '../core/controller.mjs';


export class pet_controller extends Controller{

  perm = {
    //'users': ['Hambanana#1929']
  };
  
constructor(msg){
  super(msg);
  this.auth(this.perm);
}
  
  index() {
    this.message.reply("<a:petlobter:1119809905168220190>");
  }
}