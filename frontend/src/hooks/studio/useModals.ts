import { useState } from 'react';

export function useModals() {
  const [showSettings, setShowSettings] = useState(false);
  const [showClipManager, setShowClipManager] = useState(false);
  const [showProducerMode, setShowProducerMode] = useState(false);
  const [showClipDurationSelector, setShowClipDurationSelector] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [showSceneManager, setShowSceneManager] = useState(true);

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
  };
}
