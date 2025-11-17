export interface JwtPayload {
  userId: string;
  email: string;
  role?: 'user' | 'admin';
  id?: string; // Alias for userId for compatibility
}

export interface BroadcastStatus {
  id: string;
  status: 'scheduled' | 'live' | 'ended' | 'recording';
  viewerCount: number;
  startedAt?: Date;
}

export interface ParticipantInfo {
  id: string;
  name: string;
  role: 'host' | 'guest' | 'backstage' | 'greenroom';
  status: 'invited' | 'joined' | 'disconnected';
  audio: boolean;
  video: boolean;
}

export interface StudioConfig {
  layout: LayoutConfig;
  branding: BrandingConfig;
  overlays: OverlayConfig[];
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

export interface RTMPDestination {
  platform: 'youtube' | 'facebook' | 'linkedin' | 'twitch' | 'custom';
  rtmpUrl: string;
  streamKey: string;
  active: boolean;
}

export interface MediaCapabilities {
  audio: boolean;
  video: boolean;
  screen: boolean;
  videoResolution?: {
    width: number;
    height: number;
  };
}

export interface ChatMessageData {
  platform: string;
  author: string;
  message: string;
  timestamp: Date;
}
