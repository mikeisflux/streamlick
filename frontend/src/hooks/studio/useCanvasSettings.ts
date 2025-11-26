/**
 * ⚠️ CRITICAL WARNING ⚠️
 * THIS HOOK MANAGES CANVAS SETTINGS THAT AFFECT THE STUDIOCANVAS VISUAL OUTPUT.
 * ANY CHANGE TO THESE SETTINGS (resolution, background color, position numbers,
 * lower thirds, orientation, etc.) MUST ALSO BE INTEGRATED INTO THE HIDDEN CANVAS
 * IN StudioCanvas.tsx (drawToCanvas function) OR YOU WILL CREATE A BREAK IN THE CODE.
 *
 * The hidden canvas captures the broadcast output and must be a CARBON COPY of what
 * is displayed in the React preview.
 */

import { useState, useEffect } from 'react';

interface CanvasSettings {
  // General
  canvasResolution: '720p' | '1080p' | '4k';
  canvasBackgroundColor: string;
  showResolutionBadge: boolean;
  showPositionNumbers: boolean;
  showConnectionQuality: boolean;
  showLowerThirds: boolean;
  orientation: 'landscape' | 'portrait';
  appearance: 'auto' | 'light' | 'dark';
  displayInfoMessages: boolean;
  shiftVideosForBanners: boolean;
  audioAvatars: boolean;
  autoAddPresentedMedia: boolean;
  // Camera
  videoQuality: '480p' | '720p' | '1080p';
  mirrorVideo: boolean;
  autoAdjustBrightness: boolean;
  hdMode: boolean;
  // Audio
  inputVolume: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoAdjustMicrophone: boolean;
  noiseGateEnabled: boolean;
  noiseGateThreshold: number;
  // Visual Effects
  selectedBackground: string;
  backgroundBlur: boolean;
  backgroundBlurStrength: number;
  virtualBackground: boolean;
  virtualBackgroundStrength: number;
  backgroundRemoval: boolean;
  backgroundRemovalStrength: number;
  autoEnhanceLighting: boolean;
  colorCorrection: boolean;
  // Recording
  recordingQuality: '720p' | '1080p' | '4k';
  recordLocalCopies: boolean;
  separateAudioTracks: boolean;
  autoSaveRecordings: boolean;
  // Layout
  autoArrangeParticipants: boolean;
  rememberLayoutPreferences: boolean;
  showLayoutGridLines: boolean;
  defaultLayout: number;
  // Guest
  guestsCanEnableCamera: boolean;
  guestsCanEnableMicrophone: boolean;
  guestsCanShareScreen: boolean;
  requireApprovalToJoin: boolean;
  muteGuestsOnEntry: boolean;
  disableGuestCameraOnEntry: boolean;
  showGuestsInBackstageFirst: boolean;
}

const DEFAULT_SETTINGS: CanvasSettings = {
  // General
  canvasResolution: '1080p',
  canvasBackgroundColor: '#0F1419',
  showResolutionBadge: true,
  showPositionNumbers: true,
  showConnectionQuality: true,
  showLowerThirds: true,
  orientation: 'landscape',
  appearance: 'auto',
  displayInfoMessages: true,
  shiftVideosForBanners: false,
  audioAvatars: false,
  autoAddPresentedMedia: false,
  // Camera
  videoQuality: '720p',
  mirrorVideo: false,
  autoAdjustBrightness: true,
  hdMode: true,
  // Audio
  inputVolume: 75,
  echoCancellation: true,
  noiseSuppression: true,
  autoAdjustMicrophone: false,
  noiseGateEnabled: true,
  noiseGateThreshold: -38,
  // Visual Effects
  selectedBackground: 'none',
  backgroundBlur: false,
  backgroundBlurStrength: 50,
  virtualBackground: false,
  virtualBackgroundStrength: 75,
  backgroundRemoval: false,
  backgroundRemovalStrength: 80,
  autoEnhanceLighting: false,
  colorCorrection: false,
  // Recording
  recordingQuality: '1080p',
  recordLocalCopies: true,
  separateAudioTracks: true,
  autoSaveRecordings: true,
  // Layout
  autoArrangeParticipants: true,
  rememberLayoutPreferences: true,
  showLayoutGridLines: false,
  defaultLayout: 1,
  // Guest
  guestsCanEnableCamera: true,
  guestsCanEnableMicrophone: true,
  guestsCanShareScreen: true,
  requireApprovalToJoin: false,
  muteGuestsOnEntry: false,
  disableGuestCameraOnEntry: false,
  showGuestsInBackstageFirst: false,
};

const STORAGE_KEY = 'streamlick_canvas_settings';

