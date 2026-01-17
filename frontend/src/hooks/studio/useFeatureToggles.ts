import { useState } from 'react';
import { BackgroundOptions } from '../../services/background-removal.service';

export function useFeatureToggles() {
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [clipRecordingEnabled, setClipRecordingEnabled] = useState(false);
  const [captionLanguage, setCaptionLanguage] = useState('en-US');
  const [backgroundRemovalEnabled, setBackgroundRemovalEnabled] = useState(false);
  const [backgroundRemovalOptions, setBackgroundRemovalOptions] = useState<BackgroundOptions>({
    type: 'blur',
    blurAmount: 15,
    color: '#1a1a1a',
    edgeSoftness: 0.3,
  });
  const [verticalSimulcastEnabled, setVerticalSimulcastEnabled] = useState(false);
  const [verticalResolution, setVerticalResolution] = useState<'1080x1920' | '720x1280' | '540x960'>('1080x1920');
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  return {
    captionsEnabled,
    setCaptionsEnabled,
    clipRecordingEnabled,
    setClipRecordingEnabled,
    captionLanguage,
    setCaptionLanguage,
    backgroundRemovalEnabled,
    setBackgroundRemovalEnabled,
    backgroundRemovalOptions,
    setBackgroundRemovalOptions,
    verticalSimulcastEnabled,
    setVerticalSimulcastEnabled,
    verticalResolution,
    setVerticalResolution,
    analyticsEnabled,
    setAnalyticsEnabled,
  };
}
