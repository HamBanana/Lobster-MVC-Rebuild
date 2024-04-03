const { REST, Routes } = require('discord.js');

const botId = process.env.LOBSTER_ID;
const serverId = process.env.DARKSIDE_ID;

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

const slashRegister = async () => {
    try {
        await rest.put(Routes.applicationGuildCommands(botId, serverId),{
            body:[
                {
                    name: "lob",
                    description: "Run message-based command as slash-command"
                }
            ]
        });

    } catch (error) {
        console.error(error);
    }
}
slashRegister();