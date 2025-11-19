import { create } from 'zustand';
import { Broadcast, Participant, MediaState } from '../types';

interface StudioState {
  broadcast: Broadcast | null;
  participants: Map<string, Participant>;
  mediaStates: Map<string, MediaState>;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isLive: boolean;
  isRecording: boolean;

  setBroadcast: (broadcast: Broadcast) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  updateMediaState: (participantId: string, state: MediaState) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setScreenStream: (stream: MediaStream | null) => void;
  setIsLive: (isLive: boolean) => void;
  setIsRecording: (isRecording: boolean) => void;
  reset: () => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  broadcast: null,
  participants: new Map(),
  mediaStates: new Map(),
  localStream: null,
  screenStream: null,
  isLive: false,
  isRecording: false,

  setBroadcast: (broadcast) => set({ broadcast }),

  addParticipant: (participant) =>
    set((state) => {
      const participants = new Map(state.participants);
      participants.set(participant.id, participant);
      return { participants };
    }),

  removeParticipant: (participantId) =>
    set((state) => {
      const participants = new Map(state.participants);
      participants.delete(participantId);
      return { participants };
    }),

  updateMediaState: (participantId, mediaState) =>
    set((state) => {
      const mediaStates = new Map(state.mediaStates);
      mediaStates.set(participantId, mediaState);
      return { mediaStates };
    }),

  setLocalStream: (stream) =>
    set((state) => {
      // Stop all tracks from previous stream to prevent memory leak
      if (state.localStream) {
        state.localStream.getTracks().forEach((track) => track.stop());
      }
      return { localStream: stream };
    }),

  setScreenStream: (stream) =>
    set((state) => {
      // Stop all tracks from previous stream to prevent memory leak
      if (state.screenStream) {
        state.screenStream.getTracks().forEach((track) => track.stop());
      }
      return { screenStream: stream };
    }),
  setIsLive: (isLive) => set({ isLive }),
  setIsRecording: (isRecording) => set({ isRecording }),

  // MAJOR FIX: Stop media tracks before resetting to prevent camera/mic LED staying on
  reset: () => {
    const state = get();

    // Stop all local stream tracks (camera/mic)
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    // Stop all screen share tracks
    if (state.screenStream) {
      state.screenStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    set({
      broadcast: null,
      participants: new Map(),
      mediaStates: new Map(),
      localStream: null,
      screenStream: null,
      isLive: false,
      isRecording: false,
    });
  },
}));
