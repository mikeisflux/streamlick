import { ClipManager } from '../../ClipManager';

interface ClipManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  broadcastId: string | undefined;
}

export function ClipManagerModal({ isOpen, onClose, broadcastId }: ClipManagerModalProps) {
  if (!isOpen || !broadcastId) return null;

  return <ClipManager broadcastId={broadcastId} onClose={onClose} />;
}
