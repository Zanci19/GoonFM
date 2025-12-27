const fs = require('fs');
const path = require('path');

const requiredEnvKeys = [
  'DISCORD_TOKEN',
  'APPLICATION_ID',
  'GUILD_ID',
  'VOICE_CHANNEL_ID',
  'STREAM_URL',
];

function checkEnvExample() {
  const envPath = path.join(__dirname, '..', '.env.example');
  if (!fs.existsSync(envPath)) {
    throw new Error('Missing .env.example. Add one based on the README instructions.');
  }

  const contents = fs.readFileSync(envPath, 'utf8');
  const missing = requiredEnvKeys.filter((key) => !new RegExp(`^${key}=`, 'm').test(contents));

  if (missing.length) {
    throw new Error(`.env.example is missing required keys: ${missing.join(', ')}`);
  }
}

function checkScripts() {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );

  const neededScripts = ['start', 'deploy:commands', 'test'];
  const missing = neededScripts.filter((script) => !packageJson.scripts?.[script]);

  if (missing.length) {
    throw new Error(`package.json is missing scripts: ${missing.join(', ')}`);
  }
}

try {
  checkEnvExample();
  checkScripts();
  console.log('Self-test passed: configuration scaffolding looks good.');
} catch (error) {
  console.error('Self-test failed:', error.message);
  process.exitCode = 1;
}
