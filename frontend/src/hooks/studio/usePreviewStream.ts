/**
 * usePreviewStream - Hook to send canvas preview stream to guests
 *
 * This hook handles WebRTC peer connections to send the composed canvas
 * output to guests in the greenroom so they can see the live broadcast.
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

export function usePreviewStream(broadcastId: string | undefined) {
  // Map of guest socket IDs to their peer connections
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());

  // Handle guest requesting preview stream
  const handlePreviewStreamRequested = useCallback(async ({ guestId, guestSocketId }: { guestId: string; guestSocketId: string }) => {
    console.log('[PreviewStream] Guest requested preview:', guestId, guestSocketId);

    // Get the canvas output stream
    const canvasStream = canvasStreamService.getOutputStream();
    if (!canvasStream) {
      console.warn('[PreviewStream] No canvas stream available');
      return;
    }

    // Create a new peer connection for this guest
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add canvas video track to the peer connection
    const videoTrack = canvasStream.getVideoTracks()[0];
    if (videoTrack) {
      pc.addTrack(videoTrack, canvasStream);
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
    } catch (error) {
      console.error('[PreviewStream] Error creating offer:', error);
      peerConnectionsRef.current.delete(guestSocketId);
      pc.close();
    }
  }, []);

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

      // Close all peer connections
      peerConnectionsRef.current.forEach(({ pc }) => {
        pc.close();
      });
      peerConnectionsRef.current.clear();
    };
  }, [broadcastId, handlePreviewStreamRequested, handlePreviewAnswer, handlePreviewIceCandidate]);

  return {};
}
