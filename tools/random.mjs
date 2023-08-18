export function dice(amountofsides = 6){
  console.log('dice function hit!');
  if (String(amountofsides) === "NaN"){
    return String(amountofsides+" is not a number :eyes:");
    return;
  }
  else if (String(amountofsides) === 'Infinity'){
    return 'That\'s basically just a marble, isn\'t it?';
  }

  return String((Math.floor(Math.random() * amountofsides))+1);
}

export function coin(){
  return (Math.round(Math.random()) == 0) ? 'Heads' : 'Tails';
}
