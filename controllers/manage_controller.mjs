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
  
  index(){}

  reboot(){
      sub.exec(process.env.LOBSTER_ROOT+'/utils/reboot.sh', () => {
        if (err){
          this.message.reply('Error rebooting: ' + err.message);
          return;
        }
      this.message.react('✅');
      });
  }

  enable(){
    sub.exec('chmod +x ' + process.env.LOBSTER_ROOT + '/utils/*', (err, stdout, stderr) => {
      if (err){
        this.reply('Error enabling execute permissions to shell scripts: ' + err.message);
        return;
      }
      this.reply('Shell scripts can now be executed');
    });
  }

  disable(){
    let r = sub.exec('chmod -x ' + process.env.LOBSTER_ROOT + '/utils/*', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Failed removing permissions on shell scripts: ' + err.message);
        return;
      }
      this.message.reply('Execute permission for shell scripts are removed');
    });
    // start.sh must always be enabled, otherwise Lobster cannot start
    sub.exec('chmod +x ' + process.env.LOBSTER_ROOT + '/utils/start.sh', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Failed reenabling execute permission on start.sh: ' + err.message);
        return;
      }
      this.message.reply('Reenabled execute permission on start.sh (Required for Lobster to work)');
    });
  }

  log(){
    let os = process.env.OS;
    let p;
    let spawn = sub.spawn;
    sub.exec('git log | head -5', (error, stdout, stderr) => {
      if (error){
        this.message.reply('Error in exec:' + error.message);
        return;
      }
      let o = stdout || 'Nothing here.'
      this.message.reply(stdout);
    });
    return;
    
  }

  pull(){
    sub.exec('sudo ' + process.env.LOBSTER_ROOT + '/utils/pull.sh', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Error in pull: ' + err.message);
        return;
      }
    this.message.react('✅');
    });
  }

  run_backup(args){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/run_backup.sh', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Error in run_backup: ' + err.message);
      }
    this.message.react('✅');
    });
  }

  run_main(){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/start.sh', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Error in run_main: ' + err.message);
      }
    this.message.react('✅');
    });
  }

  backup(){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/backup.sh', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Error in backup: ' + err.message);
      }
    this.message.react('✅');
    });
  }

  gitstatus(){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/gitstatus.sh', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Error in run_backup: ' + err.message);
      }
    this.message.react('Output: '+stdout);
    });

  }

  kill(){
    this.message.reply('Shutting down..').then(() => {
    process.exit();
    });
  }

  /*sql(args){
    let q = (args['query']) ? args['query'] : args['default'][0];
    this.database.connection.query(q, (msg) => {
      this.message.reply(JSON.stringify(msg));
    });
  }*/

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
