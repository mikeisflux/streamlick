/**
 * useGuestStream Hook
 *
 * Handles sending the guest's camera/mic to the host via WebRTC P2P.
 * - Creates peer connection and sends stream offer on join
 * - Handles WebRTC offer/answer/ICE candidate exchange
 * - Event-driven: backend triggers resend when host joins (no polling)
 */

import { useEffect, useRef } from 'react';
import { socketService } from '../../services/socket.service';
import { ICE_SERVERS } from '../../utils/webrtc';

const GUEST_STREAM_MAX_RETRIES = 3;
const GUEST_STREAM_RETRY_DELAY = 3000; // 3 seconds between retries

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
      // Track auto-reconnect state to prevent multiple reconnect attempts
      let autoReconnectScheduled = false;

      pc.onconnectionstatechange = () => {
        console.log('[GuestStream] Connection state:', pc.connectionState, '(ICE:', pc.iceConnectionState, ')');

        // Track when fully connected
        if (pc.connectionState === 'connected') {
          console.log('[GuestStream] WebRTC connected!');
          guestStreamConnectedRef.current = true;
          autoReconnectScheduled = false;
          if (guestStreamRetryTimeoutRef.current) {
            clearTimeout(guestStreamRetryTimeoutRef.current);
            guestStreamRetryTimeoutRef.current = null;
          }
        }

        // If connection failed or disconnected, automatically try to reconnect
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.log('[GuestStream] Connection lost, scheduling auto-reconnect...');
          guestStreamAnswerReceivedRef.current = false;
          guestStreamConnectedRef.current = false;

          // Auto-reconnect after 5 seconds if not already scheduled
          if (!autoReconnectScheduled) {
            autoReconnectScheduled = true;
            setTimeout(() => {
              // Only reconnect if still disconnected/failed and component is still mounted
              if (!guestStreamConnectedRef.current && hasJoined && broadcastId && localStream) {
                const currentState = guestStreamPcRef.current?.connectionState;
                if (currentState === 'disconnected' || currentState === 'failed' || !guestStreamPcRef.current) {
                  console.log('[GuestStream] Auto-reconnecting after connection loss...');
                  setupGuestStream(true);
                }
              }
            }, 5000);
          }
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
          // Stop retrying - backend will trigger resend when host joins
          console.log('[GuestStream] Max retries reached, waiting for host to trigger resend...');
        }
      }, GUEST_STREAM_RETRY_DELAY);
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

      // Check current connection state
      if (guestStreamPcRef.current) {
        const state = guestStreamPcRef.current.connectionState;
        const iceState = guestStreamPcRef.current.iceConnectionState;

        // If truly connected and working, ignore to prevent flickering
        if (state === 'connected' && guestStreamConnectedRef.current) {
          console.log(
            '[GuestStream] Already connected with active stream, ignoring resend request to prevent flickering'
          );
          return;
        }

        // If connection is frozen (disconnected/failed), force a new connection
        if (state === 'disconnected' || state === 'failed' || iceState === 'disconnected' || iceState === 'failed') {
          console.log('[GuestStream] Connection frozen (state:', state, ', ice:', iceState, '), forcing new connection');
          // Close the old frozen connection
          guestStreamPcRef.current.close();
          guestStreamPcRef.current = null;
          guestStreamConnectedRef.current = false;
        }
      }

      console.log('[GuestStream] Proceeding with resend...');
      guestStreamAnswerReceivedRef.current = false;
      guestStreamRetryCountRef.current = 0;

      if (guestStreamRetryTimeoutRef.current) {
        clearTimeout(guestStreamRetryTimeoutRef.current);
        guestStreamRetryTimeoutRef.current = null;
      }

      // Force create a new connection
      setupGuestStream(true);

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
