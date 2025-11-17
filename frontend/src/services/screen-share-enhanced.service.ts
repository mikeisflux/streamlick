/**
 * Enhanced Screen Share Service
 *
 * Features:
 * - Broadcaster screen share with camera (simultaneous display)
 * - Participant screen sharing with approval system
 * - System audio capture
 * - Screen share state management
 * - Multiple screen share support
 */

import io from 'socket.io-client';
import { EventEmitter } from 'events';

type Socket = ReturnType<typeof io>;

export interface ScreenShareParticipant {
  participantId: string;
  participantName: string;
  stream: MediaStream | null;
  isApproved: boolean;
  isPending: boolean;
  hasAudio: boolean;
}

export interface ScreenShareRequest {
  participantId: string;
  participantName: string;
  hasAudio: boolean;
  timestamp: Date;
}

export interface ScreenShareState {
  isScreenSharing: boolean;
  hasCamera: boolean; // Broadcaster keeps camera on while screen sharing
  screenStream: MediaStream | null;
  cameraStream: MediaStream | null;
  hasSystemAudio: boolean;
  participants: Map<string, ScreenShareParticipant>;
  pendingRequests: ScreenShareRequest[];
}

export class ScreenShareEnhancedService extends EventEmitter {
  private static instance: ScreenShareEnhancedService;
  private socket: Socket | null = null;
  private state: ScreenShareState = {
    isScreenSharing: false,
    hasCamera: true,
    screenStream: null,
    cameraStream: null,
    hasSystemAudio: false,
    participants: new Map(),
    pendingRequests: [],
  };
  // CRITICAL FIX: Track socket listeners for cleanup
  private socketListeners = new Map<string, (...args: any[]) => void>();
  // CRITICAL FIX: Track media stream event listeners
  private trackListeners = new Map<MediaStreamTrack, Map<string, (...args: any[]) => void>>();

  private constructor() {
    super();
  }

  static getInstance(): ScreenShareEnhancedService {
    if (!ScreenShareEnhancedService.instance) {
      ScreenShareEnhancedService.instance = new ScreenShareEnhancedService();
    }
    return ScreenShareEnhancedService.instance;
  }

  /**
   * Initialize screen share service with socket connection
   */
  initialize(socket: Socket, broadcastId: string): void {
    // CRITICAL FIX: Remove existing listeners before adding new ones
    this.removeSocketListeners();

    this.socket = socket;

    // CRITICAL FIX: Track listeners for cleanup
    const onScreenShareRequest = (data: { participantId: string; participantName: string; hasAudio: boolean }) => {
      const request: ScreenShareRequest = {
        participantId: data.participantId,
        participantName: data.participantName,
        hasAudio: data.hasAudio,
        timestamp: new Date(),
      };
      this.state.pendingRequests.push(request);
      this.emit('screen-share-request', request);
    };
    this.socketListeners.set('screen-share-request', onScreenShareRequest);
    this.socket.on('screen-share-request', onScreenShareRequest);

    const onScreenShareApproved = (data: { participantId: string }) => {
      this.emit('screen-share-approved', data.participantId);
    };
    this.socketListeners.set('screen-share-approved', onScreenShareApproved);
    this.socket.on('screen-share-approved', onScreenShareApproved);

    const onScreenShareDenied = (data: { participantId: string; reason?: string }) => {
      this.emit('screen-share-denied', data);
    };
    this.socketListeners.set('screen-share-denied', onScreenShareDenied);
    this.socket.on('screen-share-denied', onScreenShareDenied);

    const onParticipantScreenShareStarted = (data: { participantId: string; participantName: string; hasAudio: boolean }) => {
      const participant: ScreenShareParticipant = {
        participantId: data.participantId,
        participantName: data.participantName,
        stream: null, // Will be set when WebRTC connection is established
        isApproved: true,
        isPending: false,
        hasAudio: data.hasAudio,
      };
      this.state.participants.set(data.participantId, participant);
      this.emit('participant-screen-share-started', participant);
    };
    this.socketListeners.set('participant-screen-share-started', onParticipantScreenShareStarted);
    this.socket.on('participant-screen-share-started', onParticipantScreenShareStarted);

    const onParticipantScreenShareStopped = (data: { participantId: string }) => {
      const participant = this.state.participants.get(data.participantId);
      if (participant) {
        participant.stream?.getTracks().forEach(track => track.stop());
        this.state.participants.delete(data.participantId);
        this.emit('participant-screen-share-stopped', data.participantId);
      }
    };
    this.socketListeners.set('participant-screen-share-stopped', onParticipantScreenShareStopped);
    this.socket.on('participant-screen-share-stopped', onParticipantScreenShareStopped);
  }

