import { Database } from '../core/database.mjs';


export class Model{

    db = null;

    constructor(){
        this.db = Database.getInstance();
    }
}