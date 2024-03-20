import * as sub from 'child_process';

export class PermissionError extends Error{
    constructor(msg){
        super(msg);
        this.name = "PermissionError";
        this.code = "PERMISSION_DENIED";
    }
}

export function warn(error, fail = false){
    return new Promise((resolve, reject) => {
        sub.exec('"'+ ((typeof(error) == "string") ? error : error.message) + '" >> ' + process.env.LOBSTER_ROOT + '/../log_lobster', (err, stdout, stderr) => {
            if (err){throw err;}
            resolve(stdout);
        });
    });
}