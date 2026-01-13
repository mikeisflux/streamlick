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
import { ICE_SERVERS } from '../../utils/webrtc';

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

    // Check if we already have a working connection - ignore new offer to prevent flickering
    const existing = connectionsRef.current.get(participantId);
    if (existing) {
      const state = existing.pc.connectionState;
      // CRITICAL: Include 'new' state - connection is being set up, don't interrupt it
      // This prevents duplicate offers from causing connection recreation and flickering
      if (state === 'connected' || state === 'connecting' || state === 'new') {
        console.log('[GuestStreams] Already have active connection for', participantId, '- ignoring offer (state:', state, ')');
        return;
      }
      // Only close if connection is actually broken (failed/closed/disconnected)
      console.log('[GuestStreams] Closing broken connection for', participantId, '- state:', state);
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
    // Track disconnected timeout to avoid premature stream removal
    let disconnectedTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempted = false;

    pc.onconnectionstatechange = () => {
      console.log('[GuestStreams] Connection state for', participantId, ':', pc.connectionState);

      // Clear any pending disconnected timeout
      if (disconnectedTimeout) {
        clearTimeout(disconnectedTimeout);
        disconnectedTimeout = null;
      }

      if (pc.connectionState === 'disconnected') {
        // IMPORTANT: 'disconnected' can be temporary - ICE may reconnect
        // Wait 5 seconds, then request guest to reconnect
        console.log('[GuestStreams] Connection disconnected, waiting 5s for recovery...');
        disconnectedTimeout = setTimeout(() => {
          // Check if still disconnected (might have recovered)
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            if (!reconnectAttempted) {
              // Ask guest to reconnect instead of just removing the stream
              console.log('[GuestStreams] Connection did not recover, requesting guest to reconnect');
              reconnectAttempted = true;
              socketService.emit('request-guest-reconnect', { participantId, guestSocketId });
              // Give guest 10 more seconds to reconnect
              disconnectedTimeout = setTimeout(() => {
                if (pc.connectionState !== 'connected') {
                  console.log('[GuestStreams] Guest did not reconnect, removing stream');
                  connectionsRef.current.delete(participantId);
                  onStreamRemoved(participantId);
                }
              }, 10000);
            }
          } else if (pc.connectionState === 'closed') {
            connectionsRef.current.delete(participantId);
            onStreamRemoved(participantId);
          } else {
            console.log('[GuestStreams] Connection recovered to:', pc.connectionState);
            reconnectAttempted = false;
          }
        }, 5000);
      } else if (pc.connectionState === 'failed') {
        // Failed state - try to request reconnection before removing
        if (!reconnectAttempted) {
          console.log('[GuestStreams] Connection failed, requesting guest to reconnect');
          reconnectAttempted = true;
          socketService.emit('request-guest-reconnect', { participantId, guestSocketId });
          // Give guest 10 seconds to reconnect
          disconnectedTimeout = setTimeout(() => {
            if (pc.connectionState !== 'connected') {
              console.log('[GuestStreams] Guest did not reconnect after failure, removing stream');
              connectionsRef.current.delete(participantId);
              onStreamRemoved(participantId);
            }
          }, 10000);
        }
      } else if (pc.connectionState === 'closed') {
        connectionsRef.current.delete(participantId);
        onStreamRemoved(participantId);
      } else if (pc.connectionState === 'connected') {
        console.log('[GuestStreams] Connection established successfully for', participantId);
        reconnectAttempted = false;
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
