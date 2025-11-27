import { useState, useEffect, useCallback } from 'react';
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

  // Socket event handlers
  useEffect(() => {
    // Handle initial state sync from server when host joins
    const handleParticipantsSync = ({ participants }: { participants: Array<{ id: string; name: string; role: string; audioEnabled: boolean; videoEnabled: boolean }> }) => {
      console.log('[useParticipants] Received participants-sync with', participants.length, 'participants');

      if (participants.length > 0) {
        toast.success(`${participants.length} guest(s) already in greenroom`);
      }

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        for (const p of participants) {
          updated.set(p.id, {
            id: p.id,
            name: p.name,
            stream: null,
            audioEnabled: p.audioEnabled,
            videoEnabled: p.videoEnabled,
            role: p.role as 'host' | 'guest' | 'backstage',
          });
        }
        return updated;
      });
    };

    const handleParticipantJoined = async ({ participantId }: any) => {
      toast.success('A participant joined');

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        updated.set(participantId, {
          id: participantId,
          name: `Guest ${updated.size + 1}`,
          stream: null,
          audioEnabled: true,
          videoEnabled: true,
          role: 'backstage', // New participants start in backstage by default
        });
        return updated;
      });
    };

    // Handle greenroom participant joined - update role to 'guest' for greenroom display
    const handleGreenroomParticipantJoined = ({ participantId, name }: any) => {
      toast.success(`${name || 'A guest'} joined the greenroom`);

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(participantId);
        if (existing) {
          // Update existing participant's role to guest (greenroom)
          existing.role = 'guest';
          existing.name = name || existing.name;
          updated.set(participantId, existing);
        } else {
          // Add new participant with guest role
          updated.set(participantId, {
            id: participantId,
            name: name || `Guest ${updated.size + 1}`,
            stream: null,
            audioEnabled: true,
            videoEnabled: true,
            role: 'guest', // Greenroom participants have role 'guest'
          });
        }
        return updated;
      });
    };

    // Handle greenroom participant left
    const handleGreenroomParticipantLeft = ({ participantId }: any) => {
      toast.success('A guest left the greenroom');

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        updated.delete(participantId);
        return updated;
      });
    };

    const handleParticipantLeft = ({ participantId }: any) => {
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
