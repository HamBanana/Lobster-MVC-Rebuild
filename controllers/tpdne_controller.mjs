import {Controller} from '../core/controller.mjs';

export class tpdne_controller extends Controller{
  perm = {
    channels: ['949274005511229520']
  };
  constructor(msg){
    super(msg);
    this.allowed = false;
    this.auth(this.perm);
  }
  
  index(){
    this.view.content = {files:['https://thispersondoesnotexist.com/image']};
  this.post();
  }
}