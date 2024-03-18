import { constants } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export class Parser{

  msg;

  constructor(msg){
    this.message = msg;
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
      if (!command || command == undefined){reject('Error in command');}
      let ctrlpath = "../controllers/"+command.controller+"_controller.mjs";
      let __filename = fileURLToPath(import.meta.url);
      let __dirname = path.dirname(__filename);
      if (fs.statSync(__dirname+'/'+ctrlpath)){
        resolve(ctrlpath);
      } else {
        throw new Error({message: 'The controller "'+ command.controller +'" does not exist.'});
      }

    })
    .then((ctrlpath) => { return import(ctrlpath)})
      .then((module) => {
        let cons = eval('module.'+command.controller+'_controller');
        let ins;
        try {
          ins = new cons(this.message);
        } catch (error) {if (error){throw error;} }
        return ins.auth(ins.perm)
        .catch((err) => {
          console.log('CATCH after auth');
          if (err){throw err;}
        });
      })
          .then((ins) => {
          console.log('Ins perm: ' + JSON.stringify(ins.perm));
          
            let func = eval("ins."+command.method+'.bind(ins)');
          if (typeof(func) !== 'function'){
            reject(command.method + ' is not a valid function of '+command.controller);}
        // Execute the parsed function.
           let p = func(command.args);
           console.log("Type of p: " + typeof(p));
           console.log("content of p: " + JSON.stringify(p));
           //reject('Test');
           if (typeof(p) == "object"){
            console.log('Check 2');
            p.then((op) => {
              console.log("Return value from promise after executing function: " + JSON.stringify(op));
            });
           }
          })
          .catch((err) => {
            if (typeof(err) == 'string'){err = {'message':err};}
            console.log('Error code: ' + err.code);
            switch(err.code){
              case 'ERR_MODULE_NOT_FOUND': return this.message.reply('The controller doesn\'t exist, I guess?');
              case 'PERMISSION_DENIED': return this.message.react('<:no:1047889973631782994>');
              case 'ENOENT': return msg.reply("That controller doesn't exist");
              default:
                if (err.message == "Cannot read properties of undefined (reading 'bind')"){
                  return this.message.reply('That function does not exist');
                }
              this.message.reply('Error because: ' + err.message);
              console.log('Execute command failed:\n' 
              + 'Message: ' + err.message
              + '\nCode: ' + err.code
              + '\nStack: ' + (err.stack) ? err.stack : 'No stack.'
              );
              return;
            }
          });;

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