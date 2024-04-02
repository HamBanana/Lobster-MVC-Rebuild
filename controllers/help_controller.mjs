import {Controller} from '../core/controller.mjs';
import { Database } from "../core/database.mjs";
import {channels, members} from '../core/statics.mjs';
import { Discord } from '../core/discord.mjs';
import { Embed } from '../core/visual.mjs';

export class help_controller extends Controller{

  constructor(msg){
    super(msg);
    
  }

  index(){
    this.view.embeds[0] = Embed
    .setTitle('Lobster help')
    .setDescription('Commands follow the pattern: "!lob {category} {function} [arguments]"')
    
  }

  addCategory(){
    this.auth({'users':[members.Ham]});
    
  }
}
