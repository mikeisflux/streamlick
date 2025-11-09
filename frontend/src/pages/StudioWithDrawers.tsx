import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { broadcastService } from '../services/broadcast.service';
import { socketService } from '../services/socket.service';
import { useMedia } from '../hooks/useMedia';
import { useStudioStore } from '../store/studioStore';
import { VideoPreview } from '../components/VideoPreview';
import { Button } from '../components/Button';
import { Drawer } from '../components/Drawer';
import { DestinationsPanel } from '../components/DestinationsPanel';
import { InviteGuestsPanel } from '../components/InviteGuestsPanel';
import { BannerEditorPanel } from '../components/BannerEditorPanel';
import { BrandSettingsPanel } from '../components/BrandSettingsPanel';
import { ParticipantsPanel } from '../components/ParticipantsPanel';
import { RecordingControls } from '../components/RecordingControls';
import toast from 'react-hot-toast';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  ChatBubbleLeftIcon,
  UserGroupIcon,
  CogIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type RightPanelTab = 'comments' | 'banners' | 'media' | 'style' | 'notes' | 'people' | 'chat' | 'recording';

export function Studio() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<RightPanelTab>('chat');
  const [selectedLayout, setSelectedLayout] = useState<number>(1);

  // On-screen chat overlay state
  const [showChatOverlay, setShowChatOverlay] = useState(true);
  const [chatOverlayPos, setChatOverlayPos] = useState({ x: 20, y: 20 });
  const [chatOverlaySize, setChatOverlaySize] = useState({ width: 300, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizingOverlay, setIsResizingOverlay] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');

  // Drawer states
  const [activeDrawer, setActiveDrawer] = useState<'destinations' | 'invite' | 'banners' | 'brand' | null>(null);

  // Layout configurations
  const layouts = [
    { id: 1, name: 'Single Speaker', icon: 'single' },
    { id: 2, name: 'Side by Side', icon: 'sideBySide' },
    { id: 3, name: 'Picture in Picture', icon: 'pip' },
    { id: 4, name: 'Grid 2x2', icon: 'grid4' },
    { id: 5, name: 'Grid 3x3', icon: 'grid9' },
    { id: 6, name: 'Main + Strip', icon: 'mainStrip' },
    { id: 7, name: 'Interview', icon: 'interview' },
    { id: 8, name: 'Panel', icon: 'panel' },
    { id: 9, name: 'Screen Share', icon: 'screenShare' },
  ];

  const { broadcast, isLive, setIsLive, setBroadcast } = useStudioStore();
  const {
    localStream,
    screenStream,
    audioEnabled,
    videoEnabled,
    startCamera,
    stopCamera,
    startScreenShare,
    stopScreenShare,
    toggleAudio,
    toggleVideo,
  } = useMedia();

  useEffect(() => {
    if (!broadcastId) return;

    // Failsafe timeout: Always stop loading after 10 seconds
    const loadingTimeout = setTimeout(() => {
      console.warn('Loading timeout - forcing studio to display');
      setIsLoading(false);
      toast.error('Studio took too long to load. Some features may not work.');
    }, 10000);

    const init = async () => {
      try {
        // Start camera FIRST - don't wait for broadcast data
        console.log('Requesting camera permission...');
        try {
          await startCamera();
          console.log('Camera started successfully');
        } catch (cameraError) {
          console.error('Camera error:', cameraError);
          toast.error('Failed to access camera. Please allow camera permissions and refresh.');
        }

        // Load broadcast data (non-blocking)
        try {
          const broadcastData = await broadcastService.getById(broadcastId);
          setBroadcast(broadcastData);
          console.log('Broadcast loaded:', broadcastData);
        } catch (broadcastError) {
          console.error('Broadcast load error:', broadcastError);
          toast.error('Could not load broadcast data. Some features may not work.');
          // Continue anyway - allow user to use studio
        }

        // Connect socket
        const token = localStorage.getItem('accessToken');
        if (token) {
          try {
            socketService.connect(token);
            socketService.joinStudio(broadcastId, 'host-id');
            console.log('Socket connected');
          } catch (socketError) {
            console.error('Socket connection error:', socketError);
            toast.error('Real-time features unavailable');
          }
        } else {
          console.warn('No auth token found');
        }

        // Always set loading to false
        clearTimeout(loadingTimeout);
        setIsLoading(false);
      } catch (error) {
        console.error('Studio init error:', error);
        toast.error('Failed to initialize studio');
        clearTimeout(loadingTimeout);
        setIsLoading(false); // CRITICAL: Always stop loading
      }
    };

    init();

    return () => {
      clearTimeout(loadingTimeout);
      stopCamera();
      socketService.leaveStudio();
    };
  }, [broadcastId]);

  const handleGoLive = async () => {
    if (!broadcastId) return;

    try {
      await broadcastService.start(broadcastId);
      setIsLive(true);
      toast.success('You are now live!');
    } catch (error) {
      toast.error('Failed to go live');
    }
  };

  const handleEndBroadcast = async () => {
    if (!broadcastId) return;

    try {
      await broadcastService.end(broadcastId);
      setIsLive(false);
      toast.success('Broadcast ended');
    } catch (error) {
      toast.error('Failed to end broadcast');
    }
  };

  // Chat overlay drag and resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setChatOverlayPos({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      } else if (isResizingOverlay) {
        const newWidth = e.clientX - chatOverlayPos.x;
        const newHeight = e.clientY - chatOverlayPos.y;
        if (newWidth >= 200 && newHeight >= 200) {
          setChatOverlaySize({ width: newWidth, height: newHeight });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizingOverlay(false);
    };

    if (isDragging || isResizingOverlay) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizingOverlay, dragOffset, chatOverlayPos]);

  const handleChatOverlayDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - chatOverlayPos.x,
      y: e.clientY - chatOverlayPos.y,
    });
  };

  const handleChatOverlayResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingOverlay(true);
  };

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audio = devices.filter((d) => d.kind === 'audioinput');
      const video = devices.filter((d) => d.kind === 'videoinput');

      setAudioDevices(audio);
      setVideoDevices(video);

      // Set current devices if not already set
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        const videoTrack = localStream.getVideoTracks()[0];

        if (audioTrack && !selectedAudioDevice) {
          const settings = audioTrack.getSettings();
          setSelectedAudioDevice(settings.deviceId || '');
        }

        if (videoTrack && !selectedVideoDevice) {
          const settings = videoTrack.getSettings();
          setSelectedVideoDevice(settings.deviceId || '');
        }
      }
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      toast.error('Failed to load devices');
    }
  };

  const handleAudioDeviceChange = async (deviceId: string) => {
    setSelectedAudioDevice(deviceId);
    try {
      // Stop current stream
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }

      // Start new stream with selected device
      const _stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
      });

      // TODO: Update the stream (you'll need to update the useMedia hook to accept this)
      toast.success('Audio device changed');
    } catch (error) {
      console.error('Failed to change audio device:', error);
      toast.error('Failed to change audio device');
    }
  };

  const handleVideoDeviceChange = async (deviceId: string) => {
    setSelectedVideoDevice(deviceId);
    try {
      // Stop current stream
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }

      // Start new stream with selected device
      const _stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
        video: { deviceId: { exact: deviceId } },
      });

      // TODO: Update the stream (you'll need to update the useMedia hook to accept this)
      toast.success('Video device changed');
    } catch (error) {
      console.error('Failed to change video device:', error);
      toast.error('Failed to change video device');
    }
  };

  const openSettings = async () => {
    setShowSettings(true);
    await loadDevices();
  };

  const renderLayoutIcon = (iconType: string) => {
    const iconClass = 'border-2 border-white/30 rounded bg-white/10';
    switch (iconType) {
      case 'single':
        return <div className={`${iconClass} w-8 h-8`} />;
      case 'sideBySide':
        return (
          <div className="flex gap-0.5">
            <div className={`${iconClass} w-4 h-6`} />
            <div className={`${iconClass} w-4 h-6`} />
          </div>
        );
      case 'pip':
        return (
          <div className="relative">
            <div className={`${iconClass} w-8 h-6`} />
            <div className={`${iconClass} w-3 h-2 absolute bottom-0.5 right-0.5`} />
          </div>
        );
      case 'grid4':
        return (
          <div className="grid grid-cols-2 gap-0.5">
            <div className={`${iconClass} w-3.5 h-2.5`} />
            <div className={`${iconClass} w-3.5 h-2.5`} />
            <div className={`${iconClass} w-3.5 h-2.5`} />
            <div className={`${iconClass} w-3.5 h-2.5`} />
          </div>
        );
      case 'grid9':
        return (
          <div className="grid grid-cols-3 gap-0.5">
            {[...Array(9)].map((_, i) => (
              <div key={i} className={`${iconClass} w-2 h-1.5`} />
            ))}
          </div>
        );
      case 'mainStrip':
        return (
          <div className="flex flex-col gap-0.5">
            <div className={`${iconClass} w-8 h-4`} />
            <div className="flex gap-0.5">
              <div className={`${iconClass} w-2 h-1.5`} />
              <div className={`${iconClass} w-2 h-1.5`} />
              <div className={`${iconClass} w-2 h-1.5`} />
            </div>
          </div>
        );
      case 'interview':
        return (
          <div className="flex gap-1">
            <div className={`${iconClass} w-3.5 h-6`} />
            <div className={`${iconClass} w-3.5 h-6`} />
          </div>
        );
      case 'panel':
        return (
          <div className="flex flex-col gap-0.5">
            <div className={`${iconClass} w-8 h-3`} />
            <div className="flex gap-0.5">
              <div className={`${iconClass} w-2.5 h-2`} />
              <div className={`${iconClass} w-2.5 h-2`} />
              <div className={`${iconClass} w-2.5 h-2`} />
            </div>
          </div>
        );
      case 'screenShare':
        return (
          <div className="flex gap-0.5">
            <div className={`${iconClass} w-6 h-6`} />
            <div className={`${iconClass} w-1.5 h-6`} />
          </div>
        );
      default:
        return <div className={`${iconClass} w-8 h-8`} />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <div className="text-white text-xl">Initializing Studio...</div>
          <div className="text-gray-400 text-sm mt-2">Requesting camera and microphone access</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden grid" style={{
      gridTemplateRows: '60px 1fr',
      gridTemplateColumns: leftSidebarOpen && rightSidebarOpen
        ? '280px 1fr 320px'
        : leftSidebarOpen
        ? '280px 1fr 0px'
        : rightSidebarOpen
        ? '0px 1fr 320px'
        : '0px 1fr 0px',
      backgroundColor: '#1a1a1a'
    }}>
      {/* Top Bar - 60px height */}
      <header
        className="flex items-center justify-between px-6 border-b"
        style={{
          gridColumn: '1 / -1',
          height: '60px',
          backgroundColor: '#2d2d2d',
          borderColor: '#404040',
          zIndex: 1000
        }}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-white" style={{ width: '140px' }}>Streamlick</h1>
          {isLive && (
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-red-500 text-sm font-semibold">LIVE</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">{broadcast?.title || 'Untitled Broadcast'}</span>
          <button
            onClick={openSettings}
            className="p-2 rounded hover:bg-gray-700 transition-colors"
            title="Settings"
          >
            <CogIcon className="w-5 h-5 text-gray-300" />
          </button>
          {!isLive ? (
            <Button onClick={handleGoLive} variant="primary" size="md">
              🔴 Go Live
            </Button>
          ) : (
            <Button onClick={handleEndBroadcast} variant="danger" size="md">
              ⏹️ End Broadcast
            </Button>
          )}
        </div>
      </header>

      {/* Left Sidebar - Scenes (280px width) */}
      {leftSidebarOpen && (
        <aside
          className="flex flex-col overflow-hidden border-r"
          style={{
            width: '280px',
            backgroundColor: '#f5f5f5',
            borderColor: '#e0e0e0'
          }}
        >
          <div
            className="sticky top-0 flex items-center justify-between px-4 border-b bg-white"
            style={{ height: '56px', borderColor: '#e0e0e0' }}
          >
            <h3 className="text-sm font-semibold text-gray-800">Scenes</h3>
            <button
              onClick={() => setLeftSidebarOpen(false)}
              className="text-gray-600 hover:text-gray-900"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Intro Video */}
            <button
              className="w-full border-2 border-dashed rounded flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
              style={{ height: '80px', borderColor: '#d0d0d0' }}
            >
              + Intro Video
            </button>

            {/* Scene Card - 180px tall */}
            <div
              className="bg-white rounded shadow hover:shadow-md transition-shadow cursor-pointer border"
              style={{ height: '180px', borderColor: '#e0e0e0' }}
            >
              <div className="h-full flex flex-col p-3">
                <div className="flex-1 bg-black rounded mb-2 relative overflow-hidden">
                  {localStream && videoEnabled && (
                    <VideoPreview stream={localStream} muted className="w-full h-full object-cover" />
                  )}
                </div>
                <p className="text-xs text-gray-700 font-medium">Default Scene</p>
              </div>
            </div>

            {/* New Scene Button */}
            <button
              className="w-full border-2 border-dashed rounded flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
              style={{ height: '64px', borderColor: '#d0d0d0' }}
            >
              + New Scene
            </button>

            {/* Outro Video */}
            <button
              className="w-full border-2 border-dashed rounded flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
              style={{ height: '80px', marginBottom: '80px', borderColor: '#d0d0d0' }}
            >
              + Outro Video
            </button>
          </div>
        </aside>
      )}

      {/* Center Canvas Area */}
      <main
        className="flex flex-col overflow-hidden"
        style={{ backgroundColor: '#1a1a1a' }}
      >
        {/* Canvas Container - 16:9 aspect ratio, max-width 1920px */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div
            className="relative bg-black"
            style={{
              width: '100%',
              maxWidth: '1920px',
              aspectRatio: '16 / 9'
            }}
          >
            {/* Main Video Preview */}
            <div className="absolute inset-0 overflow-hidden"
              style={{ backgroundColor: '#000000' }}
            >
                {localStream && videoEnabled ? (
                  <VideoPreview stream={localStream} muted className="w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <VideoCameraIcon className="w-16 h-16 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Camera Off</p>
                    </div>
                  </div>
                )}

              {/* Resolution Badge - Centered Top */}
              <div
                className="absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full text-sm font-semibold text-white"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  backdropFilter: 'blur(8px)'
                }}
              >
                1080p HD
              </div>

                {/* On-Screen Chat Overlay (what viewers see in the stream) */}
                {showChatOverlay && (
                  <div
                    className="absolute bg-black/80 backdrop-blur-sm rounded-lg border border-gray-600 shadow-2xl overflow-hidden"
                    style={{
                      left: `${chatOverlayPos.x}px`,
                      top: `${chatOverlayPos.y}px`,
                      width: `${chatOverlaySize.width}px`,
                      height: `${chatOverlaySize.height}px`,
                      cursor: isDragging ? 'grabbing' : 'grab',
                    }}
                  >
                    {/* Drag Handle / Header */}
                    <div
                      className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 flex items-center justify-between cursor-grab active:cursor-grabbing"
                      onMouseDown={handleChatOverlayDragStart}
                    >
                      <div className="flex items-center gap-2">
                        <ChatBubbleLeftIcon className="w-4 h-4 text-white" />
                        <span className="text-white text-sm font-semibold">Live Chat</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowChatOverlay(false);
                        }}
                        className="text-white/80 hover:text-white"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Chat Messages */}
                    <div className="p-3 space-y-2 overflow-y-auto" style={{ height: `calc(100% - 48px)` }}>
                      {/* Sample messages - replace with actual chat messages from socket */}
                      <div className="bg-white/10 rounded p-2">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            J
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-white text-sm font-semibold">JohnDoe</span>
                              <span className="text-gray-400 text-xs">2m ago</span>
                            </div>
                            <p className="text-gray-200 text-sm mt-0.5">Hello from the stream!</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/10 rounded p-2">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            S
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-white text-sm font-semibold">Sarah123</span>
                              <span className="text-gray-400 text-xs">1m ago</span>
                            </div>
                            <p className="text-gray-200 text-sm mt-0.5">Great stream! 🎉</p>
                          </div>
                        </div>
                      </div>

                      <div className="text-gray-400 text-xs text-center py-2">
                        No more messages
                      </div>
                    </div>

                    {/* Resize Handle */}
                    <div
                      className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
                      onMouseDown={handleChatOverlayResizeStart}
                      style={{
                        background: 'linear-gradient(135deg, transparent 50%, rgba(59, 130, 246, 0.5) 50%)',
                      }}
                    />
                  </div>
                )}

                {/* User Label Overlay */}
                {localStream && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">You (Host)</span>
                        <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">720p</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        {/* Layout Bar - 72px height */}
        <div
          className="flex items-center justify-center gap-2 border-t px-4 overflow-x-auto"
          style={{
            height: '72px',
            backgroundColor: '#2d2d2d',
            borderColor: '#404040'
          }}
        >
          {/* Layout Options with Real Icons */}
          {layouts.map((layout) => (
            <button
              key={layout.id}
              onClick={() => setSelectedLayout(layout.id)}
              className="rounded hover:bg-gray-600 transition-all flex items-center justify-center flex-shrink-0 group relative"
              style={{
                width: '56px',
                height: '56px',
                backgroundColor: selectedLayout === layout.id ? '#0066ff' : '#3d3d3d'
              }}
              title={layout.name}
            >
              {renderLayoutIcon(layout.icon)}

              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-50">
                <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {layout.name}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Bottom Control Bar - ~80px height */}
        <div
          className="flex items-center justify-between px-6 border-t"
          style={{
            height: '80px',
            backgroundColor: '#2d2d2d',
            borderColor: '#404040'
          }}
        >
          {/* Left Section */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveDrawer('destinations')}
              className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
            >
              Destinations
            </button>
            <button
              onClick={() => setActiveDrawer('banners')}
              className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
            >
              Banners
            </button>
            <button
              onClick={() => setActiveDrawer('brand')}
              className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
            >
              Brand
            </button>
          </div>

          {/* Center Section */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-full ${
                audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
              } text-white transition-colors`}
              title={audioEnabled ? 'Mute' : 'Unmute'}
            >
              <MicrophoneIcon className="w-6 h-6" />
            </button>
            <button
              className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              title="Speaker"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full ${
                videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
              } text-white transition-colors`}
              title={videoEnabled ? 'Stop Camera' : 'Start Camera'}
            >
              <VideoCameraIcon className="w-6 h-6" />
            </button>
            <button
              onClick={screenStream ? stopScreenShare : startScreenShare}
              className={`p-3 rounded-full ${
                screenStream ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white transition-colors`}
              title={screenStream ? 'Stop Screen Share' : 'Share Screen'}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveDrawer('invite')}
              className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
            >
              Invite Guests
            </button>
            <button
              onClick={openSettings}
              className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              title="Settings"
            >
              <CogIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </main>

      {/* Right Sidebar - Tabbed Panels (320px width) */}
      {rightSidebarOpen && (
        <aside
          className="flex flex-col overflow-hidden border-l"
          style={{
            width: '320px',
            backgroundColor: '#ffffff',
            borderColor: '#e0e0e0',
            zIndex: 800
          }}
        >
          {/* Tab Headers */}
          <div className="border-b flex overflow-x-auto flex-shrink-0" style={{ borderColor: '#e0e0e0' }}>
            <button
              onClick={() => setActiveRightTab('comments')}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
                activeRightTab === 'comments'
                  ? 'text-gray-900 border-b-2'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              style={activeRightTab === 'comments' ? { borderColor: '#0066ff' } : {}}
            >
              Comments
            </button>
            <button
              onClick={() => setActiveRightTab('banners')}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
                activeRightTab === 'banners'
                  ? 'text-gray-900 border-b-2'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              style={activeRightTab === 'banners' ? { borderColor: '#0066ff' } : {}}
            >
              Banners
            </button>
            <button
              onClick={() => setActiveRightTab('media')}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
                activeRightTab === 'media'
                  ? 'text-gray-900 border-b-2'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              style={activeRightTab === 'media' ? { borderColor: '#0066ff' } : {}}
            >
              Media
            </button>
            <button
              onClick={() => setActiveRightTab('chat')}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
                activeRightTab === 'chat'
                  ? 'text-gray-900 border-b-2'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              style={activeRightTab === 'chat' ? { borderColor: '#0066ff' } : {}}
            >
              <ChatBubbleLeftIcon className="w-4 h-4 inline mr-1" />
              Chat
            </button>
            <button
              onClick={() => setActiveRightTab('people')}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
                activeRightTab === 'people'
                  ? 'text-gray-900 border-b-2'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              style={activeRightTab === 'people' ? { borderColor: '#0066ff' } : {}}
            >
              <UserGroupIcon className="w-4 h-4 inline mr-1" />
              People
            </button>
            <button
              onClick={() => setActiveRightTab('recording')}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
                activeRightTab === 'recording'
                  ? 'text-gray-900 border-b-2'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              style={activeRightTab === 'recording' ? { borderColor: '#0066ff' } : {}}
            >
              Recording
            </button>
            <button
              onClick={() => setRightSidebarOpen(false)}
              className="ml-auto px-3 py-2 text-gray-500 hover:text-gray-900"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
            </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeRightTab === 'chat' && (
              <div className="p-4">
                <div className="text-gray-500 text-sm text-center py-8">
                  Private studio chat
                </div>
              </div>
            )}

            {activeRightTab === 'comments' && (
              <div className="p-4">
                <div className="mb-4 flex items-center gap-2">
                  <input type="checkbox" id="show-comments" className="rounded" />
                  <label htmlFor="show-comments" className="text-sm text-gray-700">
                    Show comments on stage
                  </label>
                </div>
                <div className="text-gray-500 text-sm text-center py-8">
                  No comments yet
                </div>
              </div>
            )}

            {activeRightTab === 'banners' && (
              <div className="p-4">
                <div className="text-gray-500 text-sm text-center py-8">
                  No banners configured
                </div>
              </div>
            )}

            {activeRightTab === 'people' && <ParticipantsPanel />}

            {activeRightTab === 'recording' && <RecordingControls broadcastId={broadcastId} />}

            {activeRightTab === 'media' && (
              <div className="p-4">
                <button className="w-full py-8 border-2 border-dashed rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors" style={{ borderColor: '#d0d0d0' }}>
                  + Upload Media
                </button>
                <div className="text-gray-500 text-xs text-center mt-4">
                  No media assets yet
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Toggle Sidebar Buttons (when collapsed) */}
      {!leftSidebarOpen && (
        <button
          onClick={() => setLeftSidebarOpen(true)}
          className="fixed left-4 top-20 p-2 rounded shadow-lg transition-colors"
          style={{
            backgroundColor: '#2d2d2d',
            color: '#ffffff',
            zIndex: 1001
          }}
        >
          <Bars3Icon className="w-5 h-5" />
        </button>
      )}
      {!rightSidebarOpen && (
        <button
          onClick={() => setRightSidebarOpen(true)}
          className="fixed right-4 top-20 p-2 rounded shadow-lg transition-colors"
          style={{
            backgroundColor: '#2d2d2d',
            color: '#ffffff',
            zIndex: 1001
          }}
        >
          <ChatBubbleLeftIcon className="w-5 h-5" />
        </button>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CogIcon className="w-6 h-6" />
                Studio Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {/* Video Device Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-white flex items-center gap-2">
                  <VideoCameraIcon className="w-5 h-5" />
                  Camera / Video Source
                </label>
                <select
                  value={selectedVideoDevice}
                  onChange={(e) => handleVideoDeviceChange(e.target.value)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a camera...</option>
                  {videoDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 8)}...`}
                    </option>
                  ))}
                </select>
                {videoDevices.length === 0 && (
                  <p className="text-sm text-gray-400">No video devices found</p>
                )}
              </div>

              {/* Audio Device Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-white flex items-center gap-2">
                  <MicrophoneIcon className="w-5 h-5" />
                  Microphone / Audio Source
                </label>
                <select
                  value={selectedAudioDevice}
                  onChange={(e) => handleAudioDeviceChange(e.target.value)}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a microphone...</option>
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 8)}...`}
                    </option>
                  ))}
                </select>
                {audioDevices.length === 0 && (
                  <p className="text-sm text-gray-400">No audio devices found</p>
                )}
              </div>

              {/* Chat Overlay Settings */}
              <div className="space-y-3 pt-6 border-t border-gray-700">
                <label className="block text-sm font-semibold text-white flex items-center gap-2">
                  <ChatBubbleLeftIcon className="w-5 h-5" />
                  On-Screen Chat Overlay
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="show-chat-overlay"
                    checked={showChatOverlay}
                    onChange={(e) => setShowChatOverlay(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="show-chat-overlay" className="text-sm text-gray-300">
                    Show chat overlay on stream
                  </label>
                </div>
                <p className="text-xs text-gray-400">
                  The chat overlay can be repositioned and resized by dragging it on the canvas.
                </p>
              </div>

              {/* Additional Info */}
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
                <p className="text-sm text-blue-200">
                  <strong>Tip:</strong> You can drag the chat overlay anywhere on the canvas and resize it using the handle in the bottom-right corner.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-900 border-t border-gray-700 px-6 py-4 flex justify-end">
              <Button onClick={() => setShowSettings(false)} variant="primary">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drawers */}
      <Drawer
        isOpen={activeDrawer === 'destinations'}
        onClose={() => setActiveDrawer(null)}
        title="Stream Destinations"
        size="lg"
      >
        <DestinationsPanel broadcastId={broadcastId} />
      </Drawer>

      <Drawer
        isOpen={activeDrawer === 'invite'}
        onClose={() => setActiveDrawer(null)}
        title="Invite Guests"
        size="md"
      >
        {broadcastId && <InviteGuestsPanel broadcastId={broadcastId} />}
      </Drawer>

      <Drawer
        isOpen={activeDrawer === 'banners'}
        onClose={() => setActiveDrawer(null)}
        title="Banners & Overlays"
        size="lg"
      >
        <BannerEditorPanel />
      </Drawer>

      <Drawer
        isOpen={activeDrawer === 'brand'}
        onClose={() => setActiveDrawer(null)}
        title="Brand Settings"
        size="lg"
      >
        <BrandSettingsPanel />
      </Drawer>
    </div>
  );
}
