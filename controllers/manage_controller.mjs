import {Controller} from '../core/controller.mjs';
import * as sub from 'child_process';

import { once } from 'events';

export class manage_controller extends Controller{
perm = {'users': ['330279218543984641']
, 'channels': ['1200927450536890429']}

  constructor(msg){
  super(msg);
  this.auth(this.perm);
  }
  
  index(){
  }

  reboot(){
    //this.message.reply('Rebooting..').then(() => {
      sub.exec(process.env.LOBSTER_ROOT+'/utils/reboot.sh');
      this.message.react('✅');
    //});
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
    let os = process.env.OS;
    let p;
    let spawn = sub.spawn;
    if (!os){os = 'Linux';}
    if (os == 'Windows'){
      //p = process.env.LOBSTER_ROOT + '/utils/tail.bat ' + process.env.LOBSTER_ROOT + '/../log_lobster';
      p = 'echo';
    } else {
      p = 'tail ' + process.env.LOBSTER_ROOT+'/../log_lobster';
    }
    let pr = spawn(p);
    pr.stdout.pipe(process.stdout);
    return;
    //this.message.reply(sub.exec('tail ' + processenv.LOBSTER_ROOT+'../lobster.log'));
    let o;
    p.stdout.on('data', (data) => { o = o + data; console.log(data);});
    
    p.on('close', (code) => {
      this.message.reply('Code: ' + code);
      if (!o){
        this.message.reply('No output received');
        
      } else {
        this.message.reply(o);
      }
    });
    
  }

  pull(){
    sub.exec('sudo ' + process.env.LOBSTER_ROOT + '/utils/pull.sh');
    this.message.react('✅');
  }

  run_backup(args){
    let kill = (args['kill']) ? args['kill'] : args['default'][0];
    sub.exec(process.env.LOBSTER_ROOT+'/utils/run_backup.sh');
    if (kill){
      //process.exit();
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

  kill(){
    this.message.reply('Shutting down..').then(() => {
    process.exit();
    });
  }

  sql(args){
    let q = (args['query']) ? args['query'] : args['default'][0];
    this.database.connection.query(q, (msg) => {
      this.message.reply(JSON.stringify(msg));
    });
  }

  setvar(args){
   // let k = (args['key']) ? args['key'] : args['default'][0];
   // let v = (args['value']) ? args['value'] : args['default'][1];
   
   //this.message.reply('Setting var: "key='+k+'", "value='+v+'"');
   //process.env[k] = v;
  }

  getvar(args){
    let k = (args['key']) ? args['key'] : args['default'][0];
    //let r = eval('process.env.'+k);
    this.message.reply('No way this works right?: ' + r);
    if (!r){
      this.message.reply('Key: "'+k+'" was not found.');
      return;
    }
    return;
  }

}
