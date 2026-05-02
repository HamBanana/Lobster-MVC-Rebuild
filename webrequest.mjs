import * as https from "https";
import * as http from "http"; // BUGFIX: previously referenced but never imported.
import * as html from "node-html-parser";

export class ReturnFormat {
  static RAW = new ReturnFormat("raw");
  static JSON = new ReturnFormat("json");
  static HTML = new ReturnFormat("html");

  constructor(format) {
    this.format = format;
  }
}

function pickClient(url) {
  if (typeof url !== "string") return https.request;
  return url.startsWith("https") ? https.get : http.get;
}

export function get(url, format = ReturnFormat.HTML) {
  const call = pickClient(url);
  return new Promise((resolve, reject) => {
    call(url, (res) => {
      res.setEncoding("utf8");
      let rawData = "";
      res.on("data", (d) => {
        rawData += d;
      });
      res.on("end", () => {
        let result;
        switch (format) {
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
            reject(new Error("webrequest.get called without a valid return format"));
            return;
        }
        if (result && result.status === "failure") {
          reject(new Error('Promise for the url "' + url + '" was rejected. (Result status = failure)'));
        } else {
          resolve(result);
        }
      });
    }).on("error", reject);
  });
}

export function getJson(url) {
  return get(url, ReturnFormat.JSON);
}
