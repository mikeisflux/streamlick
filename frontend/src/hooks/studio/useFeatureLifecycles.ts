import { useState, useEffect, useRef } from 'react';
import { clipRecordingService } from '../../services/clip-recording.service';
import { captionService, Caption, POPULAR_LANGUAGES } from '../../services/caption.service';
import { backgroundRemovalService, BackgroundOptions } from '../../services/background-removal.service';
import { verticalCompositorService } from '../../services/vertical-compositor.service';
import { analyticsService, EngagementMetrics, StreamInsight } from '../../services/analytics.service';
import { compositorService } from '../../services/compositor.service';
import toast from 'react-hot-toast';

export function useCaptions(enabled: boolean, language: string) {
  const [currentCaption, setCurrentCaption] = useState<Caption | null>(null);
  const timerRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    if (enabled) {
      const startCaptions = async () => {
        // Check browser support
        if (!captionService.isSupported()) {
          toast.error('Speech recognition not supported in this browser. Try Chrome or Edge.');
          return;
        }

        try {
          // GHOST MICROPHONE APPROACH:
          // The browser's SpeechRecognition API can only access the microphone directly.
          // We create a "ghost mic" by having SpeechRecognition access the real microphone,
          // which will pick up system audio playback if configured properly.
          //
          // Better solution (TODO):
          // - Get compositor's mixed output: compositorService.getOutputStream()
          // - Use Web Audio API to create virtual audio device from mixed stream
          // - Feed that to a transcription service that accepts streams
          //
          // For now: SpeechRecognition accesses mic directly (may pick up speaker output)

          // Request microphone permission explicitly
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

          // Stop the test stream immediately - we just needed to check permissions
          stream.getTracks().forEach(track => track.stop());

          console.log('[AI Captions] Using direct microphone access. For all participants, configure system to route audio playback to mic input.');

          // Set up caption callbacks
          captionService.onCaption((caption: Caption) => {
            setCurrentCaption(caption);

            // CRITICAL: Also send caption to compositor service for output stream rendering
            compositorService.setCaption(caption);

            // Clear interim captions after 3 seconds
            if (!caption.isFinal) {
              const timer = setTimeout(() => {
                setCurrentCaption((prev) => {
                  if (prev && !prev.isFinal && prev.text === caption.text) {
                    compositorService.setCaption(null); // Clear from output stream too
                    return null;
                  }
                  return prev;
                });
              }, 3000);
              timerRef.current.push(timer);
            } else {
              // Clear final captions after 5 seconds
              const timer = setTimeout(() => {
                setCurrentCaption((prev) => {
                  if (prev && prev.isFinal && prev.text === caption.text) {
                    compositorService.setCaption(null); // Clear from output stream too
                    return null;
                  }
                  return prev;
                });
              }, 5000);
              timerRef.current.push(timer);
            }
          });

          captionService.onError((error: string) => {
            console.error('Caption error:', error);

            // Provide user-friendly error messages
            if (error === 'not-allowed') {
              toast.error('Microphone access denied. Please allow microphone access to use captions.');
            } else if (error === 'no-speech') {
              // Ignore no-speech errors as they're normal
            } else if (error === 'aborted') {
              // Ignore aborted errors as they're normal
            } else if (error === 'audio-capture') {
              toast.error('No microphone found. Please connect a microphone to use captions.');
            } else if (error === 'network') {
              toast.error('Network error. Speech recognition requires an internet connection.');
            } else {
              toast.error(`Caption error: ${error}`);
            }
          });

          // Start the caption service
          captionService.start({ language });
          const langName = POPULAR_LANGUAGES.find((l) => l.code === language)?.name;
          toast.success(`AI Captions started (${langName})`);
        } catch (error: any) {
          console.error('Failed to start captions:', error);

          if (error.name === 'NotAllowedError') {
            toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
          } else if (error.name === 'NotFoundError') {
            toast.error('No microphone found. Please connect a microphone.');
          } else {
            toast.error('Failed to start captions. Please check your microphone permissions.');
          }
        }
      };

      startCaptions();
    } else if (!enabled && captionService.active()) {
      captionService.stop();
      setCurrentCaption(null);
      compositorService.setCaption(null); // Clear from output stream too
      toast.success('AI Captions stopped');
    }

    return () => {
      // Clear all pending timers
      timerRef.current.forEach(timer => clearTimeout(timer));
      timerRef.current = [];

      if (captionService.active()) {
        captionService.stop();
      }

      // Clear captions from compositor
      compositorService.setCaption(null);
    };
  }, [enabled, language]);

  return { currentCaption };
}

