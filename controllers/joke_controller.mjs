import {Controller} from '../core/controller.mjs';
import fetch from 'node-fetch';
import { NetworkError, warn } from '../core/error.mjs';

export class joke_controller extends Controller{
  perm = {'channels': ['949274005511229520', '883526058236854312',
                       '1200927450536890429',
                       '1004881551777075210'
                      ]};

  api_urls = ['https://official-joke-api.appspot.com/jokes/random',
              //'https://v2.jokeapi.dev/joke/Any',
              //'https://geek-jokes.sameerkumar.website/api',
              'https://official-joke-api.appspot.com/random_joke'];

  constructor(msg){
    super(msg);
    this.controllername = 'joke';
    //this.auth(this.perm);
  }

  index(){
    let select;
    if (!select) {
      select = Math.floor(Math.random() * this.api_urls.length);
    }
    if (Math.random() < 0.01){
      return Promise.resolve(this.message.reply("THIS FAMILY")).catch((err) =>
        warn(err, { context: { controller: 'joke', stage: 'family reply' } })
      );
    }
    const url = this.api_urls[select];
    return fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new NetworkError(
            'Joke API returned HTTP ' + response.status + ' from ' + url,
            { code: 'HTTP_' + response.status }
          );
        }
        return response.json();
      })
      .then(data => {
        let joke;
        switch (select){
          case 0:
          case 1: joke = data.setup + ' \n ' + data.punchline; break;
          default: joke = ":eyes:";
        }
        if (!joke || joke.includes('undefined')) {
          // Some joke APIs occasionally return malformed payloads — surface
          // that rather than posting "undefined \n undefined" to chat.
          throw new NetworkError(
            'Joke API returned an unexpected payload shape: ' + JSON.stringify(data),
            { code: 'BAD_RESPONSE' }
          );
        }
        return Promise.resolve(this.message.reply(joke)).catch((err) =>
          warn(err, { context: { controller: 'joke', stage: 'reply' } })
        );
      })
      .catch(error => {
        // Network blips and bad payloads both reach here; log them with the
        // URL we were trying so we can spot if one provider is consistently
        // broken.
        warn(error, { context: { controller: 'joke', url } });
        return Promise.resolve(
          this.message.reply("I tried to fetch a joke and the joke fetched me. Try again?")
        ).catch((replyErr) =>
          warn(replyErr, { context: { controller: 'joke', stage: 'fallback reply' } })
        );
      });
  }
}
