import { create } from 'zustand';
import { Broadcast, Participant, MediaState, LayoutType } from '../types';

// Re-export LayoutType for backwards compatibility
export type { LayoutType } from '../types';

interface StudioState {
  broadcast: Broadcast | null;
  participants: Participant[];
  mediaStates: Map<string, MediaState>;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isLive: boolean;
  isRecording: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  layout: LayoutType;

  // Broadcast actions
  setBroadcast: (broadcast: Broadcast | Partial<Broadcast>) => void;
  setLayout: (layout: LayoutType) => void;

  // Participant actions
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (participantId: string) => void;
  updateParticipant: (participant: Participant | Partial<Participant> & { id: string }) => void;

  // Media state actions
  updateMediaState: (participantId: string, state: MediaState) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setScreenStream: (stream: MediaStream | null) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setVideoEnabled: (enabled: boolean) => void;

  // Status actions
  setIsLive: (isLive: boolean) => void;
  setIsRecording: (isRecording: boolean) => void;
  reset: () => void;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  broadcast: null,
  participants: [],
  mediaStates: new Map(),
  localStream: null,
  screenStream: null,
  isLive: false,
  isRecording: false,
  isAudioEnabled: true,
  isVideoEnabled: true,
  layout: 'grid',

  setBroadcast: (broadcast) =>
    set((state) => {
      if (state.broadcast) {
        // Merge with existing broadcast
        return { broadcast: { ...state.broadcast, ...broadcast } as Broadcast };
      }
      return { broadcast: broadcast as Broadcast };
    }),

  setLayout: (layout) =>
    set((state) => {
      if (state.broadcast) {
        return {
          layout,
          broadcast: { ...state.broadcast, layout },
        };
      }
      return { layout };
    }),

  setParticipants: (participants) => set({ participants }),

  addParticipant: (participant: Participant) =>
    set((state) => ({
      participants: [...state.participants, participant],
    })),

  removeParticipant: (participantId: string) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== participantId),
    })),

  updateParticipant: (participant) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === participant.id ? { ...p, ...participant } : p
      ),
    })),

  updateMediaState: (participantId: string, mediaState: MediaState) =>
    set((state) => {
      const mediaStates = new Map(state.mediaStates);
      mediaStates.set(participantId, mediaState);
      return { mediaStates };
    }),

  setLocalStream: (stream: MediaStream | null) =>
    set((state) => {
      // Stop all tracks from previous stream to prevent memory leak
      if (state.localStream) {
        state.localStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      return { localStream: stream };
    }),

  setScreenStream: (stream: MediaStream | null) =>
    set((state) => {
      // Stop all tracks from previous stream to prevent memory leak
      if (state.screenStream) {
        state.screenStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      return { screenStream: stream };
    }),

  setAudioEnabled: (enabled) => set({ isAudioEnabled: enabled }),
  setVideoEnabled: (enabled) => set({ isVideoEnabled: enabled }),

  setIsLive: (isLive: boolean) => set({ isLive }),
  setIsRecording: (isRecording: boolean) => set({ isRecording }),

  // MAJOR FIX: Stop media tracks before resetting to prevent camera/mic LED staying on
  reset: () => {
    const state = get();

    // Stop all local stream tracks (camera/mic)
    if (state.localStream) {
      state.localStream.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
    }

    // Stop all screen share tracks
    if (state.screenStream) {
      state.screenStream.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
    }

    set({
      broadcast: null,
      participants: [],
      mediaStates: new Map(),
      localStream: null,
      screenStream: null,
      isLive: false,
      isRecording: false,
      isAudioEnabled: true,
      isVideoEnabled: true,
      layout: 'grid',
    });
  },
}));
