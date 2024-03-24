import {Controller} from '../core/controller.mjs';
import * as sub from 'child_process';
import { logpath } from '../core/error.mjs';
import {Time} from '../tools/time.mjs';

import { once } from 'events';
import { warn } from '../core/error.mjs';
import { Database } from '../core/database.mjs';

export class manage_controller extends Controller{
  
perm = {'users': ['330279218543984641']}

  constructor(msg){
  super(msg);
  this.auth(this.perm);

  // Windows check
  if (process.env.OS == 'Windows'){
    this.message.reply("Lobster is currently running on Windows, don't expect any manage functions to work");
  }

  let root = process.env.LOBSTER_ROOT;
  let w = (process.env.OS == "Windows");

  this.paths = {
    reboot: (w)?root+'\\utils\\win_reboot':root+'/utils/reboot',
    pull: (w) ? root+'\\utils\\win_pull.bat' : root+'/utils/pull',
    start: (w) ? root+'\\utils\\win_start.bat' : root + '/utils/start'
  }

  }
  
  index(){}

  who(){
    sub.exec('whoami', (err, stdout, stderr) => {
      if(err){throw err;}
      this.message.reply('I am ' + stdout);
    });
  }

  reboot(args){
    let {update} = this.extractArgs(args, 'update');
    let db = Database.getInstance();
    update = (update == "true") ? true : false;

    return new Promise((resolve, reject) => {
      if (update){
        sub.exec(this.paths.pull, (err, stdout, stderr) => {
          if (err){reject('Error while pulling for reboot: ' + err.message); return;}
        });
      }
        if (process.env.OS == "Windows"){reject('Restart Lobster manually.'); return;}
        this.message.reply('<a:loading:1220396138860122162> Rebooting').then((m) => {
          let promises = [];
          promises.push(db.p_insert('system_vars', {name: 'boot_mode', value: 'reboot'}));
          promises.push(db.p_insert('system_vars', {name: 'boot_channel', value:this.message.channelId}));
          promises.push(db.p_insert('system_vars', {name: 'boot_message', value:m.id}));
          Promise.all(promises).then(() => {
            sub.exec(this.paths.reboot, (err, stdout, stderr) => {
              if (err){reject('Error rebooting: ' + err.message); return;}
            resolve(this.message.react('✅'));
          });
          });
        });

    })
    .catch((err) => {
      this.message.reply('Error: ' + JSON.stringify(err.message)); return;
    });
  }

  sql(args){
    let { query } = this.extractArgs(args, 'query');
    let db = Database.getInstance();
    return new Promise((resolve, reject) => {
      this.message.reply('Query: ' + query);
      db.connection.query(query, (err, res) => {
        if (err){reject(err);}
        resolve(res);
      });
    })
    .then((output) => {
      this.message.reply('SQL: ' + JSON.stringify(output));
    })
    .catch((err) => {
      this.message.reply('SQL error: ' + err.message);
    });

  }

  restart(args){
    let { mode } = this.extractArgs(args, 'mode');
    if (!mode) {mode = 'default';}

    return new Promise((resolve, reject) => {
      return sub.exec('chmod +x ' + this.paths.start, (err, stdout, stderr) => {
        if (process.env.OS == "Windows"){return;}
        let child = sub.spawn(this.paths.start, [], {detached: true});
        child.unref();
        return this.message.reply('<a:loading:1220396138860122162> Restarting').then((m) => {
          console.log('m: '+ JSON.stringify(m));
          let timerId = setTimeout(() => {m.edit('\:white_check_mark: Shutting down :)'); process.exit();}, 15000);
          child.stdout.on('data', (data) => {
            warn('Data: ' + data);
          });
          child.stderr.on('data', (data) => {
            m.edit('Error: ' + data);
            //clearTimeout(timerId);
          });
          child.on('exit', () => {
            m.edit('\:white_check_mark: Shutting down :)');
            this.message.react('✅');
            //process.exit();
          });
        });
      });
    })
    .catch((err) => {
      this.message.reply('Error: ' + err.message);
    }); 
  }

