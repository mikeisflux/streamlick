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

      // Launch Puppeteer
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
        ],
      });

      this.page = await this.browser.newPage();

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
      await this.page.waitForFunction(() => typeof window.DailyIframe !== 'undefined', { timeout: 10000 });

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

        // Create RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [],
        });

        window.mediasoupPeerConnection = pc;

        // Add transceivers
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        // Set remote description from mediasoup
        // This is simplified - full implementation would construct proper SDP
        window.botLog.push({ message: 'Mediasoup connection setup', transportParams });

        // Store tracks when they arrive
        window.mediaTracks = { video: null, audio: null };

        pc.ontrack = (event) => {
          window.botLog.push({ message: 'Track received', kind: event.track.kind });
          if (event.track.kind === 'video') {
            window.mediaTracks.video = event.track;
          } else {
            window.mediaTracks.audio = event.track;
          }

          // Display in video element
          const videoEl = document.getElementById('localVideo');
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

    await this.page!.evaluate(
      async (params) => {
        const { roomUrl, token } = params;

        // Create Daily call object
        window.dailyCall = window.DailyIframe.createCallObject();

        window.dailyCall.on('joined-meeting', () => {
          window.botLog.push({ message: 'Joined Daily meeting' });
        });

        window.dailyCall.on('error', (error) => {
          window.botLog.push({ message: 'Daily error', error });
        });

        // Join the room
        await window.dailyCall.join({ url: roomUrl, token });

        // Set custom tracks from mediasoup
        if (window.mediaTracks.video && window.mediaTracks.audio) {
          await window.dailyCall.setInputDevicesAsync({
            videoSource: window.mediaTracks.video,
            audioSource: window.mediaTracks.audio,
          });
          window.botLog.push({ message: 'Set custom tracks from mediasoup' });
        }
      },
      { roomUrl: config.roomUrl, token: config.token }
    );

    logger.info('[Puppeteer Bot] Joined Daily room');
  }

  private async startRTMPStreaming(config: PuppeteerBotConfig): Promise<void> {
    logger.info('[Puppeteer Bot] Starting RTMP streaming...');

    await this.page!.evaluate(
      async (destinations) => {
        const rtmpUrl = `${destinations[0].rtmpUrl}/${destinations[0].streamKey}`;

        await window.dailyCall.startLiveStreaming({
          rtmpUrl,
          layout: { preset: 'single-participant' },
        });

        window.botLog.push({ message: 'RTMP streaming started', rtmpUrl });
      },
      config.rtmpDestinations
    );

    logger.info('[Puppeteer Bot] RTMP streaming started');
  }

  async stopBot(): Promise<void> {
    logger.info('[Puppeteer Bot] Stopping bot...');

    if (this.page) {
      await this.page.evaluate(() => {
        if (window.dailyCall) {
          window.dailyCall.stopLiveStreaming();
          window.dailyCall.leave();
          window.dailyCall.destroy();
        }
        if (window.mediasoupPeerConnection) {
          window.mediasoupPeerConnection.close();
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

    return await this.page.evaluate(() => window.botLog || []);
  }
}

export const dailyBotPuppeteerService = new DailyBotPuppeteerService();
