import { Database } from '../core/database.mjs';

export class Model{

    constructor(){
        this.db = Database.getInstance();
    }
}