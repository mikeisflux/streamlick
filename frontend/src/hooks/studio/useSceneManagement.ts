import { useState, useCallback, useEffect } from 'react';
import { Scene } from '../../components/SceneManager';
import toast from 'react-hot-toast';

export function useSceneManagement() {
  // Load scenes from localStorage
  const [scenes, setScenes] = useState<Scene[]>(() => {
    const saved = localStorage.getItem('studio_scenes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load scenes:', e);
      }
    }
    return [
      {
        id: 'default',
        name: 'Main Scene',
        layout: 1,
        selectedLayout: 1,
        participants: [],
        overlays: [],
        banners: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  });

  const [currentSceneId, setCurrentSceneId] = useState(() => {
    return localStorage.getItem('studio_currentSceneId') || 'default';
  });

  // Persist scenes to localStorage
  useEffect(() => {
    localStorage.setItem('studio_scenes', JSON.stringify(scenes));
  }, [scenes]);

  // Persist current scene ID
  useEffect(() => {
    localStorage.setItem('studio_currentSceneId', currentSceneId);
  }, [currentSceneId]);

  const handleSceneChange = useCallback((sceneId: string, transition?: any) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) {
      toast.error('Scene not found');
      return;
    }

    setCurrentSceneId(sceneId);

    // Dispatch event to notify Studio to apply scene settings
    window.dispatchEvent(new CustomEvent('sceneChanged', {
      detail: {
        sceneId,
        scene,
        transition
      }
    }));

    toast.success(`Switched to scene: ${scene.name}`, {
      icon: '🎬',
      duration: 2000,
    });
  }, [scenes]);

  const handleSceneCreate = useCallback((scene: Scene) => {
    setScenes(prev => [...prev, scene]);
    toast.success(`Created scene: ${scene.name}`);
  }, []);

  const handleSceneUpdate = useCallback((sceneId: string, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...updates } : s));
  }, []);

  const handleSceneDelete = useCallback((sceneId: string) => {
    setScenes(prev => {
      if (prev.length <= 1) {
        toast.error('Cannot delete the last scene');
        return prev;
      }
      const newScenes = prev.filter(s => s.id !== sceneId);
      if (currentSceneId === sceneId) {
        setCurrentSceneId(newScenes[0].id);
      }
      toast.success('Scene deleted');
      return newScenes;
    });
  }, [currentSceneId]);

  const handleSceneDuplicate = useCallback((sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const newScene = {
      ...scene,
      id: `${scene.id}-copy-${Date.now()}`,
      name: `${scene.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setScenes(prev => [...prev, newScene]);
    toast.success(`Duplicated scene: ${scene.name}`);
  }, [scenes]);

  // Get current scene
  const getCurrentScene = useCallback(() => {
    return scenes.find(s => s.id === currentSceneId);
  }, [scenes, currentSceneId]);

  // Capture current broadcast state into a scene
  const captureCurrentState = useCallback((overrides?: Partial<Scene>) => {
    // Get current state from localStorage
    const banners = JSON.parse(localStorage.getItem('banners') || '[]');
    const streamBackground = localStorage.getItem('streamBackground');
    const selectedLayout = parseInt(localStorage.getItem('selectedLayout') || '1');

    const capturedState: Partial<Scene> = {
      selectedLayout,
      layout: selectedLayout,
      banners,
      background: streamBackground ? {
        type: 'image',
        value: streamBackground,
        url: streamBackground,
      } : undefined,
      updatedAt: Date.now(),
      ...overrides,
    };

    return capturedState;
  }, []);

  // Update current scene with current broadcast state
  const updateCurrentSceneWithState = useCallback(() => {
    const capturedState = captureCurrentState();
    handleSceneUpdate(currentSceneId, capturedState);
    toast.success('Scene updated with current settings');
  }, [currentSceneId, captureCurrentState, handleSceneUpdate]);

  return {
    scenes,
    currentSceneId,
    setCurrentSceneId,
    handleSceneChange,
    handleSceneCreate,
    handleSceneUpdate,
    handleSceneDelete,
    handleSceneDuplicate,
    getCurrentScene,
    captureCurrentState,
    updateCurrentSceneWithState,
  };
}
