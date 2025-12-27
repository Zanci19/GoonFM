# GoonFM Discord Bot

24/7 Discord voice bot that pumps the GoonFM radio stream into a voice channel with automatic reconnects, backup stream failover, and slash-command controls.

## Features

- **Always-on streaming:** Joins the configured voice channel at startup and keeps the audio feed alive with reconnection attempts and backoff.
- **Backup failover:** Optional secondary stream that the bot will swap to when the primary URL errors out.
- **Slash commands:** `/status`, `/refresh`, `/switch`, `/join`, `/leave`, and `/ping` for quick operational control.
- **Polished presence:** Sets a custom “Listening to …” status and structured logging via `pino`.
- **Config-first:** `.env` powered configuration so you can swap tokens, guilds, and streams without code changes.
- **On-demand SFX:** Drop audio files into `./sfx` and trigger them with `/sfxplay` autocomplete; the bot resumes the radio stream automatically.

## Prerequisites

- Node.js 18+
- A Discord application with a bot token (keep this secret!).
- A guild and target voice channel where the bot is allowed to **View Channel**, **Connect**, and **Speak**.
- A streaming URL (Icecast/SHOUTcast/HTTP MP3/AAC feed).

## Setup

1. Duplicate `.env.example` to `.env` inside `discord-bot/` and fill in your values:

   ```env
   DISCORD_TOKEN=your-bot-token
   APPLICATION_ID=1454423581566963910
   PUBLIC_KEY=cd655ef617b62040cdcc54b9e35cfa296c3ef6a57db6b78322f9366ef3f02143
   GUILD_ID=your-guild-id
   VOICE_CHANNEL_ID=target-voice-channel-id
   STREAM_URL=https://your-primary-stream-url
   BACKUP_STREAM_URL=https://your-backup-stream-url
   STATUS_TEXT=GoonFM · Live 24/7
   LOG_LEVEL=info
   SFX_DIR=./sfx
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Register slash commands (once per guild or when commands change):

   ```bash
   npm run deploy:commands
   ```

4. Start the bot:

   ```bash
   npm start
   ```

The bot will log in, register commands, join the configured voice channel, and begin streaming the primary URL. If the stream fails, it will retry and optionally pivot to the backup URL.

## Slash Commands

- `/status` — Show the current connection state and active stream URL.
- `/refresh` — Restart the audio pipeline with the currently selected stream.
- `/switch url:<stream>` — Switch to the provided stream URL (primary, backup, or custom).
- `/join` — Reconnect to the configured voice channel and resume streaming.
- `/leave` — Disconnect from voice and stop streaming.
- `/ping` — Quick health check.
- `/sfxplay sound:<file>` — Autocomplete a sound from `./sfx`, play it, then resume the radio stream.

## Operational Notes

- The bot uses FFmpeg (bundled via `ffmpeg-static`) and `prism-media` to transcode remote streams to Opus for Discord voice.
- Logging defaults to `info`; set `LOG_LEVEL=debug` for richer diagnostics.
- If the primary stream fails repeatedly, the bot swaps to `BACKUP_STREAM_URL` when provided.
- Presence text is controlled by `STATUS_TEXT` and shows as “Listening to …” for a polished, professional touch.
- Sound effects live in `./sfx` (or `SFX_DIR`). Supported extensions: mp3, wav, ogg, flac, aac, m4a. Rename files to avoid spaces for easier autocomplete.

## Troubleshooting

- **Commands not appearing:** Run `npm run deploy:commands` and ensure `GUILD_ID` is set correctly.
- **Bot not joining voice:** Verify channel permissions and that `VOICE_CHANNEL_ID` points to a voice/Stage channel.
- **No audio:** Confirm the stream URL is reachable over HTTPS and that the format is supported by FFmpeg.
- **Reconnect loops:** Increase `RECONNECT_DELAY_MS` or provide a `BACKUP_STREAM_URL` as a stable fallback.
