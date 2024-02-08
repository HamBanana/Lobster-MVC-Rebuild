import {Controller} from '../core/controller.mjs';
import * as sub from 'child_process';

import { once } from 'events';

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
      sub.exec(process.env.LOBSTER_ROOT+'/../lobster-utils/reboot.sh');
    });
  }

  restart(){
    this.message.reply("Restarting..").then(() => {
      let ret = sub.exec(process.env.LOBSTER_ROOT+'/../lobster-utils/start.sh');
      if (ret > 0){
        this.message.reply('Start script failed.');
        return;
      }
      process.exit();
    });
  }

  log(){
    //this.message.reply(sub.exec('tail ' + processenv.LOBSTER_ROOT+'../lobster.log'));
  }

  gitstatus(){
    //let p = sub.spawn('gitstatus', [process.env.LOBSTER_ROOT+'/../lobster-utils/gitstatus.sh', '']);
    let o = '';

    /*
    p.stdin.setDefaultEncoding = 'utf-8';
    p.stdout.on('data', () => {
      o+=DataTransfer.toString();
    })

    p.stderr.on('data', (data) => {
      this.message.reply(data);
    });

    p.stdout.on('end', async function(code){
      this.message.reply('Process ended');
      //this.message.reply(o);
    });
    */
    this.message.reply("gistatus was called");
    //await once(p, 'close');
  }
}
