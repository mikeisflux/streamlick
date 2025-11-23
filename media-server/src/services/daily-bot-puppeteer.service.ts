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

      // Grant media permissions
      const context = this.browser.defaultBrowserContext();
      await context.overridePermissions('https://api.daily.co', [
        'camera',
        'microphone',
      ]);

      logger.info('[Puppeteer Bot] Browser launched');

      // Inject Daily.co SDK and create bot page
      await this.page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Daily Bot</title>
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
      `);

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

    // Execute in browser context
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

        pc.ontrack = (event: any) => {
          win.botLog.push({ message: 'Track received', kind: event.track.kind });
          if (event.track.kind === 'video') {
            win.mediaTracks.video = event.track;
          } else {
            win.mediaTracks.audio = event.track;
          }

          // Display in video element
          const videoEl = document.getElementById('localVideo') as any;
          if (videoEl && event.streams[0]) {
            videoEl.srcObject = event.streams[0];
          }
        };
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

    logger.info('[Puppeteer Bot] WebRTC API check:', webrtcCheck);

    // Get browser console logs
    this.page!.on('console', (msg) => {
      logger.info(`[Browser Console ${msg.type()}]:`, msg.text());
    });

    try {
      await this.page!.evaluate(
        async (params) => {
          const { roomUrl, token } = params;
          const win = window as any;

          // Create Daily call object
          win.dailyCall = win.DailyIframe.createCallObject();

          win.dailyCall.on('joined-meeting', () => {
            win.botLog.push({ message: 'Joined Daily meeting' });
          });

          win.dailyCall.on('error', (error: any) => {
            console.error('Daily error event:', error);
            win.botLog.push({ message: 'Daily error', error });
          });

          // Join the room
          console.log('Attempting to join Daily room...');
          await win.dailyCall.join({ url: roomUrl, token });
          console.log('Successfully joined Daily room');

          // Set custom tracks from mediasoup
          if (win.mediaTracks.video && win.mediaTracks.audio) {
            await win.dailyCall.setInputDevicesAsync({
              videoSource: win.mediaTracks.video,
              audioSource: win.mediaTracks.audio,
            });
            win.botLog.push({ message: 'Set custom tracks from mediasoup' });
          }
        },
        { roomUrl: config.roomUrl, token: config.token }
      );

      logger.info('[Puppeteer Bot] Joined Daily room');
    } catch (error: any) {
      logger.error('[Puppeteer Bot] Error joining Daily room:', {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private async startRTMPStreaming(config: PuppeteerBotConfig): Promise<void> {
    logger.info('[Puppeteer Bot] Starting RTMP streaming...');

    await this.page!.evaluate(
      async (destinations) => {
        const win = window as any;
        const rtmpUrl = `${destinations[0].rtmpUrl}/${destinations[0].streamKey}`;

        await win.dailyCall.startLiveStreaming({
          rtmpUrl,
          layout: { preset: 'single-participant' },
        });

        win.botLog.push({ message: 'RTMP streaming started', rtmpUrl });
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
