/**
 * GuestJoin Page
 *
 * Entry point for guests joining a broadcast.
 * Uses modular hooks and components for cleaner code organization.
 */

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useMedia } from '../hooks/useMedia';
import { socketService } from '../services/socket.service';
import { webrtcService } from '../services/webrtc.service';
import api from '../services/api';
import toast from 'react-hot-toast';

// Hooks - useGuestStream removed in favor of Ant Media SFU
// BUT usePreviewStream is KEPT for P2P canvas preview (composed output to guests)
import {
  useDeviceEnumeration,
  useStatusListeners,
  useGreenroomChat,
  usePreviewStream,
} from '../hooks/guest';

// Components
import { GuestJoinLobby, GuestGreenroom, GuestStatus } from '../components/guest';

// Storage key for persisting participant session
const getSessionKey = (token: string) => `streamlick_guest_${token}`;

interface StoredSession {
  participantId: string;
  guestName: string;
  hasJoined: boolean;
}

export function GuestJoin() {
  const { token } = useParams<{ token: string }>();

  // Load stored session if exists
  const storedSession = token ? (() => {
    try {
      const stored = sessionStorage.getItem(getSessionKey(token));
      return stored ? JSON.parse(stored) as StoredSession : null;
    } catch {
      return null;
    }
  })() : null;

  // Core state - restore from session if available
  const [guestName, setGuestName] = useState(storedSession?.guestName || '');
  const [isJoining, setIsJoining] = useState(false);
  const [broadcastInfo, setBroadcastInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [guestStatus, setGuestStatus] = useState<GuestStatus>('greenroom');
  const [myParticipantId, setMyParticipantId] = useState<string | null>(storedSession?.participantId || null);
  const [streamVolume, setStreamVolume] = useState(0.3);

  // Track if we should auto-rejoin on load
  const shouldAutoRejoin = storedSession?.hasJoined && storedSession?.guestName;

  // Media hook
  const {
    localStream,
    screenStream,
    audioEnabled,
    videoEnabled,
    startCamera,
    startScreenShare,
    stopScreenShare,
    toggleAudio,
    toggleVideo,
  } = useMedia();

  // Screen sharing state
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Track if we've successfully published to LiveKit
  const hasPublishedRef = useRef(false);

  // Device enumeration hook
  const {
    audioDevices,
    videoDevices,
    selectedAudioDevice,
    selectedVideoDevice,
    setSelectedAudioDevice,
    setSelectedVideoDevice,
    refreshDevices,
  } = useDeviceEnumeration();

  // Status listeners hook
  useStatusListeners({
    hasJoined,
    myParticipantId,
    onStatusChange: setGuestStatus,
  });

  // NOTE: useGuestStream (P2P camera) removed in favor of Ant Media SFU
  // Guest publishes/subscribes camera via webrtcService.joinRoom()
  // BUT usePreviewStream is used for the composed canvas preview (P2P from host)

  // Greenroom chat hook
  const {
    greenroomParticipants,
    privateChatMessages,
    publicChatMessages,
    sendPrivateChat,
  } = useGreenroomChat({ hasJoined });

  // P2P preview stream hook - receives composed canvas output from host
  // This shows the FULL broadcast preview (all participants, overlays, backgrounds)
  // NOT the raw camera streams from Ant Media SFU
  const { broadcastStream } = usePreviewStream({
    hasJoined,
    broadcastId: broadcastInfo?.id,
  });

  // Cleanup Ant Media callbacks when leaving
  // NOTE: Callbacks are set up in handleJoin BEFORE joinRoom to avoid race condition
  useEffect(() => {
    return () => {
      if (hasJoined) {
        webrtcService.setRemoteStreamCallback(() => {});
        webrtcService.setParticipantLeftCallback(() => {});
      }
    };
  }, [hasJoined]);

  // Sync audio mute state with Ant Media
  // This ensures Ant Media is notified when guest mutes/unmutes
  // The track.enabled is already set by useMedia.toggleAudio(), this adds server notification
  useEffect(() => {
    if (!hasJoined || !hasPublishedRef.current) return;

    console.log('[GuestJoin] Syncing audio mute state with Ant Media:', !audioEnabled);
    webrtcService.muteAudio(!audioEnabled);
  }, [audioEnabled, hasJoined]);

  // Sync video mute state with Ant Media
  useEffect(() => {
    if (!hasJoined || !hasPublishedRef.current) return;

    console.log('[GuestJoin] Syncing video mute state with Ant Media:', !videoEnabled);
    webrtcService.muteVideo(!videoEnabled);
  }, [videoEnabled, hasJoined]);

  // Load invite on mount
  useEffect(() => {
    const loadInvite = async () => {
      try {
        const response = await api.get(`/participants/join/${token}`);
        setBroadcastInfo(response.data.broadcast);
        if (response.data.participantName) {
          setGuestName(response.data.participantName);
        }
        setIsLoading(false);
      } catch (error) {
        toast.error('Invalid or expired invite link');
        setIsLoading(false);
      }
    };

    const initCamera = async () => {
      // Start with front camera (user) by default for mobile
      await startCamera({ facingMode: 'user' });
      // Re-enumerate devices after camera permission is granted
      // This ensures device labels are available (browsers only show labels after permission)
      await refreshDevices();
    };

    loadInvite();
    initCamera();
  }, [token]);

  // Auto-rejoin if we have a stored session (page refresh)
  const autoRejoinAttempted = useRef(false);
  useEffect(() => {
    if (
      shouldAutoRejoin &&
      broadcastInfo &&
      localStream &&
      !hasJoined &&
      !isJoining &&
      !autoRejoinAttempted.current
    ) {
      autoRejoinAttempted.current = true;
      console.log('[GuestJoin] Auto-rejoining from stored session');
      handleJoin();
    }
  }, [shouldAutoRejoin, broadcastInfo, localStream, hasJoined, isJoining]);

  // Handle camera/mic device selection changes
  useEffect(() => {
    if (!selectedVideoDevice && !selectedAudioDevice) return;
    // Only switch if we already have a stream (don't trigger on initial load)
    if (!localStream) return;

    const switchDevices = async () => {
      console.log('[GuestJoin] Switching devices:', { selectedVideoDevice, selectedAudioDevice });
      await startCamera({
        videoDeviceId: selectedVideoDevice || undefined,
        audioDeviceId: selectedAudioDevice || undefined,
      });
    };

    switchDevices();
  }, [selectedVideoDevice, selectedAudioDevice]);

  // Helper to flip camera (mobile)
  const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');
  const flipCamera = async () => {
    const newMode = currentFacingMode === 'user' ? 'environment' : 'user';
    console.log('[GuestJoin] Flipping camera to:', newMode);
    await startCamera({ facingMode: newMode });
    setCurrentFacingMode(newMode);
    await refreshDevices();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hasJoined) {
        socketService.leaveStudio();
        socketService.disconnect();
        webrtcService.close().catch((error) => {
          console.error('Error cleaning up WebRTC on unmount:', error);
        });
      }
    };
  }, [hasJoined]);

  // Join LiveKit when localStream becomes available (handles race condition)
  // If we joined before the stream was ready, this will publish once it's available
  useEffect(() => {
    if (!hasJoined || !localStream || hasPublishedRef.current) return;

    const publishToLiveKit = async () => {
      try {
        console.log('[GuestJoin] localStream now available, joining LiveKit room');
        await webrtcService.joinRoom(localStream);
        hasPublishedRef.current = true;
        console.log('[GuestJoin] Successfully published to LiveKit');
      } catch (error) {
        console.error('[GuestJoin] Failed to publish to LiveKit:', error);
      }
    };

    publishToLiveKit();
  }, [hasJoined, localStream]);

  // Join handler
  const handleJoin = async () => {
    if (!guestName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (!token || !broadcastInfo) return;

    setIsJoining(true);
    try {
      // Update participant with name
      const response = await api.post(`/participants/join/${token}`, {
        name: guestName,
      });

      const participant = response.data.participant;
      setMyParticipantId(participant.id);

      // Connect to studio with participant token
      socketService.connect(undefined, token);
      socketService.joinStudio(broadcastInfo.id, participant.id);

      // Initialize WebRTC connection to LiveKit SFU with StreamLick participant ID
      // This ensures the LiveKit participant.identity matches our database ID
      try {
        await webrtcService.initialize(broadcastInfo.id, participant.id);
      } catch (error) {
        console.error('Failed to initialize WebRTC:', error);
        throw new Error('Failed to initialize WebRTC connection');
      }

      // CRITICAL: Set up callbacks BEFORE joining room to avoid race condition
      // Tracks can arrive immediately after joinRoom() returns
      // NOTE: These callbacks receive raw camera streams from other participants (via Ant Media SFU)
      // The composed canvas preview comes separately via P2P (usePreviewStream hook)
      webrtcService.setRemoteStreamCallback((streamId: string, stream: MediaStream) => {
        console.log('[GuestJoin] Received remote participant stream from Ant Media:', streamId, {
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length,
        });
        // Note: This is a raw participant camera stream, not the composed canvas preview
        // The canvas preview is handled by the usePreviewStream P2P hook
      });
      webrtcService.setParticipantLeftCallback((streamId: string) => {
        console.log('[GuestJoin] Participant left:', streamId);
      });

      // Join room and publish local stream via LiveKit SFU
      // This handles both sending our stream and receiving other participants' streams
      if (localStream) {
        try {
          await webrtcService.joinRoom(localStream);
          hasPublishedRef.current = true;
          console.log('[GuestJoin] Joined LiveKit room with local stream');
        } catch (error) {
          console.error('Failed to join room:', error);
          throw new Error('Failed to join media room');
        }
      } else {
        // Stream not ready yet - the useEffect will handle publishing when it becomes available
        console.warn('[GuestJoin] No local stream available when joining - will publish when ready');
      }

      // Join greenroom
      socketService.emit('join-greenroom', { broadcastId: broadcastInfo.id });

      setHasJoined(true);

      // Save session for page refresh persistence
      try {
        sessionStorage.setItem(getSessionKey(token!), JSON.stringify({
          participantId: participant.id,
          guestName,
          hasJoined: true,
        } as StoredSession));
        console.log('[GuestJoin] Session saved for refresh persistence');
      } catch (e) {
        console.warn('[GuestJoin] Failed to save session:', e);
      }

      toast.success('Joined successfully! Waiting for host...');
    } catch (error) {
      console.error('Failed to join broadcast:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to join broadcast');

      // Cleanup on failure
      try {
        socketService.leaveStudio();
        socketService.disconnect();
        await webrtcService.close();
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }

      setIsJoining(false);
    }
  };

  // Send private chat handler
  const handleSendPrivateMessage = (message: string) => {
    if (broadcastInfo?.id) {
      sendPrivateChat(message, guestName, broadcastInfo.id);
    }
  };

  // Screen share handler
  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen share - restore camera track
        stopScreenShare();
        setIsScreenSharing(false);

        // Restore camera video track on the WebRTC connection
        const cameraTrack = localStream?.getVideoTracks()[0];
        if (cameraTrack) {
          try {
            await webrtcService.replaceVideoTrack(cameraTrack);
          } catch (error) {
            console.error('Failed to restore camera track:', error);
          }
        }
        toast.success('Screen sharing stopped');
      } else {
        const stream = await startScreenShare();
        if (stream) {
          setIsScreenSharing(true);
          toast.success('Screen sharing started');

          // Handle user stopping screen share via browser UI
          const screenTrack = stream.getVideoTracks()[0];
          screenTrack.onended = () => {
            setIsScreenSharing(false);
            stopScreenShare();
            // Restore camera track
            const cameraTrack = localStream?.getVideoTracks()[0];
            if (cameraTrack) {
              webrtcService.replaceVideoTrack(cameraTrack).catch(console.error);
            }
          };

          // Replace camera track with screen share track on WebRTC connection
          if (screenTrack) {
            try {
              await webrtcService.replaceVideoTrack(screenTrack);
              console.log('[GuestJoin] Replaced camera with screen share');
            } catch (error) {
              console.error('Failed to share screen via WebRTC:', error);
              toast.error('Failed to share screen');
              stopScreenShare();
              setIsScreenSharing(false);
            }
          }
        }
      }
    } catch (error: any) {
      if (error?.name !== 'NotAllowedError') {
        console.error('Screen share error:', error);
        toast.error('Failed to share screen');
      }
      setIsScreenSharing(false);
    }
  };

  // Leave handler with proper cleanup
  const handleLeave = async () => {
    if (window.confirm('Are you sure you want to leave the show?')) {
      try {
        // Stop screen sharing if active
        if (isScreenSharing) {
          stopScreenShare();
          setIsScreenSharing(false);
        }

        // Leave studio via socket
        socketService.leaveStudio();
        socketService.disconnect();

        // Close WebRTC connections
        await webrtcService.close();

        // Reset state
        setHasJoined(false);
        setGuestStatus('greenroom');
        hasPublishedRef.current = false;

        // Clear stored session so we don't auto-rejoin
        if (token) {
          try {
            sessionStorage.removeItem(getSessionKey(token));
          } catch (e) {
            // Ignore
          }
        }

        toast.success('You have left the show');

        // Redirect to home or show a "left" message
        window.location.href = '/';
      } catch (error) {
        console.error('Error leaving broadcast:', error);
        // Force reload as fallback
        window.location.reload();
      }
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Invalid invite state
  if (!broadcastInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite</h2>
          <p className="text-gray-600 mb-6">
            This invite link is invalid or has expired. Please contact the host for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Greenroom view (after joining)
  if (hasJoined) {
    return (
      <GuestGreenroom
        broadcastTitle={broadcastInfo.title}
        guestName={guestName}
        status={guestStatus}
        localStream={localStream}
        broadcastStream={broadcastStream}
        streamVolume={streamVolume}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        isScreenSharing={isScreenSharing}
        participants={greenroomParticipants}
        privateChatMessages={privateChatMessages}
        publicChatMessages={publicChatMessages}
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        selectedAudioDevice={selectedAudioDevice}
        selectedVideoDevice={selectedVideoDevice}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onVolumeChange={setStreamVolume}
        onSendPrivateMessage={handleSendPrivateMessage}
        onAudioDeviceChange={setSelectedAudioDevice}
        onVideoDeviceChange={setSelectedVideoDevice}
        onLeave={handleLeave}
      />
    );
  }

  // Lobby view (before joining)
  return (
    <GuestJoinLobby
      broadcastTitle={broadcastInfo.title}
      localStream={localStream}
      guestName={guestName}
      isJoining={isJoining}
      audioEnabled={audioEnabled}
      videoEnabled={videoEnabled}
      audioDevices={audioDevices}
      videoDevices={videoDevices}
      selectedAudioDevice={selectedAudioDevice}
      selectedVideoDevice={selectedVideoDevice}
      onNameChange={setGuestName}
      onJoin={handleJoin}
      onToggleAudio={toggleAudio}
      onToggleVideo={toggleVideo}
      onAudioDeviceChange={setSelectedAudioDevice}
      onVideoDeviceChange={setSelectedVideoDevice}
      onFlipCamera={flipCamera}
    />
  );
}
