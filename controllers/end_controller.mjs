import {
  Controller
} from '../core/controller.mjs';
import {Time} from '../tools/time.mjs';

export class end_controller extends Controller {

  //perm = {
    //'channels': ['949274005511229520']
  //}

  constructor(msg) {
    super(msg);

    //this.auth(this.perm).catch(() => {return;});
  }

  index(args){
    console.log('lobby/index hit');
    return this.confirm_lobby(args);
  }

  test_input(input) {
    //if (this.message.channelId != '949274005511229520') 
    {return;}
    console.log(input);
    //console.log(input.default);
    //console.log(input['default']);
   // input = input.toUpperCase();
    let matches = input.match(/start/gi);
    if (!matches){return;}
   // let code = /([^\w]|^)(\w{5}[FQ])([^\w]|$)/.exec(input)?.[2];
   // let code = /start/.exec(input);
    //return this.post(input.replaceAll('start', 'end'));
    return this.post(input.replace(/start/gi, 'end'));

  }
}
