import { RefObject, useState } from 'react';
import { CommentsPanel } from '../CommentsPanel';
import { MediaAssetsPanel } from '../MediaAssetsPanel';
import { StylePanel } from '../StylePanel';
import { NotesPanel } from '../NotesPanel';
import { ParticipantsPanel } from '../ParticipantsPanel';
import { PrivateChatPanel } from '../PrivateChatPanel';
import { RecordingControls } from '../RecordingControls';
import { BitrateControl } from '../BitrateControl';
import { StreamHealthMonitor } from '../StreamHealthMonitor';
import { ChatModeration, ChatMessage } from '../ChatModeration';
import { TeleprompterSettings } from '../../hooks/studio/useTeleprompter';

interface Comment {
  id: string;
  platform: 'youtube' | 'facebook' | 'twitch' | 'linkedin' | 'x' | 'rumble';
  authorName: string;
  authorAvatar?: string;
  message: string;
  timestamp: Date;
}

interface RightSidebarProps {
  rightSidebarOpen: boolean;
  activeRightTab: 'comments' | 'banners' | 'media' | 'style' | 'notes' | 'people' | 'chat' | 'recording' | 'quality' | 'health' | null;
  onTabToggle: (tab: 'comments' | 'banners' | 'media' | 'style' | 'notes' | 'people' | 'chat' | 'recording' | 'quality' | 'health') => void;
  broadcastId: string | undefined;
  currentUserId: string | undefined;
  isLive: boolean;
  onShowBannerDrawer: () => void;
  rightSidebarRef: RefObject<HTMLElement>;
  teleprompterState: ReturnType<typeof import('../../hooks/studio/useTeleprompter').useTeleprompter>;
  onCommentClick?: (comment: Comment) => void;
}

