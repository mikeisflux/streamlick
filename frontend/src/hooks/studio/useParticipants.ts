import { useState, useEffect, useCallback } from 'react';
import { socketService } from '../../services/socket.service';
import { studioCanvasOutputService } from '../../services/studioCanvasOutput.service';
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

    const handleParticipantLeft = ({ participantId }: any) => {
      toast.success('A participant left');

      // Remove from audio mixer
      studioCanvasOutputService.removeParticipant(participantId);

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
        studioCanvasOutputService.addChatMessage({
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

          // Add participant to audio mixer if they have a stream and are now live
          if (participant.stream && (role === 'host' || role === 'guest')) {
            studioCanvasOutputService.addParticipant({
              id: participant.id,
              name: participant.name,
              stream: participant.stream,
              isLocal: false,
              audioEnabled: participant.audioEnabled,
              videoEnabled: participant.videoEnabled,
            });
          }
        }
        return updated;
      });
    };

    const handleParticipantDemoted = ({ participantId, role }: any) => {
      toast.success('Participant moved to backstage');

      // Remove participant from audio mixer when demoted to backstage
      if (role === 'backstage') {
        studioCanvasOutputService.removeParticipant(participantId);
      }

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

    socketService.on('participant-joined', handleParticipantJoined);
    socketService.on('participant-left', handleParticipantLeft);
    socketService.on('media-state-changed', handleMediaStateChanged);
    socketService.on('chat-message', handleChatMessage);
    socketService.on('participant-promoted', handleParticipantPromoted);
    socketService.on('participant-demoted', handleParticipantDemoted);
    socketService.on('viewer-count-update', handleViewerCountUpdate);

    return () => {
      socketService.off('participant-joined', handleParticipantJoined);
      socketService.off('participant-left', handleParticipantLeft);
      socketService.off('media-state-changed', handleMediaStateChanged);
      socketService.off('chat-message', handleChatMessage);
      socketService.off('participant-promoted', handleParticipantPromoted);
      socketService.off('participant-demoted', handleParticipantDemoted);
      socketService.off('viewer-count-update', handleViewerCountUpdate);
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
