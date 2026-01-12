/**
 * useDeviceEnumeration Hook
 *
 * Enumerates available audio and video input devices,
 * stores them in state, and sets default selections.
 */

import { useState, useEffect } from 'react';

export interface DeviceEnumerationResult {
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  selectedAudioDevice: string;
  setSelectedAudioDevice: (deviceId: string) => void;
  selectedVideoDevice: string;
  setSelectedVideoDevice: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
}

export function useDeviceEnumeration(): DeviceEnumerationResult {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');

  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const videoInputs = devices.filter(device => device.kind === 'videoinput');

      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);

      // Set default selections if not already set
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }
    } catch (error) {
      console.error('[useDeviceEnumeration] Error enumerating devices:', error);
    }
  };

  useEffect(() => {
    // Initial enumeration
    enumerateDevices();

    // Re-enumerate when devices change (e.g., USB camera plugged in)
    const handleDeviceChange = () => {
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  return {
    audioDevices,
    videoDevices,
    selectedAudioDevice,
    setSelectedAudioDevice,
    selectedVideoDevice,
    setSelectedVideoDevice,
    refreshDevices: enumerateDevices,
  };
}
