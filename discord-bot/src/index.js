const {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
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
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a']);

async function listSoundEffects() {
  try {
    const files = await fs.promises.readdir(config.sfxDir);
    return files
      .filter((file) => AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort();
  } catch (error) {
    logger.error({ error }, 'Failed to read SFX directory.');
    return [];
  }
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);

  await rest.put(Routes.applicationGuildCommands(config.applicationId, config.guildId), {
    body: commands,
  });
  logger.info('Slash commands registered for guild.');
}

async function handleInteraction(interaction) {
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === 'sfxplay') {
      const focused = interaction.options.getFocused() || '';
      const sounds = await listSoundEffects();
      const filtered = sounds
        .filter((name) => name.toLowerCase().includes(focused.toLowerCase()))
        .slice(0, 25)
        .map((name) => ({ name, value: name }));
      await interaction.respond(filtered);
    }
    return;
  }

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
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
          await interaction.reply({
            content: 'You need to be in a voice channel to use /join.',
            ephemeral: true,
          });
          return;
        }

        await streamer.start(voiceChannel);
        await interaction.reply({
          content: `Joined **${voiceChannel.name}** and resumed streaming.`,
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
      case 'sfxplay': {
        const sound = interaction.options.getString('sound', true);
        const filePath = path.join(config.sfxDir, sound);
        try {
          await fs.promises.access(filePath, fs.constants.R_OK);
        } catch {
          await interaction.reply({
            content: `Sound **${sound}** was not found or is not readable in ${config.sfxDir}.`,
            ephemeral: true,
          });
          return;
        }
        await streamer.playSoundEffect(sound, filePath);
        await interaction.reply({
          content: `Playing sound effect: **${sound}**`,
          ephemeral: true,
        });
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
