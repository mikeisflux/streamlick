import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { mediaStorageService } from '../../services/media-storage.service';

interface UseStudioHandlersProps {
  broadcastId: string | undefined;
  handleLayoutChange: (layoutId: number) => void;
  handlePromoteToLive: (participantId: string) => void;
  handleDemoteToBackstage: (participantId: string) => void;
  onShowInviteDrawer?: () => void;
}

export function useStudioHandlers({
  broadcastId,
  handleLayoutChange,
  handlePromoteToLive,
  handleDemoteToBackstage,
  onShowInviteDrawer,
}: UseStudioHandlersProps) {
  const [editMode, setEditMode] = useState(false);
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [isLocalUserOnStage, setIsLocalUserOnStage] = useState(true);
  const [displayedComment, setDisplayedComment] = useState<{
    id: string;
    platform: 'youtube' | 'facebook' | 'twitch' | 'linkedin' | 'x' | 'rumble';
    authorName: string;
    authorAvatar?: string;
    message: string;
    timestamp: Date;
  } | null>(null);

  const handleEditModeToggle = () => setEditMode(!editMode);

  const handleAddParticipant = () => {
    // Open the invite drawer to add participants
    if (onShowInviteDrawer) {
      onShowInviteDrawer();
    } else {
      toast.error('Unable to open invite panel');
    }
  };

  const handleCanvasSettingsClick = () => setShowCanvasSettings(true);

  const handleResetStack = async () => {
    try {
      // Clear all media from IndexedDB
      await mediaStorageService.clearAllMedia();

      // Clear all localStorage keys related to media assets
      const keysToRemove = [
        'streamLogo',
        'streamLogoName',
        'streamLogoAssetId',
        'streamOverlay',
        'streamOverlayName',
        'streamOverlayAssetId',
        'streamBackground',
        'streamBackgroundName',
        'streamBackgroundAssetId',
        'backgroundMusic',
        'backgroundMusicName',
        `media_assets_${broadcastId || 'default'}`,
      ];

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // Dispatch events to update UI
      window.dispatchEvent(new CustomEvent('logoUpdated', { detail: { url: null, name: null } }));
      window.dispatchEvent(new CustomEvent('overlayUpdated', { detail: { url: null, name: null } }));
      window.dispatchEvent(new CustomEvent('backgroundUpdated', { detail: { url: null, name: null } }));

      toast.success('Stack reset successfully! All linked files cleared.');
      setShowResetConfirmation(false);

      // Reload the page to ensure clean state
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Failed to reset stack:', error);
      toast.error('Failed to reset stack. Please try again.');
    }
  };

  const handleAddToStage = (participantId: string) => {
    if (participantId === 'local-user') {
      setIsLocalUserOnStage(true);
    } else {
      handlePromoteToLive(participantId);
    }
  };

  const handleRemoveFromStage = (participantId: string) => {
    if (participantId === 'local-user') {
      setIsLocalUserOnStage(false);
    } else {
      handleDemoteToBackstage(participantId);
    }
  };

  // Listen for scene changes and apply scene settings
  useEffect(() => {
    const handleSceneChanged = (e: CustomEvent) => {
      const { scene } = e.detail;
      if (!scene) return;

      // Apply scene layout
      if (scene.selectedLayout !== undefined) {
        handleLayoutChange(scene.selectedLayout);
      }

      // Apply scene background
      if (scene.background) {
        if (scene.background.url) {
          localStorage.setItem('streamBackground', scene.background.url);
          window.dispatchEvent(new CustomEvent('backgroundUpdated', {
            detail: { url: scene.background.url }
          }));
        }
      } else {
        // Remove background if scene doesn't have one
        localStorage.removeItem('streamBackground');
        window.dispatchEvent(new CustomEvent('backgroundUpdated', {
          detail: { url: null }
        }));
      }

      // Apply scene banners
      if (scene.banners) {
        localStorage.setItem('banners', JSON.stringify(scene.banners));
        window.dispatchEvent(new CustomEvent('bannersUpdated', {
          detail: scene.banners
        }));
      }
    };

    window.addEventListener('sceneChanged', handleSceneChanged as EventListener);
    return () => window.removeEventListener('sceneChanged', handleSceneChanged as EventListener);
  }, [handleLayoutChange]);

  return {
    editMode,
    showCanvasSettings,
    setShowCanvasSettings,
    showResetConfirmation,
    setShowResetConfirmation,
    isLocalUserOnStage,
    displayedComment,
    setDisplayedComment,
    handleEditModeToggle,
    handleAddParticipant,
    handleCanvasSettingsClick,
    handleResetStack,
    handleAddToStage,
    handleRemoveFromStage,
  };
}
