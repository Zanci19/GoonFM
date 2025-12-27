const path = require('path');
const dotenv = require('dotenv');

const REQUIRED_KEYS = [
  'DISCORD_TOKEN',
  'APPLICATION_ID',
  'GUILD_ID',
  'VOICE_CHANNEL_ID',
  'STREAM_URL',
];

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  dotenv.config({ path: envPath });
}

function loadConfig() {
  loadEnv();

  const config = {
    token: process.env.DISCORD_TOKEN,
    applicationId: process.env.APPLICATION_ID,
    publicKey: process.env.PUBLIC_KEY,
    guildId: process.env.GUILD_ID,
    voiceChannelId: process.env.VOICE_CHANNEL_ID,
    streamUrl: process.env.STREAM_URL,
    backupStreamUrl: process.env.BACKUP_STREAM_URL,
    statusText: process.env.STATUS_TEXT || 'GoonFM · Live 24/7',
    logLevel: process.env.LOG_LEVEL || 'info',
    reconnectDelayMs: Number(process.env.RECONNECT_DELAY_MS || 5000),
    maxRetries: Number(process.env.MAX_RETRIES || 5),
    startVolume: Number(process.env.START_VOLUME || 35) / 100,
    sfxDir: process.env.SFX_DIR || path.join(__dirname, '..', 'sfx'),
  };

  const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Check discord-bot/.env.`
    );
  }

  return config;
}

module.exports = {
  loadConfig,
};
