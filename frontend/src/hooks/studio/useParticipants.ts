import { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from '../../services/socket.service';
import { compositorService } from '../../services/compositor.service';
import toast from 'react-hot-toast';
import api from '../../services/api';

interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  role: 'host' | 'guest' | 'backstage';
}

interface ChatMessage {
  author: string;
  message: string;
  timestamp: number;
}

interface UseParticipantsProps {
  broadcastId: string | undefined;
  showChatOnStream: boolean;
}

// Combined polling interval in milliseconds (5 seconds)
// This polls for participants AND requests streams in one operation
// IMPORTANT: Increased from 3s to 5s to reduce connection churn and flickering
const POLL_INTERVAL = 5000;

// Track last stream request time to debounce requests
let lastStreamRequestTime = 0;
const STREAM_REQUEST_DEBOUNCE = 10000; // Only request streams every 10 seconds max

export function useParticipants({ broadcastId, showChatOnStream }: UseParticipantsProps) {
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [viewerCounts, setViewerCounts] = useState({
    total: 0,
    youtube: 0,
    facebook: 0,
    twitch: 0,
    x: 0,
    rumble: 0,
    linkedin: 0,
  });

  // Track known participant IDs to detect new joins
  const knownParticipantIdsRef = useRef<Set<string>>(new Set());

  // HTTP polling for greenroom participants - this is the PRIMARY mechanism
  // Socket events are supplementary for real-time updates
  // IMPORTANT: This polling NEVER stops - it continuously:
  //   1. Polls for new participants every 3 seconds
  //   2. Requests streams from ANY participant without video
  //   This ensures we always pick up new guests and retry failed connections
  useEffect(() => {
    if (!broadcastId) return;

    let isMounted = true;

    const pollParticipants = async () => {
      try {
        const response = await api.get(`/broadcasts/${broadcastId}/greenroom-participants`);
        if (!isMounted) return;

        const { participants } = response.data as { participants: Array<{ id: string; name: string; role: string; audioEnabled: boolean; videoEnabled: boolean }> };

        // Detect new participants that we haven't seen before
        const currentIds = new Set(participants.map(p => p.id));
        const newParticipants = participants.filter(p => !knownParticipantIdsRef.current.has(p.id));

        // Show toast for new participants
        for (const p of newParticipants) {
          console.log('[useParticipants] Poll detected new participant:', p.name);
          toast.success(`${p.name || 'A guest'} joined the greenroom`);
        }

        // Update known IDs
        knownParticipantIdsRef.current = currentIds;

        // Update state - merge with existing to preserve streams
        // Track if we need to request streams (outside the setter)
        let shouldRequestStreams = false;
        let participantsWithoutStreams: string[] = [];

        setRemoteParticipants((prev) => {
          const updated = new Map<string, RemoteParticipant>();

          // Add all participants from the poll
          for (const p of participants) {
            const existing = prev.get(p.id);
            const hasStream = existing?.stream || null;
            // Check if this participant needs a stream
            if (!hasStream && p.videoEnabled) {
              shouldRequestStreams = true;
              participantsWithoutStreams.push(p.name || p.id);
            }
            updated.set(p.id, {
              id: p.id,
              name: p.name,
              stream: hasStream, // Preserve existing stream
              audioEnabled: p.audioEnabled,
              videoEnabled: p.videoEnabled,
              role: p.role as 'host' | 'guest' | 'backstage',
            });
          }

          return updated;
        });

        // COMBINED POLL: Request streams if any participant is missing one
        // But debounce to prevent constant reconnection causing flickering
        const now = Date.now();
        if (shouldRequestStreams && (now - lastStreamRequestTime) > STREAM_REQUEST_DEBOUNCE) {
          console.log('[useParticipants] Poll: requesting streams for participants without video:', participantsWithoutStreams);
          socketService.emit('request-guest-streams');
          lastStreamRequestTime = now;
        } else if (shouldRequestStreams) {
          console.log('[useParticipants] Poll: skipping stream request (debounce), participants without video:', participantsWithoutStreams);
        }
      } catch (error) {
        // Don't log 401/403 errors as they're expected when not authenticated
        if ((error as any)?.response?.status !== 401 && (error as any)?.response?.status !== 403) {
          console.error('[useParticipants] Poll error:', error);
        }
      }
    };

    // Initial poll immediately
    pollParticipants();

    // Set up polling interval
    const pollInterval = setInterval(pollParticipants, POLL_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [broadcastId]);

  // Socket event handlers (supplementary to polling for real-time updates)
  // Polling is the PRIMARY mechanism, socket events provide faster updates when they work
  useEffect(() => {
    // Handle initial state sync from server when host joins
    // Note: Polling will also pick these up, but socket sync is faster on initial load
    const handleParticipantsSync = ({ participants }: { participants: Array<{ id: string; name: string; role: string; audioEnabled: boolean; videoEnabled: boolean }> }) => {
      console.log('[useParticipants] Received participants-sync with', participants.length, 'participants');

      // Update knownParticipantIdsRef to prevent duplicate toasts from polling
      for (const p of participants) {
        knownParticipantIdsRef.current.add(p.id);
      }

      // Don't show toast here - polling will handle notifications
      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        for (const p of participants) {
          const existing = prev.get(p.id);
          updated.set(p.id, {
            id: p.id,
            name: p.name,
            stream: existing?.stream || null, // Preserve existing stream
            audioEnabled: p.audioEnabled,
            videoEnabled: p.videoEnabled,
            role: p.role as 'host' | 'guest' | 'backstage',
          });
        }
        return updated;
      });
    };

    const handleParticipantJoined = async ({ participantId }: any) => {
      // Only show toast if we haven't seen this participant yet (from polling)
      if (!knownParticipantIdsRef.current.has(participantId)) {
        toast.success('A participant joined');
        knownParticipantIdsRef.current.add(participantId);
      }

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const existing = prev.get(participantId);
        updated.set(participantId, {
          id: participantId,
          name: existing?.name || `Guest ${updated.size + 1}`,
          stream: existing?.stream || null,
          audioEnabled: true,
          videoEnabled: true,
          role: 'backstage', // New participants start in backstage by default
        });
        return updated;
      });
    };

    // Handle greenroom participant joined - set role to 'backstage' until promoted to live
    // IMPORTANT: Greenroom participants start as 'backstage' and become 'guest' when promoted
    // This allows the "Add to Stage" button to actually do something (promote backstage -> guest)
    const handleGreenroomParticipantJoined = ({ participantId, name }: any) => {
      // Only show toast if we haven't seen this participant yet (from polling)
      if (!knownParticipantIdsRef.current.has(participantId)) {
        console.log('[useParticipants] Socket: new greenroom participant', name);
        toast.success(`${name || 'A guest'} joined the greenroom`);
        knownParticipantIdsRef.current.add(participantId);
      }

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(participantId);
        if (existing) {
          // Keep existing role if already promoted to 'guest' (on stage)
          // Only update to 'backstage' if they don't have a role yet or are still backstage
          if (existing.role !== 'guest') {
            existing.role = 'backstage';
          }
          existing.name = name || existing.name;
          updated.set(participantId, existing);
        } else {
          // Add new participant with backstage role (greenroom = backstage until promoted)
          updated.set(participantId, {
            id: participantId,
            name: name || `Guest ${updated.size + 1}`,
            stream: null,
            audioEnabled: true,
            videoEnabled: true,
            role: 'backstage', // Greenroom participants start as backstage, promoted to 'guest' to go on stage
          });
        }
        return updated;
      });
    };

    // Handle greenroom participant left
    const handleGreenroomParticipantLeft = ({ participantId }: any) => {
      // Remove from known IDs so we can detect if they rejoin
      knownParticipantIdsRef.current.delete(participantId);
      toast.success('A guest left the greenroom');

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        updated.delete(participantId);
        return updated;
      });
    };

    const handleParticipantLeft = ({ participantId }: any) => {
      knownParticipantIdsRef.current.delete(participantId);
      toast.success('A participant left');

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        updated.delete(participantId);
        return updated;
      });
    };

    // Handle participant disconnected (socket disconnect, page close, etc.)
    const handleParticipantDisconnected = ({ participantId }: any) => {
      console.log('[useParticipants] Participant disconnected:', participantId);
      knownParticipantIdsRef.current.delete(participantId);

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        updated.delete(participantId);
        return updated;
      });
    };

    const handleMediaStateChanged = ({ participantId, audio, video }: any) => {
      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const participant = updated.get(participantId);
        if (participant) {
          participant.audioEnabled = audio;
          participant.videoEnabled = video;
          updated.set(participantId, participant);
        }
        return updated;
      });
    };

    const handleChatMessage = (message: ChatMessage) => {
      setChatMessages((prev) => [...prev, message]);

      // Add to compositor if chat display is enabled
      if (showChatOnStream) {
        compositorService.addChatMessage({
          id: Date.now().toString(),
          platform: 'youtube', // Default platform, can be enhanced later
          author: message.author,
          message: message.message,
          timestamp: new Date(message.timestamp)
        });
      }
    };

    const handleParticipantPromoted = ({ participantId, role }: any) => {
      toast.success('Participant moved to live!');
      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const participant = updated.get(participantId);
        if (participant) {
          participant.role = role;
        }
        return updated;
      });
    };

    const handleParticipantDemoted = ({ participantId, role }: any) => {
      toast.success('Participant moved to backstage');
      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const participant = updated.get(participantId);
        if (participant) {
          participant.role = role;
        }
        return updated;
      });
    };

    const handleViewerCountUpdate = (counts: any) => {
      setViewerCounts({
        total: counts.total || 0,
        youtube: counts.youtube || 0,
        facebook: counts.facebook || 0,
        twitch: counts.twitch || 0,
        x: counts.x || 0,
        rumble: counts.rumble || 0,
        linkedin: counts.linkedin || 0,
      });
    };

    socketService.on('participants-sync', handleParticipantsSync);
    socketService.on('participant-joined', handleParticipantJoined);
    socketService.on('participant-left', handleParticipantLeft);
    socketService.on('participant-disconnected', handleParticipantDisconnected);
    socketService.on('media-state-changed', handleMediaStateChanged);
    socketService.on('chat-message', handleChatMessage);
    socketService.on('participant-promoted', handleParticipantPromoted);
    socketService.on('participant-demoted', handleParticipantDemoted);
    socketService.on('viewer-count-update', handleViewerCountUpdate);
    // Greenroom events - so host can see guests waiting in greenroom
    socketService.on('greenroom-participant-joined', handleGreenroomParticipantJoined);
    socketService.on('greenroom-participant-left', handleGreenroomParticipantLeft);

    return () => {
      socketService.off('participants-sync', handleParticipantsSync);
      socketService.off('participant-joined', handleParticipantJoined);
      socketService.off('participant-left', handleParticipantLeft);
      socketService.off('participant-disconnected', handleParticipantDisconnected);
      socketService.off('media-state-changed', handleMediaStateChanged);
      socketService.off('chat-message', handleChatMessage);
      socketService.off('participant-promoted', handleParticipantPromoted);
      socketService.off('participant-demoted', handleParticipantDemoted);
      socketService.off('viewer-count-update', handleViewerCountUpdate);
      socketService.off('greenroom-participant-joined', handleGreenroomParticipantJoined);
      socketService.off('greenroom-participant-left', handleGreenroomParticipantLeft);
    };
  }, [showChatOnStream]);

  // Participant management actions
  const handlePromoteToLive = useCallback((participantId: string) => {
    socketService.emit('promote-to-live', { participantId });
  }, []);

  const handleDemoteToBackstage = useCallback((participantId: string) => {
    socketService.emit('demote-to-backstage', { participantId });
  }, []);

  const handleMuteParticipant = useCallback((participantId: string) => {
    socketService.emit('mute-participant', {
      broadcastId,
      participantId,
    });
    toast.success('Participant muted');
  }, [broadcastId]);

  const handleUnmuteParticipant = useCallback((participantId: string) => {
    socketService.emit('unmute-participant', {
      broadcastId,
      participantId,
    });
    toast.success('Participant unmuted');
  }, [broadcastId]);

  const handleKickParticipant = useCallback((participantId: string, participantName: string) => {
    if (!confirm(`Kick ${participantName} from the broadcast?`)) return;

    socketService.emit('kick-participant', {
      broadcastId,
      participantId,
    });

    setRemoteParticipants((prev) => {
      const updated = new Map(prev);
      updated.delete(participantId);
      return updated;
    });

    toast.success(`${participantName} has been kicked`);
  }, [broadcastId]);

  const handleBanParticipant = useCallback(async (participantId: string, participantName: string) => {
    if (!confirm(`Ban ${participantName} permanently? They will not be able to rejoin this broadcast.`))
      return;

    try {
      // Save ban to backend
      await api.post(`/broadcasts/${broadcastId}/ban`, {
        participantId,
      });

      socketService.emit('ban-participant', {
        broadcastId,
        participantId,
      });

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        updated.delete(participantId);
        return updated;
      });

      toast.success(`${participantName} has been banned`);
    } catch (error) {
      console.error('Failed to ban participant:', error);
      toast.error('Failed to ban participant');
    }
  }, [broadcastId]);

  const handleVolumeChange = useCallback((participantId: string, volume: number) => {
    socketService.emit('set-participant-volume', {
      broadcastId,
      participantId,
      volume,
    });
  }, [broadcastId]);

  return {
    remoteParticipants,
    chatMessages,
    viewerCounts,
    handlePromoteToLive,
    handleDemoteToBackstage,
    handleMuteParticipant,
    handleUnmuteParticipant,
    handleKickParticipant,
    handleBanParticipant,
    handleVolumeChange,
    setRemoteParticipants,
    setChatMessages,
  };
}
