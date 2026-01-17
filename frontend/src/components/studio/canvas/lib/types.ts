/**
 * Type definitions for the StudioCanvas component and its sub-modules
 */

export interface Banner {
  id: string;
  type: 'lower-third' | 'text-overlay' | 'cta' | 'countdown';
  title: string;
  subtitle?: string;
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  backgroundColor: string;
  textColor: string;
  visible: boolean;
}

export interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  role: 'host' | 'guest' | 'backstage';
}

export interface ChatMessage {
  author: string;
  message: string;
  timestamp: number;
}

export interface Comment {
  id: string;
  platform: 'youtube' | 'facebook' | 'twitch' | 'linkedin' | 'x' | 'rumble';
  authorName: string;
  authorAvatar?: string;
  message: string;
  timestamp: Date;
}

export interface ParticipantPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StyleSettings {
  cameraFrame: 'none' | 'rounded' | 'circle' | 'square';
  borderWidth: number;
  borderColor: string;
  showNameTags: boolean;
  nameTagStyle: 'modern' | 'classic' | 'minimal';
  nameTagPosition: 'bottom' | 'top';
}

export interface CanvasRenderRefs {
  isLocalUserOnStage: boolean;
  videoEnabled: boolean;
  selectedLayout: number;
  isSharingScreen: boolean;
  isLocalSpeaking: boolean;
  captionsEnabled: boolean;
  currentCaption: any;
  chatMessages: ChatMessage[];
  showChatOnStream: boolean;
  chatOverlayPosition: { x: number; y: number };
  chatOverlaySize: { width: number; height: number };
  teleprompterNotes: string;
  showTeleprompterOnCanvas: boolean;
  teleprompterFontSize: number;
  teleprompterScrollPosition: number;
  displayedComment: Comment | null;
  banners: Banner[];
  remoteParticipants: Map<string, RemoteParticipant>;
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  backgroundColor: string;
  orientation: 'landscape' | 'portrait';
}
