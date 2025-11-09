import { useState } from 'react';
import {
  MicrophoneIcon,
  VideoCameraIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  XMarkIcon,
  StarIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import {
  MicrophoneIcon as MicrophoneSolidIcon,
  VideoCameraIcon as VideoCameraSolidIcon,
} from '@heroicons/react/24/solid';

interface Participant {
  id: string;
  name: string;
  role: 'host' | 'guest';
  isOnStage: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  quality: '720p' | '1080p' | '4k';
  connectionQuality: 'excellent' | 'good' | 'poor';
}

export function ParticipantsPanel() {
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: 'host-1',
      name: 'You',
      role: 'host',
      isOnStage: true,
      audioEnabled: true,
      videoEnabled: true,
      quality: '1080p',
      connectionQuality: 'excellent',
    },
  ]);

  const [spotlightedParticipant, setSpotlightedParticipant] = useState<string | null>(null);

  const onStageParticipants = participants.filter((p) => p.isOnStage);
  const backstageParticipants = participants.filter((p) => !p.isOnStage);

  const moveToStage = (participantId: string) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId ? { ...p, isOnStage: true } : p
      )
    );
  };

  const moveToBackstage = (participantId: string) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId ? { ...p, isOnStage: false } : p
      )
    );
  };

  const toggleAudio = (participantId: string) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId
          ? { ...p, audioEnabled: !p.audioEnabled }
          : p
      )
    );
  };

  const toggleVideo = (participantId: string) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId
          ? { ...p, videoEnabled: !p.videoEnabled }
          : p
      )
    );
  };

  const removeParticipant = (participantId: string) => {
    if (confirm('Are you sure you want to remove this participant?')) {
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    }
  };

  const toggleSpotlight = (participantId: string) => {
    setSpotlightedParticipant((prev) =>
      prev === participantId ? null : participantId
    );
  };

  const getConnectionColor = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return 'bg-green-500';
      case 'good':
        return 'bg-yellow-500';
      case 'poor':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const renderParticipant = (participant: Participant) => (
    <div
      key={participant.id}
      className={`p-3 rounded-lg border-2 transition-all ${
        spotlightedParticipant === participant.id
          ? 'border-yellow-500 bg-yellow-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* Participant Header */}
      <div className="flex items-start gap-3 mb-2">
        <div className="relative flex-shrink-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{
              backgroundColor: participant.role === 'host' ? '#9b59b6' : '#3b82f6',
            }}
          >
            {participant.name[0].toUpperCase()}
          </div>
          {/* Connection Quality Indicator */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getConnectionColor(
              participant.connectionQuality
            )}`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">
              {participant.name}
            </span>
            {participant.role === 'host' && (
              <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded font-medium">
                Host
              </span>
            )}
            {spotlightedParticipant === participant.id && (
              <StarIcon className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            )}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span>{participant.quality}</span>
            <span className="text-gray-300">•</span>
            <span className="capitalize">{participant.connectionQuality}</span>
          </div>
        </div>

        {participant.role !== 'host' && (
          <button
            onClick={() => removeParticipant(participant.id)}
            className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
            title="Remove participant"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Audio Toggle */}
          <button
            onClick={() => toggleAudio(participant.id)}
            className={`p-2 rounded transition-colors ${
              participant.audioEnabled
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'bg-red-100 hover:bg-red-200 text-red-600'
            }`}
            title={participant.audioEnabled ? 'Mute' : 'Unmute'}
          >
            {participant.audioEnabled ? (
              <MicrophoneSolidIcon className="w-4 h-4" />
            ) : (
              <MicrophoneIcon className="w-4 h-4" />
            )}
          </button>

          {/* Video Toggle */}
          <button
            onClick={() => toggleVideo(participant.id)}
            className={`p-2 rounded transition-colors ${
              participant.videoEnabled
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'bg-red-100 hover:bg-red-200 text-red-600'
            }`}
            title={participant.videoEnabled ? 'Hide video' : 'Show video'}
          >
            {participant.videoEnabled ? (
              <VideoCameraSolidIcon className="w-4 h-4" />
            ) : (
              <VideoCameraIcon className="w-4 h-4" />
            )}
          </button>

          {/* Spotlight Toggle */}
          <button
            onClick={() => toggleSpotlight(participant.id)}
            className={`p-2 rounded transition-colors ${
              spotlightedParticipant === participant.id
                ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title="Spotlight"
          >
            <StarIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Stage Controls */}
        {participant.role !== 'host' && (
          <div className="flex items-center gap-1">
            {participant.isOnStage ? (
              <button
                onClick={() => moveToBackstage(participant.id)}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors flex items-center gap-1"
              >
                <ArrowDownIcon className="w-3 h-3" />
                Backstage
              </button>
            ) : (
              <button
                onClick={() => moveToStage(participant.id)}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1"
              >
                <ArrowUpIcon className="w-3 h-3" />
                On Stage
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* On Stage Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            On Stage
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
              {onStageParticipants.length}
            </span>
          </h3>
        </div>

        <div className="space-y-2">
          {onStageParticipants.length > 0 ? (
            onStageParticipants.map(renderParticipant)
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              No participants on stage
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-2 bg-white text-gray-500">Backstage</span>
        </div>
      </div>

      {/* Backstage Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            Waiting
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full font-medium">
              {backstageParticipants.length}
            </span>
          </h3>
        </div>

        <div className="space-y-2">
          {backstageParticipants.length > 0 ? (
            backstageParticipants.map(renderParticipant)
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
              <UserPlusIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No guests waiting</p>
              <p className="text-xs mt-1">Invite guests to join</p>
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>Tip:</strong> Participants in backstage can see and hear you, but viewers
          can't see or hear them until you bring them on stage.
        </p>
      </div>
    </div>
  );
}
