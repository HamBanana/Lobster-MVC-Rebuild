import {Controller} from '../core/controller.mjs';
import * as sub from 'child_process';

import { once } from 'events';

export class manage_controller extends Controller{
perm = {'users': ['330279218543984641']}

  constructor(msg){
  super(msg);
  this.auth(this.perm);
  }
  
  index(){
  }

  reboot(){
    this.message.reply('Rebooting..').then(() => {
      sub.exec(process.env.LOBSTER_ROOT+'/utils/reboot.sh');
    });
  }

  restart(){
    this.message.reply("Restarting..").then(() => {
      let ret = sub.exec(process.env.LOBSTER_ROOT+'/utils/start.sh');
      if (ret > 0){
        this.message.reply('Start script failed.');
        return;
      }
      process.exit();
    });
  }

  enable(){
    sub.exec('chmod +x ' + process.env.LOBSTER_ROOT + '/utils/*');
  }

  disable(){
    let r = sub.exec('chmod -x ' + process.env.LOBSTER_ROOT + '/utils/*');
    // start.sh must always be enabled, otherwise Lobster cannot start
    sub.exec('chmod +x ' + process.env.LOBSTER_ROOT + '/utils/start.sh');
  }

  log(){
    //this.message.reply(sub.exec('tail ' + processenv.LOBSTER_ROOT+'../lobster.log'));

  }

  pull(){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/pull.sh');
    this.message.react(':white_check_mark:');
  }

  run_backup(){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/run_backup.sh');
    this.message.react(':white_check_mark:');
  }

  run_main(){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/start.sh');
    this.message.react(':white_check_mark:');
  }

  backup(){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/backup.sh');
    this.message.react(':white_check_mark:');
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
    this.message.reply("gitstatus was called");
    //await once(p, 'close');

  }

  update(){
    this.pull();
    this.run_main();
    process.exit();
  }

}
