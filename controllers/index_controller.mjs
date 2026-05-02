import {Controller} from '../core/controller.mjs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { warn } from '../core/error.mjs';

export class index_controller extends Controller{
  constructor(msg){
    super(msg);
    this.controllername = 'index';
  }

  index(){
    return new Promise((resolve, reject) => {
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        this.view.content = {files: [__dirname + '/../res/img/idiot.png']};
        resolve(this.post());
      } catch (err) {
        reject(err);
      }
    }).catch((err) => this.reportError(err, { stage: 'index/index' }));
  }

  info(){
    return Promise.resolve(
      this.message.reply("https://www.youtube.com/watch?v=n0XaSvhTYd4")
    ).catch((err) =>
      warn(err, { context: { controller: 'index', stage: 'info' } })
    );
  }

  moreinfo(){
    return Promise.resolve(
      this.message.reply("https://www.youtube.com/watch?v=FZUcpVmEHuk")
    ).catch((err) =>
      warn(err, { context: { controller: 'index', stage: 'moreinfo' } })
    );
  }
}
