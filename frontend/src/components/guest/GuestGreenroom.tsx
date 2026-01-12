/**
 * GuestGreenroom Component
 *
 * Main greenroom interface after guest has joined.
 */

import { VideoPreview } from '../VideoPreview';
import { GuestGreenroomHeader } from './GuestGreenroomHeader';
import { GuestStatusBanner, GuestStatus } from './GuestStatusBanner';
import { GuestMediaControls } from './GuestMediaControls';
import { GuestStreamPreview } from './GuestStreamPreview';
import { GuestParticipantsList } from './GuestParticipantsList';
import { GuestChat } from './GuestChat';
import { GuestSystemCheck } from './GuestSystemCheck';

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

interface GuestGreenroomProps {
  broadcastTitle: string;
  guestName: string;
  status: GuestStatus;
  localStream: MediaStream | null;
  broadcastStream: MediaStream | null;
  streamVolume: number;
  audioEnabled: boolean;
  videoEnabled: boolean;
  participants: Map<string, Participant>;
  privateChatMessages: ChatMessage[];
  publicChatMessages: ChatMessage[];
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onVolumeChange: (volume: number) => void;
  onSendPrivateMessage: (message: string) => void;
}

export function GuestGreenroom({
  broadcastTitle,
  guestName,
  status,
  localStream,
  broadcastStream,
  streamVolume,
  audioEnabled,
  videoEnabled,
  participants,
  privateChatMessages,
  publicChatMessages,
  onToggleAudio,
  onToggleVideo,
  onVolumeChange,
  onSendPrivateMessage,
}: GuestGreenroomProps) {
  // When LIVE, show the full stage view (same as what the host sees)
  if (status === 'live') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <GuestGreenroomHeader broadcastTitle={broadcastTitle} status={status} />

        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Full Stage Canvas - This is what the host sees, now the guest sees it too */}
          <div className="flex-1 flex items-center justify-center p-4 bg-black">
            <div className="w-full max-w-6xl aspect-video relative">
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
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-gray-400">Connecting to live stream...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Controls Bar */}
          <div className="bg-gray-800 border-t border-gray-700 p-4">
            <div className="max-w-4xl mx-auto flex items-center justify-center gap-6">
              {/* Mute Button */}
              <button
                onClick={onToggleAudio}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  audioEnabled
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {audioEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  )}
                </svg>
                {audioEnabled ? 'Mute' : 'Unmute'}
              </button>

              {/* Video Button */}
              <button
                onClick={onToggleVideo}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  videoEnabled
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {videoEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth={2} />
                    </>
                  )}
                </svg>
                {videoEnabled ? 'Stop Video' : 'Start Video'}
              </button>

              {/* Volume Control */}
              <div className="flex items-center gap-2 bg-gray-700 px-4 py-2 rounded-lg">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={streamVolume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  aria-label="Stream volume"
                />
                <span className="text-xs text-gray-400 w-8">{Math.round(streamVolume * 100)}%</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Default greenroom view (waiting to be promoted)
  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <GuestGreenroomHeader broadcastTitle={broadcastTitle} status={status} />

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
            <GuestStatusBanner status={status} />

            {/* Media Controls */}
            <GuestMediaControls
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              onToggleAudio={onToggleAudio}
              onToggleVideo={onToggleVideo}
              variant="dark"
            />
          </div>
        </div>

        {/* Right Sidebar - Stream Preview, Participants & Chat */}
        <div className="w-full lg:w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
          {/* Live Stream Preview */}
          <GuestStreamPreview
            stream={broadcastStream}
            volume={streamVolume}
            onVolumeChange={onVolumeChange}
          />

          {/* Participants Section */}
          <GuestParticipantsList
            currentUserName={guestName}
            participants={participants}
          />

          {/* Chat Section */}
          <GuestChat
            currentUserName={guestName}
            privateChatMessages={privateChatMessages}
            publicChatMessages={publicChatMessages}
            onSendPrivateMessage={onSendPrivateMessage}
          />

          {/* System Check */}
          <GuestSystemCheck audioEnabled={audioEnabled} videoEnabled={videoEnabled} />
        </div>
      </main>
    </div>
  );
}
