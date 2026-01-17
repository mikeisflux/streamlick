import { useState } from 'react';
import { ChatLayoutConfig } from '../../components/ChatLayoutCustomizer';

const DEFAULT_CHAT_CONFIG: ChatLayoutConfig = {
  layout: 'side',
  position: 'right',
  size: 'medium',
  width: 300,
  height: 600,
  opacity: 90,
  showAvatars: true,
  showTimestamps: false,
  fontSize: 14,
  maxMessages: 50,
  backgroundColor: '#1F2937',
  textColor: '#FFFFFF',
  accentColor: '#3B82F6',
  borderRadius: 8,
  padding: 12,
  animateNewMessages: true,
  soundOnNewMessage: false,
  highlightKeywords: [],
  hideCommands: true,
};

export function useModals() {
  const [showSettings, setShowSettings] = useState(false);
  const [showClipManager, setShowClipManager] = useState(false);
  const [showProducerMode, setShowProducerMode] = useState(false);
  const [showClipDurationSelector, setShowClipDurationSelector] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [showSceneManager, setShowSceneManager] = useState(true);
  const [showChatLayoutCustomizer, setShowChatLayoutCustomizer] = useState(false);
  const [chatLayoutConfig, setChatLayoutConfig] = useState<ChatLayoutConfig>(DEFAULT_CHAT_CONFIG);
  const [showScreenShareManager, setShowScreenShareManager] = useState(false);
  const [showBackgroundEffects, setShowBackgroundEffects] = useState(false);

  return {
    showSettings,
    setShowSettings,
    showClipManager,
    setShowClipManager,
    showProducerMode,
    setShowProducerMode,
    showClipDurationSelector,
    setShowClipDurationSelector,
    showLanguageSelector,
    setShowLanguageSelector,
    showBackgroundSettings,
    setShowBackgroundSettings,
    showSceneManager,
    setShowSceneManager,
    showChatLayoutCustomizer,
    setShowChatLayoutCustomizer,
    chatLayoutConfig,
    setChatLayoutConfig,
    showScreenShareManager,
    setShowScreenShareManager,
    showBackgroundEffects,
    setShowBackgroundEffects,
  };
}
