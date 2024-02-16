import * as Mysql from 'mysql';
import { LobsterConfig } from '../../secret.mjs'

export class Database {

    static _instance = null

    connection = null;
    constructor(){
        this.connection = Mysql.createConnection(LobsterConfig);

        if (!this.connection){
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

    create_table(name, values, if_not_exists = true, callback = null){
        console.log('CREATE TABLE ' +  ((if_not_exists) ? 'IF NOT EXISTS ' : ' ') + name + ' (' + values + ')');
        this.connection.query('CREATE TABLE ' +  ((if_not_exists) ? 'IF NOT EXISTS ' : ' ') + name + ' (' + values + ')', callback);
    }

    get(select, from, where, callback){
            this.connection.query('SELECT ' + select + ' from ' + from + ' where ' + where, callback);
    }

    update(table, set, where, callback){
        this.connection.query("UPDATE " + table + " SET " + set + " WHERE " + where, callback);
    }
}