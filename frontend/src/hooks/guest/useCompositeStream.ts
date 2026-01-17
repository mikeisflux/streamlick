/**
 * useCompositeStream Hook
 *
 * Subscribes to the server-side composite stream via Ant Media WebRTC.
 * This replaces the P2P preview approach - the composite runs on the server
 * and continues even if the host refreshes or disconnects.
 *
 * KEY ADVANTAGE: Host disconnect no longer breaks guest preview!
 * The composite HTML page runs independently on the Ant Media server.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = 'wss://media.streamlick.com:5443/LiveApp/websocket';
const MAX_RETRIES = 5;
const RETRY_DELAY = 3000;

interface UseCompositeStreamOptions {
  hasJoined: boolean;
  broadcastId: string | undefined;
}

interface UseCompositeStreamResult {
  compositeStream: MediaStream | null;
  isConnecting: boolean;
  error: string | null;
}

export function useCompositeStream({
  hasJoined,
  broadcastId,
}: UseCompositeStreamOptions): UseCompositeStreamResult {
  const [compositeStream, setCompositeStream] = useState<MediaStream | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adaptorRef = useRef<any>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupRef = useRef(false);

  // Composite stream ID format: broadcastId_composite (matches composite HTML)
  const getCompositeStreamId = useCallback((roomId: string) => {
    return `${roomId}_composite`;
  }, []);

  // Connect to composite stream
  const connectToComposite = useCallback(async (roomId: string) => {
    if (cleanupRef.current) return;

    const compositeStreamId = getCompositeStreamId(roomId);
    console.log('[CompositeStream] Connecting to composite:', compositeStreamId);
    setIsConnecting(true);
    setError(null);

    try {
      // Import WebRTCAdaptor dynamically
      const { WebRTCAdaptor } = await import('@antmedia/webrtc_adaptor');

      if (cleanupRef.current) return;

      // Close existing adaptor if any
      if (adaptorRef.current) {
        try {
          adaptorRef.current.stop(compositeStreamId);
          adaptorRef.current.closeWebSocket();
        } catch (e) {
          // Ignore cleanup errors
        }
        adaptorRef.current = null;
      }

      const adaptor = new WebRTCAdaptor({
        websocket_url: WS_URL,
        mediaConstraints: { video: false, audio: false },
        peerconnection_config: {
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        },
        sdp_constraints: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        },
        callback: (info: string, obj: any) => {
          console.log('[CompositeStream] Callback:', info, obj);

          if (cleanupRef.current) return;

          switch (info) {
            case 'initialized':
              console.log('[CompositeStream] WebSocket connected, playing:', compositeStreamId);
              adaptor.play(compositeStreamId);
              break;

            case 'newStreamAvailable':
              console.log('[CompositeStream] Stream received');
              if (obj.stream) {
                setCompositeStream(obj.stream);
                setIsConnecting(false);
                setError(null);
                retryCountRef.current = 0; // Reset retry count on success
              }
              break;

            case 'newTrackAvailable':
              console.log('[CompositeStream] New track:', obj.track?.kind);
              // Stream might come via newTrackAvailable instead of newStreamAvailable
              if (obj.stream && !compositeStream) {
                setCompositeStream(obj.stream);
                setIsConnecting(false);
                setError(null);
                retryCountRef.current = 0;
              }
              break;

            case 'play_started':
              console.log('[CompositeStream] Play started');
              setIsConnecting(false);
              break;

            case 'play_finished':
              console.log('[CompositeStream] Play finished - composite may have stopped');
              setCompositeStream(null);
              // Try to reconnect after a delay
              if (!cleanupRef.current && retryCountRef.current < MAX_RETRIES) {
                retryTimeoutRef.current = setTimeout(() => {
                  if (!cleanupRef.current) {
                    console.log('[CompositeStream] Attempting reconnect after play_finished');
                    connectToComposite(roomId);
                  }
                }, RETRY_DELAY);
              }
              break;

            case 'ice_connection_state_changed':
              console.log('[CompositeStream] ICE state:', obj.state);
              if (obj.state === 'failed' || obj.state === 'disconnected') {
                // Connection lost, try to reconnect
                if (!cleanupRef.current && retryCountRef.current < MAX_RETRIES) {
                  retryCountRef.current++;
                  retryTimeoutRef.current = setTimeout(() => {
                    if (!cleanupRef.current) {
                      console.log('[CompositeStream] Retrying after ICE failure:', retryCountRef.current);
                      connectToComposite(roomId);
                    }
                  }, RETRY_DELAY);
                }
              }
              break;
          }
        },
        callbackError: (errorType: string, message: string) => {
          console.error('[CompositeStream] Error:', errorType, message);
          setIsConnecting(false);

          // Handle specific errors
          if (errorType === 'no_stream_exist' || errorType === 'streamIdInUse') {
            // Composite not running yet, retry
            if (!cleanupRef.current && retryCountRef.current < MAX_RETRIES) {
              retryCountRef.current++;
              console.log('[CompositeStream] Stream not available, retry:', retryCountRef.current);
              retryTimeoutRef.current = setTimeout(() => {
                if (!cleanupRef.current) {
                  connectToComposite(roomId);
                }
              }, RETRY_DELAY);
            } else {
              setError('Composite stream not available - host may not have started broadcasting');
            }
          } else {
            setError(`${errorType}: ${message}`);
          }
        }
      });

      adaptorRef.current = adaptor;

    } catch (err: any) {
      console.error('[CompositeStream] Failed to connect:', err);
      setIsConnecting(false);
      setError(err.message || 'Failed to connect to composite stream');

      // Retry on general errors
      if (!cleanupRef.current && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        retryTimeoutRef.current = setTimeout(() => {
          if (!cleanupRef.current) {
            connectToComposite(roomId);
          }
        }, RETRY_DELAY);
      }
    }
  }, [getCompositeStreamId]);

  // Main effect to manage connection
  useEffect(() => {
    if (!hasJoined || !broadcastId) {
      return;
    }

    cleanupRef.current = false;
    retryCountRef.current = 0;

    // Connect to composite stream
    connectToComposite(broadcastId);

    return () => {
      cleanupRef.current = true;

      // Clear retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      // Close adaptor
      if (adaptorRef.current) {
        try {
          const compositeStreamId = getCompositeStreamId(broadcastId);
          adaptorRef.current.stop(compositeStreamId);
          adaptorRef.current.closeWebSocket();
        } catch (e) {
          // Ignore cleanup errors
        }
        adaptorRef.current = null;
      }

      setCompositeStream(null);
      setError(null);
      setIsConnecting(false);
    };
  }, [hasJoined, broadcastId, connectToComposite, getCompositeStreamId]);

  return { compositeStream, isConnecting, error };
}
