const { SlashCommandBuilder } = require('discord.js');

const commandBuilders = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show the bot connection and stream status.'),
  new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Restart the stream pipeline in the current voice channel.'),
  new SlashCommandBuilder()
    .setName('switch')
    .setDescription('Switch the stream to a new URL (primary, backup, or custom).')
    .addStringOption((option) =>
      option
        .setName('url')
        .setDescription('Stream URL to switch to.')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Force the bot to join the configured voice channel and resume streaming.'),
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Disconnect the bot from the voice channel.'),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Health check for the bot.'),
  new SlashCommandBuilder()
    .setName('sfxplay')
    .setDescription('Play a sound effect from the configured SFX folder, then resume the stream.')
    .addStringOption((option) =>
      option
        .setName('sound')
        .setDescription('Sound effect filename')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  new SlashCommandBuilder()
    .setName('sfxlist')
    .setDescription('List available sound effects.'),
  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set playback volume (for streams and SFX).')
    .addIntegerOption((option) =>
      option
        .setName('level')
        .setDescription('Volume percent (0-200)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(200)
    ),
];

const commands = commandBuilders.map((builder) => builder.toJSON());

module.exports = {
  commands,
};
