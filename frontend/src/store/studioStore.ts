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

  setBroadcast: (broadcast: Broadcast) => set({ broadcast }),

  setParticipants: (participants: Participant[]) => set({ participants }),

  updateParticipant: (updated: Partial<Participant> & { id: string }) =>
    set((state: StudioState) => ({
      participants: state.participants.map((p: Participant) =>
        p.id === updated.id ? { ...p, ...updated } : p
      ),
    })),

  addParticipant: (participant: Participant) =>
    set((state: StudioState) => ({
      participants: [...state.participants, participant],
    })),

  removeParticipant: (id: string) =>
    set((state: StudioState) => ({
      participants: state.participants.filter((p: Participant) => p.id !== id),
    })),

  setLocalStream: (stream: MediaStream | null) => set({ localStream: stream }),

  setPreviewStream: (stream: MediaStream | null) => set({ previewStream: stream }),

  setAudioEnabled: (enabled: boolean) => set({ isAudioEnabled: enabled }),

  setVideoEnabled: (enabled: boolean) => set({ isVideoEnabled: enabled }),

  setScreenSharing: (enabled: boolean) => set({ isScreenSharing: enabled }),

  setLayout: (layout: LayoutType) =>
    set((state: StudioState) => ({
      broadcast: state.broadcast ? { ...state.broadcast, layout } : null,
    })),

  setBranding: (branding: { backgroundColor?: string; logoUrl?: string | null; overlayText?: string | null }) =>
    set((state: StudioState) => ({
      broadcast: state.broadcast ? { ...state.broadcast, ...branding } : null,
    })),

  reset: () => set(initialState),
}));
