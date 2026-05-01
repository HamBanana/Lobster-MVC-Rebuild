//import * as discord from '../bot/discord.mjs';
//import * as AULM from '../AmongUs/LobbyManager.mjs';

import {count_controller} from "../controllers/count_controller.mjs";
import { Database } from './database.mjs';

import {Lobster} from "../bot/lobster.mjs";
import { warn } from '../core/error.mjs';
import { Discord } from "./discord.mjs";

//import Database from "@replit/database";
//import { createRxDatabase } from "rxdb";
//import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';



export class Bootstrap {

  constructor(){
    warn('Application started.');
    
  }

  

  static load(){
    
    let db = Database.getInstance();

    db.connection.connect((err) => {
      if (err){
        // Pass the actual error through — "Failed to get database connection" by
        // itself tells you nothing. err.code (e.g. ECONNREFUSED, ER_ACCESS_DENIED_ERROR)
        // is what you actually need to debug it.
        warn('Failed to get database connection: ' + err.code + ' - ' + err.message);
        // NOTE: deliberately not returning — preserve original behavior of still
        // starting Discord/Lobster so logs and partial functionality are visible.
        // (Without a DB, table-creating code paths like System.createTables will
        // still throw PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR; fix the DB to avoid that.)
      } else {
        warn('Database connection established.');
      }

      //Bootstrap.loadInitialValues();
      let d = new Discord();
      d.login();
      let lob = new Lobster();
    });

    //return db.get("count", 'counting', 'ID = 1');
    //.then((val) => {
    //  count_controller.last_number = val;
    //  warn('last_number: '+val);
   //});
    
  }
  
  static loadInitialValues(){
    let db = Database.getInstance();
    // count.last_number

    //db.get('count', 'Lobster.counting', 'id = 1', (err, result) => {
    //  count_controller.last_number = result[0].count;
    //});

  }

}
