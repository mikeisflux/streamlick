import { useState, useCallback } from 'react';
import { Scene } from '../../components/SceneManager';
import toast from 'react-hot-toast';

export function useSceneManagement() {
  const [scenes, setScenes] = useState<Scene[]>([
    {
      id: 'default',
      name: 'Main Scene',
      layout: 'grid',
      participants: [],
      overlays: [],
    },
  ]);
  const [currentSceneId, setCurrentSceneId] = useState('default');

  const handleSceneChange = useCallback((sceneId: string, transition?: any) => {
    setCurrentSceneId(sceneId);
    const scene = scenes.find(s => s.id === sceneId);
    toast.success(`Switched to scene: ${scene?.name || sceneId}`);
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
    };
    setScenes(prev => [...prev, newScene]);
    toast.success(`Duplicated scene: ${scene.name}`);
  }, [scenes]);

  return {
    scenes,
    currentSceneId,
    setCurrentSceneId,
    handleSceneChange,
    handleSceneCreate,
    handleSceneUpdate,
    handleSceneDelete,
    handleSceneDuplicate,
  };
}
