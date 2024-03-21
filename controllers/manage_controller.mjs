import {Controller} from '../core/controller.mjs';
import * as sub from 'child_process';
import { logpath } from '../core/error.mjs';
import {Time} from '../tools/time.mjs';

import { once } from 'events';
import { warn } from '../core/error.mjs';

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
    pull: (w) ? root+'\\utils\\win_pull.bat' : '/utils/pull'
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
    update = (update == "true") ? true : false;

    return new Promise((resolve, reject) => {
      if (update){
        sub.exec(this.paths.pull, (err, stdout, stderr) => {
          if (err){reject('Error while pulling for reboot: ' + err.message); return;}
          return stdout;
        });
      }

    })
    .then((pullout) => {
      return new Promise((resolve, reject) => {
        if (process.env.OS == "Windows"){reject('Just pretend like it rebooted'); return;}
      sub.exec(this.paths.reboot, (err, stdout, stderr) => {
        if (err){reject('Error rebooting: ' + err.message); return;}
      resolve(this.message.react('✅'));
      
    })
      });
      })
      /*.catch((err) => {
        this.message.reply('Error: ' + err.message); return;
      });*/
  }

  restart(args){
    let { mode } = this.extractArgs(args, 'mode');
    if (!mode) {mode = 'default';}
    (async function() {

      try {
    
        const out = fs.openSync('./out.log', 'a');
        const err = fs.openSync('./out.log', 'a');
    
        console.log('spawn sub');
    
        const sub = spawn(process.env.LOBSTER_ROOT + '/utils/start', [], {
          detached: true,               // this removes ties to the parent
          stdio: [ 'ignore', out, err ]
        });
    
        sub.unref();
        console.log('waiting..');
    
        await new Promise((resolve,reject) =>
          setTimeout(() => resolve(), 3000)
        );
        console.log('exiting main..');
        this.message.reply('Restarting');
    
      } catch(e) {
        console.error();
      } finally {
       // process.exit();
      }
    
    })();
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
      if (error){
        this.message.reply('Error in exec:' + error.message);
        return;
      }
      let o = stdout || 'Nothing here.';
      this.message.reply(o);
    });
    return;
    
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
