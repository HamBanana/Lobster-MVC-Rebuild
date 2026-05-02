import {Controller} from '../core/controller.mjs';
import { warn } from '../core/error.mjs';

export class pet_controller extends Controller{

  perm = {
    //'users': ['Hambanana#1929']
  };

  constructor(msg){
    super(msg);
    this.controllername = 'pet';
    this.auth(this.perm);
  }

  index() {
    return Promise.resolve(
      this.message.reply("<a:petlobter:1119809905168220190>")
    ).catch((err) => warn(err, { context: { controller: 'pet', stage: 'index' } }));
  }
}