export function useCanvasSettings() {
  const [settings, setSettings] = useState<CanvasSettings>(() => {
    // Load settings from localStorage on initialization
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load canvas settings from localStorage:', error);
    }
    return DEFAULT_SETTINGS;
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save canvas settings to localStorage:', error);
    }
  }, [settings]);

  // Apply appearance theme to document
  useEffect(() => {
    const root = document.documentElement;

    if (settings.appearance === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (settings.appearance === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      // Auto - detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }

      // Listen for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        if (e.matches) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings.appearance]);

  // Apply all video filters in one combined effect to avoid conflicts
  useEffect(() => {
    const styleId = 'streamlick-video-filters';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    // Build combined filter string
    const filters: string[] = [];

    // Auto-adjust brightness (from Camera settings)
    if (settings.autoAdjustBrightness) {
      filters.push('brightness(1.1)');
      filters.push('contrast(1.05)');
    }

    // Auto-enhance lighting (from Visual Effects)
    if (settings.autoEnhanceLighting) {
      filters.push('brightness(1.2)');
      filters.push('contrast(1.1)');
    }

    // Color correction (from Visual Effects)
    if (settings.colorCorrection) {
      filters.push('saturate(1.2)');
    }

    if (filters.length > 0) {
      styleElement.textContent = `
        video {
          filter: ${filters.join(' ')};
        }
      `;
    } else {
      styleElement.textContent = '';
    }

    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [settings.autoAdjustBrightness, settings.autoEnhanceLighting, settings.colorCorrection]);

  // Apply selected background from Visual Effects settings
  useEffect(() => {
    // Dispatch background change event that BackgroundSettingsDropdown listens to
    if (settings.selectedBackground && settings.selectedBackground !== 'none') {
      window.dispatchEvent(new CustomEvent('visualEffectsBackgroundSelected', {
        detail: { backgroundId: settings.selectedBackground }
      }));
    }
  }, [settings.selectedBackground]);


  // Listen for style settings updates from StylePanel
  useEffect(() => {
    const handleStyleSettingsUpdated = ((e: CustomEvent) => {
      // Update canvas background color when styles are applied
      if (e.detail.backgroundColor) {
        setSettings((prev) => ({
          ...prev,
          canvasBackgroundColor: e.detail.backgroundColor,
        }));
      }
    }) as EventListener;

    window.addEventListener('styleSettingsUpdated', handleStyleSettingsUpdated);
    return () => {
      window.removeEventListener('styleSettingsUpdated', handleStyleSettingsUpdated);
    };
  }, []);

  // Individual setters for each setting
  const updateSetting = <K extends keyof CanvasSettings>(key: K, value: CanvasSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return {
    settings,
    updateSetting,
    // General
    canvasResolution: settings.canvasResolution,
    setCanvasResolution: (value: CanvasSettings['canvasResolution']) => updateSetting('canvasResolution', value),
    canvasBackgroundColor: settings.canvasBackgroundColor,
    setCanvasBackgroundColor: (value: string) => updateSetting('canvasBackgroundColor', value),
    showResolutionBadge: settings.showResolutionBadge,
    setShowResolutionBadge: (value: boolean) => updateSetting('showResolutionBadge', value),
    showPositionNumbers: settings.showPositionNumbers,
    setShowPositionNumbers: (value: boolean) => updateSetting('showPositionNumbers', value),
    showConnectionQuality: settings.showConnectionQuality,
    setShowConnectionQuality: (value: boolean) => updateSetting('showConnectionQuality', value),
    showLowerThirds: settings.showLowerThirds,
    setShowLowerThirds: (value: boolean) => updateSetting('showLowerThirds', value),
    orientation: settings.orientation,
    setOrientation: (value: CanvasSettings['orientation']) => updateSetting('orientation', value),
    appearance: settings.appearance,
    setAppearance: (value: CanvasSettings['appearance']) => updateSetting('appearance', value),
    displayInfoMessages: settings.displayInfoMessages,
    setDisplayInfoMessages: (value: boolean) => updateSetting('displayInfoMessages', value),
    shiftVideosForBanners: settings.shiftVideosForBanners,
    setShiftVideosForBanners: (value: boolean) => updateSetting('shiftVideosForBanners', value),
    audioAvatars: settings.audioAvatars,
    setAudioAvatars: (value: boolean) => updateSetting('audioAvatars', value),
    autoAddPresentedMedia: settings.autoAddPresentedMedia,
    setAutoAddPresentedMedia: (value: boolean) => updateSetting('autoAddPresentedMedia', value),
    // Camera
    videoQuality: settings.videoQuality,
    setVideoQuality: (value: CanvasSettings['videoQuality']) => updateSetting('videoQuality', value),
    mirrorVideo: settings.mirrorVideo,
    setMirrorVideo: (value: boolean) => updateSetting('mirrorVideo', value),
    autoAdjustBrightness: settings.autoAdjustBrightness,
    setAutoAdjustBrightness: (value: boolean) => updateSetting('autoAdjustBrightness', value),
    hdMode: settings.hdMode,
    setHdMode: (value: boolean) => updateSetting('hdMode', value),
    // Audio
    inputVolume: settings.inputVolume,
    setInputVolume: (value: number) => updateSetting('inputVolume', value),
    echoCancellation: settings.echoCancellation,
    setEchoCancellation: (value: boolean) => updateSetting('echoCancellation', value),
    noiseSuppression: settings.noiseSuppression,
    setNoiseSuppression: (value: boolean) => updateSetting('noiseSuppression', value),
    autoAdjustMicrophone: settings.autoAdjustMicrophone,
    setAutoAdjustMicrophone: (value: boolean) => updateSetting('autoAdjustMicrophone', value),
    noiseGateEnabled: settings.noiseGateEnabled,
    setNoiseGateEnabled: (value: boolean) => updateSetting('noiseGateEnabled', value),
    noiseGateThreshold: settings.noiseGateThreshold,
    setNoiseGateThreshold: (value: number) => updateSetting('noiseGateThreshold', value),
    // Visual Effects
    selectedBackground: settings.selectedBackground,
    setSelectedBackground: (value: string) => updateSetting('selectedBackground', value),
    backgroundBlur: settings.backgroundBlur,
    setBackgroundBlur: (value: boolean) => updateSetting('backgroundBlur', value),
    backgroundBlurStrength: settings.backgroundBlurStrength,
    setBackgroundBlurStrength: (value: number) => updateSetting('backgroundBlurStrength', value),
    virtualBackground: settings.virtualBackground,
    setVirtualBackground: (value: boolean) => updateSetting('virtualBackground', value),
    virtualBackgroundStrength: settings.virtualBackgroundStrength,
    setVirtualBackgroundStrength: (value: number) => updateSetting('virtualBackgroundStrength', value),
    backgroundRemoval: settings.backgroundRemoval,
    setBackgroundRemoval: (value: boolean) => updateSetting('backgroundRemoval', value),
    backgroundRemovalStrength: settings.backgroundRemovalStrength,
    setBackgroundRemovalStrength: (value: number) => updateSetting('backgroundRemovalStrength', value),
    autoEnhanceLighting: settings.autoEnhanceLighting,
    setAutoEnhanceLighting: (value: boolean) => updateSetting('autoEnhanceLighting', value),
    colorCorrection: settings.colorCorrection,
    setColorCorrection: (value: boolean) => updateSetting('colorCorrection', value),
    // Recording
    recordingQuality: settings.recordingQuality,
    setRecordingQuality: (value: CanvasSettings['recordingQuality']) => updateSetting('recordingQuality', value),
    recordLocalCopies: settings.recordLocalCopies,
    setRecordLocalCopies: (value: boolean) => updateSetting('recordLocalCopies', value),
    separateAudioTracks: settings.separateAudioTracks,
    setSeparateAudioTracks: (value: boolean) => updateSetting('separateAudioTracks', value),
    autoSaveRecordings: settings.autoSaveRecordings,
    setAutoSaveRecordings: (value: boolean) => updateSetting('autoSaveRecordings', value),
    // Layout
    autoArrangeParticipants: settings.autoArrangeParticipants,
    setAutoArrangeParticipants: (value: boolean) => updateSetting('autoArrangeParticipants', value),
    rememberLayoutPreferences: settings.rememberLayoutPreferences,
    setRememberLayoutPreferences: (value: boolean) => updateSetting('rememberLayoutPreferences', value),
    showLayoutGridLines: settings.showLayoutGridLines,
    setShowLayoutGridLines: (value: boolean) => updateSetting('showLayoutGridLines', value),
    defaultLayout: settings.defaultLayout,
    setDefaultLayout: (value: number) => updateSetting('defaultLayout', value),
    // Guest
    guestsCanEnableCamera: settings.guestsCanEnableCamera,
    setGuestsCanEnableCamera: (value: boolean) => updateSetting('guestsCanEnableCamera', value),
    guestsCanEnableMicrophone: settings.guestsCanEnableMicrophone,
    setGuestsCanEnableMicrophone: (value: boolean) => updateSetting('guestsCanEnableMicrophone', value),
    guestsCanShareScreen: settings.guestsCanShareScreen,
    setGuestsCanShareScreen: (value: boolean) => updateSetting('guestsCanShareScreen', value),
    requireApprovalToJoin: settings.requireApprovalToJoin,
    setRequireApprovalToJoin: (value: boolean) => updateSetting('requireApprovalToJoin', value),
    muteGuestsOnEntry: settings.muteGuestsOnEntry,
    setMuteGuestsOnEntry: (value: boolean) => updateSetting('muteGuestsOnEntry', value),
    disableGuestCameraOnEntry: settings.disableGuestCameraOnEntry,
    setDisableGuestCameraOnEntry: (value: boolean) => updateSetting('disableGuestCameraOnEntry', value),
    showGuestsInBackstageFirst: settings.showGuestsInBackstageFirst,
    setShowGuestsInBackstageFirst: (value: boolean) => updateSetting('showGuestsInBackstageFirst', value),
  };
}
