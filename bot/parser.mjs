import { constants } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export class Parser{

  msg;

  constructor(msg){
    this.msg = msg;
  }
    

    
  #method_alias = {
    'd'   : 'random dice',
    'dice': 'random dice',
    'c'   : 'random coin',
    'coin': 'random coin',
    'join': 'lobby queue',
    'unjoin': 'lobby unqueue',
    'list': 'lobby list',
    'code': 'lobby list',
    'kill': 'lobby delete',
    'create': 'lobby create',
    'reboot': 'manage reboot'
  }

  parseCommand(msg){
    return new Promise((resolve, reject)=> {
      let c = (typeof(msg) === 'string') ? msg.toLowerCase() : msg.content.toLowerCase();
      if (!c.startsWith('!lob') && c.startsWith('!lobster')){return;}
      let parms = c.split(" ");

      if (parms[1] in this.#method_alias){
        c = c.replace(parms[1], this.#method_alias[parms[1]]);
      }

      parms = this.splitStringBySpaces(c);

      let command = {
        'controller': parms[1] || 'index',
        'method'    : parms[2] || 'index',
        'args'      : parms.splice(3)
      };

      console.log(JSON.stringify('Parms: ' + parms));

      //Test if command is an alias
      /*for (let [k, v] of Object.entries(this.#method_alias)){
        if (k !== parms[1]){continue;}
        let spl = v.split('.');
        command = {
          'controller': spl[0],
          'method'    : spl[1],
          'args'      :parms.splice(2)
        };
      }*/
      
          let args = {'default': []};
          for (let i of command.args){
            if (i.includes(":")){
              let spl = i.split(":")
              args[spl[0]] = spl[1];
            } else {
              args['default'].push(i);
            }
          }
          command['args'] = args;

          resolve(command);
          
        
    });
  }

  executeCommand(command){
    return new Promise((resolve, reject) => {
      if (!command || command == undefined){reject({message: 'Error in command'});}
      let ctrlpath = "../controllers/"+command.controller+"_controller.mjs";
      let __filename = fileURLToPath(import.meta.url);
      let __dirname = path.dirname(__filename);
      /*let exists = async function(ctrlpath){
        try {
          console.log('CWD: ' + process.cwd());
          await fs.stat(path.join(__dirname, '..', 'controllers', command.controller+"_controller.mjs"), false, (err, stats) => {
            console.log('Stats: ' + JSON.stringify(stats));
            if (err){
              console.log('Async test error: ' + err.message);
              return false;
            }
            return true;
          });
        } catch (error) {
          console.log('Catch error: ' + error.message);
          return false;
        }
      }

      return exists(ctrlpath).then(path => {
        console.log('Path: ' + path);
      });*/

      if (fs.statSync(__dirname+'/'+ctrlpath)){
        resolve(ctrlpath);
      } else {
        reject('Controller not found');
      }

    })
    .then((ctrlpath) => {
      console.log('ctrlpath: ' + ctrlpath);
      return import(ctrlpath).then((module) => {
        let cons = eval('module.'+command.controller+'_controller');
        let ins = new cons(this.msg);
        return ins.auth(ins.perm).then((allowed) => {
          if (!allowed) {
            reject({message: 'Permission denied', code:'PERMISSION_DENIED'});
            return;
          }
          console.log('Ins perm: ' + ins.perm);
          
          if (!command.method || parseInt(command.method)){
            //return reject("That's not a function.");
            throw new Error('Not a function');
          }
          
            let func = eval("ins."+command.method+'.bind(ins)');
          if (typeof(func) !== 'function'){
            reject(command.method + ' is not a valid function of '+command.controller);}
        // Execute the parsed function.
            func(command.args);
        });
        });
    });

  }

  splitStringBySpaces(str) {
    // Regular expression to match segments enclosed in apostrophes
    const regex = /['"]([^']+)['"]/g;
    
    // Replace segments enclosed in apostrophes with a placeholder
    const replacedStr = str.replace(regex, (match, capture) => {
      console.log('match: ' + JSON.stringify(match));
      console.log('capture: ' + JSON.stringify(capture));
        // Replace each character in the enclosed segment with a placeholder
        return capture.replace(/\s/g, '_');
    });
    
    // Split the replaced string by spaces
    const segments = replacedStr.split(/\s+/);
    
    // Restore the original segments by replacing the placeholders
    const finalSegments = segments.map(segment => {
        return segment.replace(/_/g, ' ');
    });
    
    return finalSegments;
}
}