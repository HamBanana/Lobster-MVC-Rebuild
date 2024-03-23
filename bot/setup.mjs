import { Database } from "../core/database.mjs";
import * as sub from 'child_process';

export const tables =  {
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
        is_infohost: 'TINYINT(1)',
        'PRIMARY KEY': '(id)'
    },
    system_vars:{
        name: 'VARCHAR(8) UNIQUE', value: 'VARCHAR(256)'
    }
}

export function createTables(onData = () => {}){
    return new Promise((resolve, reject) => {
        
    let db = Database.getInstance();
    let createpromises = [];
    for (let [k, v] of Object.entries(tables)){
        let p = db.p_create_table(k, v)
        .then((res) => {onData(res);});
        createpromises.push(p);
    }
    Promise.all(createpromises).then(() => { resolve(); });

    });
}

export function pull(onData = () => {}){
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

export function prepareUtils(){
    return new Promise((resolve, reject) => {
        if (process.env.OS == "Windows"){resolve();}
        sub.exec('chmod +x ' + process.env.LOBSTER_ROOT + '/utils/*', (err, stdout, stderr) => {
            if (err || stderr){reject(err); return;}
            resolve(stdout);
        });
    });
}