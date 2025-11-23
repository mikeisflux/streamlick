/**
 * Daily Bot Puppeteer Service
 *
 * Uses headless Chrome to run Daily.co SDK in a real browser environment.
 * The browser joins mediasoup to receive composite media, then joins Daily
 * to send that media to RTMP destinations.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '../utils/logger';
import { types as mediasoupTypes } from 'mediasoup';

interface PuppeteerBotConfig {
  roomUrl: string;
  token: string;
  broadcastId: string;
  webRtcTransport: mediasoupTypes.WebRtcTransport;
  videoConsumer: mediasoupTypes.Consumer;
  audioConsumer: mediasoupTypes.Consumer;
  rtmpDestinations: Array<{ rtmpUrl: string; streamKey: string }>;
}

class DailyBotPuppeteerService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async startBot(config: PuppeteerBotConfig): Promise<void> {
    try {
      logger.info('[Puppeteer Bot] Launching headless browser...');

      // Launch Puppeteer with WebRTC enabled
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          '--enable-webrtc',
          '--enable-features=NetworkService,NetworkServiceInProcess',
          '--disable-web-security',
          '--allow-insecure-localhost',
          '--autoplay-policy=no-user-gesture-required',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      this.page = await this.browser.newPage();

      // Set up console log forwarding immediately
      this.page.on('console', (msg) => {
        const type = msg.type();
        const text = msg.text();
        logger.info(`[Browser Console ${type}]: ${text}`);
      });

      // Forward page errors
      this.page.on('pageerror', (error) => {
        logger.error(`[Browser Page Error]: ${error.message}`);
      });

      // Grant media permissions
      const context = this.browser.defaultBrowserContext();
      await context.overridePermissions('https://api.daily.co', [
        'camera',
        'microphone',
      ]);

      logger.info('[Puppeteer Bot] Browser launched');

      // Navigate to Daily.co domain to get a valid origin for postMessage
      // This is required because Daily SDK uses postMessage internally and needs a non-null origin
      await this.page.goto('https://daily.co', { waitUntil: 'domcontentloaded' });

      // Now set our custom content (will inherit the daily.co origin)
      await this.page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Daily Bot</title>
          <script>
            // Mock navigator.mediaDevices before Daily SDK loads
            if (!navigator.mediaDevices) {
              navigator.mediaDevices = {};
            }
            if (!navigator.mediaDevices.getUserMedia) {
              navigator.mediaDevices.getUserMedia = function() {
                return Promise.reject(new Error('getUserMedia not supported - using custom tracks'));
              };
            }
            if (!navigator.mediaDevices.enumerateDevices) {
              navigator.mediaDevices.enumerateDevices = function() {
                return Promise.resolve([
                  { deviceId: 'default', kind: 'videoinput', label: 'Fake Video', groupId: '' },
                  { deviceId: 'default', kind: 'audioinput', label: 'Fake Audio', groupId: '' }
                ]);
              };
            }
            console.log('✅ navigator.mediaDevices mocked');
          </script>
          <script src="https://unpkg.com/@daily-co/daily-js"></script>
        </head>
        <body>
          <video id="localVideo" autoplay muted></video>
          <script>
            window.botLog = [];
            window.botReady = false;

            function log(message, data) {
              console.log('[Bot Page]', message, data || '');
              window.botLog.push({ message, data, timestamp: Date.now() });
            }

            log('Bot page loaded');
            window.botReady = true;
          </script>
        </body>
        </html>
      `, { waitUntil: 'networkidle0' });

      logger.info('[Puppeteer Bot] Page content set');

      // Wait for Daily SDK to load
      await this.page.waitForFunction(() => typeof (window as any).DailyIframe !== 'undefined', { timeout: 10000 });

      logger.info('[Puppeteer Bot] Daily SDK loaded');

      // Wait for active video/audio in mediasoup before joining Daily
      await this.waitForMediasoupProducers(config);

      // Get tracks from mediasoup to use as bot's camera/mic
      await this.setupMediasoupTracks(config);

      // Join Daily room
      await this.joinDailyRoom(config);

      // Set the mediasoup tracks as the bot's camera/mic in Daily
      await this.setDailyInputTracks();

      // Start RTMP streaming
      await this.startRTMPStreaming(config);

      logger.info('[Puppeteer Bot] ✅ Bot started successfully');
    } catch (error: any) {
      logger.error('[Puppeteer Bot] Failed to start bot:', {
        error: error.message,
        stack: error.stack,
      });
      await this.cleanup();
      throw error;
    }
  }

  private async waitForMediasoupProducers(config: PuppeteerBotConfig): Promise<void> {
    logger.info('[Puppeteer Bot] Waiting for active video/audio in mediasoup...');

    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    const checkInterval = 500; // Check every 500ms

    while (Date.now() - startTime < maxWaitTime) {
      // Check if consumers are active (not paused)
      const videoActive = !config.videoConsumer.paused && config.videoConsumer.producerPaused === false;
      const audioActive = !config.audioConsumer.paused && config.audioConsumer.producerPaused === false;

      logger.info(`[Puppeteer Bot] Mediasoup status: video=${videoActive}, audio=${audioActive}`);

      if (videoActive && audioActive) {
        logger.info('[Puppeteer Bot] ✅ Active video and audio detected in mediasoup');
        logger.info('[Puppeteer Bot] Waiting 2 seconds for stability...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        logger.info('[Puppeteer Bot] ✅ Ready to join Daily room');
        return;
      }

      // Wait before checking again
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw new Error('Timeout waiting for active video/audio in mediasoup');
  }

  private async setupMediasoupTracks(config: PuppeteerBotConfig): Promise<void> {
    logger.info('[Puppeteer Bot] Setting up media tracks...');

    await this.page!.evaluate(async () => {
      const win = window as any;

      // Create canvas for video
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;

      // Draw a simple background (we'll improve this to show mediasoup content later)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Streamlick Live', canvas.width / 2, canvas.height / 2);

      // Capture canvas as video stream
      const videoStream = canvas.captureStream(30); // 30 FPS
      const videoTrack = videoStream.getVideoTracks()[0];

      // Create fake audio track
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const destination = audioContext.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.frequency.value = 0; // Silent
      oscillator.start();
      const audioTrack = destination.stream.getAudioTracks()[0];

      // Store tracks
      win.botMediaTracks = {
        video: videoTrack,
        audio: audioTrack,
      };

      console.log('✅ Created bot media tracks (canvas video + silent audio)');
    });

    logger.info('[Puppeteer Bot] Media tracks created');
  }

  private async setDailyInputTracks(): Promise<void> {
    logger.info('[Puppeteer Bot] Setting Daily input tracks...');

    await this.page!.evaluate(async () => {
      const win = window as any;

      if (win.botMediaTracks && win.dailyCall) {
        await win.dailyCall.setInputDevicesAsync({
          videoSource: win.botMediaTracks.video,
          audioSource: win.botMediaTracks.audio,
        });
        console.log('✅ Set bot media tracks as Daily input');
      } else {
        console.warn('⚠️ Bot media tracks or Daily call not available');
      }
    });

    logger.info('[Puppeteer Bot] Daily input tracks set');
  }

  private async connectToMediasoup(config: PuppeteerBotConfig): Promise<void> {
    logger.info('[Puppeteer Bot] Connecting to mediasoup...');

    // Get transport parameters
    const transportParams = {
      id: config.webRtcTransport.id,
      iceParameters: config.webRtcTransport.iceParameters,
      iceCandidates: config.webRtcTransport.iceCandidates,
      dtlsParameters: config.webRtcTransport.dtlsParameters,
    };

    const videoConsumerParams = {
      id: config.videoConsumer.id,
      producerId: config.videoConsumer.producerId,
      kind: config.videoConsumer.kind,
      rtpParameters: config.videoConsumer.rtpParameters,
    };

    const audioConsumerParams = {
      id: config.audioConsumer.id,
      producerId: config.audioConsumer.producerId,
      kind: config.audioConsumer.kind,
      rtpParameters: config.audioConsumer.rtpParameters,
    };

    // Execute in browser context and wait for tracks
    await this.page!.evaluate(
      async (params) => {
        const { transportParams, videoConsumerParams, audioConsumerParams } = params;
        const win = window as any;

        // Create RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [],
        });

        win.mediasoupPeerConnection = pc;

        // Add transceivers
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        // Set remote description from mediasoup
        // This is simplified - full implementation would construct proper SDP
        win.botLog.push({ message: 'Mediasoup connection setup', transportParams });

        // Store tracks when they arrive
        win.mediaTracks = { video: null, audio: null };

        // Create a promise that resolves when both tracks are received
        const tracksPromise = new Promise<void>((resolve) => {
          let videoReceived = false;
          let audioReceived = false;

          pc.ontrack = (event: any) => {
            console.log(`✅ Track received: ${event.track.kind}`);
            win.botLog.push({ message: 'Track received', kind: event.track.kind });

            if (event.track.kind === 'video') {
              win.mediaTracks.video = event.track;
              videoReceived = true;
            } else {
              win.mediaTracks.audio = event.track;
              audioReceived = true;
            }

            // Display in video element
            const videoEl = document.getElementById('localVideo') as any;
            if (videoEl && event.streams[0]) {
              videoEl.srcObject = event.streams[0];
            }

            // Resolve when both tracks received
            if (videoReceived && audioReceived) {
              console.log('✅ Both tracks received');
              resolve();
            }
          };
        });

        // Wait for tracks (with timeout)
        await Promise.race([
          tracksPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for tracks')), 5000)),
        ]);
      },
      { transportParams, videoConsumerParams, audioConsumerParams }
    );

    logger.info('[Puppeteer Bot] Connected to mediasoup');
  }

  private async joinDailyRoom(config: PuppeteerBotConfig): Promise<void> {
    logger.info('[Puppeteer Bot] Joining Daily room...');

    // First check what WebRTC APIs are available
    const webrtcCheck = await this.page!.evaluate(() => {
      const win = window as any;
      return {
        RTCPeerConnection: typeof RTCPeerConnection !== 'undefined',
        getUserMedia: typeof navigator.mediaDevices?.getUserMedia === 'function',
        mediaDevices: typeof navigator.mediaDevices !== 'undefined',
        DailyIframe: typeof win.DailyIframe !== 'undefined',
        navigator: typeof navigator !== 'undefined',
      };
    });

    logger.info(`[Puppeteer Bot] WebRTC API check: ${JSON.stringify(webrtcCheck, null, 2)}`);

    try {
      const joinResult = await this.page!.evaluate(
        async (params) => {
          const { roomUrl, token } = params;
          const win = window as any;

          try {
            // Create Daily call object
            console.log('Creating Daily call object...');
            win.dailyCall = win.DailyIframe.createCallObject();

            win.dailyCall.on('joined-meeting', () => {
              console.log('✅ Joined Daily meeting');
              win.botLog.push({ message: 'Joined Daily meeting' });
            });

            win.dailyCall.on('error', (error: any) => {
              console.error('❌ Daily error event:', JSON.stringify(error, null, 2));
              win.botLog.push({ message: 'Daily error', error });
            });

            // Join the room
            console.log('Attempting to join Daily room...', { roomUrl });
            const joinResponse = await win.dailyCall.join({ url: roomUrl, token });
            console.log('✅ Successfully joined Daily room', joinResponse);

            // Bot joins as a participant without camera/mic
            // The actual user's media comes from their browser joining Daily directly

            return { success: true };
          } catch (err: any) {
            console.error('❌ Error in page evaluate:', err.message, err.stack);
            return {
              success: false,
              error: err.message || String(err),
              errorType: err.constructor?.name,
              stack: err.stack,
            };
          }
        },
        { roomUrl: config.roomUrl, token: config.token }
      );

      if (!joinResult.success) {
        throw new Error(`Daily join failed: ${joinResult.error} (${joinResult.errorType})`);
      }

      logger.info('[Puppeteer Bot] Joined Daily room');
    } catch (error: any) {
      logger.error(`[Puppeteer Bot] Error joining Daily room: ${error.message || String(error)}`);
      if (error.stack) {
        logger.error(`[Puppeteer Bot] Stack: ${error.stack}`);
      }
      throw error;
    }
  }

  private async waitForActiveMedia(): Promise<void> {
    logger.info('[Puppeteer Bot] Waiting for active video and audio...');

    await this.page!.evaluate(async () => {
      const win = window as any;
      const maxWaitTime = 10000; // 10 seconds max wait
      const startTime = Date.now();

      // Wait for at least one participant with video AND audio
      while (Date.now() - startTime < maxWaitTime) {
        const participants = win.dailyCall.participants();
        const participantCount = Object.keys(participants).length;
        console.log('Checking participants...', participantCount, 'participants');

        // Check all participants (excluding local bot)
        let hasActiveVideo = false;
        let hasActiveAudio = false;
        let remoteParticipantCount = 0;

        for (const [id, participant] of Object.entries(participants)) {
          if (id === 'local') continue; // Skip the bot itself

          remoteParticipantCount++;
          const p = participant as any;
          console.log(`Participant ${id}:`, {
            video: p.video,
            audio: p.audio,
            tracks: p.tracks,
          });

          if (p.video && p.tracks?.video?.state === 'playable') {
            hasActiveVideo = true;
          }
          if (p.audio && p.tracks?.audio?.state === 'playable') {
            hasActiveAudio = true;
          }

          if (hasActiveVideo && hasActiveAudio) {
            console.log(`✅ Found participant ${id} with active video and audio`);
            break;
          }
        }

        if (hasActiveVideo && hasActiveAudio) {
          console.log('✅ Active video and audio detected, waiting 2 seconds for stability...');
          await new Promise((resolve) => setTimeout(resolve, 2000));
          console.log('✅ Ready to start RTMP streaming');
          return;
        }

        // Wait 500ms before checking again
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // After 10 seconds, proceed anyway (stream will be blank until someone joins)
      console.warn('⚠️ No participants with active media found after 10 seconds');
      console.warn('⚠️ Proceeding anyway - RTMP stream will be blank until a participant joins Daily');
      console.warn('⚠️ NOTE: User frontend needs to join the Daily room, not just send to mediasoup');
    });

    logger.info('[Puppeteer Bot] Proceeding to start RTMP streaming');
  }

  private async startRTMPStreaming(config: PuppeteerBotConfig): Promise<void> {
    logger.info('[Puppeteer Bot] Starting RTMP streaming...');

    await this.page!.evaluate(
      async (destinations) => {
        const win = window as any;
        const rtmpUrl = `${destinations[0].rtmpUrl}/${destinations[0].streamKey}`;

        // Get participants
        const participants = win.dailyCall.participants();
        const localParticipant = participants.local;

        // Use the bot's own session since it has video now
        const layoutConfig = {
          preset: 'single-participant',
          session_id: localParticipant.session_id,
        };

        console.log('Starting RTMP stream with bot session_id:', localParticipant.session_id);

        await win.dailyCall.startLiveStreaming({
          rtmpUrl,
          layout: layoutConfig,
        });

        win.botLog.push({ message: 'RTMP streaming started', rtmpUrl, layout: layoutConfig });
      },
      config.rtmpDestinations
    );

    logger.info('[Puppeteer Bot] RTMP streaming started');
  }

  async stopBot(): Promise<void> {
    logger.info('[Puppeteer Bot] Stopping bot...');

    if (this.page) {
      await this.page.evaluate(() => {
        const win = window as any;
        if (win.dailyCall) {
          win.dailyCall.stopLiveStreaming();
          win.dailyCall.leave();
          win.dailyCall.destroy();
        }
        if (win.mediasoupPeerConnection) {
          win.mediasoupPeerConnection.close();
        }
      }).catch((err) => logger.warn('[Puppeteer Bot] Error stopping in page:', err));
    }

    await this.cleanup();
    logger.info('[Puppeteer Bot] ✅ Bot stopped');
  }

  private async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  async getLogs(): Promise<any[]> {
    if (!this.page) return [];

    return await this.page.evaluate(() => (window as any).botLog || []);
  }
}

export const dailyBotPuppeteerService = new DailyBotPuppeteerService();
