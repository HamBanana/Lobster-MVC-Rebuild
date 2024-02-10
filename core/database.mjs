import * as Mysql from 'mysql';
import { LobsterConfig } from '../../secret.mjs'

export class Database {

    static _instance = null

    db = null;
    constructor(){
        this.db = Mysql.createConnection(LobsterConfig);

        if (!this.db){
            console.log('Error in creating database connection');
        } else {
            console.log('Database connection created.');
        }
    }
    
    static getInstance(){
        if (Database._instance == null){
            Database._instance = new Database();
        } 
        return Database._instance;
    }

    create_table(name, msg){
        this.db.connect((err) => {
            if (err) { msg.reply(err.message);}
        });
    }

    get(select, from, where, msg){
        this.db.connect((err) => {
            if (err) { 
                msg.reply(err.message);
                return;
            }
            this.db.query('SELECT ' + select + ' from Lobster.' + from + ' where ' + where, (err, result) => {
                if (err) {
                    msg.reply('That failed, but at least I can reply about it. :eyes:');
                    return;
                }
                msg.reply('Result: ' + result);
                console.log('Result: ' + result);
            });
        });
    }
}