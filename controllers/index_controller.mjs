import {Controller} from '../core/controller.mjs';
import {LobbyManager} from '../among_us/lobbymanager.mjs';

export class index_controller extends Controller{
  index(){
    //this.view.content = {files: ['./res/img/idiot.png']};
    this.view.template_type = 'embed';
    this.view.template_path = 'lobby/embed_example_json';
    this.view.data.title = "A better title"
    this.post();
  }

  info(){
    this.message.reply("https://www.youtube.com/watch?v=n0XaSvhTYd4");
  }

  moreinfo(){
    this.message.reply("https://www.youtube.com/watch?v=FZUcpVmEHuk");
  }
}
