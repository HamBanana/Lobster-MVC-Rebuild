//import * as discord from '../bot/discord.mjs';
//import * as AULM from '../AmongUs/LobbyManager.mjs';

import {count_controller} from "../controllers/count_controller.mjs";

//import Database from "@replit/database";


export class Bootstrap {

  constructor(){
    console.log('Application started.');
    
  }

  static load(){
    
    //let db = new Database();

    //return db.get("count_last_number").then((val) => {
    //  count_controller.last_number = val;
    //  console.log('last_number: '+val);
    //});
    
  }
/*
  static handleRequest(msg){
    Console.log('handleRequest triggered')
  if ((msg.author.username !== 'Hambanana' || msg.author.discriminator !== '1929')) {return;}
    
  if (msg.author.bot) {return;}
  let c = msg.content.toLowerCase();

  if (c.startsWith("!lob ") || c.startsWith("!lobster ")){
    // Splitting parameters for routing.
    let parms = c.split(" ");
    if (!parms[1]){return;}
    let controller = parms[1];
    let args = {};
    let argfound = false;
    let argindex = 0;
    for (let i = 0;i<parms.length;i++){
      console.log('testing index: '+i);
      if (!parms[i].includes(':')){continue;}
      if (!argfound){argindex = i;}
      argfound = true;
        let item = parms[i].split(':');
        args[item[0]] = item[1];
    }
    
    let fun = parms?.[2];
    
    if (!fun){fun = 'index';}
    console.log('Controller: '+controller);
    console.log('Function: '+fun);
    console.log('Arguments: '+args);
    import("../controllers/"+controller+"_controller.mjs")
      .then((module) => {
        //let con = controller+"_controller";
        let ctrl = eval('new module.'+controller+'_controller()');
        let funcref = eval("ctrl."+fun);
        console.log('funcref: '+func);
        msg.reply(funcref(args));
        return;
      })
    .catch((err) => {
      console.log('Import failed: '+err);
    });
  }
  // Only if not a !lob command
    console.log('Start code detection');
  let detect = AULM.LobbyManager.detectCode(c);
  console.log(detect);
  if (!detect){return;}
  console.log('Code detected!');
  /*if (msg.channelId !== '883526058236854312' && msg.channelId !== '949274005511229520'){return;}*/
  /*
    return msg.reply('Code: '+detect.code+'\nServer: '
    +(detect.server || 'Unknown')
    +'\nHosted by: '+msg.author.username
    +'\nLast active: <t:'+Math.floor(new Date().getTime() / 1000.0)+':R>');
    
  //return msg.reply("https://www.youtube.com/watch?v=FZUcpVmEHuk");

  } */

}
