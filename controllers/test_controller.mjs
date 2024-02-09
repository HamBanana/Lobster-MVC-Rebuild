import {Controller} from '../core/controller.mjs';
//import {Test} from '../core/database.js';


export class test_controller extends Controller{

  perm = {
    //'users': ['Hambanana#1929']
  };
  
constructor(msg){
  super(msg);
  this.auth(this.perm);
}
  
  index() {
    this.view.content = Test;
    this.post()
    .then((reply) => {
    console.log(reply);
    })
  }
}