  enable(){
    sub.exec('chmod +x ' + process.env.LOBSTER_ROOT + '/utils/*', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Error enabling execute permissions to shell scripts: ' + err.message);
        return;
      }
      this.message.reply('Shell scripts can now be executed');
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
    // start must always be enabled, otherwise Lobster cannot start
    sub.exec('chmod +x ' + process.env.LOBSTER_ROOT + '/utils/start', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Failed reenabling execute permission on start: ' + err.message);
        return;
      }
      this.message.reply('Reenabled execute permission on start (Required for Lobster to work)');
    });
  }

  gitlog(){
    sub.exec('git log | head -5', (error, stdout, stderr) => {
      if (error || stderr){
        this.message.reply('Error in exec:' + error.message||stderr.message);
        return;
      }
      let o = stdout || 'Nothing here.';
      this.message.reply(o);
    });
    return;
    
  }

  ppull(){
    return new Promise((resolve, reject) => {
      let child = sub.spawn(this.paths.pull);
      this.message.reply('<a:loading:1220396138860122162> Beginning pull').then((omsg) => {
        console.log('OMSG: ' + JSON.stringify(omsg));
        child.stdout.on('data', (data) => {omsg.edit('\:loading: '+data);});
        child.stderr.on('data', (data) => {omsg.edit('\:fail: '+data)});
        child.on('exit', () => {omsg.edit('\:white_check_mark: Pull done');});
      })
    })
    .catch((err) => {
      this.message.reply('Error: ' + err.message);
    });
  }

  pull(){
    sub.exec(this.paths.pull, (err, stdout, stderr) => {
      if (err){
        this.message.reply('Error in pull: ' + err.message);
        return;
      }
      warn('Pull: ' + stdout);
    this.message.react('✅');
    });
  }

  run_backup(args){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/run_backup', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Error in run_backup: ' + err.message);
      }
    this.message.react('✅');
    });
  }

  run_main(){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/start', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Error in run_main: ' + err.message);
        return;
      }
    this.message.react('✅');
    });
  }

  backup(){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/backup', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Error in backup: ' + err.message);
        return;
      }
    this.message.react('✅');
    });
  }

  gitstatus(){
    sub.exec(process.env.LOBSTER_ROOT+'/utils/gitstatus', (err, stdout, stderr) => {
      if (err){
        this.message.reply('Error in run_backup: ' + err.message);
        return;
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

  drop_table({args}){
    let table = (args.table || args.default?.[0]);
    if (!table) {return;}
    
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

  log(args){
    let { lines, clear } = this.extractArgs(args, 'lines');

    if (clear == "true"){
      let success = (err, stdout, stderr) => {
        if (err){this.message.reply('Log error: ' + err.message);}
        this.message.react('✅');
      };
      if (process.env.OS == "Windows"){
        sub.exec('rem ' + logpath, success);
      } else {
        sub.exec('rm ' + logpath, success);
      }
      sub.exec('"" > ' + logpath)
      return;
    }

    if (!lines){lines = 10;}
    if (process.env.OS == "Windows"){
      console.log('LOGPATH: ' + logpath);
      let child = sub.spawn('powershell.exe', [process.env.LOBSTER_ROOT+"\\utils\\win_logtail.ps1 -path "+logpath+" -lines " + lines]);
      let out = "";
      child.stdout.on('data', (data) => {
        out += data;
      });
      child.stderr.on('data', (data) => {
        out += 'ERROR: ' + data;
      });
      child.on('exit', () => {
        this.message.reply((out !== "") ? out : "Log is empty");
      });
    } else {
      sub.exec('tail -' + lines + ' ' + logpath, (err, stdout, stderr) => {
        if (err){return this.message.reply("Can't get log, because: " + err.message);}
        this.message.reply('Output: '+stdout);
      }); 
    }
  }

}
