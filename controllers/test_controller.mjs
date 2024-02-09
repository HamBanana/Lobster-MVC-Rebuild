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
    this.view.content = 'Pull works, yay';
    this.post()
    .then((reply) => {
    console.log(reply);
    })
  }
}