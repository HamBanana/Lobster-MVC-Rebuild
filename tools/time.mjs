export class Time extends Date{
 static get now(){
  return Math.floor(new Date().getTime() / 1000.0)
  //return Math.floor(new Date().getTime())
}

static getTag(timestamp, format="R"){
  return "<t:"+timestamp+":"+format+">";
}

static getDifferenceInDays(date1, date2) {
  const diffInMs = Math.abs(date2 - date1);
  return diffInMs / (1000 * 60 * 60 * 24);
}

static getDifferenceInHours(date1, date2) {
  const diffInMs = Math.abs(date2 - date1);
  return diffInMs / (1000 * 60 * 60);
}

static getDifferenceInMinutes(date1, date2) {
  const diffInMs = Math.abs(date2 - date1);
  return diffInMs / (1000 * 60);
}

static getDifferenceInSeconds(date1, date2) {
  const diffInMs = Math.abs(date2 - date1);
  return diffInMs / 1000;
}


}
