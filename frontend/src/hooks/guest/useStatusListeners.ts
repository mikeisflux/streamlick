/**
 * useStatusListeners Hook
 *
 * Listens for host status change events (promoted, demoted, moved-to-backstage)
 * and updates guest status accordingly. Includes toast notifications.
 */

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { socketService } from '../../services/socket.service';

export type GuestStatus = 'greenroom' | 'backstage' | 'live';

export interface StatusListenersOptions {
  hasJoined: boolean;
  myParticipantId: string | null;
  onStatusChange: (status: GuestStatus) => void;
}

export function useStatusListeners({
  hasJoined,
  myParticipantId,
  onStatusChange,
}: StatusListenersOptions): void {
  useEffect(() => {
    if (!hasJoined) return;

    const handlePromoted = ({ participantId }: { participantId: string }) => {
      // Only process if this promotion is for US, not other guests
      if (participantId !== myParticipantId) {
        console.log('[useStatusListeners] Ignoring promotion event for different participant:', participantId);
        return;
      }

      onStatusChange('live');
      toast.success('You are now LIVE on the broadcast!', {
        duration: 5000,
        icon: '🔴',
      });
    };

    const handleDemoted = ({ participantId }: { participantId: string }) => {
      // Only process if this demotion is for us
      if (participantId !== myParticipantId) {
        return;
      }

      onStatusChange('backstage');
      toast.success('Moved to backstage');
    };

    const handleMovedToBackstage = () => {
      onStatusChange('backstage');
      toast.success('Moved to backstage - Get ready to go live!');
    };

    const handleKicked = ({ participantId }: { participantId: string }) => {
      if (participantId !== myParticipantId) {
        return;
      }

      toast.error('You have been removed from the broadcast');
      // Navigation would be handled by parent component
    };

    socketService.on('participant-promoted', handlePromoted);
    socketService.on('participant-demoted', handleDemoted);
    socketService.on('moved-to-backstage', handleMovedToBackstage);
    socketService.on('participant-kicked', handleKicked);

    return () => {
      socketService.off('participant-promoted', handlePromoted);
      socketService.off('participant-demoted', handleDemoted);
      socketService.off('moved-to-backstage', handleMovedToBackstage);
      socketService.off('participant-kicked', handleKicked);
    };
  }, [hasJoined, myParticipantId, onStatusChange]);
}
