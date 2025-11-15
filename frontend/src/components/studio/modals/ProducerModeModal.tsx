import { ProducerMode } from '../../ProducerMode';

interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  role: 'host' | 'guest' | 'backstage';
}

interface ProducerModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  broadcastId: string | undefined;
  producerId: string | undefined;
  remoteParticipants?: Map<string, RemoteParticipant>;
  onPromoteToLive?: (participantId: string) => void;
  onDemoteToBackstage?: (participantId: string) => void;
  onMuteParticipant?: (participantId: string) => void;
  onUnmuteParticipant?: (participantId: string) => void;
  onLayoutChange?: (layout: number) => void;
}

export function ProducerModeModal({
  isOpen,
  onClose,
  broadcastId,
  producerId,
  remoteParticipants,
  onPromoteToLive,
  onDemoteToBackstage,
  onMuteParticipant,
  onUnmuteParticipant,
  onLayoutChange,
}: ProducerModeModalProps) {
  if (!isOpen || !broadcastId) return null;

  return (
    <ProducerMode
      broadcastId={broadcastId}
      producerId={producerId}
      onClose={onClose}
      remoteParticipants={remoteParticipants}
      onPromoteToLive={onPromoteToLive}
      onDemoteToBackstage={onDemoteToBackstage}
      onMuteParticipant={onMuteParticipant}
      onUnmuteParticipant={onUnmuteParticipant}
      onLayoutChange={onLayoutChange}
    />
  );
}
