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
import * as fs from 'fs';
import * as path from 'path';

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
      // LOG: Debug consumer parameters
      logger.info('[Puppeteer Bot] Starting bot with config:', {
        broadcastId: config.broadcastId,
        videoConsumer: {
          id: config.videoConsumer.id,
          kind: config.videoConsumer.kind,
          codecMimeType: config.videoConsumer.rtpParameters?.codecs?.[0]?.mimeType,
        },
        audioConsumer: {
          id: config.audioConsumer.id,
          kind: config.audioConsumer.kind,
          codecMimeType: config.audioConsumer.rtpParameters?.codecs?.[0]?.mimeType,
          codecPayloadType: config.audioConsumer.rtpParameters?.codecs?.[0]?.payloadType,
          codecClockRate: config.audioConsumer.rtpParameters?.codecs?.[0]?.clockRate,
          codecChannels: config.audioConsumer.rtpParameters?.codecs?.[0]?.channels,
        },
      });

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

        // Forward all browser console logs to server logs
        if (type === 'error') {
          logger.error(`[Browser Console]: ${text}`);
        } else if (type === 'warn') {
          logger.warn(`[Browser Console]: ${text}`);
        } else {
          logger.info(`[Browser Console]: ${text}`);
        }
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


      // Wait for Daily SDK to load
      await this.page.waitForFunction(() => typeof (window as any).DailyIframe !== 'undefined', { timeout: 10000 });


      // Wait for active video/audio in mediasoup before joining Daily
      await this.waitForMediasoupProducers(config);

      // CRITICAL: Connect to mediasoup to receive the composite video/audio tracks
      await this.connectToMediasoup(config);

      // Get tracks from mediasoup to use as bot's camera/mic
      await this.setupMediasoupTracks(config);

      // IMPORTANT: Set input devices BEFORE joining Daily
      // This ensures Daily uses our custom tracks from the start
      await this.setDailyInputTracksBeforeJoin();

      // Join Daily room (will automatically publish the tracks we just set)
      await this.joinDailyRoom(config);

      // Start RTMP streaming
      await this.startRTMPStreaming(config);

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

    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    const checkInterval = 500; // Check every 500ms

    while (Date.now() - startTime < maxWaitTime) {
      // Check if consumers are active (not paused)
      const videoActive = !config.videoConsumer.paused && config.videoConsumer.producerPaused === false;
      const audioActive = !config.audioConsumer.paused && config.audioConsumer.producerPaused === false;


      if (videoActive && audioActive) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return;
      }

      // Wait before checking again
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw new Error('Timeout waiting for active video/audio in mediasoup');
  }

  private async setupMediasoupTracks(config: PuppeteerBotConfig): Promise<void> {

    // Add timeout to prevent hanging indefinitely
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('setupMediasoupTracks timed out after 15 seconds')), 15000);
    });

    const setupPromise = this.page!.evaluate(async () => {
      const win = window as any;

      // CRITICAL FIX: Use the REAL tracks from mediasoup, not fake placeholder tracks
      // The mediaTracks were populated by connectToMediasoup() via pc.ontrack event
      if (!win.mediaTracks || !win.mediaTracks.video || !win.mediaTracks.audio) {
        throw new Error('❌ Mediasoup tracks not available! Cannot stream placeholder to YouTube.');
      }

      // Use the real composite video/audio from mediasoup
      const videoTrack = win.mediaTracks.video;
      const audioTrack = win.mediaTracks.audio;

      console.log('✅ Using REAL mediasoup tracks:', JSON.stringify({
        videoId: videoTrack.id,
        videoLabel: videoTrack.label,
        audioId: audioTrack.id,
        audioLabel: audioTrack.label,
      }));

      // Store tracks for Daily.co to use
      win.botMediaTracks = {
        video: videoTrack,
        audio: audioTrack,
      };

      // OPTIONAL: Display the video in the page for debugging
      const videoEl = document.getElementById('localVideo') as any;
      if (videoEl) {
        const stream = new MediaStream([videoTrack, audioTrack]);
        videoEl.srcObject = stream;

        // Try to play with timeout - don't let this block the setup
        const playPromise = videoEl.play().catch((err: any) => {
          console.error('❌ Video play failed:', err.message);
        });

        // Don't await play - just start it and move on
        // Check video element state immediately (synchronously)
        console.log('📹 Video element state:', JSON.stringify({
          hasVideoTrack: stream.getVideoTracks().length > 0,
          videoTrackReadyState: videoTrack.readyState,
          videoTrackEnabled: videoTrack.enabled,
          elementWidth: videoEl.videoWidth,
          elementHeight: videoEl.videoHeight,
          elementPaused: videoEl.paused,
          elementReadyState: videoEl.readyState,
          elementCurrentTime: videoEl.currentTime,
        }));

        console.log('✅ Displaying mediasoup video in page');
      }

      // SERVER-SIDE RECORDING: Record what the bot receives from mediasoup
      // This helps diagnose if the issue is before or after the bot
      try {
        const recordStream = new MediaStream([videoTrack, audioTrack]);
        const recorder = new (window as any).MediaRecorder(recordStream, {
          mimeType: 'video/webm;codecs=vp8,opus',
          videoBitsPerSecond: 3000000, // 3 Mbps
        });

        win.recordingChunks = [];

        recorder.ondataavailable = (event: any) => {
          if (event.data && event.data.size > 0) {
            // Convert Blob to ArrayBuffer to pass to Node.js
            event.data.arrayBuffer().then((buffer: ArrayBuffer) => {
              win.recordingChunks.push(Array.from(new Uint8Array(buffer)));
            });
          }
        };

        recorder.onstop = () => {
          console.log('⏹️ Recording stopped. Total chunks:', win.recordingChunks.length);
          win.recordingStopped = true;
        };

        recorder.start(1000); // Capture in 1-second chunks
        console.log('🔴 RECORDING STARTED - Bot is now recording what it receives from mediasoup');

        // Stop recording after 30 seconds (shorter for quicker testing)
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }, 30000);

        win.mediaRecorder = recorder; // Store for manual control
      } catch (err: any) {
        console.error('❌ Failed to start recording:', err.message);
      }

      console.log('✅ Bot media tracks set up with REAL composite stream from StudioCanvas');
    });

    // Race between setup and timeout
    await Promise.race([setupPromise, timeoutPromise]);
    logger.info('[Puppeteer Bot] Media tracks setup completed');
  }

  private async setDailyInputTracksBeforeJoin(): Promise<void> {

    await this.page!.evaluate(async () => {
      const win = window as any;

      if (win.botMediaTracks) {
        console.log('🎥 Creating Daily call object and setting input devices...');
        // Get video track settings to check dimensions
        const videoSettings = win.botMediaTracks.video.getSettings();
        console.log('Track info:', JSON.stringify({
          videoId: win.botMediaTracks.video.id,
          videoEnabled: win.botMediaTracks.video.enabled,
          videoReadyState: win.botMediaTracks.video.readyState,
          videoWidth: videoSettings.width,
          videoHeight: videoSettings.height,
          videoFrameRate: videoSettings.frameRate,
          audioId: win.botMediaTracks.audio.id,
          audioEnabled: win.botMediaTracks.audio.enabled,
          audioReadyState: win.botMediaTracks.audio.readyState,
        }));

        // Create Daily call object
        console.log('Creating Daily call object...');
        win.dailyCall = win.DailyIframe.createCallObject();

        // Set up event handlers
        win.dailyCall.on('joined-meeting', () => {
          console.log('✅ Joined Daily meeting');
          win.botLog.push({ message: 'Joined Daily meeting' });
        });

        win.dailyCall.on('error', (error: any) => {
          console.error('❌ Daily error event:', JSON.stringify(error, null, 2));
          win.botLog.push({ message: 'Daily error', error });
        });

        // Listen for live streaming events
        win.dailyCall.on('live-streaming-started', (event: any) => {
          console.log('✅ Daily live-streaming-started event:', JSON.stringify(event));
        });

        win.dailyCall.on('live-streaming-stopped', (event: any) => {
          console.log('🛑 Daily live-streaming-stopped event:', JSON.stringify(event));
        });

        win.dailyCall.on('live-streaming-error', (event: any) => {
          console.error('❌ Daily live-streaming-error event:', JSON.stringify(event));
        });

        // Set input devices BEFORE joining
        await win.dailyCall.setInputDevicesAsync({
          videoSource: win.botMediaTracks.video,
          audioSource: win.botMediaTracks.audio,
        });
        console.log('✅ Set bot media tracks as Daily input');

        // Start camera to actually begin capturing from the input devices
        // This must be called BEFORE joining
        await win.dailyCall.startCamera();
        console.log('✅ Started camera - now capturing from mediasoup tracks');
      } else {
        console.warn('⚠️ Bot media tracks not available');
      }
    });

  }

  private async connectToMediasoup(config: PuppeteerBotConfig): Promise<void> {

    // Get transport parameters for browser-side WebRTC connection
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

    // Build SDP answer from mediasoup transport parameters
    // This creates a valid SDP that the browser can use to connect to mediasoup
    const answerSdp = this.buildBrowserSdp(transportParams, videoConsumerParams, audioConsumerParams);

    // Execute in browser context to establish WebRTC connection
    await this.page!.evaluate(
      async (params) => {
        const { answerSdp } = params;
        const win = window as any;

        console.log('[Bot] Creating RTCPeerConnection to mediasoup...');

        // Create RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [],
        });

        win.mediasoupPeerConnection = pc;
        win.mediaTracks = { video: null, audio: null };

        // Add transceivers for receiving video and audio
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        // Set up track receiver before creating offer
        const tracksPromise = new Promise<void>((resolve) => {
          let videoReceived = false;
          let audioReceived = false;

          pc.ontrack = (event: any) => {
            console.log(`✅ [Bot] Track received: ${event.track.kind}`, event.track.id);

            if (event.track.kind === 'video') {
              win.mediaTracks.video = event.track;
              videoReceived = true;
            } else if (event.track.kind === 'audio') {
              win.mediaTracks.audio = event.track;
              audioReceived = true;
            }

            // Display video for debugging
            const videoEl = document.getElementById('localVideo') as HTMLVideoElement;
            if (videoEl && event.streams[0]) {
              videoEl.srcObject = event.streams[0];
              console.log('✅ [Bot] Video element updated with stream');
            }

            // Resolve when both tracks received
            if (videoReceived && audioReceived) {
              console.log('✅ [Bot] Both video and audio tracks received!');
              resolve();
            }
          };
        });

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('[Bot] Created offer, set as local description');

        // Log the SDP answer we're about to set
        console.log('[Bot] About to set remote SDP answer:', answerSdp);

        // Set remote description from mediasoup (constructed SDP answer)
        try {
          await pc.setRemoteDescription({
            type: 'answer',
            sdp: answerSdp,
          });
          console.log('[Bot] ✅ Successfully set mediasoup SDP as remote description');
        } catch (error: any) {
          console.error('[Bot] ❌ Failed to set remote description:', error.message);
          console.error('[Bot] SDP that failed:', answerSdp);
          throw error;
        }

        // Wait for tracks to arrive (with 10 second timeout)
        await Promise.race([
          tracksPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout waiting for mediasoup tracks in browser')), 10000)
          ),
        ]);

        console.log('✅ [Bot] Mediasoup connection established successfully');
      },
      { answerSdp }
    );

    logger.info('[Puppeteer Bot] Successfully connected to mediasoup and received tracks');
  }

  /**
   * Build SDP answer for browser to connect to mediasoup WebRTC transport
   */
  private buildBrowserSdp(
    transportParams: any,
    videoConsumerParams: any,
    audioConsumerParams: any
  ): string {
    const dtls = transportParams.dtlsParameters;
    const ice = transportParams.iceParameters;
    const candidates = transportParams.iceCandidates;

    // Get first candidate
    const candidate = candidates[0];

    // Get codec info from RTP parameters
    const videoCodec = videoConsumerParams.rtpParameters.codecs[0];
    const audioCodec = audioConsumerParams.rtpParameters.codecs[0];

    // LOG: Debug audio codec parameters
    logger.info('[Puppeteer Bot] Building SDP with audio codec:', {
      mimeType: audioCodec.mimeType,
      payloadType: audioCodec.payloadType,
      clockRate: audioCodec.clockRate,
      channels: audioCodec.channels,
      parameters: audioCodec.parameters,
      rtcpFeedback: audioCodec.rtcpFeedback,
    });

    // Get SSRCs
    const videoSsrc = videoConsumerParams.rtpParameters.encodings?.[0]?.ssrc || 1111;
    const audioSsrc = audioConsumerParams.rtpParameters.encodings?.[0]?.ssrc || 2222;

    logger.info('[Puppeteer Bot] Building SDP with SSRCs:', {
      videoSsrc,
      audioSsrc,
    });

    // Build SDP answer
    const sdp = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=mediasoup
t=0 0
a=group:BUNDLE 0 1
a=msid-semantic:WMS *
a=ice-ufrag:${ice.usernameFragment}
a=ice-pwd:${ice.password}
a=ice-options:trickle
a=fingerprint:${dtls.fingerprints[0].algorithm} ${dtls.fingerprints[0].value}
a=setup:active
m=video ${candidate.port} UDP/TLS/RTP/SAVPF ${videoCodec.payloadType}
c=IN IP4 ${candidate.ip}
a=rtcp:${candidate.port} IN IP4 ${candidate.ip}
a=rtcp-mux
a=sendonly
a=mid:0
a=rtpmap:${videoCodec.payloadType} ${videoCodec.mimeType.split('/')[1]}/${videoCodec.clockRate}
a=ssrc:${videoSsrc} cname:mediasoup
a=ssrc:${videoSsrc} msid:mediasoup video
a=candidate:${candidate.foundation} 1 udp ${candidate.priority} ${candidate.ip} ${candidate.port} typ ${candidate.type}
m=audio ${candidate.port} UDP/TLS/RTP/SAVPF ${audioCodec.payloadType}
c=IN IP4 ${candidate.ip}
a=rtcp:${candidate.port} IN IP4 ${candidate.ip}
a=rtcp-mux
a=sendonly
a=mid:1
a=rtpmap:${audioCodec.payloadType} ${audioCodec.mimeType.split('/')[1]}/${audioCodec.clockRate}${audioCodec.channels ? `/${audioCodec.channels}` : ''}
a=ssrc:${audioSsrc} cname:mediasoup
a=ssrc:${audioSsrc} msid:mediasoup audio
a=candidate:${candidate.foundation} 1 udp ${candidate.priority} ${candidate.ip} ${candidate.port} typ ${candidate.type}
`;

    logger.info('[Puppeteer Bot] Generated SDP answer:', sdp);
    return sdp;
  }

  private async joinDailyRoom(config: PuppeteerBotConfig): Promise<void> {

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


    try {
      const joinResult = await this.page!.evaluate(
        async (params) => {
          const { roomUrl, token } = params;
          const win = window as any;

          try {
            // Daily call object should already be created with input devices set
            if (!win.dailyCall) {
              throw new Error('Daily call object not found - should have been created earlier');
            }

            // Join the room (tracks will be published automatically)
            console.log('Attempting to join Daily room...', { roomUrl });
            const joinResponse = await win.dailyCall.join({ url: roomUrl, token });
            console.log('✅ Successfully joined Daily room', JSON.stringify(joinResponse));

            // Wait a moment for tracks to start publishing
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Verify the local participant has active tracks
            const localParticipant = win.dailyCall.participants().local;
            console.log('📊 Local participant after join:', JSON.stringify({
              session_id: localParticipant.session_id,
              user_name: localParticipant.user_name,
              video: localParticipant.video,
              audio: localParticipant.audio,
              tracks: localParticipant.tracks,
            }));

            // CRITICAL: Check what actual MediaStreamTracks Daily is using
            const actualVideoTrack = localParticipant.videoTrack;
            const actualAudioTrack = localParticipant.audioTrack;
            console.log('🔍 Actual tracks Daily is using:', JSON.stringify({
              videoTrackId: actualVideoTrack?.id,
              videoTrackLabel: actualVideoTrack?.label,
              videoTrackEnabled: actualVideoTrack?.enabled,
              videoTrackReadyState: actualVideoTrack?.readyState,
              audioTrackId: actualAudioTrack?.id,
              audioTrackLabel: actualAudioTrack?.label,
              audioTrackEnabled: actualAudioTrack?.enabled,
              audioTrackReadyState: actualAudioTrack?.readyState,
            }));

            // Check if these match our mediasoup tracks
            const usingOurTracks = {
              video: actualVideoTrack?.id === win.botMediaTracks.video.id,
              audio: actualAudioTrack?.id === win.botMediaTracks.audio.id,
            };
            console.log('✅ Daily is using our mediasoup tracks:', JSON.stringify(usingOurTracks));

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

    } catch (error: any) {
      logger.error(`[Puppeteer Bot] Error joining Daily room: ${error.message || String(error)}`);
      if (error.stack) {
        logger.error(`[Puppeteer Bot] Stack: ${error.stack}`);
      }
      throw error;
    }
  }

  private async waitForActiveMedia(): Promise<void> {

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

  }

  private async startRTMPStreaming(config: PuppeteerBotConfig): Promise<void> {

    await this.page!.evaluate(
      async (destinations) => {
        const win = window as any;
        const rtmpUrl = `${destinations[0].rtmpUrl}/${destinations[0].streamKey}`;

        // Get participants
        const participants = win.dailyCall.participants();
        const localParticipant = participants.local;

        console.log('📹 Starting RTMP streaming...');
        console.log('Local participant details:', JSON.stringify({
          session_id: localParticipant.session_id,
          user_name: localParticipant.user_name,
          video: localParticipant.video,
          audio: localParticipant.audio,
          tracks: localParticipant.tracks,
        }));

        // Check if bot has active video/audio
        if (!localParticipant.video || !localParticipant.audio) {
          console.error('❌ Bot does not have active video/audio!', JSON.stringify({
            video: localParticipant.video,
            audio: localParticipant.audio,
          }));
          throw new Error('Bot missing video or audio before starting RTMP');
        }

        // Use the bot's own session since it has video now
        const layoutConfig = {
          preset: 'single-participant',
          session_id: localParticipant.session_id,
        };

        console.log('Starting RTMP stream with layout:', JSON.stringify(layoutConfig));
        console.log('RTMP URL:', rtmpUrl.substring(0, 50) + '...');

        await win.dailyCall.startLiveStreaming({
          rtmpUrl,
          layout: layoutConfig,
        });

        console.log('✅ RTMP streaming started successfully');
        win.botLog.push({ message: 'RTMP streaming started', rtmpUrl, layout: layoutConfig });
      },
      config.rtmpDestinations
    );

  }

  async stopBot(): Promise<void> {
    logger.info('[Puppeteer Bot] Stopping bot...');

    if (this.page) {
      // Stop recording and get chunks before closing
      const recordingData = await this.page.evaluate(() => {
        const win = window as any;
        console.log('🛑 Stopping bot...');

        // Stop recording if active
        if (win.mediaRecorder && win.mediaRecorder.state === 'recording') {
          console.log('Stopping recording...');
          win.mediaRecorder.stop();
          // Wait a bit for onstop to fire
        }

        if (win.dailyCall) {
          console.log('Stopping Daily live streaming...');
          win.dailyCall.stopLiveStreaming();
          console.log('Leaving Daily room...');
          win.dailyCall.leave();
          console.log('Destroying Daily call...');
          win.dailyCall.destroy();
          console.log('✅ Daily stopped');
        } else {
          console.log('⚠️ No Daily call to stop');
        }

        if (win.mediasoupPeerConnection) {
          console.log('Closing mediasoup peer connection...');
          win.mediasoupPeerConnection.close();
          console.log('✅ Mediasoup connection closed');
        } else {
          console.log('⚠️ No mediasoup connection to close');
        }

        return win.recordingChunks || [];
      }).catch((err) => {
        logger.warn('[Puppeteer Bot] Error stopping in page:', err);
        return [];
      });

      // Save recording to disk if we have data
      if (recordingData && recordingData.length > 0) {
        try {
          // Convert array of arrays back to Buffer
          const buffers = recordingData.map((chunk: number[]) => Buffer.from(chunk));
          const videoBuffer = Buffer.concat(buffers);

          const filename = `bot-recording-${Date.now()}.webm`;
          const filepath = path.join(__dirname, '../../recordings', filename);

          // Ensure recordings directory exists
          const recordingsDir = path.dirname(filepath);
          if (!fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir, { recursive: true });
          }

          fs.writeFileSync(filepath, videoBuffer);
          logger.info(`🎥 Recording saved to: ${filepath} (${videoBuffer.length} bytes)`);
        } catch (err: any) {
          logger.error('[Puppeteer Bot] Failed to save recording:', err.message);
        }
      } else {
        logger.warn('[Puppeteer Bot] No recording data to save');
      }
    }

    await this.cleanup();
    logger.info('[Puppeteer Bot] Bot stopped successfully');
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