export function useBackgroundRemoval(
  enabled: boolean,
  localStream: MediaStream | null,
  options: BackgroundOptions
) {
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const lastStreamIdRef = useRef<string | null>(null);

  // Start/stop background removal when enabled changes or stream changes
  useEffect(() => {
    const currentStreamId = localStream?.id || null;
    const streamChanged = currentStreamId !== lastStreamIdRef.current;
    let isMounted = true;

    // Update the last stream ID reference
    if (enabled && localStream) {
      lastStreamIdRef.current = currentStreamId;
    }
    if (enabled && localStream && (streamChanged || !backgroundRemovalService.isActive())) {
      const startBackgroundRemoval = async () => {
        try {
          // Stop existing background removal if stream changed
          if (streamChanged && backgroundRemovalService.isActive()) {
            console.log('[Background Removal] Stream changed, restarting with new stream');
            backgroundRemovalService.stop();
          }

          // Verify localStream is active before processing
          const videoTracks = localStream.getVideoTracks();
          if (videoTracks.length === 0 || videoTracks[0].readyState !== 'live') {
            console.error('Local stream is not active, cannot start background removal');
            if (isMounted) toast.error('Camera not active');
            return;
          }

          // Load model if not already loaded
          if (!backgroundRemovalService.isModelLoaded()) {
            if (isMounted) toast.loading('Loading AI background model...', { id: 'bg-model' });
            await backgroundRemovalService.loadModel();
            if (!isMounted) return;
            toast.success('Background removal ready', { id: 'bg-model' });
          }

          // Start background removal
          console.log('[Background Removal] Starting with stream:', localStream.id);
          const outputStream = await backgroundRemovalService.start(localStream, options);
          if (!isMounted) return;
          setProcessedStream(outputStream);
          toast.success(`Background ${options.type} enabled`);
        } catch (error) {
          console.error('Failed to start background removal:', error);
          if (!isMounted) return;
          toast.error('Failed to enable background removal');
          setProcessedStream(null); // Ensure fallback to original stream
        }
      };

      startBackgroundRemoval();
    } else if (!enabled) {
      // Always stop and clear processed stream when disabled
      if (backgroundRemovalService.isActive()) {
        console.log('[Background Removal] Stopping and restoring original stream');
        backgroundRemovalService.stop();
      }
      setProcessedStream(null);

      // Verify localStream is still valid
      if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        console.log('[Background Removal] Original stream status:', {
          id: localStream.id,
          videoTracks: videoTracks.length,
          active: videoTracks[0]?.readyState
        });
      }

      if (backgroundRemovalService.isActive()) {
        toast.success('Background removal stopped');
      }
      lastStreamIdRef.current = null;
    }

    return () => {
      isMounted = false;
    };
  }, [enabled, localStream]); // Includes localStream to handle stream changes

  // Update options in real-time when they change
  useEffect(() => {
    if (enabled && backgroundRemovalService.isActive()) {
      backgroundRemovalService.updateOptions(options);
    }
  }, [enabled, options]);

  return { processedStream };
}

export function useVerticalSimulcast(
  enabled: boolean,
  localStream: MediaStream | null,
  processedStream: MediaStream | null,
  resolution: '1080x1920' | '720x1280' | '540x960'
) {
  const [verticalStream, setVerticalStream] = useState<MediaStream | null>(null);
  const lastStreamIdRef = useRef<string | null>(null);

  useEffect(() => {
    const sourceStream = processedStream || compositorService.getOutputStream() || localStream;
    const currentStreamId = sourceStream?.id || null;
    const streamChanged = currentStreamId !== lastStreamIdRef.current;
    let isMounted = true;

    // Update the last stream ID reference
    if (enabled && sourceStream) {
      lastStreamIdRef.current = currentStreamId;
    }
    if (enabled && sourceStream && (streamChanged || !verticalCompositorService.active())) {
      const startVerticalSimulcast = async () => {
        try {
          // Stop existing vertical simulcast if stream changed
          if (streamChanged && verticalCompositorService.active()) {
            console.log('[Vertical Simulcast] Stream changed, restarting with new stream');
            verticalCompositorService.stop();
          }

          console.log('[Vertical Simulcast] Starting with stream:', sourceStream.id);

          // Start vertical compositor
          const outputStream = await verticalCompositorService.start(sourceStream, {
            outputWidth: parseInt(resolution.split('x')[0]),
            outputHeight: parseInt(resolution.split('x')[1]),
            cropMode: 'center',
            smoothing: 0.15,
          });

          if (!isMounted) return;
          setVerticalStream(outputStream);
          toast.success(`Vertical simulcast enabled (${resolution} 9:16)`);
        } catch (error) {
          console.error('Failed to start vertical simulcast:', error);
          if (!isMounted) return;
          toast.error('Failed to enable vertical simulcast');
          setVerticalStream(null); // Ensure cleanup on error
        }
      };

      startVerticalSimulcast();
    } else if (!enabled) {
      if (verticalCompositorService.active()) {
        console.log('[Vertical Simulcast] Stopping');
        verticalCompositorService.stop();
        toast.success('Vertical simulcast stopped');
      }
      setVerticalStream(null);
      lastStreamIdRef.current = null;
    }

    return () => {
      isMounted = false;
    };
  }, [enabled, resolution, localStream, processedStream]); // Includes streams to handle changes

  return { verticalStream };
}

export function useAnalytics(enabled: boolean) {
  const [analyticsMetrics, setAnalyticsMetrics] = useState<EngagementMetrics | null>(null);
  const [analyticsInsights, setAnalyticsInsights] = useState<StreamInsight[]>([]);

  useEffect(() => {
    if (enabled) {
      analyticsService.startTracking();
      toast.success('Analytics tracking started');

      // Update metrics every 10 seconds
      const metricsInterval = setInterval(() => {
        setAnalyticsMetrics(analyticsService.getEngagementMetrics());
        setAnalyticsInsights(analyticsService.generateInsights());
      }, 10000);

      return () => {
        clearInterval(metricsInterval);
        analyticsService.stopTracking();
      };
    } else if (!enabled && analyticsService.active()) {
      analyticsService.stopTracking();
      toast.success('Analytics tracking stopped');
    }
  }, [enabled]);

  // Simulate viewer events for analytics (demo purposes)
  useEffect(() => {
    if (!enabled) return;

    // Simulate a viewer joining
    const viewerId = `viewer-${Math.random().toString(36).substr(2, 9)}`;
    analyticsService.recordViewerJoin(viewerId, { source: 'demo' });

    // Simulate random engagement events
    const engagementInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        analyticsService.recordEngagement(viewerId, 'chat', { message: 'Demo engagement' });
      }
    }, 15000);

    return () => {
      clearInterval(engagementInterval);
      analyticsService.recordViewerLeave(viewerId);
    };
  }, [enabled]);

  return { analyticsMetrics, analyticsInsights };
}
