const { REST, Routes } = require('discord.js');
const { loadConfig } = require('../src/config');
const { commands } = require('../src/commands');
const createLogger = require('../src/logger');

async function register() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    await rest.put(Routes.applicationGuildCommands(config.applicationId, config.guildId), {
      body: commands,
    });
    logger.info('Slash commands registered successfully.');
  } catch (error) {
    logger.error({ error }, 'Failed to register slash commands.');
    process.exitCode = 1;
  }
}

register();
