import {Controller} from '../core/controller.mjs';
import fetch from 'node-fetch';

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
    this.auth(this.perm);
  }
  
  index(args){
  let select = parseInt( (args['select']) ? args['select'] : args['default'][0] );
    if (!select) {
      select = Math.floor(Math.random() * this.api_urls.length);
    }
    console.log('select: ' + select);
    console.log(this.api_urls[select]);
    if (Math.random() < 0.01){
      this.message.reply("THIS FAMILY");
      return;
    }
    fetch(this.api_urls[select])
  .then(response => response.json())
  .then(data => {
    let joke;
    console.log('select in then(): '+select);
    switch (select){
      case 0: 
      case 1:joke = data.setup + ' \n ' + data.punchline; break;
     // case 2: joke = data.joke || (data.setup + ' \n ' + data.delivery); break;
      //case 2: joke = data; break;
      //case 2: joke = data.value; break;
      default: joke = ":eyes:"
    }
    
    //this.view.content = joke; 
    console.log(joke);
    this.message.reply(joke);
  })
  .catch(error => {
    console.error('Error:', error);
    this.message.reply("This function is a joke :eyes:");
  });
  }

  //return this.message.reply(joke);
  
}
