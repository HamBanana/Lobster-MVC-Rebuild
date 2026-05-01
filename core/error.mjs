import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Time } from '../tools/time.mjs';

function resolveLogPath() {
    const root = process.env.LOBSTER_ROOT;
    if (!root) {
        // Fall back to a writable location next to cwd so we never silently lose logs.
        return path.join(process.cwd(), 'log_lobster');
    }
    return os.platform() === 'win32'
        ? path.join(root, '..', 'log_lobster')
        : path.join(root, '..', 'log_lobster');
}

export const logpath = resolveLogPath();

export class PermissionError extends Error{
    constructor(msg){
        super(msg);
        this.name = "PermissionError";
        this.code = "PERMISSION_DENIED";
    }
}

export function warn(error, fail = false){
    const message = (typeof error === "string") ? error : (error && error.message) ? error.message : String(error);
    const line = '<t:' + Time.now + ':t>: ' + message;
    // Mirror to console so the operator sees what's happening live. The old
    // shell-echo implementation only wrote to a file, but because it was always
    // crashing, the .catch console.log was effectively the bot's stdout. Keeping
    // a console mirror preserves that visibility.
    console.log(line);
    return fs.appendFile(logpath, line + '\n')
        .catch((err) => {
            // Surface the reason warn() itself failed so we don't silently mask
            // logging problems (bad LOBSTER_ROOT, permissions, etc.).
            console.log('Warn file write failed (' + err.message + ') for: ' + JSON.stringify(message));
        });
}