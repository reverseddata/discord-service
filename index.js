const {
  Client, GatewayIntentBits, Partials, Collection,
} = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { getDb } = require('./utils/db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

// ── Load Commands ──────────────────────────────────────────────────────────
const commandsData = [];

// Regular commands
const cmdFiles = ['apply-setup.js', 'submit.js', 'payout-history.js', 'embed.js'];
for (const file of cmdFiles) {
  const cmd = require(path.join(__dirname, 'commands', file));
  client.commands.set(cmd.data.name, cmd);
  commandsData.push(cmd.data.toJSON());
}

// Staff commands (multi-export)
const { setfollowers, creatorlist, markpaid, removecreator, changetier } = require('./commands/staff');
for (const cmd of [setfollowers, creatorlist, markpaid, removecreator, changetier]) {
  client.commands.set(cmd.data.name, cmd);
  commandsData.push(cmd.data.toJSON());
}

// ── Load Events ────────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  const handler = (...args) => event.execute(...args, client);
  event.once ? client.once(event.name, handler) : client.on(event.name, handler);
}

// ── Ready ──────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Init DB
  await getDb();
  console.log('✅ Database initialized');

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: commandsData }
    );
    console.log(`✅ Registered ${commandsData.length} slash commands`);
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

client.login(process.env.BOT_TOKEN);
