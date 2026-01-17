import { useState } from 'react';
import { Mic, MicOff, Video, VideoOff, Plus, Minus, X, MoreVertical } from 'lucide-react';
import { Participant } from '../../../types';

interface PeoplePanelProps {
  participants: Participant[];
  onBringOnStage: (participantId: string) => void;
  onRemoveFromStage: (participantId: string) => void;
  onMuteParticipant: (participantId: string, muted: boolean) => void;
  onKickParticipant: (participantId: string) => void;
}

export function PeoplePanel({
  participants,
  onBringOnStage,
  onRemoveFromStage,
  onMuteParticipant,
  onKickParticipant,
}: PeoplePanelProps) {
  const onStage = participants.filter(p => p.isOnStage);
  const backstage = participants.filter(p => !p.isOnStage && p.status !== 'LEFT' && p.status !== 'WAITING');
  const waiting = participants.filter(p => p.status === 'WAITING' || p.status === 'GREENROOM');

  return (
    <div className="p-4">
      {/* On Stage */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold text-dark-400 uppercase mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-500" />
          On Stage ({onStage.length})
        </h4>
        {onStage.length === 0 ? (
          <p className="text-sm text-dark-500 italic">No participants on stage</p>
        ) : (
          <div className="space-y-2">
            {onStage.map((participant) => (
              <ParticipantRow
                key={participant.id}
                participant={participant}
                onRemove={() => onRemoveFromStage(participant.id)}
                onMute={(muted) => onMuteParticipant(participant.id, muted)}
                onKick={() => onKickParticipant(participant.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Backstage */}
      <div className="mb-6">
        <h4 className="text-xs font-semibold text-dark-400 uppercase mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          Backstage ({backstage.length})
        </h4>
        {backstage.length === 0 ? (
          <p className="text-sm text-dark-500 italic">No participants backstage</p>
        ) : (
          <div className="space-y-2">
            {backstage.map((participant) => (
              <ParticipantRow
                key={participant.id}
                participant={participant}
                onAdd={() => onBringOnStage(participant.id)}
                onMute={(muted) => onMuteParticipant(participant.id, muted)}
                onKick={() => onKickParticipant(participant.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Waiting / Greenroom */}
      <div>
        <h4 className="text-xs font-semibold text-dark-400 uppercase mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Greenroom ({waiting.length})
        </h4>
        {waiting.length === 0 ? (
          <p className="text-sm text-dark-500 italic">No participants waiting</p>
        ) : (
          <div className="space-y-2">
            {waiting.map((participant) => (
              <ParticipantRow
                key={participant.id}
                participant={participant}
                onAdd={() => onBringOnStage(participant.id)}
                onKick={() => onKickParticipant(participant.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ParticipantRowProps {
  participant: Participant;
  onAdd?: () => void;
  onRemove?: () => void;
  onMute?: (muted: boolean) => void;
  onKick: () => void;
}

function ParticipantRow({
  participant,
  onAdd,
  onRemove,
  onMute,
  onKick,
}: ParticipantRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const isHost = participant.role === 'HOST';

  return (
    <div className="flex items-center justify-between p-2 bg-dark-800 rounded-lg group">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          isHost ? 'bg-brand-600' : 'bg-dark-700'
        }`}>
          {participant.name.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div>
          <div className="text-sm font-medium flex items-center gap-2">
            {participant.name}
            {isHost && (
              <span className="text-[10px] px-1.5 py-0.5 bg-brand-600/30 text-brand-400 rounded">
                HOST
              </span>
            )}
          </div>
          <div className="text-xs text-dark-500">{participant.role}</div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Media Status */}
        <div className="flex items-center gap-1 mr-2">
          <span className={`p-1 rounded ${participant.audioEnabled ? 'text-dark-400' : 'text-red-400'}`}>
            {participant.audioEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
          </span>
          <span className={`p-1 rounded ${participant.videoEnabled ? 'text-dark-400' : 'text-red-400'}`}>
            {participant.videoEnabled ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
          </span>
        </div>

        {/* Action Buttons */}
        {!isHost && (
          <>
            {onAdd && (
              <button
                onClick={onAdd}
                className="p-1.5 bg-brand-600 hover:bg-brand-700 rounded transition opacity-0 group-hover:opacity-100"
                title="Add to Stage"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
            {onRemove && (
              <button
                onClick={onRemove}
                className="p-1.5 bg-dark-700 hover:bg-dark-600 rounded transition opacity-0 group-hover:opacity-100"
                title="Remove from Stage"
              >
                <Minus className="w-3 h-3" />
              </button>
            )}

            {/* More Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 hover:bg-dark-700 rounded transition opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="w-3 h-3" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-dark-700 border border-dark-600 rounded-lg shadow-xl overflow-hidden z-10">
                  {onMute && (
                    <button
                      onClick={() => {
                        onMute(!participant.audioEnabled);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-dark-600 transition"
                    >
                      {participant.audioEnabled ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                      {participant.audioEnabled ? 'Mute' : 'Unmute'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onKick();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-dark-600 transition"
                  >
                    <X className="w-3 h-3" />
                    Kick
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
