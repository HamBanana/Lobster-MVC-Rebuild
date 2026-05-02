export function dice(amountofsides = 6) {
  const sidesNum = Number(amountofsides);
  if (Number.isNaN(sidesNum)) {
    return amountofsides + ' is not a number :eyes:';
  }
  if (!Number.isFinite(sidesNum)) {
    return "That's basically just a marble, isn't it?";
  }
  if (sidesNum < 1) {
    return "A die needs at least one side :eyes:";
  }
  return String(Math.floor(Math.random() * sidesNum) + 1);
}

export function coin() {
  return (Math.round(Math.random()) === 0) ? 'Heads' : 'Tails';
}
