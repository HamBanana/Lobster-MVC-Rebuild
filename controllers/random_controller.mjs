import {Controller} from '../core/controller.mjs';

export class random_controller extends Controller{

  static dice_always = 0;

  constructor(msg){
    super(msg);
    this.controllername = 'random';
  }

  index(){
    return Promise.resolve(this.message.reply(':eyes:')).catch((err) =>
      this.reportError(err, { stage: 'random/index' })
    );
  }

  dice(args){
    let amountofsides = (args && args['sides']) ? args['sides'] : (args && args['default'] && args['default'][0]);
    if (!amountofsides) amountofsides = 6;

    let result;
    const sidesNum = Number(amountofsides);
    if (Number.isNaN(sidesNum)) {
      result = String(amountofsides) + ' is not a number :eyes:';
    } else if (!Number.isFinite(sidesNum)) {
      result = "That's a marble :eyes:";
    } else if (sidesNum < 1) {
      result = "A die needs at least 1 side :eyes:";
    } else if (
      random_controller.dice_always !== 0 &&
      typeof random_controller.dice_always === 'number'
    ) {
      result = random_controller.dice_always;
    } else {
      result = Math.floor(Math.random() * sidesNum) + 1;
    }

    this.view.content = String(result);
    return this.post();
  }

  cheat(args){
    let always = (args && args.always) || (args && args.default && args.default[0]);

    const parsed = parseInt(always, 10);
    if (Number.isNaN(parsed)) {
      this.view.content = JSON.stringify(always) + ' is not a number.';
      return this.post();
    }

    random_controller.dice_always = parsed;
    return this.post('Dice rolls will now always return ' + parsed + '.');
  }

  coin(){
    return Promise.resolve(
      this.message.reply((Math.round(Math.random()) === 0) ? 'Heads' : 'Tails')
    ).catch((err) => this.reportError(err, { stage: 'random/coin' }));
  }

  random(){
    return this.post(':eyes:');
  }
}
