import * as fs from 'fs';

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
    if (fs.existsSync(ctrlpath)){
      console.log(command.controller+' is not a valid controller.');
      return;
    }
  return import(ctrlpath).then((module) => {
    let cons = eval('module.'+command.controller+'_controller');
    let ins = new cons(this.msg);
    if (!ins.allowed) {
      reject('Permission denied!');
      this.msg.react('<:no:1047889973631782994>');
      return;
    }
    if (!command.method){reject({message: "That's not a function."});}
    let func = eval("ins."+command.method+'.bind(ins)');
    if (typeof(func) !== 'function'){reject(String(func)+' is not a valid function of '+command.controller);}
  // Execute the parsed function.
    resolve(
      func(command.args)
      /*.catch((err) => {
        console.log('ERROR: ' + err.message);
      })*/
      );
    })
    .catch((err) => {
      // Test for nonexistant function.
      if (err.message == "Cannot read properties of undefined (reading 'bind')"){
        return this.msg.reply('That\'s not a function of ' + command.controller);
      }
      switch(err.code){
        case 'ERR_MODULE_NOT_FOUND': return this.msg.reply('The controller "' + command.controller + '" doesn\'t exist.');
        default: this.msg.reply('Error because: ' + err.message); 
        console.log('Execute command failed:\n' 
        + 'Message: ' + err.message
        + '\nCode: ' + err.code
        + '\nStack: ' + (err.stack) ? err.stack : 'No stack.'
        );
        return;
      }
      //throw err;
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