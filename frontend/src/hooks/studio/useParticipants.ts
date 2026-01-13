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

  // Track known participant IDs to prevent duplicate toasts
  const knownParticipantIdsRef = useRef<Set<string>>(new Set());
  const initialFetchDoneRef = useRef<boolean>(false);

  // ONE-TIME initial fetch on mount to catch guests that joined before host
  // After this, ALL updates come through socket events - NO POLLING
  useEffect(() => {
    if (!broadcastId || initialFetchDoneRef.current) return;

    let isMounted = true;

    const fetchInitialParticipants = async () => {
      try {
        const response = await api.get(`/broadcasts/${broadcastId}/greenroom-participants`);
        if (!isMounted) return;

        const { participants } = response.data as { participants: Array<{ id: string; name: string; role: string; audioEnabled: boolean; videoEnabled: boolean }> };

        console.log('[useParticipants] Initial fetch: found', participants.length, 'participants');

        // Add all to known IDs to prevent duplicate toasts from socket events
        for (const p of participants) {
          knownParticipantIdsRef.current.add(p.id);
        }

        // Set initial state
        setRemoteParticipants((prev) => {
          const updated = new Map<string, RemoteParticipant>();

          for (const p of participants) {
            const existing = prev.get(p.id);
            updated.set(p.id, {
              id: p.id,
              name: p.name,
              stream: existing?.stream || null,
              audioEnabled: p.audioEnabled,
              videoEnabled: p.videoEnabled,
              role: (p.role || 'backstage') as 'host' | 'guest' | 'backstage',
            });
          }

          return updated;
        });

        initialFetchDoneRef.current = true;
        // NOTE: Guests automatically send their stream offer when joining
        // No active requesting needed - fully event-driven
      } catch (error) {
        // Don't log 401/403 errors as they're expected when not authenticated
        if ((error as any)?.response?.status !== 401 && (error as any)?.response?.status !== 403) {
          console.error('[useParticipants] Initial fetch error:', error);
        }
      }
    };

    fetchInitialParticipants();

    return () => {
      isMounted = false;
    };
  }, [broadcastId]);

  // Socket event handlers - PRIMARY mechanism for all participant updates
  // Fully event-driven: no polling, no active requesting
  useEffect(() => {
    // Handle initial state sync from server when host joins
    const handleParticipantsSync = ({ participants }: { participants: Array<{ id: string; name: string; role: string; audioEnabled: boolean; videoEnabled: boolean }> }) => {
      console.log('[useParticipants] Received participants-sync with', participants.length, 'participants');

      // Update knownParticipantIdsRef to prevent duplicate toasts
      for (const p of participants) {
        knownParticipantIdsRef.current.add(p.id);
      }

      // Don't show toast here - initial fetch handles notifications
      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        for (const p of participants) {
          const existing = prev.get(p.id);
          // CRITICAL: Preserve existing 'guest' role if already on stage
          // Don't let sync reset role to 'backstage' - that causes video element deletion and flickering
          const apiRole = (p.role || 'backstage') as 'host' | 'guest' | 'backstage';
          const role = existing?.role === 'guest' ? 'guest' : apiRole;
          updated.set(p.id, {
            id: p.id,
            name: p.name,
            stream: existing?.stream || null, // Preserve existing stream
            audioEnabled: p.audioEnabled,
            videoEnabled: p.videoEnabled,
            role,
          });
        }
        return updated;
      });
    };

    const handleParticipantJoined = async ({ participantId }: any) => {
      // Only show toast if we haven't seen this participant yet
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
      // Only show toast if we haven't seen this participant yet
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
          // IMPORTANT: Create new object to trigger React re-render
          updated.set(participantId, {
            ...existing,
            role: existing.role === 'guest' ? 'guest' : 'backstage',
            name: name || existing.name,
          });
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
          // IMPORTANT: Create new object to trigger React re-render
          updated.set(participantId, {
            ...participant,
            audioEnabled: audio,
            videoEnabled: video,
          });
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
          // IMPORTANT: Create new object to trigger React re-render
          // This is CRITICAL for the canvas to pick up the role change
          updated.set(participantId, {
            ...participant,
            role,
          });
          // NOTE: Guest stream should already be established - no active requesting
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
          // IMPORTANT: Create new object to trigger React re-render
          updated.set(participantId, {
            ...participant,
            role,
          });
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
    // NOTE: Guest stream should already be established - no active requesting
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
