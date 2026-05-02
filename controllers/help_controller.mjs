import {Controller} from '../core/controller.mjs';
import {members} from '../core/statics.mjs';
import { Embed } from '../core/visual.mjs';

export class help_controller extends Controller{

  constructor(msg){
    super(msg);
    this.controllername = 'help';
  }

  index(){
    this.view.embeds[0] = Embed
      .setTitle('Lobster help')
      .setDescription('Commands follow the pattern: "!lob {category} {function} [arguments]"');
    return this.post();
  }

  addCategory(){
    this.auth({'users':[members.Ham]});
    // Stub: implementation lives elsewhere. The auth call above will throw
    // a PermissionError for non-Ham callers, which the parser catches.
  }
}