export function RightSidebar({
  rightSidebarOpen,
  activeRightTab,
  onTabToggle,
  broadcastId,
  currentUserId,
  isLive,
  onShowBannerDrawer,
  rightSidebarRef,
  teleprompterState,
  onCommentClick,
}: RightSidebarProps) {
  return (
    <>
      {/* Persistent Button Bar - Always Visible (64px, fixed on right edge) */}
      <div
        className="flex flex-col border-l fixed bottom-0 justify-start gap-0"
        style={{
          position: 'fixed',
          top: '60px',
          right: 0,
          width: '64px',
          backgroundColor: '#f8f8f8',
          borderColor: '#e0e0e0',
          zIndex: 96, // Layer 96: Right sidebar buttons (above content panel)
        }}
      >
        <button
          onClick={() => onTabToggle('comments')}
          className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
          aria-label="Comments Panel"
          aria-expanded={activeRightTab === 'comments'}
          style={{
            borderBottomColor: '#e0e0e0',
            ...(activeRightTab === 'comments' ? {
              backgroundColor: '#e6f2ff',
              color: '#0066ff',
              borderLeft: '4px solid #0066ff'
            } : {
              color: '#666666'
            })
          }}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <span className="text-xs font-medium">Comments</span>
        </button>

        <button
          onClick={() => onTabToggle('banners')}
          className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
          aria-label="Banners Panel"
          aria-expanded={activeRightTab === 'banners'}
          style={{
            borderBottomColor: '#e0e0e0',
            ...(activeRightTab === 'banners' ? {
              backgroundColor: '#e6f2ff',
              color: '#0066ff',
              borderLeft: '4px solid #0066ff'
            } : {
              color: '#666666'
            })
          }}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-medium">Banners</span>
        </button>

        <button
          onClick={() => onTabToggle('media')}
          className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
          aria-label="Media Panel"
          aria-expanded={activeRightTab === 'media'}
          style={{
            borderBottomColor: '#e0e0e0',
            ...(activeRightTab === 'media' ? {
              backgroundColor: '#e6f2ff',
              color: '#0066ff',
              borderLeft: '4px solid #0066ff'
            } : {
              color: '#666666'
            })
          }}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-medium">Media</span>
        </button>

        <button
          onClick={() => onTabToggle('style')}
          className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
          aria-label="Style Panel"
          aria-expanded={activeRightTab === 'style'}
          style={{
            borderBottomColor: '#e0e0e0',
            ...(activeRightTab === 'style' ? {
              backgroundColor: '#e6f2ff',
              color: '#0066ff',
              borderLeft: '4px solid #0066ff'
            } : {
              color: '#666666'
            })
          }}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <span className="text-xs font-medium">Style</span>
        </button>

        <button
          onClick={() => onTabToggle('notes')}
          className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
          aria-label="Notes Panel"
          aria-expanded={activeRightTab === 'notes'}
          style={{
            borderBottomColor: '#e0e0e0',
            ...(activeRightTab === 'notes' ? {
              backgroundColor: '#e6f2ff',
              color: '#0066ff',
              borderLeft: '4px solid #0066ff'
            } : {
              color: '#666666'
            })
          }}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-xs font-medium">Notes</span>
        </button>

        <button
          onClick={() => onTabToggle('people')}
          className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
          aria-label="People Panel"
          aria-expanded={activeRightTab === 'people'}
          style={{
            borderBottomColor: '#e0e0e0',
            ...(activeRightTab === 'people' ? {
              backgroundColor: '#e6f2ff',
              color: '#0066ff',
              borderLeft: '4px solid #0066ff'
            } : {
              color: '#666666'
            })
          }}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="text-xs font-medium">People</span>
        </button>

        <button
          onClick={() => onTabToggle('chat')}
          className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
          aria-label="Private Chat Panel"
          aria-expanded={activeRightTab === 'chat'}
          style={{
            borderBottomColor: '#e0e0e0',
            ...(activeRightTab === 'chat' ? {
              backgroundColor: '#e6f2ff',
              color: '#0066ff',
              borderLeft: '4px solid #0066ff'
            } : {
              color: '#666666'
            })
          }}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="text-xs font-medium">Private</span>
        </button>

        <button
          onClick={() => onTabToggle('recording')}
          className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
          aria-label="Recording Panel"
          aria-expanded={activeRightTab === 'recording'}
          style={{
            borderBottomColor: '#e0e0e0',
            ...(activeRightTab === 'recording' ? {
              backgroundColor: '#e6f2ff',
              color: '#0066ff',
              borderLeft: '4px solid #0066ff'
            } : {
              color: '#666666'
            })
          }}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-medium">Record</span>
        </button>

        <button
          onClick={() => onTabToggle('quality')}
          className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
          aria-label="Stream Quality Panel"
          aria-expanded={activeRightTab === 'quality'}
          style={{
            borderBottomColor: '#e0e0e0',
            ...(activeRightTab === 'quality' ? {
              backgroundColor: '#e6f2ff',
              color: '#0066ff',
              borderLeft: '4px solid #0066ff'
            } : {
              color: '#666666'
            })
          }}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs font-medium">Quality</span>
        </button>

        <button
          onClick={() => onTabToggle('health')}
          className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
          aria-label="Stream Health Panel"
          aria-expanded={activeRightTab === 'health'}
          style={{
            borderBottomColor: '#e0e0e0',
            ...(activeRightTab === 'health' ? {
              backgroundColor: '#e6f2ff',
              color: '#0066ff',
              borderLeft: '4px solid #0066ff'
            } : {
              color: '#666666'
            })
          }}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-medium">Health</span>
        </button>
      </div>

      {/* Expandable Content Panel - Slides out from right (320px, absolute positioned) */}
      <aside
        ref={rightSidebarRef}
        className="fixed bottom-0 flex flex-col overflow-hidden border-l"
        style={{
          top: '60px',
          right: '64px',
          width: '320px',
          backgroundColor: '#ffffff',
          borderColor: '#e0e0e0',
          zIndex: 95, // Content panel (above bottom control bar, below top nav)
          transform: rightSidebarOpen ? 'translateX(0)' : 'translateX(320px)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        aria-expanded={rightSidebarOpen}
        aria-label="Tabbed Panels Content"
      >
        {activeRightTab && (
          <>
            {/* Panel Header */}
            <div
              className="flex items-center justify-between px-4 border-b bg-white"
              style={{ height: '56px', borderColor: '#e0e0e0' }}
            >
              <h3 className="text-sm font-semibold text-gray-800 capitalize">{activeRightTab}</h3>
              <button
                onClick={() => onTabToggle(activeRightTab)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto">
              {activeRightTab === 'comments' && (
                <>
                  {broadcastId && (
                    <div className="border-b border-gray-200">
                      <ChatModeration
                        broadcastId={broadcastId}
                        isHost={true}
                        recentMessages={[]}
                      />
                    </div>
                  )}
                  <CommentsPanel broadcastId={broadcastId} onCommentClick={onCommentClick} />
                </>
              )}
              {activeRightTab === 'banners' && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Banners</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Manage your stream banners and overlays. Click the button below for the full banner editor.
                  </p>
                  <button
                    onClick={onShowBannerDrawer}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Open Banner Editor
                  </button>
                </div>
              )}
              {activeRightTab === 'media' && <MediaAssetsPanel broadcastId={broadcastId} />}
              {activeRightTab === 'style' && <StylePanel broadcastId={broadcastId} />}
              {activeRightTab === 'notes' && <NotesPanel broadcastId={broadcastId} teleprompterState={teleprompterState} />}
              {activeRightTab === 'people' && <ParticipantsPanel />}
              {activeRightTab === 'chat' && <PrivateChatPanel broadcastId={broadcastId} currentUserId={currentUserId} />}
              {activeRightTab === 'recording' && (
                <RecordingControls
                  broadcastId={broadcastId}
                />
              )}
              {activeRightTab === 'quality' && broadcastId && (
                <div className="p-4">
                  <BitrateControl broadcastId={broadcastId} isLive={isLive} />
                </div>
              )}
              {activeRightTab === 'health' && broadcastId && (
                <div className="p-4">
                  <StreamHealthMonitor broadcastId={broadcastId} isLive={isLive} />
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
