/**
 * usePreviewStream Hook
 *
 * Handles receiving the host's preview stream via WebRTC.
 * - Requests preview stream from host
 * - Handles WebRTC offer/answer/ICE candidate exchange
 * - Automatic retry logic for connection establishment
 * - Reconnection on connection failure
 */

import { useEffect, useRef, useState } from 'react';
import { socketService } from '../../services/socket.service';
import { ICE_SERVERS } from '../../utils/webrtc';

const MAX_RETRIES = 5;
const RETRY_DELAY = 3000; // 3 seconds

interface UsePreviewStreamOptions {
  hasJoined: boolean;
  broadcastId: string | undefined;
}

interface UsePreviewStreamResult {
  broadcastStream: MediaStream | null;
}

export function usePreviewStream({
  hasJoined,
  broadcastId,
}: UsePreviewStreamOptions): UsePreviewStreamResult {
  const [broadcastStream, setBroadcastStream] = useState<MediaStream | null>(null);

  // Refs for peer connection state
  const previewPcRef = useRef<RTCPeerConnection | null>(null);
  const hostSocketIdRef = useRef<string | null>(null);
  const offerReceivedRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!hasJoined || !broadcastId) return;

    offerReceivedRef.current = false;
    retryCountRef.current = 0;

    // Handle WebRTC offer from host
    const handlePreviewOffer = async ({
      offer,
      hostSocketId,
    }: {
      offer: RTCSessionDescriptionInit;
      hostSocketId: string;
    }) => {
      console.log('[PreviewStream] Received offer from host');
      offerReceivedRef.current = true;
      hostSocketIdRef.current = hostSocketId;

      // Clear any retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      // Close existing peer connection if any
      if (previewPcRef.current) {
        previewPcRef.current.close();
      }

      // Create peer connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      previewPcRef.current = pc;

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log('[PreviewStream] Received track:', event.track.kind);
        // DEBUG: Log detailed track info (explicit values)
        console.log('[PreviewStream] Track details: trackId=' + event.track.id +
          ', kind=' + event.track.kind +
          ', label=' + event.track.label +
          ', enabled=' + event.track.enabled +
          ', muted=' + event.track.muted +
          ', readyState=' + event.track.readyState);

        // Only set broadcast stream for VIDEO tracks
        // Audio tracks arrive in separate streams and would overwrite the video stream
        if (event.track.kind === 'video' && event.streams && event.streams[0]) {
          const stream = event.streams[0];
          // DEBUG: Log stream details (explicit values)
          console.log('[PreviewStream] Setting video stream: streamId=' + stream.id +
            ', active=' + stream.active +
            ', videoTracks=' + stream.getVideoTracks().length +
            ', audioTracks=' + stream.getAudioTracks().length);
          setBroadcastStream(stream);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && hostSocketIdRef.current) {
          socketService.emit('preview-ice-candidate', {
            targetSocketId: hostSocketIdRef.current,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // DEBUG: Monitor WebRTC stats to verify frames are being received
      let statsInterval: ReturnType<typeof setInterval> | null = null;

      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log('[PreviewStream] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          console.log('[PreviewStream] Preview stream connected successfully!');
          // Start stats monitoring when connected
          statsInterval = setInterval(async () => {
            try {
              const stats = await pc.getStats();
              stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                  // Log explicit values, not object reference
                  console.log('[PreviewStream] Video receive stats: framesReceived=' + report.framesReceived +
                    ', framesDecoded=' + report.framesDecoded +
                    ', bytesReceived=' + report.bytesReceived +
                    ', packetsReceived=' + report.packetsReceived +
                    ', packetsLost=' + report.packetsLost);
                }
              });
            } catch (e) {
              // Ignore errors when connection is closed
            }
          }, 5000);
        }
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
          }
          setBroadcastStream(null);
          offerReceivedRef.current = false;
          // Try to reconnect after a delay
          setTimeout(() => {
            if (hasJoined && broadcastId) {
              console.log('[PreviewStream] Reconnecting...');
              retryCountRef.current = 0;
              socketService.emit('request-preview-stream', { broadcastId });
            }
          }, 2000);
        }
      };

      // Handle ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log('[PreviewStream] ICE connection state:', pc.iceConnectionState);
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketService.emit('preview-answer', {
          hostSocketId,
          answer: pc.localDescription?.toJSON(),
        });
      } catch (error) {
        console.error('[PreviewStream] Error handling offer:', error);
      }
    };

    // Handle ICE candidate from host
    const handlePreviewIceCandidate = async ({
      candidate,
    }: {
      candidate: RTCIceCandidateInit;
      fromSocketId: string;
    }) => {
      if (!previewPcRef.current) return;

      try {
        await previewPcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('[PreviewStream] Error adding ICE candidate:', error);
      }
    };

    // Function to request preview stream with retry logic
    const requestPreviewWithRetry = () => {
      if (!hasJoined || !broadcastId) return;

      console.log(
        `[PreviewStream] Requesting preview stream (attempt ${retryCountRef.current + 1}/${MAX_RETRIES + 1})...`
      );
      socketService.emit('request-preview-stream', { broadcastId });

      // Set up retry if no offer received
      retryTimeoutRef.current = setTimeout(() => {
        if (!offerReceivedRef.current && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          console.log('[PreviewStream] No offer received, retrying...');
          requestPreviewWithRetry();
        } else if (!offerReceivedRef.current) {
          console.warn('[PreviewStream] Max retries reached, preview stream unavailable');
        }
      }, RETRY_DELAY);
    };

    socketService.on('preview-offer', handlePreviewOffer);
    socketService.on('preview-ice-candidate', handlePreviewIceCandidate);

    // Request preview stream from host with retry logic
    requestPreviewWithRetry();

    return () => {
      socketService.off('preview-offer', handlePreviewOffer);
      socketService.off('preview-ice-candidate', handlePreviewIceCandidate);

      // Clear retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      // Close peer connection
      if (previewPcRef.current) {
        previewPcRef.current.close();
        previewPcRef.current = null;
      }
    };
  }, [hasJoined, broadcastId]);

  return { broadcastStream };
}
