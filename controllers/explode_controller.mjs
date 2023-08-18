import {Controller} from '../core/controller.mjs';

export class explode_controller extends Controller{

  //perm = {'channels': ['949274005511229520']};

explosions = ['https://media3.giphy.com/media/xUA7aQ21bruxszHmRW/giphy.gif?cid=790b7611b10e319b9ab4f20fd92314894260115ccb10c443&rid=giphy.gif&ct=g'
             ,'https://media2.giphy.com/media/fVzdQ7TK7hO5ViB2Pp/giphy.gif?cid=790b76110fc516b8b63d743fbacd53e3fdc766ae8eeb7993&rid=giphy.gif&ct=g'
             ,'https://api.time.com/wp-content/uploads/2016/03/kepler-exploding-star-nasa.gif?w=1024&h=512&crop=1'
             ,'https://media2.giphy.com/media/XhbiNR25N4VW5P2bk8/giphy.gif?cid=790b7611e550971630c716c7a07b3e2669e4014a109e30dd&rid=giphy.gif&ct=g'
             , 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/d29a990a-6738-47cd-8594-eca5af699e8d/dc642s2-1dd44029-2bc4-43cb-b1cc-16218883cad7.gif?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiJcL2ZcL2QyOWE5OTBhLTY3MzgtNDdjZC04NTk0LWVjYTVhZjY5OWU4ZFwvZGM2NDJzMi0xZGQ0NDAyOS0yYmM0LTQzY2ItYjFjYy0xNjIxODg4M2NhZDcuZ2lmIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.mdprlTU8bWMW4KBVIxgJwj52h6y9wVidFrakej0RUS0'
             , 'https://media4.giphy.com/media/G3Wfea8vbpQK4/200.gif'
             , 'https://telltaletv.com/wp-content/uploads/2017/10/81786-Walter-White-explosion-gif-Bre-hUuE.gif'
             , 'https://art.pixilart.com/418d9096f8fed81.gif'
             , 'https://media.tenor.com/MllCb1f90-0AAAAC/boom-anime.gif'
             , 'https://media4.giphy.com/media/qiPJ5kow5KOT6/giphy.gif'
             , 'https://media.tenor.com/mwNXS1PHRzYAAAAC/frieza-explosion.gif'
             , 'https://media.tenor.com/3pYpsJ2CRYkAAAAM/running-explosion.gif'
             , 'https://media.tenor.com/RegpKvUKWgMAAAAM/boom-explosion.gif'
             , 'https://media.tenor.com/y5LKJ8uFpsoAAAAM/explosion.gif'
             , 'https://media.tenor.com/UdWQYTuF64kAAAAM/explosion-fireball.gif'
             , 'https://media.tenor.com/2UzEUTY_XSgAAAAM/boom-bird.gif'
             , 'https://media.tenor.com/7FMxMpaSTc4AAAAM/minsi-gominsi.gif'
             , 'https://media.tenor.com/TE2rZ1RlrKMAAAAM/sodacat-sodacat13.gif'
             , 'https://media.tenor.com/nlFQyoe8rqMAAAAM/explosion-anime.gif'
             , 'https://media.tenor.com/Mp2x_sFweAcAAAAM/bill-wurtz-wurtz.gif'
             , 'https://media.tenor.com/v4YXCGD9Q9IAAAAM/watermelon-explode.gif'
             , 'https://media.tenor.com/HI_mOEG6gM0AAAAM/tom-and-jerry-explosion.gif'
             , 'https://media.tenor.com/nZhJbNDMkUMAAAAM/rick-explosion.gif'
             , 'https://media.tenor.com/nk3l0dGCT9MAAAAM/hello-funny.gif'
             , 'https://media.tenor.com/dOA9z9vzX3MAAAAM/explosion-homer-dimpson.gif'
             , 'https://media.tenor.com/cBCcyFDp_BcAAAAM/bh187-family-guy.gif'
             , 'https://media.tenor.com/4DzwICwRJb8AAAAM/fine-leslie-nielsen.gif'
             , 'https://media.tenor.com/nlq-ALxfnBwAAAAM/chicken-bro-chicken.gif'
             , 'https://media.tenor.com/V6k3KbrycpsAAAAC/anime-explosion.gif'
             , 'https://media.tenor.com/gMACtWvF0v0AAAAC/pissed-angry.gif'
             , 'https://media.tenor.com/F2MBHC2PajgAAAAd/sanalogy-spongebob.gif'
             , 'https://media.tenor.com/wEgCPxoQdLYAAAAS/explosion-megumin.gif'
             , 'https://media.discordapp.net/attachments/963894199458078741/1140324506813079693/7vmxer.gif'];


  constructor(msg){
    super(msg);
    //this.auth(this.perm);
    console.log('Explode constructor');
  }

  index(){
    this.view.content = {files: [this.explosions[Math.floor(Math.random() * this.explosions.length)]]};
    console.log(this.view.content.files[0])
    this.post();
  }
}
