/**
 * ⚠️ CRITICAL WARNING ⚠️
 * THIS COMPONENT MANAGES SCENES THAT CONFIGURE THE STUDIOCANVAS LAYOUT AND OVERLAYS.
 * ANY CHANGE TO SCENE STRUCTURE, PARTICIPANT POSITIONING, OR OVERLAY CONFIGURATION
 * MUST BE COMPATIBLE WITH THE HIDDEN CANVAS IN StudioCanvas.tsx (drawToCanvas function)
 * OR YOU WILL CREATE A BREAK IN THE CODE.
 *
 * The hidden canvas captures the broadcast output and must be a CARBON COPY of what
 * is displayed in the React preview.
 *
 * Scene elements that affect canvas: layouts, participant positions, overlays (logo, banner, lowerThird, etc.)
 */

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

export interface Scene {
  id: string;
  name: string;
  layout: 'solo' | 'sideBySide' | 'grid' | 'pip' | 'spotlight' | 'custom' | number;
  selectedLayout?: number; // Layout ID for compatibility
  participants: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
  }[];
  overlays: {
    id: string;
    type: 'logo' | 'banner' | 'lowerThird' | 'image' | 'text';
    url?: string;
    text?: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  banners?: {
    id: string;
    type: 'lower-third' | 'text-overlay' | 'cta' | 'countdown';
    title: string;
    subtitle?: string;
    position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    backgroundColor: string;
    textColor: string;
    visible: boolean;
  }[];
  background?: {
    type: 'color' | 'image' | 'video';
    value: string;
    url?: string; // For image/video backgrounds
  };
  audioSettings?: {
    masterVolume: number;
    participantVolumes: Record<string, number>;
  };
  createdAt?: number;
  updatedAt?: number;
}

interface SceneManagerProps {
  scenes: Scene[];
  currentSceneId: string;
  onSceneChange: (sceneId: string, transition?: TransitionType) => void;
  onSceneCreate: (scene: Scene) => void;
  onSceneUpdate: (sceneId: string, updates: Partial<Scene>) => void;
  onSceneDelete: (sceneId: string) => void;
  onSceneDuplicate: (sceneId: string) => void;
  captureCurrentState?: () => Partial<Scene>;
  updateCurrentSceneWithState?: () => void;
}

export type TransitionType =
  | 'cut'
  | 'fade'
  | 'slideLeft'
  | 'slideRight'
  | 'slideUp'
  | 'slideDown'
  | 'dissolve'
  | 'wipe';

