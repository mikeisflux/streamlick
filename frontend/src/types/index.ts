// Broadcast types
export type BroadcastStatus = 'IDLE' | 'GREENROOM' | 'LIVE' | 'ENDED' | 'live' | 'scheduled' | 'error';
export type LayoutType = 'grid' | 'spotlight' | 'side-by-side' | 'picture-in-picture' | 'single';
export type Platform = 'YOUTUBE' | 'TWITCH' | 'FACEBOOK' | 'CUSTOM_RTMP' | 'youtube' | 'twitch' | 'facebook' | 'x' | 'linkedin' | 'custom';
export type ParticipantRole = 'HOST' | 'COHOST' | 'GUEST';
export type ParticipantStatus = 'WAITING' | 'GREENROOM' | 'ONSTAGE' | 'LEFT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  avatar?: string;
  avatarUrl?: string; // Alias for avatar
  planType?: 'free' | 'pro' | 'enterprise';
}

export interface StudioConfig {
  layout?: LayoutType;
  backgroundColor?: string;
  logoUrl?: string;
  overlayText?: string;
  showChat?: boolean;
  showCaptions?: boolean;
  selectedDestinations?: string[];
  broadcastType?: 'live' | 'scheduled' | 'practice' | 'recording' | 'webinar';
  source?: string;
  isReusable?: boolean;
  localRecordings?: boolean;
  [key: string]: unknown; // Allow additional properties
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
  studioConfig?: StudioConfig;
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
  displayName?: string; // Optional display name
  platform: Platform;
  rtmpUrl: string;
  streamKey: string;
  platformId?: string;
  accessToken?: string;
  userId: string;
  isActive?: boolean; // Active status
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

// Media state for participants
export interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing?: boolean;
  audioLevel?: number;
}

// Performance metrics for compositor
export interface PerformanceMetrics {
  fps?: number;
  frameTime?: number;
  renderTime?: number;
  encodeTime?: number;
  droppedFrames: number;
  totalFrames: number;
  memoryUsage?: number;
  cpuUsage?: number;
  averageRenderTime?: string;
  maxRenderTime?: string;
  minRenderTime?: string;
  dropRate?: string;
  participantCount?: number;
  overlayCount?: number;
  chatMessagesCount?: number;
}

// Layout configuration
export interface LayoutConfig {
  type: LayoutType;
  participantPositions?: Record<string, { x: number; y: number; width: number; height: number }>;
  backgroundColor?: string;
  gap?: number;
  padding?: number;
}
