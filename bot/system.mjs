import { Database } from "../core/database.mjs";
import * as sub from 'child_process';

export class System{
    
os = process.env.OS;
root = process.env.LOBSTER_ROOT;

    static vars = {}
    
     tables =  {
        lobby_active_lobbies:{
            id: 'INT AUTO_INCREMENT NOT NULL',
            code: 'CHAR(6) UNIQUE NOT NULL',
            server: 'VARCHAR(20)',
            creationtime: 'BIGINT',
            pingtime: 'BIGINT',
            is_vc_lobby: 'TINYINT(1)',
            host: 'VARCHAR(20)',
            is_vanilla: 'TINYINT(1)',
            notes: 'TEXT',
            infohost: 'VARCHAR(25)',
            state: 'varchar(8)',
            post_id: 'varchar(25)',
            'PRIMARY KEY': '(id)'
        },
        lobby_queue:{
            id: 'INT AUTO_INCREMENT',
            member_id: 'VARCHAR(20) UNIQUE',
            join_request_time: 'BIGINT',
            lobby_code: 'VARCHAR(6)',
            'PRIMARY KEY': '(id)'
        },
        system_vars:{
            name: 'VARCHAR(16) UNIQUE', value: 'VARCHAR(256)'
        }
    }

    constructor(){
        this.db = Database.getInstance();
    }

    static setVar(name, value){
        let db = Database.getInstance();
        return new Promise((resolve, reject) => {
            return db.p_set('system_vars', {name, value}).then((res) => {resolve(res);}).catch((err) => {reject();});
        });
    }

    static getVar(name){
        return System.vars[name];
    }
    
    createTables(onData = () => {}){
        return new Promise((resolve, reject) => {
            
        let db = Database.getInstance();
        let createpromises = [];
        for (let [k, v] of Object.entries(this.tables)){
            let p = db.p_create_table(k, v)
            .then((res) => {onData(res);});
            createpromises.push(p);
        }
        Promise.all(createpromises).then(() => { resolve(); }).catch((err) => {throw err;});
    
        });
    }
    
    pull(onData = () => {}){
        let w = process.env.OS == "Windows";
        let path = (w) ? process.env.LOBSTER_ROOT + '\\utils\\win_pull.bat' : process.env.LOBSTER_ROOT + '/utils/pull'; 
        return new Promise((resolve, reject) => {
            if (process.env.NO_GIT_PULL){resolve();}
            let child = sub.spawn(path);
            child.stderr.on('data', (data) => {reject(data);});
            child.stdout.on('data', (data) => {onData(data);});
            child.on('exit', () => {resolve();});
        });
    }
    
    prepareUtils(){
        return new Promise((resolve, reject) => {
            if (process.env.OS == "Windows"){resolve();}
            sub.exec('chmod +x ' + process.env.LOBSTER_ROOT + '/utils/*', (err, stdout, stderr) => {
                if (err || stderr){reject(err); return;}
                resolve(stdout);
            });
        });
    }
    
    npm(onData = () => {}){
        return new Promise((resolve, reject) => {
            let child = sub.spawn('npm install');
            child.stderr.on('data', (data) => {reject(data);});
            child.stdout.on('data', (data) => {onData(data);});
            child.on('exit', () => {resolve();});
        });
    }
    
    loadVars(){
        return new Promise((resolve, reject) => {
            let db = Database.getInstance();
            db.p_get('system_vars')
            .then((res) => {
                console.log('Vars: \n'+JSON.stringify(res));
                resolve(res);
            })
            .catch((err) => {throw err;});
        });
    }

    resetBootmode(){
        return new Promise((resolve, reject) => {
            let db = Database.getInstance();
            console.log('resetBootmode is running');
            let promises = [];
            promises.push(db.p_delete('system_vars', {name: 'boot_mode'}).then(() => {console.log('boot_mode deleted');}).catch((err) => {reject(err);}));
            promises.push(db.p_delete('system_vars', {name: 'boot_channel'}).then(() => {console.log('boot_channel deleted');}).catch((err) => {reject(err);}));
            promises.push(db.p_delete('system_vars', {name: 'boot_message'}).then(() => {console.log('boot_message deleted');}).catch((err) => {reject(err);}));
                
            Promise.all(promises).then(() => {
                console.log('Bootmode is reset');
                db.p_get('system_vars').then((res) => {console.log('Vars after delete: ' + JSON.stringify(res));});
                resolve();
            })
            .catch((err) => {throw err;});
        });
    }

    static getBootMessage(){
        return new Promise((resolve, reject) => {
            if (!System.vars.boot_channel || !System.vars.boot_message){reject('Cannot get boot message');}
            let channel = Discord.client.channels.cache.get(System.vars.boot_channel);
            return channel.messages.fetch(System.vars.boot_message).then((m) => {resolve(m);});
        });
    }
}