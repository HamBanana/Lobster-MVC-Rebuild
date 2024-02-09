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
    this.message.react('✅');
  }

  run_backup(args){
    let kill = (args['kill']) ? args['kill'] : args['default'][0];
    sub.exec(process.env.LOBSTER_ROOT+'/utils/run_backup.sh');
    if (kill){
      process.exit();
    }
    this.message.react('✅');
  }

  run_main(){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/start.sh');
    this.message.react('✅');
  }

  backup(){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/backup.sh');
    this.message.react('✅');
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
    this.message.reply('Pulling..');
    this.pull();
    let c = sub.exec(process.env.LOBSTER_ROOT+'/utils/update_code.sh');
    let o = '';

    c.stdout.on('data', (data) => {
      o = o + data;
    });

    c.stderr.on('data', (data) => {
      console.log('stderr: ' + data);
    });

    c.on('close', (code) => {
      this.message.reply(code.toString());
      process.exit();
    });

    this.run_main();
  }

}
