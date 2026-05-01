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

    // getConnection() tests that the pool can reach the server.
    // On failure we log and continue — Discord still starts for partial functionality.
    // With a pool, subsequent queries will retry the connection rather than permanently
    // dying with PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR.
    db.connection.getConnection((err, conn) => {
      if (err) {
        warn('Failed to get database connection: ' + err.code + ' - ' + err.message);
      } else {
        warn('Database connection established.');
        conn.release();
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
