import {Controller} from '../core/controller.mjs';


export class test_controller extends Controller{

  perm = {
    //'users': ['Hambanana#1929']
  };
  
constructor(msg){
  super(msg);
  this.auth(this.perm);
}
  
  index() {
    this.view.content = 'Guess pull works, too';
    this.post()
    .then((reply) => {
    console.log(reply);
    })
  }
}