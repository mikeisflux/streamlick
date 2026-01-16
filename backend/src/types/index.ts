import { Request } from 'express';
import { Socket } from 'socket.io';

// Authenticated request with user info
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Socket with user data
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  broadcastId?: string;
  participantId?: string;
}

// Broadcast layout types
export type LayoutType =
  | 'grid'           // Equal-sized grid
  | 'spotlight'      // One large, others small
  | 'side-by-side'   // Two columns
  | 'picture-in-picture' // Main + small overlay
  | 'single';        // One participant only

// Compositor state
export interface CompositorState {
  broadcastId: string;
  layout: LayoutType;
  participants: ParticipantState[];
  overlays: OverlayState[];
  backgroundColor: string;
  logoUrl?: string;
}

export interface ParticipantState {
  id: string;
  name: string;
  streamId: string;
  position: number;
  isOnStage: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface OverlayState {
  type: 'text' | 'image' | 'lower-third';
  content: string;
  position: { x: number; y: number };
  visible: boolean;
}

// WebRTC Signaling
export interface WebRTCOffer {
  streamId: string;
  sdp: string;
}

export interface WebRTCAnswer {
  streamId: string;
  sdp: string;
}

export interface WebRTCCandidate {
  streamId: string;
  candidate: RTCIceCandidateInit;
}

// Ant Media Events
export interface AntMediaStreamInfo {
  streamId: string;
  status: 'broadcasting' | 'finished' | 'failed';
}
