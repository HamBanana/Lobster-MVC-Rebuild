import {Controller} from '../core/controller.mjs';
import * as sub from 'child_process';

export class manage_controller extends Controller{
perm = {'users': ['330279218543984641']}

  constructor(msg){
  super(msg);
  this.auth(this.perm);
  msg.reply("Dangerous action in progress.");
  }
  
  index(){
  }

  reboot(){
    this.message.reply('Rebooting..').then(() => {
      sub.exec('/home/thawasta/codespace/lobster-utils/reboot.sh');
    });
  }

  restart(){
    let ret = sub.exec('/home/thawasta/codespace/lobster-utils/start.sh');
    if (ret > 0){
      this.message.reply('Start script failed.');
      return;
    }
    process.exit();
  }
}
