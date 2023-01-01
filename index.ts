import express, { Request, Response } from "express";
import {
    InteractionResponseType,
    InteractionType,
    verifyKey,
} from "discord-interactions";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3001;
const PUBLIC_KEY = process.env.PUBLIC_KEY as string;
const TOKEN = process.env.TOKEN as string;

app.use(express.json({ verify: VerifyDiscordRequest(PUBLIC_KEY) }));

app.post("/interactions", async (req, res) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type, id, data } = req.body;

    if (type === InteractionType.PING) {
        return res.send({ type: InteractionResponseType.PONG });
    }

    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name } = data;

        if (name === "foo") {
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "bar",
                },
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`"invisible omfori" listening on port ${PORT}..`);

    HasGuildCommands("1055286748726448149", "1040584998803214378", [
        {
            name: "foo",
            description: "foo",
            type: 1,
        },
    ]);
});

function VerifyDiscordRequest(clientKey: string) {
    return function (
        req: Request,
        res: Response,
        buf: string | Buffer | Uint8Array | ArrayBuffer
    ) {
        const signature = req.get("X-Signature-Ed25519");
        const timestamp = req.get("X-Signature-Timestamp");

        const isValidRequest = verifyKey(
            buf,
            signature as string,
            timestamp as string,
            clientKey
        );
        if (!isValidRequest) {
            res.status(401).send("Bad request signature");
            throw new Error("Bad request signature");
        }
    };
}

interface CommandType {
    name: string;
    description: string;
    type: number;
}

async function HasGuildCommands(
    appId: string,
    guildId: string,
    commands: CommandType[]
) {
    if (guildId === "" || appId === "") return;

    commands.forEach((c) => HasGuildCommand(appId, guildId, c));
}

async function HasGuildCommand(
    appId: string,
    guildId: string,
    command: CommandType
) {
    const endpoint = `applications/${appId}/guilds/${guildId}/commands`;

    try {
        const res = await DiscordRequest(endpoint, { method: "GET" });
        const data = (await res.json()) as string[];

        if (data) {
            const installedNames = data.map((c) => c);
            // This is just matching on the name, so it's not good for updates
            if (!installedNames.includes(command["name"])) {
                console.log(`Installing "${command["name"]}"`);
                InstallGuildCommand(appId, guildId, command);
            } else {
                console.log(`"${command["name"]}" command already installed`);
            }
        }
    } catch (err) {
        console.error(err);
    }
}

export async function InstallGuildCommand(
    appId: string,
    guildId: string,
    command: CommandType
) {
    const endpoint = `applications/${appId}/guilds/${guildId}/commands`;

    try {
        await DiscordRequest(endpoint, { method: "POST", body: command });
    } catch (err) {
        console.error(err);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function DiscordRequest(endpoint: string, options: any) {
    const url = `https://discord.com/api/v10/${endpoint}`;

    if (options.body) options.body = JSON.stringify(options.body);

    const res = await fetch(url, {
        headers: {
            Authorization: `Bot ${TOKEN}`,
            "Content-Type": "application/json; charset=UTF-8",
            "User-Agent": "Omfori (https://github.com/omfori, 1.0.0)",
        },
        ...options,
    });

    if (!res.ok) {
        const data = await res.json();
        console.log(res.status);
        throw new Error(JSON.stringify(data));
    }

    return res;
}
