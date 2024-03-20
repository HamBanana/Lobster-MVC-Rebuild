import {Controller} from '../core/controller.mjs';
import { Database } from "../core/database.mjs";
import {channels, members} from '../core/statics.mjs';
import { Discord } from '../core/discord.mjs';

export class help_controller extends Controller{

  constructor(msg){
    super(msg);
    
  }

  addCategory(){
    this.auth({'users':[members.Ham]});
  }
}
