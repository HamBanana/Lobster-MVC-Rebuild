import * as Mysql from 'mysql';
import { LobsterConfig } from '../../secret.mjs'
import { warn } from './error.mjs';

export class Database {

    static _instance = null

    connection = null;
    constructor(){
        this.connection = Mysql.createConnection(LobsterConfig);

        if (!this.connection){
            warn('Error in creating database connection');
        } else {
            warn('Database connection created.');
        }
    }
    
    static getInstance(){
        if (Database._instance == null){
            Database._instance = new Database();
        } 
        return Database._instance;
    }

    getStringsFromJson(values){
        let keystring = ''
        let valuestring = '';
        for (const [key, value] of Object.entries(values)){
            keystring += (keystring == '') ? key : ', ' + key;
            valuestring += (valuestring == '') ? '"'+value+'"' : ', "' + value + '"';
        }
        return {keystring, valuestring};
    }

    insert(table, values, callback = () => {}){

        let {keystring, valuestring} = this.getStringsFromJson(values);

        //warn('INSERT INTO ' + table + ' (' + keystring + ') VALUES (' + valuestring + ')');
        return this.connection.query('INSERT INTO ' + table + ' (' + keystring + ') VALUES (' + valuestring + ')', callback);
    }

    create_table(name, values, if_not_exists = true, callback = null){
        return this.connection.query('CREATE TABLE ' +  ((if_not_exists) ? 'IF NOT EXISTS ' : ' ') + name + ' (' + values + ')', callback);
    }

    p_createtable(name, values, options){
        return new Promise((resolve, reject) => {
            let {keystring, valuestring} = this.getStringsFromJson(values);
            return this.connection.query("CREATE TABLE " + ((options.if_not_exists) ? "IF NOT EXISTS " : " ") + name + " (" + values );
        });
    }

    get(select, from, where = undefined, callback = () => {}){
        return this.connection.query('SELECT ' + select + ' from ' + from + ((where) ? ' where ' + where : ''), callback);
    }

    p_get(from, where, operator = "AND"){
        return new Promise((resolve, reject) => {
            let wherestring = "";
            for (let [k, v] of Object.entries(where)){
                wherestring += (wherestring == "") ? k+' = '+v : ' AND '+k+' = '+v;
            }
            return this.connection.query('SELECT * from ' + from + ((wherestring !== "") ? ' where ' + wherestring : ''), (err, res) => {
                if (err){reject(err); return;}
                resolve(res);
            });
        });
    }

    p_getLatest(table){
        return new Promise((resolve, reject) => {
            return this.connection.query("SELECT * from " + table + " ORDER BY id DESC LIMIT 1", (err, res) => {
                if (err){reject(err); return;}
                resolve(res[0]);
            });
        });
    }

    update(table, set, where, callback){
        return this.connection.query("UPDATE " + table + " SET " + set + " WHERE " + where, callback);
    }

    delete(table, where, callback){
        //warn('DELETE FROM ' + table + ' WHERE ' + where);
       return this.connection.query('DELETE FROM ' + table + ' WHERE ' + where, callback);
    }
}