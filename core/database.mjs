import Nano from "nano";

export class Database {

    db = null;
    constructor(){
        this.db = Nano('localhost:5984');
        console.log('Nano loaded');
    }

    _instance = null;
    getinstance(){
        if (this._instance == null){
            
        }
    }

}