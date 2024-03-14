import {Controller} from '../core/controller.mjs';
import {LobbyManager} from '../among_us/lobbymanager.mjs';
import { embed_example } from '../views/lobby.mjs';
import { MessageEmbed } from 'discord.js';
//import * as idiot from '../res/img/idiot.png';
import * as path from 'path';
import { fileURLToPath } from 'url';

export class index_controller extends Controller{
  index(){
    let __filename = fileURLToPath(import.meta.url);
    let __dirname = path.dirname(__filename);
    //this.view.content = {files: [__dirname + '/../res/img/idiot.png']};
    //this.view.template_type = 'embed';
    //this.view.template_path = 'lobby/embed_example_json';
    //this.view.data['title'] = "A better title";
    //this.view.data['description'] = "A better description";

    this.view.embeds[0] = new MessageEmbed().setTitle('Yay').addFields([{name:'Yay', value:'An embed with a field'}]); 
    //this.post({embeds:[embed_example]});
    //this.message.reply({embeds:[embed_example]});
    this.post();
  }

  info(){
    this.message.reply("https://www.youtube.com/watch?v=n0XaSvhTYd4");
  }

  moreinfo(){
    this.message.reply("https://www.youtube.com/watch?v=FZUcpVmEHuk");
  }
}