export const SceneManager: React.FC<SceneManagerProps> = ({
  scenes,
  currentSceneId,
  onSceneChange,
  onSceneCreate,
  onSceneUpdate,
  onSceneDelete,
  onSceneDuplicate,
  captureCurrentState,
  updateCurrentSceneWithState,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingScene, setEditingScene] = useState<string | null>(null);
  const [newSceneName, setNewSceneName] = useState('');
  const [selectedTransition, setSelectedTransition] = useState<TransitionType>('fade');

  const currentScene = scenes.find(s => s.id === currentSceneId);

  const handleSceneSwitch = (sceneId: string) => {
    if (sceneId === currentSceneId) return;
    onSceneChange(sceneId, selectedTransition);
    toast.success(`Switched to ${scenes.find(s => s.id === sceneId)?.name}`, {
      duration: 2000,
      icon: '🎬',
    });
  };

  const handleCreateScene = () => {
    if (!newSceneName.trim()) {
      toast.error('Please enter a scene name');
      return;
    }

    // Capture current broadcast state if available
    const currentState = captureCurrentState ? captureCurrentState() : {};

    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      name: newSceneName,
      layout: 1,
      selectedLayout: 1,
      participants: [],
      overlays: [],
      banners: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...currentState, // Apply current broadcast state
    };

    onSceneCreate(newScene);
    setNewSceneName('');
    toast.success(`Scene "${newSceneName}" created with current settings!`, {
      icon: '🎬',
      duration: 2000,
    });
  };

  const handleRenameScene = (sceneId: string, newName: string) => {
    onSceneUpdate(sceneId, { name: newName });
    setEditingScene(null);
    toast.success('Scene renamed');
  };

  const handleDeleteScene = (sceneId: string) => {
    if (scenes.length <= 1) {
      toast.error('Cannot delete the last scene');
      return;
    }

    if (sceneId === currentSceneId) {
      toast.error('Cannot delete the active scene');
      return;
    }

    if (confirm('Are you sure you want to delete this scene?')) {
      onSceneDelete(sceneId);
      toast.success('Scene deleted');
    }
  };

  const handleDuplicateScene = (sceneId: string) => {
    onSceneDuplicate(sceneId);
    toast.success('Scene duplicated');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + 1-9 to switch scenes
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (scenes[index]) {
          handleSceneSwitch(scenes[index].id);
        }
      }

      // Ctrl/Cmd + N to create new scene
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setIsExpanded(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [scenes, currentSceneId]);

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🎬</span>
          Scenes
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-white"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {/* Current scene display */}
      <div className="bg-gray-900 rounded p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs text-gray-400">Active Scene</div>
            <div className="text-white font-medium">{currentScene?.name || 'No scene'}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-red-500">LIVE</span>
          </div>
        </div>
        {updateCurrentSceneWithState && (
          <button
            onClick={updateCurrentSceneWithState}
            className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            title="Update this scene with current broadcast settings"
          >
            💾 Update Scene
          </button>
        )}
      </div>

      {isExpanded && (
        <>
          {/* Transition selector */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Transition Effect</label>
            <select
              value={selectedTransition}
              onChange={(e) => setSelectedTransition(e.target.value as TransitionType)}
              className="w-full bg-gray-900 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
            >
              <option value="cut">Cut (Instant)</option>
              <option value="fade">Fade</option>
              <option value="dissolve">Dissolve</option>
              <option value="slideLeft">Slide Left</option>
              <option value="slideRight">Slide Right</option>
              <option value="slideUp">Slide Up</option>
              <option value="slideDown">Slide Down</option>
              <option value="wipe">Wipe</option>
            </select>
          </div>

          {/* Scene list */}
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {scenes.map((scene, index) => {
              const isActive = scene.id === currentSceneId;
              const isEditing = editingScene === scene.id;

              return (
                <div
                  key={scene.id}
                  className={`p-3 rounded border transition-all ${
                    isActive
                      ? 'bg-blue-500/20 border-blue-500'
                      : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-gray-400 text-sm font-mono">
                        {index + 1}
                      </span>

                      {isEditing ? (
                        <input
                          type="text"
                          defaultValue={scene.name}
                          className="flex-1 bg-gray-800 text-white px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                          onBlur={(e) => handleRenameScene(scene.id, e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameScene(scene.id, e.currentTarget.value);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => handleSceneSwitch(scene.id)}
                          className={`flex-1 text-left font-medium ${
                            isActive ? 'text-blue-400' : 'text-white hover:text-blue-400'
                          }`}
                        >
                          {scene.name}
                        </button>
                      )}
                    </div>

                    {!isActive && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingScene(scene.id)}
                          className="p-1 text-gray-400 hover:text-white"
                          title="Rename"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDuplicateScene(scene.id)}
                          className="p-1 text-gray-400 hover:text-white"
                          title="Duplicate"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteScene(scene.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <span className="px-2 py-0.5 bg-gray-800 rounded">Layout {scene.selectedLayout || scene.layout}</span>
                    {scene.banners && scene.banners.length > 0 && (
                      <span className="px-2 py-0.5 bg-purple-900/30 text-purple-300 rounded">{scene.banners.length} banner{scene.banners.length !== 1 ? 's' : ''}</span>
                    )}
                    {scene.background && (
                      <span className="px-2 py-0.5 bg-blue-900/30 text-blue-300 rounded">Background</span>
                    )}
                    {scene.participants.length > 0 && (
                      <span>{scene.participants.length} participant{scene.participants.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Create new scene */}
          <div className="border-t border-gray-700 pt-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateScene()}
                placeholder="New scene name..."
                className="flex-1 bg-gray-900 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleCreateScene}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
              >
                + Create Scene
              </button>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              <p>💡 Tip: Use Ctrl+1-9 to quickly switch between scenes</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Scene transition renderer
export const applySceneTransition = (
  fromElement: HTMLElement,
  toElement: HTMLElement,
  transition: TransitionType,
  duration: number = 500
): Promise<void> => {
  return new Promise((resolve) => {
    toElement.style.position = 'absolute';
    toElement.style.top = '0';
    toElement.style.left = '0';
    toElement.style.width = '100%';
    toElement.style.height = '100%';

    switch (transition) {
      case 'cut':
        fromElement.style.display = 'none';
        toElement.style.display = 'block';
        resolve();
        break;

      case 'fade':
        toElement.style.opacity = '0';
        toElement.style.display = 'block';
        toElement.style.transition = `opacity ${duration}ms ease-in-out`;

        setTimeout(() => {
          toElement.style.opacity = '1';
          setTimeout(() => {
            fromElement.style.display = 'none';
            resolve();
          }, duration);
        }, 10);
        break;

      case 'dissolve':
        toElement.style.opacity = '0';
        toElement.style.display = 'block';
        toElement.style.transition = `opacity ${duration}ms linear`;
        fromElement.style.transition = `opacity ${duration}ms linear`;

        setTimeout(() => {
          toElement.style.opacity = '1';
          fromElement.style.opacity = '0';
          setTimeout(() => {
            fromElement.style.display = 'none';
            fromElement.style.opacity = '1';
            resolve();
          }, duration);
        }, 10);
        break;

      case 'slideLeft':
        toElement.style.transform = 'translateX(100%)';
        toElement.style.display = 'block';
        toElement.style.transition = `transform ${duration}ms ease-in-out`;
        fromElement.style.transition = `transform ${duration}ms ease-in-out`;

        setTimeout(() => {
          toElement.style.transform = 'translateX(0)';
          fromElement.style.transform = 'translateX(-100%)';
          setTimeout(() => {
            fromElement.style.display = 'none';
            fromElement.style.transform = 'translateX(0)';
            resolve();
          }, duration);
        }, 10);
        break;

      case 'slideRight':
        toElement.style.transform = 'translateX(-100%)';
        toElement.style.display = 'block';
        toElement.style.transition = `transform ${duration}ms ease-in-out`;
        fromElement.style.transition = `transform ${duration}ms ease-in-out`;

        setTimeout(() => {
          toElement.style.transform = 'translateX(0)';
          fromElement.style.transform = 'translateX(100%)';
          setTimeout(() => {
            fromElement.style.display = 'none';
            fromElement.style.transform = 'translateX(0)';
            resolve();
          }, duration);
        }, 10);
        break;

      case 'slideUp':
        toElement.style.transform = 'translateY(100%)';
        toElement.style.display = 'block';
        toElement.style.transition = `transform ${duration}ms ease-in-out`;
        fromElement.style.transition = `transform ${duration}ms ease-in-out`;

        setTimeout(() => {
          toElement.style.transform = 'translateY(0)';
          fromElement.style.transform = 'translateY(-100%)';
          setTimeout(() => {
            fromElement.style.display = 'none';
            fromElement.style.transform = 'translateY(0)';
            resolve();
          }, duration);
        }, 10);
        break;

      case 'slideDown':
        toElement.style.transform = 'translateY(-100%)';
        toElement.style.display = 'block';
        toElement.style.transition = `transform ${duration}ms ease-in-out`;
        fromElement.style.transition = `transform ${duration}ms ease-in-out`;

        setTimeout(() => {
          toElement.style.transform = 'translateY(0)';
          fromElement.style.transform = 'translateY(100%)';
          setTimeout(() => {
            fromElement.style.display = 'none';
            fromElement.style.transform = 'translateY(0)';
            resolve();
          }, duration);
        }, 10);
        break;

      case 'wipe':
        toElement.style.clipPath = 'inset(0 100% 0 0)';
        toElement.style.display = 'block';
        toElement.style.transition = `clip-path ${duration}ms ease-in-out`;

        setTimeout(() => {
          toElement.style.clipPath = 'inset(0 0 0 0)';
          setTimeout(() => {
            fromElement.style.display = 'none';
            resolve();
          }, duration);
        }, 10);
        break;

      default:
        fromElement.style.display = 'none';
        toElement.style.display = 'block';
        resolve();
    }
  });
};
