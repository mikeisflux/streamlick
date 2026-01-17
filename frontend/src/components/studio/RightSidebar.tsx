import { useState } from 'react';
import {
  MessageSquare, FileText, Image, Palette, StickyNote,
  Users, MessageCircle, Video, BarChart3, Activity, X
} from 'lucide-react';
import { PeoplePanel } from './panels/PeoplePanel';
import { StylePanel } from './panels/StylePanel';
import { Participant } from '../../types';
import { LayoutType } from '../../store/studioStore';

export type RightTab = 'comments' | 'banners' | 'media' | 'style' | 'notes' | 'people' | 'chat' | 'recording' | 'quality' | 'health' | null;

interface RightSidebarProps {
  activeTab: RightTab;
  onTabChange: (tab: RightTab) => void;
  broadcastId: string;
  participants: Participant[];
  onBringOnStage: (participantId: string) => void;
  onRemoveFromStage: (participantId: string) => void;
  onMuteParticipant: (participantId: string, muted: boolean) => void;
  onKickParticipant: (participantId: string) => void;
  currentLayout: LayoutType;
  backgroundColor: string;
  onLayoutChange: (layout: LayoutType) => void;
  onBackgroundColorChange: (color: string) => void;
}

const TABS = [
  { id: 'comments' as const, label: 'Comments', icon: MessageSquare },
  { id: 'banners' as const, label: 'Banners', icon: FileText },
  { id: 'media' as const, label: 'Media', icon: Image },
  { id: 'style' as const, label: 'Style', icon: Palette },
  { id: 'notes' as const, label: 'Notes', icon: StickyNote },
  { id: 'people' as const, label: 'People', icon: Users },
  { id: 'chat' as const, label: 'Private', icon: MessageCircle },
  { id: 'recording' as const, label: 'Record', icon: Video },
  { id: 'quality' as const, label: 'Quality', icon: BarChart3 },
  { id: 'health' as const, label: 'Health', icon: Activity },
];

