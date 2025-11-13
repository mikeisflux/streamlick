import { ProducerMode } from '../../ProducerMode';

interface ProducerModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  broadcastId: string | undefined;
  producerId: string | undefined;
}

export function ProducerModeModal({ isOpen, onClose, broadcastId, producerId }: ProducerModeModalProps) {
  if (!isOpen || !broadcastId) return null;

  return <ProducerMode broadcastId={broadcastId} producerId={producerId} onClose={onClose} />;
}
