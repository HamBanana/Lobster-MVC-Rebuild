import { Controller } from '../core/controller.mjs';

export class end_controller extends Controller {

  constructor(msg) {
    super(msg);
    this.controllername = 'end';
  }

  index(args){
    return this.confirm_lobby(args);
  }

  test_input(input) {
    if (typeof input !== 'string') return;
    const matches = input.match(/start/gi);
    if (!matches) return;
    return this.post(input.replace(/start/gi, 'end'));
  }
}
