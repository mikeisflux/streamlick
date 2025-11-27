import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMedia } from '../hooks/useMedia';
import { socketService } from '../services/socket.service';
import { webrtcService } from '../services/webrtc.service';
import { VideoPreview } from '../components/VideoPreview';
import { Button } from '../components/Button';
import api from '../services/api';
import toast from 'react-hot-toast';

export function GuestJoin() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [guestName, setGuestName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [broadcastInfo, setBroadcastInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [guestStatus, setGuestStatus] = useState<'greenroom' | 'backstage' | 'live'>('greenroom');

  // Broadcast stream preview state
  const [broadcastStream, setBroadcastStream] = useState<MediaStream | null>(null);
  const [streamVolume, setStreamVolume] = useState(0.3); // Default 30%
  const broadcastVideoRef = useRef<HTMLVideoElement>(null);

  // Other greenroom participants for video chat
  const [greenroomParticipants, setGreenroomParticipants] = useState<Map<string, { id: string; name: string; stream: MediaStream | null; audioEnabled: boolean; videoEnabled: boolean; }>>(new Map());

  // Chat state
  const [privateChatMessages, setPrivateChatMessages] = useState<Array<{ author: string; message: string; timestamp: number; }>>([]);
  const [publicChatMessages, setPublicChatMessages] = useState<Array<{ author: string; message: string; timestamp: number; }>>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [activeChatTab, setActiveChatTab] = useState<'private' | 'public'>('private');

  // Device state
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [showDeviceSelectors, setShowDeviceSelectors] = useState(false);

  const {
    localStream,
    audioEnabled,
    videoEnabled,
    startCamera,
    toggleAudio,
    toggleVideo,
  } = useMedia();

  // Load available devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((d) => d.kind === 'audioinput');
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');

        setAudioDevices(audioInputs);
        setVideoDevices(videoInputs);

        // Set defaults
        if (audioInputs.length > 0 && !selectedAudioDevice) {
          setSelectedAudioDevice(audioInputs[0].deviceId);
        }
        if (videoInputs.length > 0 && !selectedVideoDevice) {
          setSelectedVideoDevice(videoInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Failed to enumerate devices:', error);
      }
    };

    loadDevices();
  }, []);

  useEffect(() => {
    const loadInvite = async () => {
      try {
        // Use GET to validate without marking as joined
        const response = await api.get(`/participants/join/${token}`);
        setBroadcastInfo(response.data.broadcast);
        // Pre-fill name if one was set when invite was created
        if (response.data.participantName) {
          setGuestName(response.data.participantName);
        }
        setIsLoading(false);
      } catch (error) {
        toast.error('Invalid or expired invite link');
        setIsLoading(false);
      }
    };

    loadInvite();
    startCamera();
  }, [token]);

  // Listen for status changes from host
  useEffect(() => {
    if (!hasJoined) return;

    const handlePromoted = () => {
      setGuestStatus('live');
      toast.success('You are now LIVE on the broadcast!', {
        duration: 5000,
        icon: '🔴',
      });
    };

    const handleDemoted = () => {
      setGuestStatus('backstage');
      toast.success('Moved to backstage');
    };

    const handleMovedToBackstage = () => {
      setGuestStatus('backstage');
      toast.success('Moved to backstage - Get ready to go live!');
    };

    socketService.on('participant-promoted', handlePromoted);
    socketService.on('participant-demoted', handleDemoted);
    socketService.on('moved-to-backstage', handleMovedToBackstage);

    return () => {
      socketService.off('participant-promoted', handlePromoted);
      socketService.off('participant-demoted', handleDemoted);
      socketService.off('moved-to-backstage', handleMovedToBackstage);
    };
  }, [hasJoined]);

  // Preview stream peer connection ref
  const previewPcRef = useRef<RTCPeerConnection | null>(null);
  const hostSocketIdRef = useRef<string | null>(null);

  // ICE servers for WebRTC
  const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  // Track if we've received an offer
  const offerReceivedRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 3000; // 3 seconds

  // Request and receive preview stream via WebRTC
  useEffect(() => {
    if (!hasJoined || !broadcastInfo?.id) return;

    offerReceivedRef.current = false;
    retryCountRef.current = 0;

    // Handle WebRTC offer from host
    const handlePreviewOffer = async ({ offer, hostSocketId }: { offer: RTCSessionDescriptionInit; hostSocketId: string }) => {
      console.log('[PreviewStream] Received offer from host');
      offerReceivedRef.current = true;
      hostSocketIdRef.current = hostSocketId;

      // Clear any retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      // Close existing peer connection if any
      if (previewPcRef.current) {
        previewPcRef.current.close();
      }

      // Create peer connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      previewPcRef.current = pc;

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log('[PreviewStream] Received track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          setBroadcastStream(event.streams[0]);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && hostSocketIdRef.current) {
          socketService.emit('preview-ice-candidate', {
            targetSocketId: hostSocketIdRef.current,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log('[PreviewStream] Connection state:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setBroadcastStream(null);
          offerReceivedRef.current = false;
          // Try to reconnect after a delay
          setTimeout(() => {
            if (hasJoined && broadcastInfo?.id) {
              console.log('[PreviewStream] Reconnecting...');
              retryCountRef.current = 0; // Reset retry count for reconnection
              socketService.emit('request-preview-stream', { broadcastId: broadcastInfo.id });
            }
          }, 2000);
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketService.emit('preview-answer', {
          hostSocketId,
          answer: pc.localDescription?.toJSON(),
        });
      } catch (error) {
        console.error('[PreviewStream] Error handling offer:', error);
      }
    };

    // Handle ICE candidate from host
    const handlePreviewIceCandidate = async ({ candidate, fromSocketId }: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
      if (!previewPcRef.current) return;

      try {
        await previewPcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('[PreviewStream] Error adding ICE candidate:', error);
      }
    };

    // Function to request preview stream with retry logic
    const requestPreviewWithRetry = () => {
      if (!hasJoined || !broadcastInfo?.id) return;

      console.log(`[PreviewStream] Requesting preview stream (attempt ${retryCountRef.current + 1}/${MAX_RETRIES + 1})...`);
      socketService.emit('request-preview-stream', { broadcastId: broadcastInfo.id });

      // Set up retry if no offer received
      retryTimeoutRef.current = setTimeout(() => {
        if (!offerReceivedRef.current && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          console.log('[PreviewStream] No offer received, retrying...');
          requestPreviewWithRetry();
        } else if (!offerReceivedRef.current) {
          console.warn('[PreviewStream] Max retries reached, preview stream unavailable');
        }
      }, RETRY_DELAY);
    };

    socketService.on('preview-offer', handlePreviewOffer);
    socketService.on('preview-ice-candidate', handlePreviewIceCandidate);

    // Request preview stream from host with retry logic
    requestPreviewWithRetry();

    return () => {
      socketService.off('preview-offer', handlePreviewOffer);
      socketService.off('preview-ice-candidate', handlePreviewIceCandidate);

      // Clear retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      // Close peer connection
      if (previewPcRef.current) {
        previewPcRef.current.close();
        previewPcRef.current = null;
      }
    };
  }, [hasJoined, broadcastInfo?.id]);

  // P2P Stream to Host - send our camera/mic directly to the host
  const guestStreamPcRef = useRef<RTCPeerConnection | null>(null);
  const hostStreamSocketIdRef = useRef<string | null>(null);

  // Active polling for guest stream offers - NEVER give up until connected
  const guestStreamAnswerReceivedRef = useRef(false);
  const guestStreamRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const guestStreamRetryCountRef = useRef(0);
  const guestStreamConnectedRef = useRef(false); // True when WebRTC is fully connected
  const activePollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const GUEST_STREAM_MAX_RETRIES = 10; // Initial retry burst
  const GUEST_STREAM_RETRY_DELAY = 3000; // 3 seconds for initial burst
  const ACTIVE_POLLING_INTERVAL = 5000; // 5 seconds for continuous polling after initial burst

  useEffect(() => {
    if (!hasJoined || !broadcastInfo?.id || !localStream) return;

    console.log('[GuestStream] Setting up P2P stream to host');
    guestStreamAnswerReceivedRef.current = false;
    guestStreamRetryCountRef.current = 0;
    guestStreamConnectedRef.current = false;

    // Handle answer from host
    const handleGuestStreamAnswer = async ({ answer, hostSocketId }: { answer: RTCSessionDescriptionInit; hostSocketId: string }) => {
      console.log('[GuestStream] Received answer from host - connection in progress');
      guestStreamAnswerReceivedRef.current = true;
      hostStreamSocketIdRef.current = hostSocketId;

      // Clear retry timeout since we got an answer
      if (guestStreamRetryTimeoutRef.current) {
        clearTimeout(guestStreamRetryTimeoutRef.current);
        guestStreamRetryTimeoutRef.current = null;
      }

      // Note: Don't stop active polling here - wait for connectionState to be 'connected'
      // The active polling will check connectionState and stop itself when connected

      if (!guestStreamPcRef.current) {
        console.warn('[GuestStream] No peer connection for answer');
        return;
      }

      try {
        await guestStreamPcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('[GuestStream] Remote description set successfully, waiting for WebRTC connection...');
      } catch (error) {
        console.error('[GuestStream] Error setting remote description:', error);
        // Reset flag so active polling will retry
        guestStreamAnswerReceivedRef.current = false;
      }
    };

    // Handle ICE candidate from host
    const handleGuestStreamIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (!guestStreamPcRef.current) return;

      try {
        await guestStreamPcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('[GuestStream] Error adding ICE candidate:', error);
      }
    };

    // Create peer connection and send offer
    const setupGuestStream = async () => {
      console.log('[GuestStream] Creating peer connection to send stream to host');

      // Close existing connection if any (for retries)
      if (guestStreamPcRef.current) {
        guestStreamPcRef.current.close();
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      guestStreamPcRef.current = pc;

      // Add local tracks
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
        console.log('[GuestStream] Added track:', track.kind);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && hostStreamSocketIdRef.current) {
          socketService.emit('guest-stream-ice-candidate', {
            targetSocketId: hostStreamSocketIdRef.current,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        console.log('[GuestStream] Connection state:', pc.connectionState);

        // Track when fully connected - stop polling
        if (pc.connectionState === 'connected') {
          console.log('[GuestStream] WebRTC connected! Stopping active polling.');
          guestStreamConnectedRef.current = true;
          // Stop active polling since we're connected
          if (activePollingIntervalRef.current) {
            clearInterval(activePollingIntervalRef.current);
            activePollingIntervalRef.current = null;
          }
          if (guestStreamRetryTimeoutRef.current) {
            clearTimeout(guestStreamRetryTimeoutRef.current);
            guestStreamRetryTimeoutRef.current = null;
          }
        }

        // If connection failed or disconnected, restart active polling
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.log('[GuestStream] Connection lost, restarting active polling...');
          guestStreamAnswerReceivedRef.current = false;
          guestStreamConnectedRef.current = false;
          guestStreamRetryCountRef.current = 0;
          // Start retry after a short delay
          guestStreamRetryTimeoutRef.current = setTimeout(() => {
            startActivePolling();
          }, 2000);
        }
      };

      // Create and send offer
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        console.log('[GuestStream] Sending offer to host');
        socketService.emit('guest-stream-offer', {
          offer: pc.localDescription?.toJSON(),
        });
      } catch (error) {
        console.error('[GuestStream] Error creating offer:', error);
      }
    };

    // Function to send offer with retry logic (initial burst)
    const sendOfferWithRetry = () => {
      if (!hasJoined || !broadcastInfo?.id || !localStream) return;
      if (guestStreamConnectedRef.current) return; // Already connected

      console.log(`[GuestStream] Sending offer (attempt ${guestStreamRetryCountRef.current + 1}/${GUEST_STREAM_MAX_RETRIES + 1})...`);
      setupGuestStream();

      // Set up retry if no answer received
      guestStreamRetryTimeoutRef.current = setTimeout(() => {
        if (guestStreamConnectedRef.current) return; // Connected during timeout

        if (!guestStreamAnswerReceivedRef.current && guestStreamRetryCountRef.current < GUEST_STREAM_MAX_RETRIES) {
          guestStreamRetryCountRef.current++;
          console.log('[GuestStream] No answer received, retrying...');
          sendOfferWithRetry();
        } else if (!guestStreamAnswerReceivedRef.current) {
          console.log('[GuestStream] Initial burst complete, switching to active polling mode...');
          startActivePolling();
        }
      }, GUEST_STREAM_RETRY_DELAY);
    };

    // Active polling - continuously search for host until connected (NEVER give up)
    const startActivePolling = () => {
      if (guestStreamConnectedRef.current) return; // Already connected
      if (activePollingIntervalRef.current) return; // Already polling

      console.log('[GuestStream] Starting active polling - will keep searching for host...');

      // Send an offer immediately only if not connected
      if (!guestStreamConnectedRef.current) {
        // Also check if we have an active connection in progress
        if (guestStreamPcRef.current) {
          const state = guestStreamPcRef.current.connectionState;
          if (state === 'connecting' || state === 'connected') {
            console.log('[GuestStream] Active poll: connection already in progress or connected, skipping initial offer');
          } else {
            console.log('[GuestStream] Active poll: sending initial offer to host...');
            guestStreamAnswerReceivedRef.current = false;
            setupGuestStream();
          }
        } else {
          console.log('[GuestStream] Active poll: sending initial offer to host...');
          guestStreamAnswerReceivedRef.current = false;
          setupGuestStream();
        }
      }

      // Set up continuous polling with longer interval since connection stability is key
      activePollingIntervalRef.current = setInterval(() => {
        if (guestStreamConnectedRef.current) {
          // Stop polling if connected
          console.log('[GuestStream] Active poll: connected! Stopping polling.');
          if (activePollingIntervalRef.current) {
            clearInterval(activePollingIntervalRef.current);
            activePollingIntervalRef.current = null;
          }
          return;
        }

        // Check if we have an active connection
        if (guestStreamPcRef.current) {
          const state = guestStreamPcRef.current.connectionState;
          // Don't recreate if we're connecting or already connected
          if (state === 'connecting' || state === 'connected') {
            console.log('[GuestStream] Active poll: connection in progress/connected, skipping...');
            return;
          }
          // Also check if we got an answer and are waiting for ICE to complete
          if (guestStreamAnswerReceivedRef.current && state === 'new') {
            console.log('[GuestStream] Active poll: answer received, waiting for ICE...');
            return;
          }
        }

        // Only send new offer if connection is failed/disconnected/closed or doesn't exist
        console.log('[GuestStream] Active poll: connection not established, sending offer to host...');
        guestStreamAnswerReceivedRef.current = false;
        setupGuestStream();
      }, ACTIVE_POLLING_INTERVAL);
    };

    // Handle request from host to resend stream offer (when host reconnects)
    const handleResendStreamOffer = () => {
      console.log('[GuestStream] Host requested stream offer resend');

      // CRITICAL FIX: If already connected and stream is flowing, DO NOT recreate the connection
      // This prevents flickering caused by constant reconnection
      if (guestStreamConnectedRef.current && guestStreamPcRef.current) {
        const state = guestStreamPcRef.current.connectionState;
        if (state === 'connected') {
          console.log('[GuestStream] Already connected with active stream, ignoring resend request to prevent flickering');
          return;
        }
      }

      // Only proceed if not connected
      console.log('[GuestStream] Not connected, proceeding with resend...');
      guestStreamAnswerReceivedRef.current = false;
      guestStreamRetryCountRef.current = 0;

      // Clear any existing retry timeout
      if (guestStreamRetryTimeoutRef.current) {
        clearTimeout(guestStreamRetryTimeoutRef.current);
        guestStreamRetryTimeoutRef.current = null;
      }

      // Stop active polling if running (will restart fresh)
      if (activePollingIntervalRef.current) {
        clearInterval(activePollingIntervalRef.current);
        activePollingIntervalRef.current = null;
      }

      // Send offer immediately with fresh retry cycle
      sendOfferWithRetry();

      // Also re-emit join-greenroom to ensure host gets the notification
      if (broadcastInfo?.id) {
        console.log('[GuestStream] Re-emitting join-greenroom for host');
        socketService.emit('join-greenroom', { broadcastId: broadcastInfo.id });
      }
    };

    socketService.on('guest-stream-answer', handleGuestStreamAnswer);
    socketService.on('guest-stream-ice-candidate', handleGuestStreamIceCandidate);
    socketService.on('resend-stream-offer', handleResendStreamOffer);

    // Small delay to ensure socket is connected and joined, then start with retry logic
    const timeout = setTimeout(() => {
      sendOfferWithRetry();
    }, 500);

    return () => {
      clearTimeout(timeout);
      if (guestStreamRetryTimeoutRef.current) {
        clearTimeout(guestStreamRetryTimeoutRef.current);
        guestStreamRetryTimeoutRef.current = null;
      }
      // Clear active polling interval
      if (activePollingIntervalRef.current) {
        clearInterval(activePollingIntervalRef.current);
        activePollingIntervalRef.current = null;
      }
      // Reset connected state
      guestStreamConnectedRef.current = false;

      socketService.off('guest-stream-answer', handleGuestStreamAnswer);
      socketService.off('guest-stream-ice-candidate', handleGuestStreamIceCandidate);
      socketService.off('resend-stream-offer', handleResendStreamOffer);

      if (guestStreamPcRef.current) {
        guestStreamPcRef.current.close();
        guestStreamPcRef.current = null;
      }
    };
  }, [hasJoined, broadcastInfo?.id, localStream]);

  // Listen for greenroom participants and chat
  useEffect(() => {
    if (!hasJoined) return;

    // Listen for greenroom participants
    const handleGreenroomParticipantJoined = ({ participantId, name }: { participantId: string; name: string }) => {
      setGreenroomParticipants((prev) => {
        const updated = new Map(prev);
        updated.set(participantId, {
          id: participantId,
          name: name || `Guest`,
          stream: null,
          audioEnabled: true,
          videoEnabled: true,
        });
        return updated;
      });
    };

    const handleGreenroomParticipantLeft = ({ participantId }: { participantId: string }) => {
      setGreenroomParticipants((prev) => {
        const updated = new Map(prev);
        updated.delete(participantId);
        return updated;
      });
    };

    const handleGreenroomStream = ({ participantId, stream }: { participantId: string; stream: MediaStream }) => {
      setGreenroomParticipants((prev) => {
        const updated = new Map(prev);
        const participant = updated.get(participantId);
        if (participant) {
          participant.stream = stream;
          updated.set(participantId, participant);
        }
        return updated;
      });
    };

    // Chat message handlers
    const handlePrivateChatMessage = (message: { author: string; message: string; timestamp: number }) => {
      setPrivateChatMessages((prev) => [...prev, message]);
    };

    const handlePublicChatMessage = (message: { author: string; message: string; timestamp: number }) => {
      setPublicChatMessages((prev) => [...prev, message]);
    };

    socketService.on('greenroom-participant-joined', handleGreenroomParticipantJoined);
    socketService.on('greenroom-participant-left', handleGreenroomParticipantLeft);
    socketService.on('greenroom-stream', handleGreenroomStream);
    socketService.on('private-chat-message', handlePrivateChatMessage);
    socketService.on('public-chat-message', handlePublicChatMessage);

    return () => {
      socketService.off('greenroom-participant-joined', handleGreenroomParticipantJoined);
      socketService.off('greenroom-participant-left', handleGreenroomParticipantLeft);
      socketService.off('greenroom-stream', handleGreenroomStream);
      socketService.off('private-chat-message', handlePrivateChatMessage);
      socketService.off('public-chat-message', handlePublicChatMessage);
    };
  }, [hasJoined]);

  // Update broadcast video volume when it changes
  useEffect(() => {
    if (broadcastVideoRef.current) {
      broadcastVideoRef.current.volume = streamVolume;
    }
  }, [streamVolume, broadcastStream]);

  // Set broadcast stream to video element and play it
  useEffect(() => {
    const video = broadcastVideoRef.current;
    if (!video || !broadcastStream) return;

    console.log('[GuestJoin] Setting broadcast stream to video element:', {
      streamId: broadcastStream.id,
      videoTracks: broadcastStream.getVideoTracks().length,
      audioTracks: broadcastStream.getAudioTracks().length,
      active: broadcastStream.active,
    });

    video.srcObject = broadcastStream;

    // Track video loading progress
    const handleLoadedMetadata = () => {
      console.log('[GuestJoin] Broadcast video metadata loaded:', {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });
    };

    const handleCanPlay = () => {
      console.log('[GuestJoin] Broadcast video can play');
      // Try to play again when video is ready
      video.play().catch((err) => {
        console.warn('[GuestJoin] Play on canplay failed:', err);
      });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);

    // Explicitly call play() - autoPlay attribute is often blocked by browsers
    video.play().catch((err) => {
      console.warn('[GuestJoin] Failed to auto-play broadcast video:', err);
      // This is expected if user hasn't interacted with the page yet
    });

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [broadcastStream]);

  // Send private chat message
  const handleSendPrivateChat = () => {
    if (!chatMessage.trim()) return;
    socketService.emit('send-private-chat', {
      broadcastId: broadcastInfo?.id,
      message: chatMessage,
      author: guestName,
    });
    // Add to local messages
    setPrivateChatMessages((prev) => [...prev, { author: guestName, message: chatMessage, timestamp: Date.now() }]);
    setChatMessage('');
  };

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

      // Connect to studio with participant token for guest authentication
      socketService.connect(undefined, token);
      socketService.joinStudio(broadcastInfo.id, participant.id);

      // Initialize WebRTC with proper error handling
      try {
        await webrtcService.initialize(broadcastInfo.id);
      } catch (error) {
        console.error('Failed to initialize WebRTC:', error);
        throw new Error('Failed to initialize WebRTC connection');
      }

      try {
        await webrtcService.createSendTransport();
      } catch (error) {
        console.error('Failed to create send transport:', error);
        throw new Error('Failed to create media transport');
      }

      // Produce media with individual error handling
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        const audioTrack = localStream.getAudioTracks()[0];

        if (videoTrack) {
          try {
            await webrtcService.produceMedia(videoTrack);
          } catch (error) {
            console.error('Failed to produce video:', error);
            toast.error('Failed to send video - continuing with audio only');
          }
        }

        if (audioTrack) {
          try {
            await webrtcService.produceMedia(audioTrack);
          } catch (error) {
            console.error('Failed to produce audio:', error);
            toast.error('Failed to send audio - continuing with video only');
          }
        }
      }

      // Join the greenroom for private chat with other guests
      socketService.emit('join-greenroom', { broadcastId: broadcastInfo.id });

      setHasJoined(true);
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

  // Cleanup on component unmount
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

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

  if (hasJoined) {
    // Status badge styling
    const getStatusBadge = () => {
      switch (guestStatus) {
        case 'live':
          return {
            bg: 'bg-red-600',
            text: 'text-white',
            label: 'LIVE',
            icon: '🔴',
            dot: 'bg-red-500',
            pulse: true
          };
        case 'backstage':
          return {
            bg: 'bg-yellow-600',
            text: 'text-white',
            label: 'Backstage',
            icon: '⏱️',
            dot: 'bg-yellow-500',
            pulse: false
          };
        default:
          return {
            bg: 'bg-green-600',
            text: 'text-white',
            label: 'In Greenroom',
            icon: '🎭',
            dot: 'bg-green-500',
            pulse: false
          };
      }
    };

    const statusBadge = getStatusBadge();

    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{broadcastInfo.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${statusBadge.dot} ${statusBadge.pulse ? 'animate-pulse' : ''}`}></div>
                <p className="text-sm text-gray-400">{statusBadge.label}</p>
              </div>
            </div>
            {/* Status badge */}
            <div className={`px-4 py-2 rounded-full ${statusBadge.bg} ${statusBadge.text} font-medium flex items-center gap-2`}>
              <span>{statusBadge.icon}</span>
              <span>{statusBadge.label}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* Main Video Area */}
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-3xl">
              {/* Video Preview */}
              <div className="bg-black rounded-lg overflow-hidden aspect-video mb-6 relative">
                <VideoPreview stream={localStream} muted />
                {/* Your name badge */}
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 px-3 py-1 rounded-full">
                  <span className="text-white text-sm font-medium">{guestName} (You)</span>
                </div>
              </div>

              {/* Status Message */}
              <div className={`rounded-lg p-6 text-center mb-6 ${
                guestStatus === 'live'
                  ? 'bg-gradient-to-r from-red-900 to-pink-900'
                  : guestStatus === 'backstage'
                  ? 'bg-gradient-to-r from-yellow-900 to-orange-900'
                  : 'bg-gradient-to-r from-blue-900 to-purple-900'
              }`}>
                <div className="flex items-center justify-center mb-3">
                  {guestStatus === 'live' ? (
                    <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                      <span className="text-3xl">🔴</span>
                    </div>
                  ) : guestStatus === 'backstage' ? (
                    <svg className="w-12 h-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {guestStatus === 'live'
                    ? 'You are LIVE!'
                    : guestStatus === 'backstage'
                    ? 'You\'re in Backstage'
                    : 'Welcome to the Greenroom!'}
                </h2>
                <p className={`mb-4 ${
                  guestStatus === 'live'
                    ? 'text-red-200'
                    : guestStatus === 'backstage'
                    ? 'text-yellow-200'
                    : 'text-blue-200'
                }`}>
                  {guestStatus === 'live'
                    ? 'You\'re now visible to all viewers. Smile and be yourself!'
                    : guestStatus === 'backstage'
                    ? 'Get ready! The host will bring you on screen shortly. Make final adjustments to your camera and microphone.'
                    : 'The host will move you to backstage and then bring you on screen when ready. Make sure your camera and microphone are working properly.'}
                </p>
                <div className={`inline-flex items-center px-4 py-2 rounded-lg ${
                  guestStatus === 'live'
                    ? 'bg-red-500 bg-opacity-20'
                    : guestStatus === 'backstage'
                    ? 'bg-yellow-500 bg-opacity-20'
                    : 'bg-blue-500 bg-opacity-20'
                }`}>
                  <svg className={`w-4 h-4 mr-2 ${
                    guestStatus === 'live'
                      ? 'text-red-300'
                      : guestStatus === 'backstage'
                      ? 'text-yellow-300'
                      : 'text-blue-300'
                  }`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span className={`text-sm ${
                    guestStatus === 'live'
                      ? 'text-red-200'
                      : guestStatus === 'backstage'
                      ? 'text-yellow-200'
                      : 'text-blue-200'
                  }`}>
                    {guestStatus === 'live'
                      ? 'Remember: Thousands may be watching you live!'
                      : guestStatus === 'backstage'
                      ? 'Tip: You can see and hear the broadcast, but viewers can\'t see you yet'
                      : 'Tip: Test your audio and video before going live'}
                  </span>
                </div>
              </div>

              {/* Media Controls */}
              <div className="flex justify-center gap-4">
                <button
                  onClick={toggleAudio}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                    audioEnabled
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                  title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                  <span className="text-xl">{audioEnabled ? '🎤' : '🔇'}</span>
                  <span>{audioEnabled ? 'Mute' : 'Unmute'}</span>
                </button>
                <button
                  onClick={toggleVideo}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                    videoEnabled
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                  title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  <span className="text-xl">{videoEnabled ? '📹' : '📵'}</span>
                  <span>{videoEnabled ? 'Stop Video' : 'Start Video'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Stream Preview, Participants & Chat */}
          <div className="w-full lg:w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            {/* Live Stream Preview - Fixed at top of sidebar */}
            <div className="flex-shrink-0 border-b border-gray-700">
              <div className="bg-black">
                <div className="relative aspect-video">
                  {broadcastStream ? (
                    <video
                      ref={broadcastVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-900">
                      <div className="text-center">
                        <svg className="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-500 text-xs">Live Stream Preview</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-red-600 px-2 py-0.5 rounded text-xs text-white font-medium flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                    LIVE
                  </div>
                </div>
                {/* Volume Slider */}
                <div className="bg-gray-800 px-3 py-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  <input
                    id="stream-volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={streamVolume}
                    onChange={(e) => setStreamVolume(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    aria-label="Stream volume"
                  />
                  <span className="text-xs text-gray-400 w-8">{Math.round(streamVolume * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Participants Section */}
            <div className="p-4 border-b border-gray-700">
              <h3 className="font-semibold text-white">Participants</h3>
            </div>
            <div className="p-4 border-b border-gray-700 max-h-48 overflow-y-auto">
              {/* Current user */}
              <div className="bg-gray-700 rounded-lg p-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-white font-medium">{guestName} (You)</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">In Greenroom</p>
              </div>

              {/* Other greenroom participants */}
              {Array.from(greenroomParticipants.values()).map((participant) => (
                <div key={participant.id} className="bg-gray-700 rounded-lg p-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-white font-medium">{participant.name}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">In Greenroom</p>
                </div>
              ))}

              {/* Info message */}
              {greenroomParticipants.size === 0 && (
                <div className="mt-2 p-3 bg-blue-900 bg-opacity-30 rounded-lg">
                  <p className="text-xs text-blue-200">
                    Other guests in the greenroom will appear here. You can chat with them while waiting.
                  </p>
                </div>
              )}
            </div>

            {/* Chat Section */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat Tabs */}
              <div className="flex border-b border-gray-700">
                <button
                  onClick={() => setActiveChatTab('private')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeChatTab === 'private'
                      ? 'text-white bg-gray-700 border-b-2 border-blue-500'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  Private Chat
                </button>
                <button
                  onClick={() => setActiveChatTab('public')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeChatTab === 'public'
                      ? 'text-white bg-gray-700 border-b-2 border-blue-500'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  Public Chat
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {activeChatTab === 'private' ? (
                  privateChatMessages.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center">
                      No messages yet. Start chatting with other guests!
                    </p>
                  ) : (
                    privateChatMessages.map((msg, i) => (
                      <div key={i} className={`p-2 rounded ${msg.author === guestName ? 'bg-blue-600 ml-4' : 'bg-gray-700 mr-4'}`}>
                        <p className="text-xs text-gray-300 font-medium">{msg.author}</p>
                        <p className="text-sm text-white">{msg.message}</p>
                      </div>
                    ))
                  )
                ) : (
                  publicChatMessages.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center">
                      No public chat messages yet.
                    </p>
                  ) : (
                    publicChatMessages.map((msg, i) => (
                      <div key={i} className="p-2 rounded bg-gray-700">
                        <p className="text-xs text-gray-300 font-medium">{msg.author}</p>
                        <p className="text-sm text-white">{msg.message}</p>
                      </div>
                    ))
                  )
                )}
              </div>

              {/* Chat Input - only for private chat */}
              {activeChatTab === 'private' && (
                <div className="p-4 border-t border-gray-700">
                  <div className="flex gap-2">
                    <input
                      id="chat-message"
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendPrivateChat()}
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Chat message"
                    />
                    <button
                      onClick={handleSendPrivateChat}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}

              {/* Read-only notice for public chat */}
              {activeChatTab === 'public' && (
                <div className="p-4 border-t border-gray-700 bg-gray-900">
                  <p className="text-xs text-gray-500 text-center">
                    Public chat is read-only while in the greenroom
                  </p>
                </div>
              )}
            </div>

            {/* System Check */}
            <div className="p-4 border-t border-gray-700 bg-gray-850">
              <div className="text-xs text-gray-400 space-y-1">
                <p className="font-medium text-gray-300">System Check:</p>
                <div className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Camera: {videoEnabled ? 'On' : 'Off'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400">✓</span>
                  <span>Microphone: {audioEnabled ? 'On' : 'Off'}</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join Broadcast</h1>
          <p className="text-lg text-gray-600">{broadcastInfo.title}</p>
          <p className="text-sm text-gray-500 mt-2">Set up your camera and microphone before joining</p>
        </div>

        {/* Video Preview */}
        <div className="bg-black rounded-xl overflow-hidden aspect-video mb-6 shadow-lg relative">
          <VideoPreview stream={localStream} muted />
          {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-gray-400">Camera is off</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={toggleAudio}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition-all shadow-md ${
              audioEnabled
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            <span className="text-xl">{audioEnabled ? '🎤' : '🔇'}</span>
            <span className="text-sm">{audioEnabled ? 'Mute' : 'Unmute'}</span>
          </button>
          <button
            onClick={toggleVideo}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition-all shadow-md ${
              videoEnabled
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            <span className="text-xl">{videoEnabled ? '📹' : '📵'}</span>
            <span className="text-sm">{videoEnabled ? 'Stop Video' : 'Start Video'}</span>
          </button>
          <button
            onClick={() => setShowDeviceSelectors(!showDeviceSelectors)}
            className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition-all shadow-md bg-gray-100 hover:bg-gray-200 text-gray-900"
            title="Device settings"
          >
            <span className="text-xl">⚙️</span>
            <span className="text-sm">Settings</span>
          </button>
        </div>

        {/* Device Selectors */}
        {showDeviceSelectors && (
          <div className="mb-6 space-y-4 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-3">Device Settings</h4>

            {/* Camera Selector */}
            <div>
              <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-2">
                Camera
              </label>
              <select
                id="camera-select"
                value={selectedVideoDevice}
                onChange={(e) => setSelectedVideoDevice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Microphone Selector */}
            <div>
              <label htmlFor="microphone-select" className="block text-sm font-medium text-gray-700 mb-2">
                Microphone
              </label>
              <select
                id="microphone-select"
                value={selectedAudioDevice}
                onChange={(e) => setSelectedAudioDevice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              💡 Test your devices before joining to ensure everything works correctly
            </p>
          </div>
        )}

        {/* Name Input */}
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter your full name or brand name"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">This is how you'll appear to viewers</p>
          </div>

          <Button
            onClick={handleJoin}
            disabled={isJoining || !guestName.trim()}
            size="lg"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isJoining ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Joining Greenroom...
              </span>
            ) : (
              'Enter Greenroom'
            )}
          </Button>

          {/* Consent and Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Before you join:</p>
                <ul className="space-y-1 text-blue-800">
                  <li>• Make sure your camera and microphone are working</li>
                  <li>• You'll wait in the greenroom until the host brings you on</li>
                  <li>• By joining, you consent to being recorded and streamed live</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Browser requirements */}
          <p className="text-xs text-gray-500 text-center">
            Best experience on Chrome, Firefox, Safari, or Edge
          </p>
        </div>
      </div>
    </div>
  );
}
