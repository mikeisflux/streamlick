/**
 * GuestParticipantsList Component
 *
 * Displays the list of participants in the greenroom.
 */

interface Participant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface GuestParticipantsListProps {
  currentUserName: string;
  participants: Map<string, Participant>;
}

export function GuestParticipantsList({
  currentUserName,
  participants,
}: GuestParticipantsListProps) {
  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="font-semibold text-white">Participants</h3>
      </div>

      {/* Participants List */}
      <div className="p-4 border-b border-gray-700 max-h-48 overflow-y-auto">
        {/* Current user */}
        <div className="bg-gray-700 rounded-lg p-3 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-white font-medium">{currentUserName} (You)</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">In Greenroom</p>
        </div>

        {/* Other participants */}
        {Array.from(participants.values()).map((participant) => (
          <div key={participant.id} className="bg-gray-700 rounded-lg p-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-white font-medium">{participant.name}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">In Greenroom</p>
          </div>
        ))}

        {/* Info message when empty */}
        {participants.size === 0 && (
          <div className="mt-2 p-3 bg-blue-900 bg-opacity-30 rounded-lg">
            <p className="text-xs text-blue-200">
              Other guests in the greenroom will appear here. You can chat with them while waiting.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
