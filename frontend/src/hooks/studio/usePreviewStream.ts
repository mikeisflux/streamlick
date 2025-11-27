/**
 * usePreviewStream - Hook to send canvas preview stream to guests
 *
 * This hook handles WebRTC peer connections to send the composed canvas
 * output to guests in the greenroom so they can see the live broadcast.
 *
 * KEY BEHAVIOR: Even before "Go Live", when a guest joins the greenroom,
 * we start P2P streaming the canvas preview to them. This allows guests
 * to see what the stream will look like before going live.
 */
import { useEffect, useRef, useCallback } from 'react';
import { socketService } from '../../services/socket.service';
import { canvasStreamService } from '../../services/canvas-stream.service';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface PeerConnection {
  pc: RTCPeerConnection;
  guestSocketId: string;
}

interface PendingRequest {
  guestId: string;
  guestSocketId: string;
}

export function usePreviewStream(broadcastId: string | undefined) {
  // Map of guest socket IDs to their peer connections
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  // Queue of pending preview requests waiting for canvas stream
  const pendingRequestsRef = useRef<PendingRequest[]>([]);
  // Track unsubscribe function for canvas stream ready callback
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Create peer connection and send offer to guest
  const createPeerConnectionForGuest = useCallback(async (guestId: string, guestSocketId: string, canvasStream: MediaStream) => {
    console.log('[PreviewStream] Creating peer connection for guest:', guestId, guestSocketId);

    // Check if we already have a connection for this guest
    if (peerConnectionsRef.current.has(guestSocketId)) {
      console.log('[PreviewStream] Already have connection for guest, skipping:', guestSocketId);
      return;
    }

    // Create a new peer connection for this guest
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add canvas video track to the peer connection
    const videoTrack = canvasStream.getVideoTracks()[0];
    if (videoTrack) {
      pc.addTrack(videoTrack, canvasStream);
      console.log('[PreviewStream] Added video track to peer connection');
    } else {
      console.warn('[PreviewStream] No video track in canvas stream');
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.emit('preview-ice-candidate', {
          targetSocketId: guestSocketId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[PreviewStream] Connection state:', pc.connectionState, 'for guest:', guestSocketId);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        // Clean up this connection
        peerConnectionsRef.current.delete(guestSocketId);
        pc.close();
      }
    };

    // Store the peer connection
    peerConnectionsRef.current.set(guestSocketId, { pc, guestSocketId });

    // Create and send offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketService.emit('preview-offer', {
        guestSocketId,
        offer: pc.localDescription?.toJSON(),
      });
      console.log('[PreviewStream] Sent offer to guest:', guestSocketId);
    } catch (error) {
      console.error('[PreviewStream] Error creating offer:', error);
      peerConnectionsRef.current.delete(guestSocketId);
      pc.close();
    }
  }, []);

  // Handle guest requesting preview stream
  const handlePreviewStreamRequested = useCallback(async ({ guestId, guestSocketId }: { guestId: string; guestSocketId: string }) => {
    console.log('[PreviewStream] Guest requested preview:', guestId, guestSocketId);

    // Get the canvas output stream
    const canvasStream = canvasStreamService.getOutputStream();

    if (canvasStream) {
      // Canvas stream is ready, create peer connection immediately
      await createPeerConnectionForGuest(guestId, guestSocketId, canvasStream);
    } else {
      // Canvas stream not ready yet - queue the request
      console.log('[PreviewStream] Canvas stream not ready, queuing request for guest:', guestSocketId);
      pendingRequestsRef.current.push({ guestId, guestSocketId });

      // Subscribe to be notified when canvas becomes ready (if not already subscribed)
      if (!unsubscribeRef.current) {
        unsubscribeRef.current = canvasStreamService.onStreamReady(async (stream) => {
          console.log('[PreviewStream] Canvas stream now ready, processing', pendingRequestsRef.current.length, 'pending requests');

          // Process all pending requests
          const pending = [...pendingRequestsRef.current];
          pendingRequestsRef.current = [];

          for (const request of pending) {
            await createPeerConnectionForGuest(request.guestId, request.guestSocketId, stream);
          }
        });
      }
    }
  }, [createPeerConnectionForGuest]);

  // Handle answer from guest
  const handlePreviewAnswer = useCallback(async ({ answer, guestSocketId }: { answer: RTCSessionDescriptionInit; guestSocketId: string }) => {
    console.log('[PreviewStream] Received answer from guest:', guestSocketId);

    const connection = peerConnectionsRef.current.get(guestSocketId);
    if (!connection) {
      console.warn('[PreviewStream] No peer connection found for guest:', guestSocketId);
      return;
    }

    try {
      await connection.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('[PreviewStream] Error setting remote description:', error);
    }
  }, []);

  // Handle ICE candidate from guest
  const handlePreviewIceCandidate = useCallback(async ({ candidate, fromSocketId }: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
    const connection = peerConnectionsRef.current.get(fromSocketId);
    if (!connection) {
      console.warn('[PreviewStream] No peer connection found for:', fromSocketId);
      return;
    }

    try {
      await connection.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('[PreviewStream] Error adding ICE candidate:', error);
    }
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    if (!broadcastId) return;

    socketService.on('preview-stream-requested', handlePreviewStreamRequested);
    socketService.on('preview-answer', handlePreviewAnswer);
    socketService.on('preview-ice-candidate', handlePreviewIceCandidate);

    return () => {
      socketService.off('preview-stream-requested', handlePreviewStreamRequested);
      socketService.off('preview-answer', handlePreviewAnswer);
      socketService.off('preview-ice-candidate', handlePreviewIceCandidate);

      // Clean up canvas stream ready subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      // Clear pending requests
      pendingRequestsRef.current = [];

      // Close all peer connections
      peerConnectionsRef.current.forEach(({ pc }) => {
        pc.close();
      });
      peerConnectionsRef.current.clear();
    };
  }, [broadcastId, handlePreviewStreamRequested, handlePreviewAnswer, handlePreviewIceCandidate]);

  return {};
}
