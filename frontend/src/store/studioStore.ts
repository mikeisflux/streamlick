import { create } from 'zustand';

export type LayoutType = 'grid' | 'spotlight' | 'side-by-side' | 'picture-in-picture' | 'single';
export type BroadcastStatus = 'IDLE' | 'GREENROOM' | 'LIVE' | 'ENDED';

interface Participant {
  id: string;
  name: string;
  role: 'HOST' | 'COHOST' | 'GUEST';
  status: 'WAITING' | 'GREENROOM' | 'ONSTAGE' | 'LEFT';
  streamId: string | null;
  isOnStage: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  position: number;
}

interface Broadcast {
  id: string;
  title: string;
  status: BroadcastStatus;
  layout: LayoutType;
  backgroundColor: string;
  logoUrl: string | null;
  overlayText: string | null;
  previewUrl: string | null;
}

interface StudioState {
  broadcast: Broadcast | null;
  participants: Participant[];
  localStream: MediaStream | null;
  previewStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;

  // Actions
  setBroadcast: (broadcast: Broadcast) => void;
  setParticipants: (participants: Participant[]) => void;
  updateParticipant: (participant: Partial<Participant> & { id: string }) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (id: string) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setPreviewStream: (stream: MediaStream | null) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setVideoEnabled: (enabled: boolean) => void;
  setScreenSharing: (enabled: boolean) => void;
  setLayout: (layout: LayoutType) => void;
  setBranding: (branding: { backgroundColor?: string; logoUrl?: string | null; overlayText?: string | null }) => void;
  reset: () => void;
}

const initialState = {
  broadcast: null,
  participants: [],
  localStream: null,
  previewStream: null,
  isAudioEnabled: true,
  isVideoEnabled: true,
  isScreenSharing: false,
};

export const useStudioStore = create<StudioState>((set) => ({
  ...initialState,

  setBroadcast: (broadcast) => set({ broadcast }),

  setParticipants: (participants) => set({ participants }),

  updateParticipant: (updated) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === updated.id ? { ...p, ...updated } : p
      ),
    })),

  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants, participant],
    })),

  removeParticipant: (id) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== id),
    })),

  setLocalStream: (stream) => set({ localStream: stream }),

  setPreviewStream: (stream) => set({ previewStream: stream }),

  setAudioEnabled: (enabled) => set({ isAudioEnabled: enabled }),

  setVideoEnabled: (enabled) => set({ isVideoEnabled: enabled }),

  setScreenSharing: (enabled) => set({ isScreenSharing: enabled }),

  setLayout: (layout) =>
    set((state) => ({
      broadcast: state.broadcast ? { ...state.broadcast, layout } : null,
    })),

  setBranding: (branding) =>
    set((state) => ({
      broadcast: state.broadcast ? { ...state.broadcast, ...branding } : null,
    })),

  reset: () => set(initialState),
}));
