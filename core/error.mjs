export class PermissionError extends Error{
    constructor(msg){
        super(msg);
        this.name = "PermissionError";
        this.code = "PERMISSION_DENIED";
    }
}