import Nano from "nano";

export class Database {

    static _instance = null

    db = null;
    constructor(){
        this.db = Nano('localhost:5984');
        console.log('Nano loaded');
    }
    
    getInstance(){
        if (Database._instance == null){
            Database._instance = new Database();
        } else { return Database._instance;}
    }

}