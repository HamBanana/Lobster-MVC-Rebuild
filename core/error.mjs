import * as sub from 'child_process';

export const logpath =  (process.env.OS == "Windows") ? process.env.LOBSTER_ROOT+'\\..\\log_lobster' : process.env.LOBSTER_ROOT+'/../log_lobster' ;

export class PermissionError extends Error{
    constructor(msg){
        super(msg);
        this.name = "PermissionError";
        this.code = "PERMISSION_DENIED";
    }
}

export function warn(error, fail = false){
    return new Promise((resolve, reject) => {
        sub.exec('echo "<t:'+Time.now+':t>: '+ ( (typeof(error) == "string") ? error : error.message) + '" >> ' + logpath, (err, stdout, stderr) => {
            if (err){reject(err);}
            resolve(stdout);
        });
    })
    .catch((err) => {
        console.log('Warn failed: ' + JSON.stringify(error));
    });
}