export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  planType: 'free' | 'core' | 'advanced' | 'teams' | 'business';
  createdAt: string;
}

export interface Broadcast {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'live' | 'ended' | 'recording';
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  studioConfig?: StudioConfig;
  createdAt: string;
  updatedAt: string;
}

export interface StudioConfig {
  layout: LayoutConfig;
  branding?: BrandingConfig;
  overlays?: OverlayConfig[];
}

export interface LayoutConfig {
  type: 'single' | 'side-by-side' | 'grid' | 'pip' | 'screen-share';
  participants: ParticipantLayout[];
}

export interface ParticipantLayout {
  participantId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: 'rectangle' | 'circle' | 'rounded';
  zIndex: number;
}

export interface BrandingConfig {
  logo?: {
    url: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    size: number;
  };
  background?: {
    type: 'color' | 'image' | 'video';
    value: string;
  };
  colors?: {
    primary: string;
    secondary: string;
  };
}

export interface OverlayConfig {
  id: string;
  type: 'banner' | 'text' | 'image' | 'cta';
  content: string;
  position: { x: number; y: number };
  style: Record<string, string>;
  visible: boolean;
}

export interface Participant {
  id: string;
  broadcastId: string;
  userId?: string;
  name?: string;
  role: 'host' | 'guest' | 'backstage';
  status: 'invited' | 'joined' | 'disconnected';
  joinedAt?: string;
  leftAt?: string;
}

export interface Destination {
  id: string;
  platform: 'youtube' | 'facebook' | 'linkedin' | 'twitch' | 'custom';
  displayName?: string;
  rtmpUrl?: string;
  isActive: boolean;
}

export interface MediaState {
  audio: boolean;
  video: boolean;
  screen: boolean;
}
