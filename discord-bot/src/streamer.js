const {
  joinVoiceChannel,
  createAudioPlayer,
  NoSubscriberBehavior,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioResource,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const prism = require('prism-media');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');

class RadioStreamer {
  constructor(client, config, logger) {
    this.client = client;
    this.config = config;
    this.logger = logger;
    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    this.connection = null;
    this.currentStreamUrl = config.streamUrl;
    this.retryCount = 0;
    this.usingBackup = false;
    this.playingSfx = false;
    this.resumeStreamUrl = this.currentStreamUrl;

    if (ffmpegPath) {
      process.env.FFMPEG_PATH = ffmpegPath;
    }

    this.registerPlayerEvents();
  }

  async ensureConnection() {
    if (this.connection) {
      if (this.connection.state.status === VoiceConnectionStatus.Ready) return;
      if (
        this.connection.state.status === VoiceConnectionStatus.Connecting ||
        this.connection.state.status === VoiceConnectionStatus.Signalling
      ) {
        await entersState(this.connection, VoiceConnectionStatus.Ready, 15_000);
        return;
      }
    }

    await this.joinConfiguredChannel();
  }

  registerPlayerEvents() {
    this.player.on(AudioPlayerStatus.Playing, () => {
      this.logger.info(
        { stream: this.currentStreamUrl },
        `Streaming ${this.usingBackup ? 'backup' : 'primary'} feed`
      );
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.playingSfx) {
        this.logger.info('Sound effect finished; resuming stream.');
        this.playingSfx = false;
        this.playStream(this.resumeStreamUrl || this.config.streamUrl).catch((error) => {
          this.logger.error({ error }, 'Failed to resume stream after SFX.');
          this.restartStream(true);
        });
        return;
      }

      this.logger.warn('Audio player entered idle state; restarting stream pipeline.');
      this.restartStream();
    });

    this.player.on('error', (error) => {
      this.logger.error({ error, stream: this.currentStreamUrl }, 'Player error encountered.');
      if (this.playingSfx) {
        this.playingSfx = false;
        this.playStream(this.resumeStreamUrl || this.config.streamUrl).catch((err) => {
          this.logger.error({ err }, 'Failed to recover stream after SFX error.');
          this.restartStream(true);
        });
      } else {
        this.restartStream(true);
      }
    });
  }

  async joinConfiguredChannel() {
    const channel = await this.client.channels.fetch(this.config.voiceChannelId);
    if (!channel || !channel.isVoiceBased()) {
      throw new Error('Configured channel is missing or not voice-capable.');
    }

    this.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    this.connection.on('stateChange', async (_, newState) => {
      this.logger.debug({ state: newState.status }, 'Voice connection state updated.');

      if (newState.status === VoiceConnectionStatus.Disconnected) {
        this.logger.warn('Voice connection lost; attempting to reconnect.');
        try {
          await Promise.race([
            entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          this.connection?.destroy();
          await this.ensureConnection();
          await this.playStream(this.currentStreamUrl); // rebuild connection completely
        }
      }
    });

    await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
    this.logger.info(
      { guild: channel.guild.name, channel: channel.name },
      'Voice connection ready.'
    );
    this.connection.subscribe(this.player);
  }

  async start() {
    await this.ensureConnection();
    await this.playStream(this.config.streamUrl);
  }

  async playStream(url) {
    this.logger.info({ stream: url }, 'Starting stream.');
    await this.ensureConnection();
    const resource = await this.createResource(url);
    this.currentStreamUrl = url;
    this.resumeStreamUrl = url;
    this.usingBackup = url === this.config.backupStreamUrl;
    this.player.play(resource);
    this.retryCount = 0;
  }

  async createResource(url) {
    return new Promise((resolve, reject) => {
      const ffmpeg = new prism.FFmpeg({
        args: [
          '-reconnect',
          '1',
          '-reconnect_streamed',
          '1',
          '-reconnect_delay_max',
          '5',
          '-i',
          url,
          '-analyzeduration',
          '0',
          '-loglevel',
          'warning',
          '-f',
          's16le',
          '-ar',
          '48000',
          '-ac',
          '2',
        ],
      });

      const opus = new prism.opus.Encoder({ rate: 48_000, channels: 2, frameSize: 960 });

      const onError = (error) => {
        ffmpeg.destroy();
        opus.destroy();
        reject(error);
      };

      ffmpeg.once('error', onError);
      opus.once('error', onError);

      const audioStream = ffmpeg.pipe(opus);
      audioStream.once('error', onError);

      const resource = createAudioResource(audioStream, {
        inputType: StreamType.Opus,
      });

      if (resource.volume) {
        resource.volume.setVolume(Math.min(Math.max(this.config.startVolume, 0), 1));
      }

      resolve(resource);
    });
  }

  async createFileResource(filePath) {
    return new Promise((resolve, reject) => {
      const ffmpeg = new prism.FFmpeg({
        args: [
          '-i',
          filePath,
          '-loglevel',
          'warning',
          '-f',
          's16le',
          '-ar',
          '48000',
          '-ac',
          '2',
        ],
      });

      const opus = new prism.opus.Encoder({ rate: 48_000, channels: 2, frameSize: 960 });

      const onError = (error) => {
        ffmpeg.destroy();
        opus.destroy();
        reject(error);
      };

      ffmpeg.once('error', onError);
      opus.once('error', onError);

      const audioStream = ffmpeg.pipe(opus);
      audioStream.once('error', onError);

      const resource = createAudioResource(audioStream, {
        inputType: StreamType.Opus,
      });

      resolve(resource);
    });
  }

  async restartStream(tryBackup = false) {
    const shouldUseBackup = tryBackup && this.config.backupStreamUrl && !this.usingBackup;

    if (shouldUseBackup) {
      this.logger.warn(
        { backup: this.config.backupStreamUrl },
        'Switching to backup stream after an error.'
      );
      this.usingBackup = true;
      return this.playStream(this.config.backupStreamUrl);
    }

    if (this.retryCount >= this.config.maxRetries) {
      this.logger.error('Reached maximum retry count; pausing before another attempt.');
      this.retryCount = 0;
      return;
    }

    this.retryCount += 1;
    this.logger.warn(
      { attempt: this.retryCount, delay: this.config.reconnectDelayMs },
      'Retrying primary stream.'
    );

    setTimeout(() => {
      this.playStream(this.config.streamUrl).catch((err) => {
        this.logger.error({ err }, 'Failed to restart primary stream.');
        this.restartStream(true);
      });
    }, this.config.reconnectDelayMs);
  }

  async switchStream(url) {
    await this.ensureConnection();
    this.usingBackup = url === this.config.backupStreamUrl;
    await this.playStream(url);
    return this.currentStreamUrl;
  }

  async playSoundEffect(name, filePath) {
    await this.ensureConnection();
    await fs.promises.access(filePath, fs.constants.R_OK);

    this.logger.info({ sound: name }, 'Playing sound effect.');
    const resource = await this.createFileResource(filePath);
    this.playingSfx = true;
    this.resumeStreamUrl = this.currentStreamUrl || this.config.streamUrl;
    this.player.play(resource);
  }

  async disconnect() {
    this.player.stop(true);
    this.connection?.destroy();
    this.connection = null;
    this.usingBackup = false;
    this.currentStreamUrl = this.config.streamUrl;
  }

  getStatus() {
    return {
      stream: this.currentStreamUrl,
      usingBackup: this.usingBackup,
      playerState: this.player.state.status,
      connectionState: this.connection?.state.status || 'disconnected',
    };
  }
}

module.exports = RadioStreamer;
