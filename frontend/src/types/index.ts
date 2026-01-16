// Broadcast types
export type BroadcastStatus = 'IDLE' | 'GREENROOM' | 'LIVE' | 'ENDED';
export type LayoutType = 'grid' | 'spotlight' | 'side-by-side' | 'picture-in-picture' | 'single';
export type Platform = 'YOUTUBE' | 'TWITCH' | 'FACEBOOK' | 'CUSTOM_RTMP';
export type ParticipantRole = 'HOST' | 'COHOST' | 'GUEST';
export type ParticipantStatus = 'WAITING' | 'GREENROOM' | 'ONSTAGE' | 'LEFT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  avatar?: string;
}

export interface Broadcast {
  id: string;
  title: string;
  description?: string;
  status: BroadcastStatus;
  streamKey: string;
  previewUrl?: string;
  layout: LayoutType;
  backgroundColor: string;
  logoUrl?: string;
  overlayText?: string;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  userId: string;
  participants?: Participant[];
  outputs?: BroadcastOutput[];
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  streamId?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  position: number;
  isOnStage: boolean;
  inviteToken: string;
  broadcastId: string;
  userId?: string;
  joinedAt?: string;
  leftAt?: string;
}

export interface Destination {
  id: string;
  name: string;
  platform: Platform;
  rtmpUrl: string;
  streamKey: string;
  platformId?: string;
  accessToken?: string;
  userId: string;
}

export interface BroadcastOutput {
  id: string;
  status: 'IDLE' | 'STARTING' | 'LIVE' | 'ERROR' | 'STOPPED';
  broadcastId: string;
  destinationId: string;
  destination: Destination;
  startedAt?: string;
  endedAt?: string;
}

// WebRTC types
export interface StreamInfo {
  streamId: string;
  participantId: string;
  stream: MediaStream;
}
