const {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} = require('discord.js');
const { loadConfig } = require('./config');
const createLogger = require('./logger');
const RadioStreamer = require('./streamer');
const { commands } = require('./commands');

const config = loadConfig();
const logger = createLogger(config.logLevel);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const streamer = new RadioStreamer(client, config, logger);

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);

  await rest.put(Routes.applicationGuildCommands(config.applicationId, config.guildId), {
    body: commands,
  });
  logger.info('Slash commands registered for guild.');
}

async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const name = interaction.commandName;
  logger.info({ command: name, user: interaction.user.tag }, 'Command received.');

  try {
    switch (name) {
      case 'status': {
        const status = streamer.getStatus();
        const message = [
          `Voice: **${status.connectionState}**`,
          `Player: **${status.playerState}**`,
          `Stream: ${status.stream}`,
          status.usingBackup ? 'Using backup feed.' : 'Using primary feed.',
        ].join('\n');
        await interaction.reply({ content: message, ephemeral: true });
        break;
      }
      case 'refresh': {
        await streamer.switchStream(streamer.currentStreamUrl);
        await interaction.reply({ content: 'Stream refreshed and restarted.', ephemeral: true });
        break;
      }
      case 'switch': {
        const url = interaction.options.getString('url', true);
        if (!/^https?:\/\//i.test(url)) {
          await interaction.reply({
            content: 'Please provide a valid http(s) stream URL.',
            ephemeral: true,
          });
          return;
        }
        await streamer.switchStream(url);
        await interaction.reply({
          content: `Switched stream to:\n${url}`,
          ephemeral: true,
        });
        break;
      }
      case 'join': {
        await streamer.start();
        await interaction.reply({
          content: 'Rejoined the configured voice channel and resumed streaming.',
          ephemeral: true,
        });
        break;
      }
      case 'leave': {
        await streamer.disconnect();
        await interaction.reply({ content: 'Disconnected from voice.', ephemeral: true });
        break;
      }
      case 'ping': {
        await interaction.reply({ content: 'Pong — bot is online.', ephemeral: true });
        break;
      }
      default:
        await interaction.reply({ content: 'Command not recognized.', ephemeral: true });
    }
  } catch (error) {
    logger.error({ error, command: name }, 'Command handling error.');
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: 'Something went wrong while handling that command.',
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: 'Something went wrong while handling that command.',
        ephemeral: true,
      });
    }
  }
}

async function bootstrap() {
  client.once(Events.ClientReady, async (readyClient) => {
    logger.info({ user: readyClient.user.tag }, 'Discord client ready.');

    try {
      await registerCommands();
    } catch (error) {
      logger.error({ error }, 'Failed to register commands; continuing startup.');
    }

    try {
      await streamer.start();
    } catch (error) {
      logger.error({ error }, 'Failed to start the voice streamer.');
    }

    client.user.setPresence({
      status: 'online',
      activities: [{ name: config.statusText, type: ActivityType.Listening }],
    });
  });

  client.on(Events.InteractionCreate, handleInteraction);
  client.on(Events.Error, (error) => logger.error({ error }, 'Client error.'));
  client.on('shardError', (error) =>
    logger.error({ error }, 'WebSocket connection encountered an error.')
  );

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection.');
  });

  await client.login(config.token);
}

bootstrap().catch((error) => {
  logger.error({ error }, 'Failed to start the bot.');
  process.exit(1);
});
