/**
 * GuestStage Component
 *
 * The view shown to guests when they are LIVE on stage.
 * Shows the broadcast preview, their self-video thumbnail, and controls.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';

interface Participant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface ChatMessage {
  author: string;
  message: string;
  timestamp: number;
}

interface GuestStageProps {
  broadcastTitle: string;
  guestName: string;
  localStream: MediaStream | null;
  broadcastStream: MediaStream | null;
  streamVolume: number;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing?: boolean;
  participants: Map<string, Participant>;
  privateChatMessages: ChatMessage[];
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare?: () => void;
  onVolumeChange: (volume: number) => void;
  onSendPrivateMessage: (message: string) => void;
  onLeave?: () => void;
}

export function GuestStage({
  broadcastTitle,
  guestName,
  localStream,
  broadcastStream,
  streamVolume,
  audioEnabled,
  videoEnabled,
  isScreenSharing = false,
  participants,
  privateChatMessages,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onVolumeChange,
  onSendPrivateMessage,
  onLeave,
}: GuestStageProps) {
  const [activeTab, setActiveTab] = useState<'private' | 'comments' | 'recording'>('private');
  const [chatMessage, setChatMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleSendChat = () => {
    if (chatMessage.trim()) {
      onSendPrivateMessage(chatMessage);
      setChatMessage('');
    }
  };

  const handleLeave = () => {
    if (onLeave) {
      onLeave();
    } else {
      if (window.confirm('Are you sure you want to leave the show?')) {
        window.location.reload();
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          {/* Broadcast Title */}
          <span className="text-gray-900 font-medium">{broadcastTitle}</span>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
            Stream this to your audience
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Video Canvas */}
        <div className="flex-1 flex flex-col bg-gray-200 p-4">
          {/* Stage Canvas */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden shadow-lg relative">
              {broadcastStream ? (
                <video
                  autoPlay
                  playsInline
                  ref={(el) => {
                    if (el && el.srcObject !== broadcastStream) {
                      el.srcObject = broadcastStream;
                      el.volume = streamVolume;
                      el.play().catch((err) => console.warn('[GuestStage] Play failed:', err));
                    }
                  }}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-gray-400">Connecting to live stream...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section - Self Preview + Status + Controls */}
          <div className="mt-4 flex items-end gap-4">
            {/* Self Video Thumbnail */}
            <div className="relative">
              <div className="w-40 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-primary-500">
                {localStream ? (
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={(el) => {
                      if (el && el.srcObject !== localStream) {
                        el.srcObject = localStream;
                        el.play().catch(() => {});
                      }
                    }}
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                      <span className="text-lg text-white font-semibold">
                        {guestName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {/* Name badge */}
              <div className="absolute bottom-0 left-0 right-0 bg-primary-600 text-white text-xs px-2 py-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                {guestName}
              </div>
              {/* Mic/Video status icons */}
              <div className="absolute top-1 right-1 flex gap-1">
                {!audioEnabled && (
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Present Button */}
            <div className="bg-white rounded-lg p-4 border border-gray-200 flex flex-col items-center">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm text-gray-700">Present</span>
            </div>

            {/* You're in the show! Banner */}
            <div className="flex-1 bg-white rounded-lg border-l-4 border-green-500 p-4">
              <h3 className="font-semibold text-gray-900">You're in the show!</h3>
              <p className="text-sm text-gray-600">Everyone can see and hear you</p>
            </div>

            {/* Recording Status */}
            <div className="bg-white rounded-lg p-4 border border-gray-200 flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Recording hasn't started</h4>
                <p className="text-sm text-gray-500">Please stay in the studio after the show to finish uploading your recordings.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Chat/Comments/Recording */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('private')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'private'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              Private chat
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'comments'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              Comments
            </button>
            <button
              onClick={() => setActiveTab('recording')}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'recording'
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              Recording
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === 'private' && (
              <>
                {/* Studio Chat Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Studio chat</h3>
                      <p className="text-sm text-gray-500">{participants.size + 1} people</p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4">
                  {privateChatMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">Start the conversation</h4>
                      <p className="text-sm text-gray-500">Chat with everyone in the studio.</p>
                      <p className="text-sm text-gray-500">Messages are cleared after each session.</p>
                      <p className="text-sm text-gray-500">Viewers will not see these messages.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {privateChatMessages.map((msg, i) => (
                        <div key={i} className="flex gap-2">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-primary-600">
                              {msg.author.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-900 text-sm">{msg.author}</span>
                            <p className="text-sm text-gray-700">{msg.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'comments' && (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">No comments yet</p>
                </div>
              </div>
            )}

            {activeTab === 'recording' && (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">Recording not started</p>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input (only for private chat tab) */}
          {activeTab === 'private' && (
            <div className="p-3 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Chat with everyone in the studio"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatMessage.trim()}
                  className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:text-gray-400"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          {/* Left Controls */}
          <div className="flex items-center gap-2">
            {/* Microphone */}
            <button
              onClick={onToggleAudio}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                audioEnabled
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {audioEnabled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                ) : (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                  </>
                )}
              </svg>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Camera */}
            <button
              onClick={onToggleVideo}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                videoEnabled
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  : 'bg-red-100 text-red-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {videoEnabled ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                ) : (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                  </>
                )}
              </svg>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Screen Share */}
            <button
              onClick={onToggleScreenShare}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isScreenSharing
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title={isScreenSharing ? 'Stop screen share' : 'Share screen'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {isScreenSharing && <span className="text-xs font-medium">Sharing</span>}
            </button>

            {/* Settings */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                  showSettings
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Settings Panel */}
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                  <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Settings</h3>
                      <button
                        onClick={() => setShowSettings(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Volume Control */}
                    <div className="mb-4">
                      <label className="flex items-center justify-between text-sm text-gray-700 mb-2">
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                          Stream Volume
                        </span>
                        <span className="text-gray-500">{Math.round(streamVolume * 100)}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={streamVolume}
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                      />
                    </div>

                    {/* Audio/Video Status */}
                    <div className="space-y-2 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Microphone</span>
                        <span className={`font-medium ${audioEnabled ? 'text-green-600' : 'text-red-600'}`}>
                          {audioEnabled ? 'On' : 'Off'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Camera</span>
                        <span className={`font-medium ${videoEnabled ? 'text-green-600' : 'text-red-600'}`}>
                          {videoEnabled ? 'On' : 'Off'}
                        </span>
                      </div>
                      {isScreenSharing && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Screen Share</span>
                          <span className="font-medium text-primary-600">Active</span>
                        </div>
                      )}
                    </div>

                    {/* Connection Info */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        Connected to: {broadcastTitle}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Participants: {participants.size + 1}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Leave Button */}
            <button
              onClick={handleLeave}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>

          {/* Right Side - Help */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHelp(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">Need help?</span>
            </button>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowHelp(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Need Help?</h2>
              <p className="text-gray-600">Here are some quick tips:</p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">Microphone issues?</h3>
                  <p className="text-xs text-gray-500">Check your browser permissions and ensure the correct device is selected.</p>
                </div>
              </div>

              <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">Camera not working?</h3>
                  <p className="text-xs text-gray-500">Close other apps using your camera and refresh the page.</p>
                </div>
              </div>

              <div className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">Connection issues?</h3>
                  <p className="text-xs text-gray-500">Try refreshing the page or check your internet connection.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowHelp(false);
                  toast('Contact the host via private chat for assistance', { icon: '💬' });
                }}
                className="w-full py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Contact host via chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