export function RightSidebar({
  activeTab,
  onTabChange,
  broadcastId,
  participants,
  onBringOnStage,
  onRemoveFromStage,
  onMuteParticipant,
  onKickParticipant,
  currentLayout,
  backgroundColor,
  onLayoutChange,
  onBackgroundColorChange,
}: RightSidebarProps) {
  const isOpen = activeTab !== null;

  return (
    <>
      {/* Tab Button Bar - Always Visible */}
      <div
        className="fixed top-14 right-0 bottom-20 w-16 bg-dark-900 border-l border-dark-800 flex flex-col z-50"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(isActive ? null : tab.id)}
              className={`flex flex-col items-center justify-center py-3 border-b border-dark-800 transition ${
                isActive
                  ? 'bg-brand-600/20 text-brand-400 border-l-2 border-l-brand-500'
                  : 'text-dark-400 hover:bg-dark-800 hover:text-white'
              }`}
              title={tab.label}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Panel - Slides Out */}
      <aside
        className={`fixed top-14 right-16 bottom-20 w-80 bg-dark-900 border-l border-dark-800 flex flex-col z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {activeTab && (
          <>
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-dark-800">
              <h3 className="text-sm font-semibold capitalize">{activeTab}</h3>
              <button
                onClick={() => onTabChange(null)}
                className="p-1 text-dark-400 hover:text-white hover:bg-dark-800 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'comments' && (
                <CommentsPanel />
              )}

              {activeTab === 'banners' && (
                <BannersPanel />
              )}

              {activeTab === 'media' && (
                <MediaPanel />
              )}

              {activeTab === 'style' && (
                <StylePanel
                  currentLayout={currentLayout}
                  backgroundColor={backgroundColor}
                  onLayoutChange={onLayoutChange}
                  onBackgroundColorChange={onBackgroundColorChange}
                />
              )}

              {activeTab === 'notes' && (
                <NotesPanel />
              )}

              {activeTab === 'people' && (
                <PeoplePanel
                  participants={participants}
                  onBringOnStage={onBringOnStage}
                  onRemoveFromStage={onRemoveFromStage}
                  onMuteParticipant={onMuteParticipant}
                  onKickParticipant={onKickParticipant}
                />
              )}

              {activeTab === 'chat' && (
                <PrivateChatPanel />
              )}

              {activeTab === 'recording' && (
                <RecordingPanel />
              )}

              {activeTab === 'quality' && (
                <QualityPanel />
              )}

              {activeTab === 'health' && (
                <HealthPanel />
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

// Placeholder panels - to be expanded
function CommentsPanel() {
  return (
    <div className="p-4">
      <p className="text-sm text-dark-400">
        Comments from connected platforms will appear here.
      </p>
      <div className="mt-4 p-8 border border-dashed border-dark-700 rounded-lg text-center">
        <MessageSquare className="w-8 h-8 mx-auto text-dark-600 mb-2" />
        <p className="text-dark-500 text-sm">No comments yet</p>
      </div>
    </div>
  );
}

function BannersPanel() {
  return (
    <div className="p-4">
      <p className="text-sm text-dark-400 mb-4">
        Create banners and lower thirds to display on your broadcast.
      </p>
      <button className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm font-medium transition">
        Create Banner
      </button>
    </div>
  );
}

function MediaPanel() {
  return (
    <div className="p-4">
      <p className="text-sm text-dark-400 mb-4">
        Upload and manage media assets for your broadcast.
      </p>
      <button className="w-full px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm font-medium transition border border-dashed border-dark-600">
        Upload Media
      </button>
    </div>
  );
}

function NotesPanel() {
  const [notes, setNotes] = useState('');

  return (
    <div className="p-4">
      <p className="text-sm text-dark-400 mb-4">
        Private notes only visible to you.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Type your notes here..."
        className="w-full h-48 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm resize-none focus:outline-none focus:border-brand-500"
      />
    </div>
  );
}

function PrivateChatPanel() {
  return (
    <div className="p-4">
      <p className="text-sm text-dark-400">
        Private messages with participants.
      </p>
      <div className="mt-4 p-8 border border-dashed border-dark-700 rounded-lg text-center">
        <MessageCircle className="w-8 h-8 mx-auto text-dark-600 mb-2" />
        <p className="text-dark-500 text-sm">Select a participant to chat</p>
      </div>
    </div>
  );
}

function RecordingPanel() {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm">Recording Status</span>
        <span className={`text-sm font-medium ${isRecording ? 'text-red-400' : 'text-dark-400'}`}>
          {isRecording ? 'Recording' : 'Not Recording'}
        </span>
      </div>

      <button
        onClick={() => setIsRecording(!isRecording)}
        className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition ${
          isRecording
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-brand-600 hover:bg-brand-700'
        }`}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>

      <div className="mt-4 text-xs text-dark-500">
        Recordings are saved to Ant Media Server and can be downloaded after the broadcast.
      </div>
    </div>
  );
}

function QualityPanel() {
  return (
    <div className="p-4">
      <h4 className="text-sm font-medium mb-3">Stream Quality</h4>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-400">Resolution</span>
          <span className="text-sm">1920x1080</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-400">Bitrate</span>
          <span className="text-sm">4500 kbps</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-400">Frame Rate</span>
          <span className="text-sm">30 fps</span>
        </div>
      </div>
    </div>
  );
}

function HealthPanel() {
  return (
    <div className="p-4">
      <h4 className="text-sm font-medium mb-3">Connection Health</h4>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-400">Status</span>
          <span className="flex items-center gap-1.5 text-sm text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Connected
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-400">Latency</span>
          <span className="text-sm">45ms</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-dark-400">Packet Loss</span>
          <span className="text-sm">0.1%</span>
        </div>
      </div>
    </div>
  );
}
