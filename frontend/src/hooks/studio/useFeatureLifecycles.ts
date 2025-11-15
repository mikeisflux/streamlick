import { useState, useEffect } from 'react';
import { clipRecordingService } from '../../services/clip-recording.service';
import { captionService, Caption, POPULAR_LANGUAGES } from '../../services/caption.service';
import { backgroundRemovalService, BackgroundOptions } from '../../services/background-removal.service';
import { verticalCompositorService } from '../../services/vertical-compositor.service';
import { analyticsService, EngagementMetrics, StreamInsight } from '../../services/analytics.service';
import { compositorService } from '../../services/compositor.service';
import toast from 'react-hot-toast';

export function useCaptions(enabled: boolean, language: string) {
  const [currentCaption, setCurrentCaption] = useState<Caption | null>(null);

  useEffect(() => {
    if (enabled) {
      const startCaptions = async () => {
        // Check browser support
        if (!captionService.isSupported()) {
          toast.error('Speech recognition not supported in this browser. Try Chrome or Edge.');
          return;
        }

        try {
          // Request microphone permission explicitly
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

          // Stop the test stream immediately - we just needed to check permissions
          stream.getTracks().forEach(track => track.stop());

          // Set up caption callbacks
          captionService.onCaption((caption: Caption) => {
            setCurrentCaption(caption);

            // Clear interim captions after 3 seconds
            if (!caption.isFinal) {
              setTimeout(() => {
                setCurrentCaption((prev) => {
                  if (prev && !prev.isFinal && prev.text === caption.text) {
                    return null;
                  }
                  return prev;
                });
              }, 3000);
            } else {
              // Clear final captions after 5 seconds
              setTimeout(() => {
                setCurrentCaption((prev) => {
                  if (prev && prev.isFinal && prev.text === caption.text) {
                    return null;
                  }
                  return prev;
                });
              }, 5000);
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
      toast.success('AI Captions stopped');
    }

    return () => {
      if (captionService.active()) {
        captionService.stop();
      }
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

  useEffect(() => {
    if (enabled && localStream) {
      const startBackgroundRemoval = async () => {
        try {
          // Load model if not already loaded
          if (!backgroundRemovalService.isModelLoaded()) {
            toast.loading('Loading AI background model...', { id: 'bg-model' });
            await backgroundRemovalService.loadModel();
            toast.success('Background removal ready', { id: 'bg-model' });
          }

          // Start background removal
          const outputStream = await backgroundRemovalService.start(localStream, options);
          setProcessedStream(outputStream);
          toast.success(`Background ${options.type} enabled`);
        } catch (error) {
          console.error('Failed to start background removal:', error);
          toast.error('Failed to enable background removal');
        }
      };

      startBackgroundRemoval();
    } else if (!enabled && backgroundRemovalService.isActive()) {
      backgroundRemovalService.stop();
      setProcessedStream(null);
      toast.success('Background removal stopped');
    }

    return () => {
      if (backgroundRemovalService.isActive()) {
        backgroundRemovalService.stop();
      }
    };
  }, [enabled, localStream, options]);

  return { processedStream };
}

export function useVerticalSimulcast(
  enabled: boolean,
  localStream: MediaStream | null,
  processedStream: MediaStream | null,
  resolution: '1080x1920' | '720x1280' | '540x960'
) {
  const [verticalStream, setVerticalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (enabled && localStream) {
      const startVerticalSimulcast = async () => {
        try {
          // Get the source stream (processed or original)
          const sourceStream = processedStream || compositorService.getOutputStream() || localStream;

          // Start vertical compositor
          const outputStream = await verticalCompositorService.start(sourceStream, {
            outputWidth: parseInt(resolution.split('x')[0]),
            outputHeight: parseInt(resolution.split('x')[1]),
            cropMode: 'center',
            smoothing: 0.15,
          });

          setVerticalStream(outputStream);
          toast.success(`Vertical simulcast enabled (${resolution} 9:16)`);
        } catch (error) {
          console.error('Failed to start vertical simulcast:', error);
          toast.error('Failed to enable vertical simulcast');
        }
      };

      startVerticalSimulcast();
    } else if (!enabled && verticalCompositorService.active()) {
      verticalCompositorService.stop();
      setVerticalStream(null);
      toast.success('Vertical simulcast stopped');
    }

    return () => {
      if (verticalCompositorService.active()) {
        verticalCompositorService.stop();
      }
    };
  }, [enabled, localStream, processedStream, resolution]);

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
