import * as https from 'https';
import * as html from 'node-html-parser';

export function get(url, format=ReturnFormat.HTML){
  let call;
  
  if (typeof(url) !== 'string'){
    call = https.request;
  }
  else if (url.startsWith('https')){
   call = https.get;
 } else {
   call = http.get;
 }
  return new Promise((resolve, reject) => {
    call(url, (res) => {
      res.setEncoding('utf8');
      let rawData = "";

      res.on("data", (d) => {
        rawData += d;
      });

      res.on("end", () => {
        let result;
        switch(format){
          case ReturnFormat.RAW:
          result = rawData;
          break;
          case ReturnFormat.JSON:
          result = JSON.parse(rawData);
          break;
          case ReturnFormat.HTML:
          result = html.parse(rawData);
          break;
          default:
          console.log('webrequest.get was somehow called without a valid return format');
          exit(1);
          break;
        }
        if (result["status"] === "failure"){reject('Promise for the url "'+url+'" was rejected. (Result status = failure)');}
        else {
          resolve(result);
        }
      });
    });
  });
}

export function getJson(url){
  let call;

  if (typeof(url) !== 'string'){
    call = https.request;
  }
  else if (url.startsWith('https')){
   call = https.get;
 } else {
   call = http.get;
 }

 return new Promise((resolve, reject) => {
   call(url, (res) => {
     res.setEncoding('utf8');
     let rawData = "";

     res.on("data", (d) => {
       rawData += d;
     });

     res.on("end", () => {
       let result = JSON.parse(rawData);
       if (result["status"] === "failure"){reject('Promise for the url "'+url+'" was rejected. (Result status = failure)');}
       else {
         resolve(result);
       }
     });
   });
 });

}

export class ReturnFormat{
  static RAW = new ReturnFormat('raw');
  static JSON = new ReturnFormat('json');
  static HTML = new ReturnFormat('html');

  constructor(format){
    //this.#format = format;
    this.format = format;
    //Object.defineProperty(this, 'format', {value: format});
  }
}
