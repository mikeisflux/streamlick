import { RefObject } from 'react';
import { SceneManager, Scene } from '../SceneManager';

interface LeftSidebarProps {
  leftSidebarOpen: boolean;
  onToggle: () => void;
  scenes: Scene[];
  currentSceneId: string;
  onSceneChange: (sceneId: string) => void;
  onSceneCreate: (scene: Scene) => void;
  onSceneUpdate: (sceneId: string, updates: Partial<Scene>) => void;
  onSceneDelete: (sceneId: string) => void;
  onSceneDuplicate: (sceneId: string) => void;
  captureCurrentState?: () => Partial<Scene>;
  updateCurrentSceneWithState?: () => void;
  videoRef: RefObject<HTMLVideoElement>;
  localStream: MediaStream | null;
  videoEnabled: boolean;
  showSceneManager: boolean;
  leftSidebarRef: RefObject<HTMLElement>;
}

export function LeftSidebar({
  leftSidebarOpen,
  onToggle,
  scenes,
  currentSceneId,
  onSceneChange,
  onSceneCreate,
  onSceneUpdate,
  onSceneDelete,
  onSceneDuplicate,
  captureCurrentState,
  updateCurrentSceneWithState,
  videoRef,
  localStream,
  videoEnabled,
  showSceneManager,
  leftSidebarRef,
}: LeftSidebarProps) {
  return (
    <>
      {/* Left Sidebar - Scenes (280px width) - Always rendered, slides in/out with transform, overlays content */}
      <aside
        ref={leftSidebarRef}
        className="flex flex-col overflow-hidden border-r absolute left-0 top-0 bottom-0"
        style={{
          width: '280px',
          backgroundColor: '#f5f5f5',
          borderColor: '#e0e0e0',
          transform: leftSidebarOpen ? 'translateX(0)' : 'translateX(-280px)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: leftSidebarOpen ? '4px 0 12px rgba(0, 0, 0, 0.1)' : 'none',
          zIndex: 95, // Layer 95: Left sidebar (above bottom control bar, below top nav)
        }}
        aria-expanded={leftSidebarOpen}
        aria-label="Scenes Panel"
      >
        <div
          className="sticky top-0 flex items-center justify-between px-4 border-b bg-white"
          style={{ height: '56px', borderColor: '#e0e0e0' }}
        >
          <h3 className="text-sm font-semibold text-gray-800">Scenes</h3>
          <button
            onClick={onToggle}
            className="text-gray-600 hover:text-gray-900"
            aria-label="Close Scenes Panel"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{
                transform: leftSidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Scene Manager Component */}
          {showSceneManager && (
            <SceneManager
              scenes={scenes}
              currentSceneId={currentSceneId}
              onSceneChange={onSceneChange}
              onSceneCreate={onSceneCreate}
              onSceneUpdate={onSceneUpdate}
              onSceneDelete={onSceneDelete}
              onSceneDuplicate={onSceneDuplicate}
              captureCurrentState={captureCurrentState}
              updateCurrentSceneWithState={updateCurrentSceneWithState}
            />
          )}

          {/* Default scene card */}
          <div
            className="bg-white rounded shadow hover:shadow-md transition-shadow cursor-pointer border"
            style={{ height: '180px', borderColor: '#e0e0e0' }}
          >
            <div className="h-full flex flex-col p-3">
              <div className="flex-1 bg-black rounded mb-2 relative overflow-hidden">
                {localStream && videoEnabled && (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ willChange: 'auto' }}
                  />
                )}
              </div>
              <p className="text-xs text-gray-700 font-medium">Default Scene</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Toggle Button for Left Sidebar (when collapsed) */}
      {!leftSidebarOpen && (
        <button
          onClick={onToggle}
          className="fixed top-1/2 transform -translate-y-1/2 rounded-r bg-gray-700 hover:bg-gray-600 text-white shadow-lg flex items-center justify-center"
          style={{
            left: 0,
            width: '32px',
            height: '80px',
            zIndex: 84, // Toggle button (slightly below sidebar)
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          title="Open Scenes Panel"
          aria-label="Open Scenes Panel"
          aria-expanded="false"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </>
  );
}
