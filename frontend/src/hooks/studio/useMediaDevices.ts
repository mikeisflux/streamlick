import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export function useMediaDevices() {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedSpeakerDevice, setSelectedSpeakerDevice] = useState<string>('');
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [showMicSelector, setShowMicSelector] = useState(false);
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [showSpeakerSelector, setShowSpeakerSelector] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);
      setSpeakerDevices(audioOutputs);

      // Set default devices if not already set
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }
      if (!selectedSpeakerDevice && audioOutputs.length > 0) {
        setSelectedSpeakerDevice(audioOutputs[0].deviceId);
      }
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      toast.error('Failed to load media devices');
    }
  }, [selectedAudioDevice, selectedVideoDevice, selectedSpeakerDevice]);

  const handleAudioDeviceChange = useCallback(async (deviceId: string, localStream: MediaStream | null) => {
    try {
      setSelectedAudioDevice(deviceId);

      // Stop current audio track
      if (localStream) {
        localStream.getAudioTracks().forEach(track => track.stop());
      }

      // Get new audio stream with selected device and high-quality constraints
      const newAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          // Enable all noise reduction features
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          // High-quality audio settings
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
          channelCount: { ideal: 2 },
        },
      });

      // Replace audio track in local stream
      const newAudioTrack = newAudioStream.getAudioTracks()[0];
      if (localStream) {
        const oldAudioTrack = localStream.getAudioTracks()[0];
        if (oldAudioTrack) {
          localStream.removeTrack(oldAudioTrack);
        }
        localStream.addTrack(newAudioTrack);
      }

      // Clean up the temporary stream by stopping any remaining tracks
      // (after we've transferred the track to localStream, the stream itself is no longer needed)
      newAudioStream.getTracks().forEach(track => {
        if (track !== newAudioTrack) {
          track.stop();
        }
      });

      toast.success('Microphone changed successfully');
    } catch (error) {
      console.error('Failed to change audio device:', error);
      toast.error('Failed to change microphone');
    }
  }, []);

  const handleVideoDeviceChange = useCallback(async (deviceId: string, localStream: MediaStream | null) => {
    try {
      setSelectedVideoDevice(deviceId);

      // Stop current video track
      if (localStream) {
        localStream.getVideoTracks().forEach(track => track.stop());
      }

      // Wait a bit for the camera to be fully released
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get new video stream with selected device
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });

      // Replace video track in local stream
      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      if (localStream) {
        const oldVideoTrack = localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          localStream.removeTrack(oldVideoTrack);
        }
        localStream.addTrack(newVideoTrack);
      }

      // Clean up the temporary stream by stopping any remaining tracks
      // (after we've transferred the track to localStream, the stream itself is no longer needed)
      newVideoStream.getTracks().forEach(track => {
        if (track !== newVideoTrack) {
          track.stop();
        }
      });

      toast.success('Camera changed successfully');
    } catch (error) {
      console.error('Failed to change video device:', error);
      toast.error('Failed to change camera. Make sure it\'s not being used by another application.');
    }
  }, []);

  const handleSpeakerDeviceChange = useCallback(async (deviceId: string) => {
    try {
      setSelectedSpeakerDevice(deviceId);

      // Set the audio output device for all audio/video elements
      const audioElements = document.querySelectorAll('audio, video');
      for (const element of audioElements) {
        if (typeof (element as any).setSinkId !== 'undefined') {
          await (element as any).setSinkId(deviceId);
        }
      }

      toast.success('Speaker changed successfully');
    } catch (error) {
      console.error('Failed to change speaker device:', error);
      toast.error('Failed to change speaker');
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    setSpeakerMuted(prev => {
      const newMuted = !prev;
      const audioElements = document.querySelectorAll('audio, video');
      audioElements.forEach((element: any) => {
        element.muted = newMuted;
      });
      return newMuted;
    });
  }, []);

  return {
    audioDevices,
    videoDevices,
    speakerDevices,
    selectedAudioDevice,
    selectedVideoDevice,
    selectedSpeakerDevice,
    speakerMuted,
    showMicSelector,
    showCameraSelector,
    showSpeakerSelector,
    setAudioDevices,
    setVideoDevices,
    setSpeakerDevices,
    setSelectedAudioDevice,
    setSelectedVideoDevice,
    setSelectedSpeakerDevice,
    setSpeakerMuted,
    setShowMicSelector,
    setShowCameraSelector,
    setShowSpeakerSelector,
    loadDevices,
    handleAudioDeviceChange,
    handleVideoDeviceChange,
    handleSpeakerDeviceChange,
    toggleSpeaker,
  };
}
