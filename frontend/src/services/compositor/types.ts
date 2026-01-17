/**
 * Compositor Types
 *
 * Shared type definitions for the compositor service.
 */

export interface ParticipantStream {
  id: string;
  name: string;
  stream: MediaStream;
  isLocal: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  avatarUrl?: string;
}

export interface LayoutConfig {
  type: 'grid' | 'spotlight' | 'sidebar' | 'pip' | 'screenshare';
  spotlightId?: string;
  positions?: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface OverlayAsset {
  id: string;
  type: 'logo' | 'banner' | 'background';
  url: string;
  position?: { x: number; y: number; width?: number; height?: number };
}

export interface ChatMessage {
  id: string;
  platform: 'youtube' | 'facebook' | 'twitch' | 'x' | 'rumble';
  author: string;
  message: string;
  timestamp: Date;
}

export interface LowerThird {
  id: string;
  name: string;
  title?: string;
  subtitle?: string;
  style?: 'modern' | 'classic' | 'minimal' | 'bold';
  position?: 'left' | 'center' | 'right';
}

export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

// Extended MediaStreamTrack for canvas capture
export interface CanvasCaptureMediaStreamTrack extends MediaStreamTrack {
  requestFrame(): void;
}
