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

      // Connect to mediasoup WebRTC transport
      await this.connectToMediasoup(config);

      // Join Daily room
      await this.joinDailyRoom(config);

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

            // Set custom tracks from mediasoup
            if (win.mediaTracks.video && win.mediaTracks.audio) {
              console.log('Setting custom tracks from mediasoup...');
              await win.dailyCall.setInputDevicesAsync({
                videoSource: win.mediaTracks.video,
                audioSource: win.mediaTracks.audio,
              });
              console.log('✅ Custom tracks set');
              win.botLog.push({ message: 'Set custom tracks from mediasoup' });
            } else {
              console.warn('⚠️ mediaTracks not available:', {
                hasVideo: !!win.mediaTracks.video,
                hasAudio: !!win.mediaTracks.audio,
              });
            }

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

  private async startRTMPStreaming(config: PuppeteerBotConfig): Promise<void> {
    logger.info('[Puppeteer Bot] Starting RTMP streaming...');

    await this.page!.evaluate(
      async (destinations) => {
        const win = window as any;
        const rtmpUrl = `${destinations[0].rtmpUrl}/${destinations[0].streamKey}`;

        // Get local participant session ID
        const participants = win.dailyCall.participants();
        const localParticipant = participants.local;
        const sessionId = localParticipant.session_id;

        console.log('Starting RTMP stream with session_id:', sessionId);

        await win.dailyCall.startLiveStreaming({
          rtmpUrl,
          layout: {
            preset: 'single-participant',
            session_id: sessionId,
          },
        });

        win.botLog.push({ message: 'RTMP streaming started', rtmpUrl, sessionId });
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
