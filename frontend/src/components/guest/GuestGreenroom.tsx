/**
 * GuestGreenroom Component
 *
 * Main greenroom interface after guest has joined.
 * Shows different views for greenroom (waiting) and live (on stage).
 */

import { VideoPreview } from '../VideoPreview';
import { GuestGreenroomHeader } from './GuestGreenroomHeader';
import { GuestStatusBanner, GuestStatus } from './GuestStatusBanner';
import { GuestMediaControls } from './GuestMediaControls';
import { GuestStreamPreview } from './GuestStreamPreview';
import { GuestParticipantsList } from './GuestParticipantsList';
import { GuestChat } from './GuestChat';
import { GuestSystemCheck } from './GuestSystemCheck';
import { GuestStage } from './GuestStage';

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

interface DeviceInfo {
  deviceId: string;
  label: string;
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
  isScreenSharing?: boolean;
  participants: Map<string, Participant>;
  privateChatMessages: ChatMessage[];
  publicChatMessages: ChatMessage[];
  audioDevices?: DeviceInfo[];
  videoDevices?: DeviceInfo[];
  selectedAudioDevice?: string;
  selectedVideoDevice?: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare?: () => void;
  onVolumeChange: (volume: number) => void;
  onSendPrivateMessage: (message: string) => void;
  onAudioDeviceChange?: (deviceId: string) => void;
  onVideoDeviceChange?: (deviceId: string) => void;
  onLeave?: () => void;
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
  isScreenSharing = false,
  participants,
  privateChatMessages,
  publicChatMessages,
  audioDevices = [],
  videoDevices = [],
  selectedAudioDevice,
  selectedVideoDevice,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onVolumeChange,
  onSendPrivateMessage,
  onAudioDeviceChange,
  onVideoDeviceChange,
  onLeave,
}: GuestGreenroomProps) {
  // When LIVE, show the GuestStage component
  if (status === 'live') {
    return (
      <GuestStage
        broadcastTitle={broadcastTitle}
        guestName={guestName}
        localStream={localStream}
        broadcastStream={broadcastStream}
        streamVolume={streamVolume}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        isScreenSharing={isScreenSharing}
        participants={participants}
        privateChatMessages={privateChatMessages}
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        selectedAudioDevice={selectedAudioDevice}
        selectedVideoDevice={selectedVideoDevice}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onToggleScreenShare={onToggleScreenShare}
        onVolumeChange={onVolumeChange}
        onSendPrivateMessage={onSendPrivateMessage}
        onAudioDeviceChange={onAudioDeviceChange}
        onVideoDeviceChange={onVideoDeviceChange}
        onLeave={onLeave}
      />
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
