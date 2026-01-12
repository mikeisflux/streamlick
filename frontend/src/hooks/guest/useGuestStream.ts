/**
 * useGuestStream Hook
 *
 * Handles sending the guest's camera/mic to the host via WebRTC P2P.
 * - Creates peer connection and sends stream offer
 * - Handles WebRTC offer/answer/ICE candidate exchange
 * - Active polling to ensure connection (never gives up)
 * - Handles host reconnection requests
 */

import { useEffect, useRef } from 'react';
import { socketService } from '../../services/socket.service';
import { ICE_SERVERS } from '../../utils/webrtc';

const GUEST_STREAM_MAX_RETRIES = 5;
const GUEST_STREAM_RETRY_DELAY = 5000; // 5 seconds - give more time for ICE negotiation
const ACTIVE_POLLING_INTERVAL = 8000; // 8 seconds - less aggressive polling

interface UseGuestStreamOptions {
  hasJoined: boolean;
  broadcastId: string | undefined;
  localStream: MediaStream | null;
}

export function useGuestStream({
  hasJoined,
  broadcastId,
  localStream,
}: UseGuestStreamOptions): void {
  // Refs for peer connection state
  const guestStreamPcRef = useRef<RTCPeerConnection | null>(null);
  const hostStreamSocketIdRef = useRef<string | null>(null);
  const guestStreamAnswerReceivedRef = useRef(false);
  const guestStreamRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const guestStreamRetryCountRef = useRef(0);
  const guestStreamConnectedRef = useRef(false);
  const activePollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Queue for ICE candidates generated before we have the host socket ID
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    if (!hasJoined || !broadcastId || !localStream) return;

    console.log('[GuestStream] Setting up P2P stream to host');
    guestStreamAnswerReceivedRef.current = false;
    guestStreamRetryCountRef.current = 0;
    guestStreamConnectedRef.current = false;

    // Create peer connection and send offer
    const setupGuestStream = async (forceNew = false) => {
      // Check if we should skip creating a new connection
      if (guestStreamPcRef.current && !forceNew) {
        const state = guestStreamPcRef.current.connectionState;
        const iceState = guestStreamPcRef.current.iceConnectionState;

        // Don't close connections that are actively working
        if (state === 'connected') {
          console.log('[GuestStream] Already connected, skipping new connection');
          return;
        }
        if (state === 'connecting' || iceState === 'checking') {
          console.log('[GuestStream] Connection in progress (state:', state, 'ice:', iceState, '), skipping new connection');
          return;
        }
        // If we received an answer and connection is still being set up, wait
        if (guestStreamAnswerReceivedRef.current && (state === 'new' || iceState === 'new')) {
          console.log('[GuestStream] Answer received, ICE negotiation pending, skipping new connection');
          return;
        }
      }

      console.log('[GuestStream] Creating peer connection to send stream to host');

      // Close existing connection if any (for retries)
      if (guestStreamPcRef.current) {
        console.log('[GuestStream] Closing old connection (state:', guestStreamPcRef.current.connectionState, ')');
        guestStreamPcRef.current.close();
      }

      // Clear pending ICE candidates from previous attempt
      pendingIceCandidatesRef.current = [];
      hostStreamSocketIdRef.current = null;
      guestStreamAnswerReceivedRef.current = false;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      guestStreamPcRef.current = pc;

      // Add local tracks
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
        console.log('[GuestStream] Added track:', track.kind);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateJson = event.candidate.toJSON();
          if (hostStreamSocketIdRef.current) {
            // We have the host socket ID, send immediately
            socketService.emit('guest-stream-ice-candidate', {
              targetSocketId: hostStreamSocketIdRef.current,
              candidate: candidateJson,
            });
          } else {
            // Queue the candidate until we receive the answer with host socket ID
            console.log('[GuestStream] Queueing ICE candidate (waiting for host socket ID)');
            pendingIceCandidatesRef.current.push(candidateJson);
          }
        }
      };

      // Handle ICE connection state for debugging
      pc.oniceconnectionstatechange = () => {
        console.log('[GuestStream] ICE connection state:', pc.iceConnectionState);
      };

      // Handle ICE gathering state
      pc.onicegatheringstatechange = () => {
        console.log('[GuestStream] ICE gathering state:', pc.iceGatheringState);
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log('[GuestStream] Connection state:', pc.connectionState, '(ICE:', pc.iceConnectionState, ')');

        // Track when fully connected - stop polling
        if (pc.connectionState === 'connected') {
          console.log('[GuestStream] WebRTC connected! Stopping active polling.');
          guestStreamConnectedRef.current = true;
          if (activePollingIntervalRef.current) {
            clearInterval(activePollingIntervalRef.current);
            activePollingIntervalRef.current = null;
          }
          if (guestStreamRetryTimeoutRef.current) {
            clearTimeout(guestStreamRetryTimeoutRef.current);
            guestStreamRetryTimeoutRef.current = null;
          }
        }

        // If connection failed or disconnected, restart active polling
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.log('[GuestStream] Connection lost, restarting active polling...');
          guestStreamAnswerReceivedRef.current = false;
          guestStreamConnectedRef.current = false;
          guestStreamRetryCountRef.current = 0;
          guestStreamRetryTimeoutRef.current = setTimeout(() => {
            startActivePolling();
          }, 2000);
        }
      };

      // Create and send offer
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        console.log('[GuestStream] Sending offer to host');
        socketService.emit('guest-stream-offer', {
          offer: pc.localDescription?.toJSON(),
        });
      } catch (error) {
        console.error('[GuestStream] Error creating offer:', error);
      }
    };

    // Function to send offer with retry logic (initial burst)
    const sendOfferWithRetry = () => {
      if (!hasJoined || !broadcastId || !localStream) return;
      if (guestStreamConnectedRef.current) return;

      console.log(
        `[GuestStream] Sending offer (attempt ${guestStreamRetryCountRef.current + 1}/${GUEST_STREAM_MAX_RETRIES + 1})...`
      );
      setupGuestStream();

      guestStreamRetryTimeoutRef.current = setTimeout(() => {
        if (guestStreamConnectedRef.current) return;

        if (
          !guestStreamAnswerReceivedRef.current &&
          guestStreamRetryCountRef.current < GUEST_STREAM_MAX_RETRIES
        ) {
          guestStreamRetryCountRef.current++;
          console.log('[GuestStream] No answer received, retrying...');
          sendOfferWithRetry();
        } else if (!guestStreamAnswerReceivedRef.current) {
          console.log('[GuestStream] Initial burst complete, switching to active polling mode...');
          startActivePolling();
        }
      }, GUEST_STREAM_RETRY_DELAY);
    };

    // Active polling - continuously search for host until connected
    const startActivePolling = () => {
      if (guestStreamConnectedRef.current) return;
      if (activePollingIntervalRef.current) return;

      console.log('[GuestStream] Starting active polling - will keep searching for host...');

      // Send an offer immediately (setupGuestStream has guards to prevent closing active connections)
      console.log('[GuestStream] Active poll: attempting initial connection...');
      setupGuestStream();

      // Set up continuous polling
      activePollingIntervalRef.current = setInterval(() => {
        if (guestStreamConnectedRef.current) {
          console.log('[GuestStream] Active poll: connected! Stopping polling.');
          if (activePollingIntervalRef.current) {
            clearInterval(activePollingIntervalRef.current);
            activePollingIntervalRef.current = null;
          }
          return;
        }

        // setupGuestStream has guards to prevent closing connections in progress
        console.log('[GuestStream] Active poll: checking connection...');
        setupGuestStream();
      }, ACTIVE_POLLING_INTERVAL);
    };

    // Handle answer from host
    const handleGuestStreamAnswer = async ({
      answer,
      hostSocketId,
    }: {
      answer: RTCSessionDescriptionInit;
      hostSocketId: string;
    }) => {
      console.log('[GuestStream] Received answer from host - connection in progress');
      guestStreamAnswerReceivedRef.current = true;
      hostStreamSocketIdRef.current = hostSocketId;

      if (guestStreamRetryTimeoutRef.current) {
        clearTimeout(guestStreamRetryTimeoutRef.current);
        guestStreamRetryTimeoutRef.current = null;
      }

      if (!guestStreamPcRef.current) {
        console.warn('[GuestStream] No peer connection for answer');
        return;
      }

      try {
        await guestStreamPcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('[GuestStream] Remote description set successfully, waiting for WebRTC connection...');

        // Flush any queued ICE candidates now that we have the host socket ID
        if (pendingIceCandidatesRef.current.length > 0) {
          console.log(`[GuestStream] Flushing ${pendingIceCandidatesRef.current.length} queued ICE candidates`);
          pendingIceCandidatesRef.current.forEach((candidate) => {
            socketService.emit('guest-stream-ice-candidate', {
              targetSocketId: hostStreamSocketIdRef.current,
              candidate,
            });
          });
          pendingIceCandidatesRef.current = [];
        }
      } catch (error) {
        console.error('[GuestStream] Error setting remote description:', error);
        guestStreamAnswerReceivedRef.current = false;
      }
    };

    // Handle ICE candidate from host
    const handleGuestStreamIceCandidate = async ({
      candidate,
    }: {
      candidate: RTCIceCandidateInit;
    }) => {
      if (!guestStreamPcRef.current) return;

      try {
        await guestStreamPcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('[GuestStream] Error adding ICE candidate:', error);
      }
    };

    // Handle request from host to resend stream offer
    const handleResendStreamOffer = () => {
      console.log('[GuestStream] Host requested stream offer resend');

      // If already connected, ignore to prevent flickering
      if (guestStreamConnectedRef.current && guestStreamPcRef.current) {
        const state = guestStreamPcRef.current.connectionState;
        if (state === 'connected') {
          console.log(
            '[GuestStream] Already connected with active stream, ignoring resend request to prevent flickering'
          );
          return;
        }
      }

      console.log('[GuestStream] Not connected, proceeding with resend...');
      guestStreamAnswerReceivedRef.current = false;
      guestStreamRetryCountRef.current = 0;

      if (guestStreamRetryTimeoutRef.current) {
        clearTimeout(guestStreamRetryTimeoutRef.current);
        guestStreamRetryTimeoutRef.current = null;
      }

      if (activePollingIntervalRef.current) {
        clearInterval(activePollingIntervalRef.current);
        activePollingIntervalRef.current = null;
      }

      sendOfferWithRetry();

      // Re-emit join-greenroom to ensure host gets the notification
      if (broadcastId) {
        console.log('[GuestStream] Re-emitting join-greenroom for host');
        socketService.emit('join-greenroom', { broadcastId });
      }
    };

    socketService.on('guest-stream-answer', handleGuestStreamAnswer);
    socketService.on('guest-stream-ice-candidate', handleGuestStreamIceCandidate);
    socketService.on('resend-stream-offer', handleResendStreamOffer);

    // Small delay then start with retry logic
    const timeout = setTimeout(() => {
      sendOfferWithRetry();
    }, 500);

    return () => {
      clearTimeout(timeout);
      if (guestStreamRetryTimeoutRef.current) {
        clearTimeout(guestStreamRetryTimeoutRef.current);
        guestStreamRetryTimeoutRef.current = null;
      }
      if (activePollingIntervalRef.current) {
        clearInterval(activePollingIntervalRef.current);
        activePollingIntervalRef.current = null;
      }
      guestStreamConnectedRef.current = false;

      socketService.off('guest-stream-answer', handleGuestStreamAnswer);
      socketService.off('guest-stream-ice-candidate', handleGuestStreamIceCandidate);
      socketService.off('resend-stream-offer', handleResendStreamOffer);

      if (guestStreamPcRef.current) {
        guestStreamPcRef.current.close();
        guestStreamPcRef.current = null;
      }
    };
  }, [hasJoined, broadcastId, localStream]);
}
