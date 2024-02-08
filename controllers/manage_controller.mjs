import {Controller} from '../core/controller.mjs';
import * as sub from 'child_process';

export class manage_controller extends Controller{
perm = {'users': ['330279218543984641']}
  index(msg){
  super(msg);
  }

  reboot(){
  ret = sub.exec('../utils/reboot.sh');
  this.message.reply(ret);
  }
}
