const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const botId = process.env.LOBSTER_ID;
const serverId = process.env.DARKSIDE_ID;

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

const commands = [
    {
        name: "lob",
        description: "Run message-based command as slash-command",
        options: [
            {
                name: "controller",
                description: "The category of function",
                type: ApplicationCommandOptionType.String,
                required: true,
            },
            {
                name: "function",
                description: "The function to call",
                type: ApplicationCommandOptionType.String,
            },
        ],
    },
    {
        name: "confirm_lobby",
        description: "Confirm game has entered lobby.",
        options: [
            {
                name: "code",
                description: "The code of the lobby.",
                type: ApplicationCommandOptionType.String,
                required: true,
            },
        ],
    },
    {
        name: "create",
        description: "Creates a new lobby",
        options: [
            {
                name: "code",
                description: "The code for joining the lobby",
                type: ApplicationCommandOptionType.String,
            },
            {
                name: "server",
                description: "The server lobby is hosted on",
                type: ApplicationCommandOptionType.String,
            },
        ],
    },
    {
        name: "delete",
        description: "Deletes a lobby",
        options: [
            {
                name: "code",
                description: "The code of the lobby to be deleted.",
                type: ApplicationCommandOptionType.String,
                required: true,
            },
        ],
    },
    {
        name: "queue",
        description: "Join the queue for a lobby.",
        options: [
            {
                name: "code",
                description: "The code of the lobby to join",
                type: ApplicationCommandOptionType.String,
                required: true,
            },
        ],
    },
    {
        name: "unqueue",
        description: "Leave the queue for a lobby.",
        options: [
            {
                name: "code",
                description: "The code of the lobby to unjoin from.",
                type: ApplicationCommandOptionType.String,
                required: true,
            },
        ],
    },
    {
        name: "list",
        description: "Shows a list of active lobbies",
    },
    {
        name: "announce",
        description: "Sets up a trigger that automatically posts the lobby code when you enter a lobby",
        options: [
            {
                name: "is_vc_lobby",
                description: "true, if the lobby uses voice chat",
                type: ApplicationCommandOptionType.String,
            },
            {
                name: "is_vanilla",
                description: "true, if the lobby is not modded",
                type: ApplicationCommandOptionType.String,
            },
        ],
    },
    {
        name: "unannounce",
        description: "Removes trigger to post code when you enter a lobby",
    },
];

const slashRegister = async () => {
    try {
        await rest.put(Routes.applicationGuildCommands(botId, serverId), {
            body: commands,
        });
        console.log('Successfully registered slash commands.');
    } catch (error) {
        console.error(error);
    }
};
slashRegister();
