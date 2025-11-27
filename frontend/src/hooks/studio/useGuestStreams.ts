/**
 * useGuestStreams - P2P WebRTC hook for receiving guest video streams
 *
 * This hook handles direct peer-to-peer WebRTC connections with guests.
 * When a guest joins, they initiate a WebRTC connection to send their
 * camera/mic to the host. The host receives these streams and can
 * composite them on the canvas.
 *
 * Flow:
 * 1. Guest joins greenroom → emits 'guest-stream-offer' with their video
 * 2. Host receives offer → creates answer → sends back
 * 3. ICE candidates exchanged
 * 4. Host receives guest's video track via ontrack
 * 5. Stream is passed to useParticipants to update participant.stream
 */
import { useEffect, useRef, useCallback } from 'react';
import { socketService } from '../../services/socket.service';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface GuestConnection {
  pc: RTCPeerConnection;
  participantId: string;
  guestSocketId: string;
  stream: MediaStream | null;
}

type StreamReceivedCallback = (participantId: string, stream: MediaStream) => void;
type StreamRemovedCallback = (participantId: string) => void;

export function useGuestStreams(
  broadcastId: string | undefined,
  onStreamReceived: StreamReceivedCallback,
  onStreamRemoved: StreamRemovedCallback
) {
  // Map of participant IDs to their peer connections
  const connectionsRef = useRef<Map<string, GuestConnection>>(new Map());

  // Handle WebRTC offer from guest (guest is sending their camera to us)
  const handleGuestStreamOffer = useCallback(async ({
    participantId,
    guestSocketId,
    offer,
  }: {
    participantId: string;
    guestSocketId: string;
    offer: RTCSessionDescriptionInit;
  }) => {
    console.log('[GuestStreams] Received offer from guest:', participantId);

    // Close existing connection for this participant if any
    const existing = connectionsRef.current.get(participantId);
    if (existing) {
      existing.pc.close();
      connectionsRef.current.delete(participantId);
    }

    // Create new peer connection
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const connection: GuestConnection = {
      pc,
      participantId,
      guestSocketId,
      stream: null,
    };

    connectionsRef.current.set(participantId, connection);

    // Handle incoming tracks from guest
    pc.ontrack = (event) => {
      console.log('[GuestStreams] Received track from guest:', participantId, event.track.kind);

      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        connection.stream = stream;

        // Notify parent component about the new stream
        onStreamReceived(participantId, stream);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.emit('guest-stream-ice-candidate', {
          targetSocketId: guestSocketId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[GuestStreams] Connection state for', participantId, ':', pc.connectionState);

      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        // Clean up and notify
        connectionsRef.current.delete(participantId);
        onStreamRemoved(participantId);
      }
    };

    try {
      // Set remote description (guest's offer)
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketService.emit('guest-stream-answer', {
        guestSocketId,
        participantId,
        answer: pc.localDescription?.toJSON(),
      });

      console.log('[GuestStreams] Sent answer to guest:', participantId);
    } catch (error) {
      console.error('[GuestStreams] Error handling offer from', participantId, ':', error);
      pc.close();
      connectionsRef.current.delete(participantId);
    }
  }, [onStreamReceived, onStreamRemoved]);

  // Handle ICE candidate from guest
  const handleGuestStreamIceCandidate = useCallback(async ({
    participantId,
    candidate,
  }: {
    participantId: string;
    candidate: RTCIceCandidateInit;
  }) => {
    const connection = connectionsRef.current.get(participantId);
    if (!connection) {
      console.warn('[GuestStreams] No connection for ICE candidate from:', participantId);
      return;
    }

    try {
      await connection.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('[GuestStreams] Error adding ICE candidate:', error);
    }
  }, []);

  // Handle guest leaving - clean up their connection
  const handleGuestLeft = useCallback(({ participantId }: { participantId: string }) => {
    const connection = connectionsRef.current.get(participantId);
    if (connection) {
      console.log('[GuestStreams] Guest left, closing connection:', participantId);
      connection.pc.close();
      connectionsRef.current.delete(participantId);
      onStreamRemoved(participantId);
    }
  }, [onStreamRemoved]);

  // Set up socket event listeners
  useEffect(() => {
    if (!broadcastId) return;

    console.log('[GuestStreams] Setting up P2P stream listeners for broadcast:', broadcastId);

    socketService.on('guest-stream-offer', handleGuestStreamOffer);
    socketService.on('guest-stream-ice-candidate', handleGuestStreamIceCandidate);
    socketService.on('greenroom-participant-left', handleGuestLeft);
    socketService.on('participant-disconnected', handleGuestLeft);

    return () => {
      socketService.off('guest-stream-offer', handleGuestStreamOffer);
      socketService.off('guest-stream-ice-candidate', handleGuestStreamIceCandidate);
      socketService.off('greenroom-participant-left', handleGuestLeft);
      socketService.off('participant-disconnected', handleGuestLeft);

      // Close all peer connections on cleanup
      connectionsRef.current.forEach(({ pc, participantId }) => {
        console.log('[GuestStreams] Closing connection for:', participantId);
        pc.close();
      });
      connectionsRef.current.clear();
    };
  }, [broadcastId, handleGuestStreamOffer, handleGuestStreamIceCandidate, handleGuestLeft]);

  // Return method to manually close a guest's connection
  const closeGuestConnection = useCallback((participantId: string) => {
    const connection = connectionsRef.current.get(participantId);
    if (connection) {
      connection.pc.close();
      connectionsRef.current.delete(participantId);
    }
  }, []);

  return {
    closeGuestConnection,
  };
}
