import { useState, useEffect } from 'react';
import { Button } from './Button';
import toast from 'react-hot-toast';
import api from '../services/api';

export interface BackgroundEffect {
  type: 'none' | 'blur' | 'greenscreen' | 'virtual';
  blurAmount?: number; // 0-20 pixels
  chromaKey?: {
    color: string; // hex color
    similarity: number; // 0-1
    smoothness: number; // 0-1
  };
  virtualBackground?: {
    type: 'image' | 'video';
    url: string;
  };
}

interface BackgroundEffectsProps {
  currentEffect: BackgroundEffect;
  onEffectChange: (effect: BackgroundEffect) => void;
}

export function BackgroundEffects({ currentEffect, onEffectChange }: BackgroundEffectsProps) {
  const [effectType, setEffectType] = useState<BackgroundEffect['type']>(currentEffect.type);
  const [blurAmount, setBlurAmount] = useState(currentEffect.blurAmount || 10);
  const [chromaColor, setChromaColor] = useState(currentEffect.chromaKey?.color || '#00ff00');
  const [chromaSimilarity, setChromaSimilarity] = useState(currentEffect.chromaKey?.similarity || 0.4);
  const [chromaSmoothness, setChromaSmoothness] = useState(currentEffect.chromaKey?.smoothness || 0.1);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [defaultBackgrounds, setDefaultBackgrounds] = useState<any[]>([]);
  const [customBackgrounds, setCustomBackgrounds] = useState<any[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    loadDefaultBackgrounds();
    loadCustomBackgrounds();
  }, []);

  const loadDefaultBackgrounds = async () => {
    try {
      const response = await api.get('/assets/backgrounds/defaults');
      setDefaultBackgrounds(response.data.assets || []);
    } catch (error) {
      console.error('Failed to load default backgrounds:', error);
    }
  };

  const loadCustomBackgrounds = async () => {
    try {
      const response = await api.get('/backgrounds/custom');
      setCustomBackgrounds(response.data.backgrounds || []);
    } catch (error) {
      console.error('Failed to load custom backgrounds:', error);
    }
  };

  const handleEffectTypeChange = (type: BackgroundEffect['type']) => {
    setEffectType(type);

    let effect: BackgroundEffect = { type };

    if (type === 'blur') {
      effect.blurAmount = blurAmount;
    } else if (type === 'greenscreen') {
      effect.chromaKey = {
        color: chromaColor,
        similarity: chromaSimilarity,
        smoothness: chromaSmoothness,
      };
    } else if (type === 'virtual' && selectedBackground) {
      const bg = [...defaultBackgrounds, ...customBackgrounds].find(b => b.id === selectedBackground);
      if (bg) {
        effect.virtualBackground = {
          type: 'image',
          url: bg.url,
        };
      }
    }

    onEffectChange(effect);
  };

  const handleBlurChange = (value: number) => {
    setBlurAmount(value);
    if (effectType === 'blur') {
      onEffectChange({
        type: 'blur',
        blurAmount: value,
      });
    }
  };

  const handleChromaSettingChange = () => {
    if (effectType === 'greenscreen') {
      onEffectChange({
        type: 'greenscreen',
        chromaKey: {
          color: chromaColor,
          similarity: chromaSimilarity,
          smoothness: chromaSmoothness,
        },
      });
    }
  };

  const handleBackgroundSelect = (backgroundId: string) => {
    setSelectedBackground(backgroundId);
    const bg = [...defaultBackgrounds, ...customBackgrounds].find(b => b.id === backgroundId);

    if (bg) {
      setEffectType('virtual');
      onEffectChange({
        type: 'virtual',
        virtualBackground: {
          type: 'image',
          url: bg.url,
        },
      });
    }
  };

  const handleUploadBackground = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);

    try {
      toast.loading('Uploading background...', { id: 'upload-bg' });
      const response = await api.post('/backgrounds/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setCustomBackgrounds([...customBackgrounds, response.data.background]);
      toast.success('Background uploaded', { id: 'upload-bg' });
      setShowUploadModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload failed', { id: 'upload-bg' });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-300">Background Effects</h3>

      {/* Effect Type Selector */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleEffectTypeChange('none')}
          className={`p-2 rounded text-xs ${
            effectType === 'none'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          ✖️ None
        </button>
        <button
          onClick={() => handleEffectTypeChange('blur')}
          className={`p-2 rounded text-xs ${
            effectType === 'blur'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          🌫️ Blur
        </button>
        <button
          onClick={() => handleEffectTypeChange('greenscreen')}
          className={`p-2 rounded text-xs ${
            effectType === 'greenscreen'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          🟢 Green Screen
        </button>
        <button
          onClick={() => handleEffectTypeChange('virtual')}
          className={`p-2 rounded text-xs ${
            effectType === 'virtual'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          🖼️ Virtual BG
        </button>
      </div>

      {/* Blur Controls */}
      {effectType === 'blur' && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Blur Amount: {blurAmount}px
          </label>
          <input
            id="blur-amount"
            type="range"
            min="0"
            max="20"
            value={blurAmount}
            onChange={(e) => handleBlurChange(parseInt(e.target.value))}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            aria-label="Background blur amount"
          />
        </div>
      )}

      {/* Green Screen Controls */}
      {effectType === 'greenscreen' && (
        <div className="space-y-3">
          <div>
            <label htmlFor="chroma-color" className="text-xs text-gray-400 block mb-1">
              Chroma Key Color
            </label>
            <div className="flex gap-2">
              <input
                id="chroma-color"
                type="color"
                value={chromaColor}
                onChange={(e) => {
                  setChromaColor(e.target.value);
                  handleChromaSettingChange();
                }}
                className="w-12 h-8 rounded cursor-pointer"
                aria-label="Chroma key color picker"
              />
              <input
                id="chroma-color-text"
                type="text"
                value={chromaColor}
                onChange={(e) => {
                  setChromaColor(e.target.value);
                  handleChromaSettingChange();
                }}
                className="flex-1 px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600"
                placeholder="#00ff00"
                aria-label="Chroma key color hex value"
              />
            </div>
          </div>

          <div>
            <label htmlFor="chroma-similarity" className="text-xs text-gray-400 block mb-1">
              Similarity: {Math.round(chromaSimilarity * 100)}%
            </label>
            <input
              id="chroma-similarity"
              type="range"
              min="0"
              max="100"
              value={chromaSimilarity * 100}
              onChange={(e) => {
                setChromaSimilarity(parseInt(e.target.value) / 100);
                handleChromaSettingChange();
              }}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              aria-label="Chroma key similarity"
            />
          </div>

          <div>
            <label htmlFor="chroma-smoothness" className="text-xs text-gray-400 block mb-1">
              Smoothness: {Math.round(chromaSmoothness * 100)}%
            </label>
            <input
              id="chroma-smoothness"
              type="range"
              min="0"
              max="100"
              value={chromaSmoothness * 100}
              onChange={(e) => {
                setChromaSmoothness(parseInt(e.target.value) / 100);
                handleChromaSettingChange();
              }}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              aria-label="Chroma key smoothness"
            />
          </div>
        </div>
      )}

      {/* Virtual Background Selector */}
      {effectType === 'virtual' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400">Choose Background</label>
            <Button
              onClick={() => setShowUploadModal(true)}
              variant="ghost"
              size="sm"
              className="text-xs"
            >
              + Upload
            </Button>
          </div>

          {/* Default Backgrounds */}
          <div className="grid grid-cols-3 gap-2">
            {defaultBackgrounds.map((bg) => (
              <button
                key={bg.id}
                onClick={() => handleBackgroundSelect(bg.id)}
                className={`aspect-video rounded overflow-hidden border-2 transition-all ${
                  selectedBackground === bg.id
                    ? 'border-primary-500 ring-2 ring-primary-500/50'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
                title={bg.name}
              >
                {bg.thumbnailUrl || bg.url ? (
                  <img
                    src={bg.thumbnailUrl || bg.url}
                    alt={bg.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">
                    {bg.name}
                  </div>
                )}
              </button>
            ))}

            {/* Custom Backgrounds */}
            {customBackgrounds.map((bg) => (
              <button
                key={bg.id}
                onClick={() => handleBackgroundSelect(bg.id)}
                className={`aspect-video rounded overflow-hidden border-2 transition-all ${
                  selectedBackground === bg.id
                    ? 'border-primary-500 ring-2 ring-primary-500/50'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
                title={bg.name}
              >
                <img
                  src={bg.thumbnailUrl || bg.url}
                  alt={bg.name}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Upload Background</h3>
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadBackground}
              className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700"
            />
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => setShowUploadModal(false)}
                variant="ghost"
                size="sm"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
