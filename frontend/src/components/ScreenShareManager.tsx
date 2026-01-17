import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import screenShareService, {
  ScreenShareRequest,
  ScreenShareParticipant,
} from '../services/screen-share.service';

interface ScreenShareManagerProps {
  isHost: boolean;
  participantId: string;
  participantName: string;
  onScreenShareStart?: (stream: MediaStream) => void;
  onScreenShareStop?: () => void;
}

export const ScreenShareManager: React.FC<ScreenShareManagerProps> = ({
  isHost,
  participantId,
  participantName,
  onScreenShareStart,
  onScreenShareStop,
}) => {
  const [isBroadcasterSharing, setIsBroadcasterSharing] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [hasSystemAudio, setHasSystemAudio] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<ScreenShareRequest[]>([]);
  const [activeShares, setActiveShares] = useState<ScreenShareParticipant[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    // Listen for screen share events
    const handleRequest = (request: ScreenShareRequest) => {
      setPendingRequests(prev => [...prev, request]);
      toast('New screen share request!', {
        icon: '🖥️',
        duration: 5000,
      });
    };

    const handleBroadcasterStarted = (data: any) => {
      setIsBroadcasterSharing(true);
      setHasCamera(data.hasCamera);
      setHasSystemAudio(data.hasSystemAudio);
      if (onScreenShareStart) {
        onScreenShareStart(data.screenStream);
      }
    };

    const handleBroadcasterStopped = () => {
      setIsBroadcasterSharing(false);
      if (onScreenShareStop) {
        onScreenShareStop();
      }
    };

    const handleParticipantStarted = (participant: ScreenShareParticipant) => {
      setActiveShares(prev => [...prev, participant]);
      toast.success(`${participant.participantName} started screen sharing`);
    };

    const handleParticipantStopped = (participantId: string) => {
      setActiveShares(prev => prev.filter(p => p.participantId !== participantId));
      toast(`Screen share stopped`, { icon: '🖥️' });
    };

    const handleApproved = () => {
      setRequestSent(false);
      toast.success('Screen share request approved! Starting...');
      startParticipantShare();
    };

    const handleDenied = (data: { reason?: string }) => {
      setRequestSent(false);
      toast.error(data.reason || 'Screen share request denied');
    };

    screenShareService.on('screen-share-request', handleRequest);
    screenShareService.on('broadcaster-screen-share-started', handleBroadcasterStarted);
    screenShareService.on('broadcaster-screen-share-stopped', handleBroadcasterStopped);
    screenShareService.on('participant-screen-share-started', handleParticipantStarted);
    screenShareService.on('participant-screen-share-stopped', handleParticipantStopped);
    screenShareService.on('screen-share-approved', handleApproved);
    screenShareService.on('screen-share-denied', handleDenied);

    return () => {
      screenShareService.off('screen-share-request', handleRequest);
      screenShareService.off('broadcaster-screen-share-started', handleBroadcasterStarted);
      screenShareService.off('broadcaster-screen-share-stopped', handleBroadcasterStopped);
      screenShareService.off('participant-screen-share-started', handleParticipantStarted);
      screenShareService.off('participant-screen-share-stopped', handleParticipantStopped);
      screenShareService.off('screen-share-approved', handleApproved);
      screenShareService.off('screen-share-denied', handleDenied);
    };
  }, [onScreenShareStart, onScreenShareStop]);

  const startBroadcasterShare = async () => {
    try {
      const stream = await screenShareService.startBroadcasterScreenShare({
        includeCamera: hasCamera,
        includeSystemAudio: hasSystemAudio,
      });
      toast.success('Screen sharing started!');
    } catch (error: any) {
      toast.error(`Failed to start screen share: ${error.message}`);
    }
  };

  const stopBroadcasterShare = () => {
    screenShareService.stopBroadcasterScreenShare();
    toast('Screen sharing stopped', { icon: '🖥️' });
  };

  const requestScreenShare = async () => {
    try {
      setRequestSent(true);
      await screenShareService.requestScreenShare(participantId, participantName);
      toast.success('Screen share request sent to host');
    } catch (error: any) {
      setRequestSent(false);
      toast.error(`Failed to request screen share: ${error.message}`);
    }
  };

  const startParticipantShare = async () => {
    try {
      const stream = await screenShareService.startParticipantScreenShare(participantId);
      toast.success('Screen sharing started!');
      if (onScreenShareStart) {
        onScreenShareStart(stream);
      }
    } catch (error: any) {
      toast.error(`Failed to start screen share: ${error.message}`);
    }
  };

  const approveRequest = (requestParticipantId: string) => {
    screenShareService.approveScreenShare(requestParticipantId);
    setPendingRequests(prev => prev.filter(r => r.participantId !== requestParticipantId));
    toast.success('Screen share request approved');
  };

  const denyRequest = (requestParticipantId: string) => {
    screenShareService.denyScreenShare(requestParticipantId, 'Host denied the request');
    setPendingRequests(prev => prev.filter(r => r.participantId !== requestParticipantId));
    toast('Screen share request denied', { icon: '🚫' });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🖥️</span>
          Screen Sharing
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-white"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isHost ? (
        <>
          {/* Broadcaster screen share controls */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">Your Screen</span>
              {isBroadcasterSharing && (
                <span className="flex items-center gap-1 text-xs text-green-500">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  SHARING
                </span>
              )}
            </div>

            {!isBroadcasterSharing && isExpanded && (
              <>
                <div className="space-y-2 mb-3">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={hasCamera}
                      onChange={(e) => setHasCamera(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Keep camera on</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={hasSystemAudio}
                      onChange={(e) => setHasSystemAudio(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Include system audio</span>
                  </label>
                </div>

                <button
                  onClick={startBroadcasterShare}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
                >
                  Share Your Screen
                </button>
              </>
            )}

            {isBroadcasterSharing && isExpanded && (
              <div className="space-y-2">
                <div className="bg-gray-900 rounded p-3">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    {hasCamera && (
                      <span className="flex items-center gap-1">
                        <span>📹</span>
                        Camera on
                      </span>
                    )}
                    {hasSystemAudio && (
                      <span className="flex items-center gap-1">
                        <span>🔊</span>
                        System audio
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={stopBroadcasterShare}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                >
                  Stop Sharing
                </button>
              </div>
            )}
          </div>

          {isExpanded && (
            <>
              {/* Pending screen share requests */}
              {pendingRequests.length > 0 && (
                <div className="mb-4 border-t border-gray-700 pt-4">
                  <h4 className="text-sm font-medium text-white mb-3">Pending Requests</h4>
                  <div className="space-y-2">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.participantId}
                        className="bg-gray-900 rounded p-3 border border-yellow-500/30"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-white font-medium">{request.participantName}</div>
                            <div className="text-xs text-gray-400">
                              {request.hasAudio && '🔊 With audio'}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveRequest(request.participantId)}
                            className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => denyRequest(request.participantId)}
                            className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                          >
                            ✗ Deny
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active participant screen shares */}
              {activeShares.length > 0 && (
                <div className="border-t border-gray-700 pt-4">
                  <h4 className="text-sm font-medium text-white mb-3">Active Screen Shares</h4>
                  <div className="space-y-2">
                    {activeShares.map((share) => (
                      <div
                        key={share.participantId}
                        className="bg-gray-900 rounded p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-white font-medium">{share.participantName}</div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                              Sharing
                            </span>
                            {share.hasAudio && <span>🔊 Audio</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          {/* Participant screen share request */}
          <div className="text-sm text-gray-400 mb-3">
            Request permission to share your screen with the host
          </div>

          {!requestSent ? (
            <button
              onClick={requestScreenShare}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              Request Screen Share
            </button>
          ) : (
            <div className="bg-gray-900 rounded p-3 text-center">
              <div className="text-yellow-500 mb-2">⏳</div>
              <div className="text-sm text-gray-300">Waiting for host approval...</div>
            </div>
          )}
        </>
      )}

      {isExpanded && (
        <div className="mt-4 text-xs text-gray-500 border-t border-gray-700 pt-3">
          <p>💡 Tip: Screen shares include cursor and system audio</p>
          {isHost && <p className="mt-1">💡 Keep your camera on while sharing to stay visible</p>}
        </div>
      )}
    </div>
  );
};
