import {EmbedBuilder} from 'discord.js';

export const create =
  '\`\`\`'
    +'Code: {{code}}\nServer: '
    +'{{server}}'
    +'\nHosted by: {{host}}'
    +'\nVanilla:  {{is_vanilla}}'
    +'\nVoice chat: {{is_vc_lobby}}'
    +'\nNotes: {{notes}}'
    +'\`\`\`'
    +'\nLast ping: <t:{{pingtime}}:R>';

  export const autocreate =
  '\`\`\`'
    +'\nCode: {{code}}'
    +'\nHosted by: {{host}}'
    +'\nVanilla:  {{is_vanilla}}'
    +'\nVoice chat: {{is_vc_lobby}}'
    +'\nNotes: {{notes}}'
    +'\`\`\`'
    +'<@&{{pingrole}}>'
    +'\nGame entered lobby: <t:{{pingtime}}:R>';
  
export const prompt_server =
  'Code: {{code}}\n'
  +'Hosted by: {{host}}\n'
  +'Choose server to create the lobby, or :x: to cancel lobby creation.';

/*export const prompt_start =
  'Code: {{code}}n'
  +'Server: {{server}}'
  +'Hosted by: {{host}}\n'
  +'Do you want to create this lobby, {{host}}?';*/

  export const prompt_lobby =
  "Is this game in lobby now?\n"
  +"Code: {{code}}, Server: {{server}}";

  export const prompt_create =
  "Create this lobby?\n"
  +"Code: {{code}}, Server: {{server}}";

  export const confirm_lobby =
  '\`\`\`'
    +'Code: {{code}}\nServer: '
    +'{{server}}'
    +'\nHosted by: {{host}}'
    +'\nVanilla:  {{is_vanilla}}'
    +'\nVoice chat: {{is_vc_lobby}}'
    +'\nNotes: {{notes}}'
    +'\`\`\`'
    +'\nLast ping: <t:{{pingtime}}:R>'
    +'\n{{mentions}}';

    export const game_started =
    "Lobby {{code}} has started the game\n"
    +"React with :point_up: or write \"!lob join {{code}}\" to get pinged for next game.";

  export const embed_example =
  new EmbedBuilder()
  .setColor(0x5f4499)
  .setTitle('{{title}}')
  .setURL('https://discord.js.org')
  .setAuthor({
		name: 'Some name',
		icon_url: 'https://i.imgur.com/AfFp7pu.png',
		url: 'https://discord.js.org',
	})
  .setDescription('Some description here')
  .setThumbnail('https://i.imgur.com/AfFp7pu.png')
  .setFields([
		{
			name: 'Regular field title',
			value: 'Some value here',
		},
		{
			name: '\u200b',
			value: '\u200b',
			inline: false,
		},
		{
			name: 'Inline field title',
			value: 'Some value here',
			inline: true,
		},
		{
			name: 'Inline field title',
			value: 'Some value here',
			inline: true,
		},
		{
			name: 'Inline field title',
			value: 'Some value here',
			inline: true,
		},
	])
  .setImage('https://i.imgur.com/AfFp7pu.png')
  .setTimestamp(new Date().getTime())
  .setFooter({
		text: 'Some footer text here',
		icon_url: 'https://i.imgur.com/AfFp7pu.png',
	});

export const embed_example_json = 
    {
      "title":"{{title}}",
      "type":"rich",
      "description":"{{description}}",
      "url":"https://discord.js.org",
      "timestamp":"{{Time.now}}",
      "color":6243481,
      "fields":[
          {
            "name":"Regular field title",
            "value":"Some value here",
            "inline":false
          },
          {
            "name":"Another regular field​",
            "value":"with another regular value​",
            "inline":false
          },
          {
            "name":"Inline field title",
            "value":"Some value here",
            "inline":true
          },
          {
            "name":"Inline field title",
            "value":"Some value here",
            "inline":true
          },
          {
            "name":"Inline field title",
            "value":"Some value here",
            "inline":true
          }
        ],
        "thumbnail":{"url":"https://i.imgur.com/AfFp7pu.png"},
          "image":{"url":"https://i.imgur.com/AfFp7pu.png"},
          "author":{"name":"Some name","url":"https://discord.js.org"},
          "footer":{"text":"Some footer text here"},
                                             };
