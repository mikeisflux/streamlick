import { useRef, useEffect, useState } from 'react';
import { UserPlus, Plus, Minus, X, MoreVertical } from 'lucide-react';

// Local participant type (subset of full type)
interface Participant {
  id: string;
  name: string;
  role: 'HOST' | 'COHOST' | 'GUEST';
  status: 'WAITING' | 'GREENROOM' | 'ONSTAGE' | 'LEFT';
  streamId?: string | null;
  isOnStage: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  position: number;
}

interface PreviewStripProps {
  participants: Participant[];
  localStream: MediaStream | null;
  localVideoEnabled: boolean;
  hostParticipant: Participant | null;
  onAddToStage: (participantId: string) => void;
  onRemoveFromStage: (participantId: string) => void;
  onKickParticipant: (participantId: string) => void;
  onInviteClick: () => void;
}

interface PreviewTileProps {
  participant: Participant;
  stream?: MediaStream | null;
  isLocal?: boolean;
  onAddToStage?: () => void;
  onRemoveFromStage?: () => void;
  onKick?: () => void;
}

function PreviewTile({
  participant,
  stream,
  isLocal = false,
  onAddToStage,
  onRemoveFromStage,
  onKick,
}: PreviewTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const isOnStage = participant.isOnStage;
  const borderColor = isOnStage ? 'border-brand-500' : participant.status === 'GREENROOM' ? 'border-green-500' : 'border-yellow-500';

  return (
    <div
      className={`relative flex-shrink-0 w-40 h-24 rounded-lg overflow-hidden border-2 ${borderColor} bg-dark-800 group`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMenu(false);
      }}
    >
      {/* Video or Avatar */}
      {stream && participant.videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-dark-700 rounded-full flex items-center justify-center text-lg font-medium">
            {participant.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Name Label */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium truncate">
            {isLocal ? 'You (Preview)' : participant.name}
          </span>
          <div className="flex items-center gap-1">
            {!participant.audioEnabled && (
              <span className="w-4 h-4 bg-red-500/80 rounded-full flex items-center justify-center">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="absolute top-1 left-1">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          isOnStage
            ? 'bg-brand-500/80 text-white'
            : participant.status === 'GREENROOM'
            ? 'bg-green-500/80 text-white'
            : 'bg-yellow-500/80 text-black'
        }`}>
          {isOnStage ? 'ON STAGE' : participant.status === 'GREENROOM' ? 'GREENROOM' : 'BACKSTAGE'}
        </span>
      </div>

      {/* Hover Actions */}
      {isHovered && !isLocal && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2">
          {isOnStage ? (
            <button
              onClick={onRemoveFromStage}
              className="flex items-center gap-1 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-xs font-medium transition"
            >
              <Minus className="w-3 h-3" />
              Remove
            </button>
          ) : (
            <button
              onClick={onAddToStage}
              className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs font-medium transition"
            >
              <Plus className="w-3 h-3" />
              Add to Stage
            </button>
          )}
        </div>
      )}

      {/* Menu Button (for kick/ban) */}
      {!isLocal && participant.role !== 'HOST' && (
        <div className="absolute top-1 right-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 bg-black/50 hover:bg-black/70 rounded transition opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-3 h-3" />
          </button>

          {showMenu && (
            <div className="absolute top-full right-0 mt-1 w-32 bg-dark-800 border border-dark-700 rounded-lg shadow-xl overflow-hidden z-10">
              <button
                onClick={() => {
                  onKick?.();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-dark-700 transition"
              >
                <X className="w-3 h-3" />
                Kick User
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PreviewStrip({
  participants,
  localStream,
  localVideoEnabled,
  hostParticipant,
  onAddToStage,
  onRemoveFromStage,
  onKickParticipant,
  onInviteClick,
}: PreviewStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter participants by status (exclude HOST as they're shown separately with local stream)
  const backstageParticipants = participants.filter(
    p => !p.isOnStage && p.status !== 'LEFT' && p.role !== 'HOST'
  );
  const greenroomParticipants = participants.filter(
    p => (p.status === 'GREENROOM' || p.status === 'WAITING') && p.role !== 'HOST'
  );

  return (
    <div className="bg-dark-900 border-t border-dark-800 px-4 py-3">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-xs font-semibold text-dark-400 uppercase">Preview / Backstage</h3>
        <span className="text-xs text-dark-500">
          {backstageParticipants.length + greenroomParticipants.length + 1} participants
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-dark-900"
      >
        {/* Host Preview */}
        {hostParticipant && (
          <PreviewTile
            participant={{
              ...hostParticipant,
              videoEnabled: localVideoEnabled,
            }}
            stream={localStream}
            isLocal={true}
          />
        )}

        {/* Backstage Participants */}
        {backstageParticipants.map((participant) => (
          <PreviewTile
            key={participant.id}
            participant={participant}
            onAddToStage={() => onAddToStage(participant.id)}
            onRemoveFromStage={() => onRemoveFromStage(participant.id)}
            onKick={() => onKickParticipant(participant.id)}
          />
        ))}

        {/* Greenroom Participants */}
        {greenroomParticipants
          .filter(p => !backstageParticipants.find(b => b.id === p.id))
          .map((participant) => (
            <PreviewTile
              key={participant.id}
              participant={participant}
              onAddToStage={() => onAddToStage(participant.id)}
              onRemoveFromStage={() => onRemoveFromStage(participant.id)}
              onKick={() => onKickParticipant(participant.id)}
            />
          ))}

        {/* Invite Button - Green filled */}
        <button
          onClick={onInviteClick}
          className="flex-shrink-0 w-40 h-24 rounded-lg bg-green-600/20 border-2 border-green-600/50 hover:bg-green-600/30 hover:border-green-500 flex flex-col items-center justify-center gap-2 transition"
        >
          <UserPlus className="w-6 h-6 text-green-500" />
          <span className="text-xs text-green-500 font-medium">Invite Guests</span>
        </button>
      </div>
    </div>
  );
}