  // CRITICAL FIX: Remove socket listeners
  private removeSocketListeners(): void {
    if (!this.socket) return;

    this.socketListeners.forEach((listener, event) => {
      this.socket?.off(event, listener);
    });
    this.socketListeners.clear();
  }

  // CRITICAL FIX: Remove track event listeners
  private removeTrackListeners(track: MediaStreamTrack): void {
    const listeners = this.trackListeners.get(track);
    if (listeners) {
      listeners.forEach((listener, event) => {
        track.removeEventListener(event, listener);
      });
      this.trackListeners.delete(track);
    }
  }

  // CRITICAL FIX: Remove all track event listeners
  private removeAllTrackListeners(): void {
    this.trackListeners.forEach((listeners, track) => {
      listeners.forEach((listener, event) => {
        track.removeEventListener(event, listener);
      });
    });
    this.trackListeners.clear();
  }

  /**
   * Start broadcaster screen share with camera
   * Broadcaster stays visible on camera while sharing screen
   */
  async startBroadcasterScreenShare(options?: {
    includeCamera?: boolean;
    includeSystemAudio?: boolean;
  }): Promise<MediaStream> {
    try {
      const includeCamera = options?.includeCamera !== false; // Default true
      const includeSystemAudio = options?.includeSystemAudio !== false; // Default true

      // Get screen share stream with audio
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        } as MediaTrackConstraints,
        audio: includeSystemAudio ? {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } : false,
      });

      this.state.screenStream = screenStream;
      this.state.hasSystemAudio = includeSystemAudio && screenStream.getAudioTracks().length > 0;

      // CRITICAL FIX: Handle browser "Stop Sharing" button and track listener
      const screenTrack = screenStream.getVideoTracks()[0];
      const onEnded = () => {
        this.stopBroadcasterScreenShare();
      };
      if (!this.trackListeners.has(screenTrack)) {
        this.trackListeners.set(screenTrack, new Map());
      }
      this.trackListeners.get(screenTrack)!.set('ended', onEnded);
      screenTrack.addEventListener('ended', onEnded);

      // Get camera stream if requested
      if (includeCamera) {
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false, // Audio already captured from main mic
          });
          this.state.cameraStream = cameraStream;
          this.state.hasCamera = true;
        } catch (cameraError) {
          console.warn('Could not access camera:', cameraError);
          this.state.hasCamera = false;
        }
      } else {
        this.state.hasCamera = false;
      }

      this.state.isScreenSharing = true;

      // Notify backend
      this.socket?.emit('broadcaster-screen-share-started', {
        hasCamera: this.state.hasCamera,
        hasSystemAudio: this.state.hasSystemAudio,
      });

      this.emit('broadcaster-screen-share-started', {
        screenStream,
        cameraStream: this.state.cameraStream,
        hasCamera: this.state.hasCamera,
        hasSystemAudio: this.state.hasSystemAudio,
      });

      return screenStream;
    } catch (error) {
      console.error('Failed to start broadcaster screen share:', error);
      throw error;
    }
  }

  /**
   * Stop broadcaster screen share
   */
  stopBroadcasterScreenShare(): void {
    // CRITICAL FIX: Remove track event listeners before stopping tracks
    if (this.state.screenStream) {
      this.state.screenStream.getTracks().forEach(track => {
        this.removeTrackListeners(track);
        track.stop();
      });
      this.state.screenStream = null;
    }

    // Stop camera stream if it was started for screen sharing
    // Note: Main camera stream is handled separately by the studio
    if (this.state.cameraStream) {
      this.state.cameraStream.getTracks().forEach(track => {
        this.removeTrackListeners(track);
        track.stop();
      });
      this.state.cameraStream = null;
    }

    this.state.isScreenSharing = false;
    this.state.hasCamera = false;
    this.state.hasSystemAudio = false;

    // Notify backend
    this.socket?.emit('broadcaster-screen-share-stopped');

    this.emit('broadcaster-screen-share-stopped');
  }

  /**
   * Request screen share permission (for participants)
   */
  async requestScreenShare(participantId: string, participantName: string): Promise<void> {
    try {
      // Get screen share stream to check capabilities
      const testStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const hasAudio = testStream.getAudioTracks().length > 0;

      // Stop test stream immediately
      testStream.getTracks().forEach(track => track.stop());

      // Send request to host
      this.socket?.emit('request-screen-share', {
        participantId,
        participantName,
        hasAudio,
      });

      this.emit('screen-share-request-sent', { participantId, hasAudio });
    } catch (error) {
      console.error('Failed to request screen share:', error);
      throw error;
    }
  }

  /**
   * Approve participant screen share request (host only)
   */
  approveScreenShare(participantId: string): void {
    const requestIndex = this.state.pendingRequests.findIndex(
      req => req.participantId === participantId
    );

    if (requestIndex !== -1) {
      this.state.pendingRequests.splice(requestIndex, 1);
    }

    this.socket?.emit('approve-screen-share', { participantId });
  }

  /**
   * Deny participant screen share request (host only)
   */
  denyScreenShare(participantId: string, reason?: string): void {
    const requestIndex = this.state.pendingRequests.findIndex(
      req => req.participantId === participantId
    );

    if (requestIndex !== -1) {
      this.state.pendingRequests.splice(requestIndex, 1);
    }

    this.socket?.emit('deny-screen-share', { participantId, reason });
  }

  /**
   * Start participant screen share (after approval)
   */
  async startParticipantScreenShare(participantId: string): Promise<MediaStream> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        } as MediaTrackConstraints,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const hasAudio = screenStream.getAudioTracks().length > 0;

      // CRITICAL FIX: Handle browser "Stop Sharing" button and track listener
      const participantTrack = screenStream.getVideoTracks()[0];
      const onParticipantEnded = () => {
        this.stopParticipantScreenShare(participantId);
      };
      if (!this.trackListeners.has(participantTrack)) {
        this.trackListeners.set(participantTrack, new Map());
      }
      this.trackListeners.get(participantTrack)!.set('ended', onParticipantEnded);
      participantTrack.addEventListener('ended', onParticipantEnded);

      // Notify backend
      this.socket?.emit('participant-screen-share-started', {
        participantId,
        hasAudio,
      });

      return screenStream;
    } catch (error) {
      console.error('Failed to start participant screen share:', error);
      throw error;
    }
  }

  /**
   * Stop participant screen share
   */
  stopParticipantScreenShare(participantId: string): void {
    const participant = this.state.participants.get(participantId);
    if (participant && participant.stream) {
      // CRITICAL FIX: Remove track event listeners before stopping tracks
      participant.stream.getTracks().forEach(track => {
        this.removeTrackListeners(track);
        track.stop();
      });
      this.state.participants.delete(participantId);
    }

    // Notify backend
    this.socket?.emit('participant-screen-share-stopped', { participantId });

    this.emit('participant-screen-share-stopped', participantId);
  }

  /**
   * Set participant screen stream (called by WebRTC service)
   */
  setParticipantScreenStream(participantId: string, stream: MediaStream): void {
    const participant = this.state.participants.get(participantId);
    if (participant) {
      participant.stream = stream;
      this.emit('participant-screen-stream-ready', { participantId, stream });
    }
  }

  /**
   * Get current state
   */
  getState(): ScreenShareState {
    return { ...this.state };
  }

  /**
   * Get broadcaster screen and camera streams
   */
  getBroadcasterStreams(): { screenStream: MediaStream | null; cameraStream: MediaStream | null } {
    return {
      screenStream: this.state.screenStream,
      cameraStream: this.state.cameraStream,
    };
  }

  /**
   * Get participant screen stream
   */
  getParticipantScreenStream(participantId: string): MediaStream | null {
    return this.state.participants.get(participantId)?.stream || null;
  }

  /**
   * Get all pending screen share requests
   */
  getPendingRequests(): ScreenShareRequest[] {
    return [...this.state.pendingRequests];
  }

  /**
   * Get all active participant screen shares
   */
  getActiveParticipantShares(): ScreenShareParticipant[] {
    return Array.from(this.state.participants.values());
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stopBroadcasterScreenShare();

    // Stop all participant screen shares
    this.state.participants.forEach((participant, participantId) => {
      this.stopParticipantScreenShare(participantId);
    });

    this.state.participants.clear();
    this.state.pendingRequests = [];

    // CRITICAL FIX: Remove all event listeners
    this.removeSocketListeners();
    this.removeAllTrackListeners();
    this.removeAllListeners(); // Remove EventEmitter listeners

    this.socket = null;
  }
}

export default ScreenShareEnhancedService.getInstance();
