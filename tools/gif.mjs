export function random(category){
  let arr;
  switch(category){
    case 'done':
      arr = [
        'https://media.tenor.com/93OUVuCIk6MAAAAM/done-and-done-spongebob.gif'
        ,'https://media.tenor.com/uTjqYsH_j-YAAAAM/done-so-done.gif'
        ,'https://media.tenor.com/h3hKmL66_JUAAAAM/thumbs-up-okay.gif'
        ,'https://media.tenor.com/3PCreHGZ3rcAAAAM/done-well.gif'
        ,'https://media.tenor.com/MNEAbaOSzv0AAAAM/dhei-houl.gif'
        ,'https://media.tenor.com/itu1dtCNwbcAAAAM/and-done-did-it.gif'
        ,'https://media.tenor.com/F1GY9aHS6JYAAAAM/dab-done.gif'
        ,'https://media.tenor.com/IAUvvrUY7zQAAAAM/done-spongebob.gif'
        ,'https://media.tenor.com/SLQdbJYUoFMAAAAM/done-jaredfps.gif'
        ,'https://media.tenor.com/MqgG1Iu32eQAAAAM/fall-shake.gif'
        ,'https://media.tenor.com/4wMKQjUDRi8AAAAM/captain-america-done-avengers-marvel.gif'
        ,'https://media.tenor.com/e5kg-AhF-ZkAAAAM/done-anupama.gif'
        ,'https://media.tenor.com/GoOHTKk2NrcAAAAM/done-im-done.gif'
        ,'https://media.tenor.com/j5cyWvbcM4MAAAAM/done-its-done.gif'
        ,'https://media.tenor.com/wUvRhitB-M8AAAAM/unamused-cat.gif'
        ,'https://media.tenor.com/WLcUt16j5GAAAAAM/i-probably-shouldnt-have-done-that-daniel-smith.gif'
        ,'https://media.tenor.com/8JRZIXi2z9YAAAAM/i-dont-know-if-i-can-keep-doing-this-randy-marsh.gif'
      ];
      break;
    case 'denied':
      arr = [
        'https://media.tenor.com/cKCmsmrzP6IAAAAM/im-not-gonna-allow-it-omar-adom-zidan.gif'
        ,'https://media.tenor.com/GfKoy332vr8AAAAM/homer-simpson-i-cant.gif'
        ,'https://media.tenor.com/ucVFrxQ86h4AAAAM/i-wont-let-you-see-that-i-am-brandon.gif'
        ,'https://media.tenor.com/uQGG7K5ksg8AAAAM/i-can-do-it-hoops.gif'
        ,'https://media.tenor.com/59Wzc9CCdk8AAAAM/ill-see-what-i-can-do-about-that-bojack.gif'
        ,'https://media.tenor.com/wICl4A4G6iEAAAAM/why-isnt-this-possible-to-do-clint.gif'
        ,'https://media.tenor.com/UmP8rggYEG8AAAAM/i-dont-know-how-much-longer-we-can-keep-this-up-dude.gif'
        ,'https://media.tenor.com/ShNAMjjZ9-YAAAAM/solar-opposites-terry.gif'
        ,'https://media.tenor.com/afI1_uOmoNoAAAAM/i-may-not-be-able-to-do-that-james-pumphrey.gif'
        ,'https://media.tenor.com/fvqEfiBtv3oAAAAM/this-isnt-how-its-supposed-to-happen-randy-marsh.gif'
        ,'https://media.tenor.com/4SONfaMbgJQAAAAM/chris-pratt-andy.gif'
        ,'https://media.tenor.com/ZAPzYZxKu9EAAAAM/bart-simpson-i-cant-promise.gif'
        ,'https://media.tenor.com/xNsT0uBQGBAAAAAM/i-will-do-no-such-thing-tracy-jordan.gif'
        ,'https://media.tenor.com/tF7w7BMTt7UAAAAM/anime.gif'
        ,'https://media.tenor.com/fcXatGK6bqgAAAAM/sure-air-quotes.gif'
        ,'https://media.tenor.com/SnCjEsan0Q0AAAAM/because-i-dont-want-to-cartman.gif'
        ,'https://media.tenor.com/JMvGaAkBJhsAAAAM/i-dont-feel-like-doing-it-lauren-francesca.gif'
        ,'https://media.tenor.com/Zig0j7ijIeIAAAAM/youd-better-not-say-what-i-think-youre-gonna-say-tuong-lu-kim.gif'
        ,'https://media.tenor.com/9c7Amvf2SjsAAAAM/dont-you-dare-angry.gif'
      ]
      break;
  }
  return arr[Math.floor(Math.random() * arr.length)];
}