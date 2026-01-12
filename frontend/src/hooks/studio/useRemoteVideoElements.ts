/**
 * useRemoteVideoElements - Remote participant video element management
 *
 * Manages creation and cleanup of video elements for remote participants
 * and integrates their audio with the audio mixer
 */

import { useEffect, useRef } from 'react';
import { audioMixerService } from '../../services/audio-mixer.service';

export interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  role: 'host' | 'guest' | 'backstage';
}

export function useRemoteVideoElements(remoteParticipants: Map<string, RemoteParticipant>) {
  const remoteVideoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const participantAudioAddedRef = useRef<Set<string>>(new Set());

  // Manage video elements for remote participants AND add their audio to the mixer
  useEffect(() => {
    const currentParticipantIds = Array.from(remoteParticipants.keys());
    const existingVideoIds = Array.from(remoteVideoElementsRef.current.keys());

    // Create video elements for new participants
    currentParticipantIds.forEach((participantId) => {
      const participant = remoteParticipants.get(participantId);
      if (!participant || !participant.stream) return;

      // Skip participants not on stage: only 'guest' role goes on stage
      if (participant.role !== 'guest' || participantId === 'screen-share') return;

      // Add participant audio to mixer if not already added
      if (!participantAudioAddedRef.current.has(participantId) && participant.audioEnabled) {
        const audioTrack = participant.stream.getAudioTracks()[0];
        if (audioTrack) {
          try {
            const audioStream = new MediaStream([audioTrack]);
            audioMixerService.addStream(`participant-${participantId}`, audioStream);
            participantAudioAddedRef.current.add(participantId);
          } catch (err) {
            console.error('[useRemoteVideoElements] Failed to add participant audio:', participantId, err);
          }
        }
      }

      // Skip if video element already exists
      if (remoteVideoElementsRef.current.has(participantId)) {
        const existingVideo = remoteVideoElementsRef.current.get(participantId);
        if (!existingVideo) return;

        // CRITICAL: Never update srcObject if video is currently playing with valid dimensions
        const isVideoPlaying = existingVideo.readyState >= 2 &&
                               existingVideo.videoWidth > 0 &&
                               existingVideo.videoHeight > 0 &&
                               !existingVideo.paused;

        if (isVideoPlaying) {
          // Video is playing fine - ensure audio is in mixer
          if (participant.audioEnabled && !participantAudioAddedRef.current.has(participantId)) {
            const audioTrack = participant.stream?.getAudioTracks()[0];
            if (audioTrack) {
              try {
                const audioStream = new MediaStream([audioTrack]);
                audioMixerService.addStream(`participant-${participantId}`, audioStream);
                participantAudioAddedRef.current.add(participantId);
              } catch (err) {
                console.error('[useRemoteVideoElements] Failed to add audio:', participantId, err);
              }
            }
          }
          return;
        }

        // Video not playing properly - check if we need to update srcObject
        const existingStream = existingVideo.srcObject as MediaStream | null;
        const newStream = participant.stream;

        if (existingStream !== newStream && newStream) {
          existingVideo.srcObject = newStream;
          existingVideo.play().catch(err =>
            console.error('[useRemoteVideoElements] Failed to play:', participantId, err)
          );

          if (participant.audioEnabled) {
            const audioTrack = newStream.getAudioTracks()[0];
            if (audioTrack) {
              try {
                const audioStream = new MediaStream([audioTrack]);
                audioMixerService.addStream(`participant-${participantId}`, audioStream);
                participantAudioAddedRef.current.add(participantId);
              } catch (err) {
                console.error('[useRemoteVideoElements] Failed to update audio:', participantId, err);
              }
            }
          }
        } else if (existingVideo.paused) {
          existingVideo.play().catch(err =>
            console.error('[useRemoteVideoElements] Failed to resume:', participantId, err)
          );
        }
        return;
      }

      // Create new video element
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true; // Audio handled by audioMixerService
      video.srcObject = participant.stream;
      video.play().catch(err =>
        console.error('[useRemoteVideoElements] Failed to play new video:', participantId, err)
      );

      remoteVideoElementsRef.current.set(participantId, video);
    });

    // Remove video elements and audio for participants that left or are not on stage
    existingVideoIds.forEach((videoId) => {
      const participant = remoteParticipants.get(videoId);
      const shouldRemove = !currentParticipantIds.includes(videoId) ||
                          (participant && participant.role !== 'guest');

      if (shouldRemove) {
        const video = remoteVideoElementsRef.current.get(videoId);
        if (video) {
          video.srcObject = null;
        }
        remoteVideoElementsRef.current.delete(videoId);

        if (participantAudioAddedRef.current.has(videoId)) {
          audioMixerService.removeStream(`participant-${videoId}`);
          participantAudioAddedRef.current.delete(videoId);
        }
      }
    });

    // Check for participants no longer on stage
    participantAudioAddedRef.current.forEach((participantId) => {
      const participant = remoteParticipants.get(participantId);
      if (!participant || participant.role !== 'guest') {
        audioMixerService.removeStream(`participant-${participantId}`);
        participantAudioAddedRef.current.delete(participantId);
      }
    });

    // Cleanup on unmount
    return () => {
      remoteVideoElementsRef.current.forEach((video) => {
        video.srcObject = null;
      });
      remoteVideoElementsRef.current.clear();

      participantAudioAddedRef.current.forEach((participantId) => {
        audioMixerService.removeStream(`participant-${participantId}`);
      });
      participantAudioAddedRef.current.clear();
    };
  }, [remoteParticipants]);

  /**
   * Create video element on-demand for a participant (used in render loop)
   */
  const getOrCreateVideoElement = (participantId: string, stream: MediaStream | null): HTMLVideoElement | undefined => {
    let video = remoteVideoElementsRef.current.get(participantId);

    if (!video && stream) {
      video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.srcObject = stream;
      video.play().catch(err =>
        console.error('[useRemoteVideoElements] Failed to play on-demand video:', participantId, err)
      );
      remoteVideoElementsRef.current.set(participantId, video);
    }

    return video;
  };

  return {
    remoteVideoElementsRef,
    participantAudioAddedRef,
    getOrCreateVideoElement,
  };
}
