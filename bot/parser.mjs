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
      
      let parms = c.split(" ");

      if (parms[0] in this.#method_alias){
        c = c.replace(parms[0], this.#method_alias[parms[0]]);
      }

      console.log('Parms before split: ' + JSON.stringify(parms));
      
      //parms = this.splitStringByQuotes(c);
      parms = this.splitStringBySpaces(c);

      console.log('Parms after split: ' + JSON.stringify(parms));

      let command = {
        'controller': parms[0] || 'index',
        'method'    : parms[1] || 'index',
        'args'      : parms.splice(2)
      };

      console.log(JSON.stringify('Parms: ' + parms));
      console.log('Command: ' + JSON.stringify(command));
      
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
      try {
        fs.statSync(path.resolve(__dirname, ctrlpath));
        resolve(ctrlpath);
      } catch (error) {
        error = new Error('The controller "'+ command.controller +'" does not exist.');
        error.code = 'ERR_MODULE_NOT_FOUND';
        reject(error);
      }
    })
    .then((ctrlpath) => { 
      return import(ctrlpath).catch(error => {
        error = new Error('The controller "'+ command.controller +'" does not exist.');
        error.code = 'ERR_MODULE_NOT_FOUND';
        throw error;
      });
    })
    .then((module) => {
        return new Promise((resolve, reject) => {
          try {
            let cons = eval('module.'+command.controller+'_controller');
            resolve(new cons(this.message));
          } catch (error) {
            reject(error);
          }
        })
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
           if (typeof(p) === "object" && typeof(p.then) === "function") {
             return p.then((op) => {
               console.log("Return value from promise after executing function: " + JSON.stringify(op));
               return op;
             });
           }
           return p;
          })
          .catch((err) => {
            console.error('Execute command error:', err);
            throw err; // Re-throw to be handled by lobster.mjs error handling
          });

  }

  splitStringBySpaces(str) {
    // Regular expression to match segments enclosed in apostrophes
    const regex = /['"]([^'"]+)['"]/g;
    
    // Replace segments enclosed in apostrophes with a placeholder
    const replacedStr = str.replace(regex, (match, capture) => {
      console.log('match: ' + JSON.stringify(match));
      console.log('capture: ' + JSON.stringify(capture));
        // Replace each character in the enclosed segment with a placeholder
        return capture.replace(/\s/g, 'ø');
    });
    
    // Split the replaced string by spaces
    const segments = replacedStr.split(/\s+/);
    
    // Restore the original segments by replacing the placeholders
    const finalSegments = segments.map(segment => {
        return segment.replace(/ø/g, ' ');
    });
    
    return finalSegments;
}

splitStringByQuotes(str){
  let segments = str.split('"');
  let enclosedsegments = [];
  for (let i in segments){
    // i % 2 will be 0, if i is even.
    if (i % 2 == 0){
      enclosedsegments.push(segments[i]);
    } else {
      enclosedsegments.push(...segments[i].split(' '));
    }
  }
  return enclosedsegments;
}
}
