import * as rand from '../tools/random.mjs';
import {Controller} from '../core/controller.mjs';

export class random_controller extends Controller{

  perm = {'channels': ['949274005511229520']};

  static dice_always = 0;

  constructor(msg){
    super(msg);
   // this.auth(this.perm);
  }
  index(){return this.message.reply(':eyes:');}

dice(args){
  let amountofsides = (args['sides']) ? args['sides'] : args['default'][0];
  if (!amountofsides){amountofsides = 6;}

  let result;
  if (String(amountofsides) === "NaN"){
     result =  String(amountofsides+" is not a number :eyes:");
  }
  else if (String(amountofsides) === 'Infinity'){
    result = "That's a marble :eyes:";
  }

  if (random_controller.dice_always !== 0 &&
      typeof(random_controller.dice_always) === 'number'
     ){result = random_controller.dice_always;}

  else {result = (Math.floor(Math.random() * amountofsides))+1;}

  result = String(result);
  this.view.content = result;
  return this.post();
}

  cheat(args){
    let always = (args.always) || args.default[0];

    always = parseInt(always);
    if (typeof(always) !== 'number' || isNaN(always)){
      this.view.content = "What, you can't even cheat right?";
      this.post();
      return;
    }

    random_controller.dice_always = parseInt(always);
  }

coin(){
  return this.message.reply((Math.round(Math.random()) == 0) ? 'Heads' : 'Tails');
}

random(){
  this.post(':eyes:');
}
}
