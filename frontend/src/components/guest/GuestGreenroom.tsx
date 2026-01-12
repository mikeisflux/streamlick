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
