import { Discord } from './discord.mjs';

export const channels = {
    'lob-test': '1200927450536890429',
    'spam': '949274005511229520',
    'vanilla-codes': '967232458854629408',
    'counting': '1135218372091588770',
    'vanilla-game-chat': '883526058236854312',
    'serious-topics': '992089336109617283',
    'brainstuff': '1094311608815190038',
    'venting': '1007147411552096376',
    get: (id) => { return Discord.client.channels.cache.get(id); }
}

export const roles = {
    'archetype': '969663541911101440',
    'avant-garde': '904440695195070534'
}

export const members = {
    'Ham': '330279218543984641',
    get: (id) => {
        let user = Discord.client.users.cache.get(id);
        console.log('Getting member with id "' + id + '": ' + JSON.stringify(user));
        return user;
    }
}

export const messages = {
    get: (channelId, messageId) => {
        return new Promise((resolve, reject) => {
        let channel = Discord.client.channels.cache.get(channelId);
        channel.messages.fetch(messageId).then((message) => {resolve(message);}).catch((err) => {reject(err);});
        });
    }
}