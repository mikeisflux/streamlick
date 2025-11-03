import { useState } from 'react';
import { toast } from 'react-hot-toast';

export type ChatLayout = 'side' | 'bottom' | 'overlay' | 'floating' | 'hidden';
export type ChatPosition = 'left' | 'right' | 'top' | 'bottom' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
export type ChatSize = 'small' | 'medium' | 'large' | 'custom';

export interface ChatLayoutConfig {
  layout: ChatLayout;
  position: ChatPosition;
  size: ChatSize;
  width: number; // pixels or percentage
  height: number;
  opacity: number; // 0-100
  showAvatars: boolean;
  showTimestamps: boolean;
  fontSize: number; // 12-24
  maxMessages: number; // 10-100
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  borderRadius: number;
  padding: number;
  animateNewMessages: boolean;
  soundOnNewMessage: boolean;
  highlightKeywords: string[];
  hideCommands: boolean;
}

const DEFAULT_CONFIG: ChatLayoutConfig = {
  layout: 'side',
  position: 'right',
  size: 'medium',
  width: 300,
  height: 600,
  opacity: 90,
  showAvatars: true,
  showTimestamps: false,
  fontSize: 14,
  maxMessages: 50,
  backgroundColor: '#1F2937',
  textColor: '#FFFFFF',
  accentColor: '#3B82F6',
  borderRadius: 8,
  padding: 12,
  animateNewMessages: true,
  soundOnNewMessage: false,
  highlightKeywords: [],
  hideCommands: true,
};

const LAYOUT_PRESETS: Record<string, Partial<ChatLayoutConfig>> = {
  minimal: {
    layout: 'overlay',
    position: 'bottomLeft',
    size: 'small',
    width: 300,
    height: 200,
    opacity: 70,
    showAvatars: false,
    showTimestamps: false,
    fontSize: 12,
  },
  standard: {
    layout: 'side',
    position: 'right',
    size: 'medium',
    width: 350,
    height: 600,
    opacity: 90,
    showAvatars: true,
    showTimestamps: false,
    fontSize: 14,
  },
  fullScreen: {
    layout: 'overlay',
    position: 'right',
    size: 'large',
    width: 400,
    height: 800,
    opacity: 85,
    showAvatars: true,
    showTimestamps: true,
    fontSize: 16,
  },
  bottomBar: {
    layout: 'bottom',
    position: 'bottom',
    size: 'custom',
    width: 1920,
    height: 150,
    opacity: 80,
    showAvatars: false,
    showTimestamps: false,
    fontSize: 14,
  },
};

interface ChatLayoutCustomizerProps {
  config: ChatLayoutConfig;
  onChange: (config: ChatLayoutConfig) => void;
  onSavePreset?: (name: string, config: ChatLayoutConfig) => void;
}

export const ChatLayoutCustomizer: React.FC<ChatLayoutCustomizerProps> = ({
  config,
  onChange,
  onSavePreset,
}) => {
  const [activeTab, setActiveTab] = useState<'layout' | 'style' | 'behavior'>('layout');
  const [presetName, setPresetName] = useState('');

  const updateConfig = (updates: Partial<ChatLayoutConfig>) => {
    onChange({ ...config, ...updates });
  };

  const applyPreset = (presetKey: string) => {
    const preset = LAYOUT_PRESETS[presetKey];
    if (preset) {
      onChange({ ...config, ...preset });
      toast.success(`Applied ${presetKey} preset`);
    }
  };

  const saveAsPreset = () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }
    if (onSavePreset) {
      onSavePreset(presetName, config);
      toast.success(`Preset "${presetName}" saved`);
      setPresetName('');
    }
  };

  const renderLayoutTab = () => (
    <div className="space-y-4">
      {/* Layout Type */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Layout Type</label>
        <div className="grid grid-cols-2 gap-2">
          {(['side', 'bottom', 'overlay', 'floating', 'hidden'] as ChatLayout[]).map((layout) => (
            <button
              key={layout}
              onClick={() => updateConfig({ layout })}
              className={`p-3 rounded border text-sm font-medium transition-all ${
                config.layout === layout
                  ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
              }`}
            >
              {layout.charAt(0).toUpperCase() + layout.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Position */}
      {config.layout !== 'hidden' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Position</label>
          <div className="grid grid-cols-3 gap-2">
            {(['topLeft', 'top', 'topRight', 'left', 'right', 'bottomLeft', 'bottom', 'bottomRight'] as ChatPosition[]).map((position) => (
              <button
                key={position}
                onClick={() => updateConfig({ position })}
                className={`p-2 rounded border text-xs font-medium transition-all ${
                  config.position === position
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                }`}
              >
                {position.replace(/([A-Z])/g, ' $1').trim()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Size Presets */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Size</label>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {(['small', 'medium', 'large', 'custom'] as ChatSize[]).map((size) => (
            <button
              key={size}
              onClick={() => updateConfig({ size })}
              className={`p-2 rounded border text-sm font-medium transition-all ${
                config.size === size
                  ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
              }`}
            >
              {size.charAt(0).toUpperCase() + size.slice(1)}
            </button>
          ))}
        </div>

        {/* Custom dimensions */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Width (px)</label>
            <input
              type="number"
              value={config.width}
              onChange={(e) => updateConfig({ width: parseInt(e.target.value) })}
              className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
              min="200"
              max="1920"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Height (px)</label>
            <input
              type="number"
              value={config.height}
              onChange={(e) => updateConfig({ height: parseInt(e.target.value) })}
              className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
              min="100"
              max="1080"
            />
          </div>
        </div>
      </div>

      {/* Opacity */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Opacity: {config.opacity}%
        </label>
        <input
          type="range"
          value={config.opacity}
          onChange={(e) => updateConfig({ opacity: parseInt(e.target.value) })}
          min="0"
          max="100"
          className="w-full"
        />
      </div>
    </div>
  );

  const renderStyleTab = () => (
    <div className="space-y-4">
      {/* Font Size */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Font Size: {config.fontSize}px
        </label>
        <input
          type="range"
          value={config.fontSize}
          onChange={(e) => updateConfig({ fontSize: parseInt(e.target.value) })}
          min="12"
          max="24"
          className="w-full"
        />
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Background</label>
          <input
            type="color"
            value={config.backgroundColor}
            onChange={(e) => updateConfig({ backgroundColor: e.target.value })}
            className="w-full h-10 rounded cursor-pointer"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Text Color</label>
          <input
            type="color"
            value={config.textColor}
            onChange={(e) => updateConfig({ textColor: e.target.value })}
            className="w-full h-10 rounded cursor-pointer"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Accent Color</label>
          <input
            type="color"
            value={config.accentColor}
            onChange={(e) => updateConfig({ accentColor: e.target.value })}
            className="w-full h-10 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Border Radius & Padding */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Border Radius: {config.borderRadius}px</label>
          <input
            type="range"
            value={config.borderRadius}
            onChange={(e) => updateConfig({ borderRadius: parseInt(e.target.value) })}
            min="0"
            max="20"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Padding: {config.padding}px</label>
          <input
            type="range"
            value={config.padding}
            onChange={(e) => updateConfig({ padding: parseInt(e.target.value) })}
            min="0"
            max="24"
            className="w-full"
          />
        </div>
      </div>

      {/* Visual Options */}
      <div className="space-y-2">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-300">Show Avatars</span>
          <input
            type="checkbox"
            checked={config.showAvatars}
            onChange={(e) => updateConfig({ showAvatars: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-300">Show Timestamps</span>
          <input
            type="checkbox"
            checked={config.showTimestamps}
            onChange={(e) => updateConfig({ showTimestamps: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
      </div>
    </div>
  );

  const renderBehaviorTab = () => (
    <div className="space-y-4">
      {/* Max Messages */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Max Messages: {config.maxMessages}
        </label>
        <input
          type="range"
          value={config.maxMessages}
          onChange={(e) => updateConfig({ maxMessages: parseInt(e.target.value) })}
          min="10"
          max="100"
          step="10"
          className="w-full"
        />
      </div>

      {/* Behavioral Options */}
      <div className="space-y-2">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-300">Animate New Messages</span>
          <input
            type="checkbox"
            checked={config.animateNewMessages}
            onChange={(e) => updateConfig({ animateNewMessages: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-300">Sound on New Message</span>
          <input
            type="checkbox"
            checked={config.soundOnNewMessage}
            onChange={(e) => updateConfig({ soundOnNewMessage: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-300">Hide Commands (!command)</span>
          <input
            type="checkbox"
            checked={config.hideCommands}
            onChange={(e) => updateConfig({ hideCommands: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
        </label>
      </div>

      {/* Highlight Keywords */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Highlight Keywords (comma-separated)
        </label>
        <input
          type="text"
          value={config.highlightKeywords.join(', ')}
          onChange={(e) => updateConfig({
            highlightKeywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
          })}
          placeholder="word1, word2, word3"
          className="w-full bg-gray-800 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span>💬</span>
        Chat Layout Customizer
      </h3>

      {/* Presets */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">Quick Presets</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(LAYOUT_PRESETS).map((presetKey) => (
            <button
              key={presetKey}
              onClick={() => applyPreset(presetKey)}
              className="px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-300 hover:border-blue-500 hover:text-blue-400 transition-all"
            >
              {presetKey.charAt(0).toUpperCase() + presetKey.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-4">
        <button
          onClick={() => setActiveTab('layout')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'layout'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Layout
        </button>
        <button
          onClick={() => setActiveTab('style')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'style'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Style
        </button>
        <button
          onClick={() => setActiveTab('behavior')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'behavior'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Behavior
        </button>
      </div>

      {/* Tab Content */}
      <div className="mb-4">
        {activeTab === 'layout' && renderLayoutTab()}
        {activeTab === 'style' && renderStyleTab()}
        {activeTab === 'behavior' && renderBehaviorTab()}
      </div>

      {/* Save as Custom Preset */}
      {onSavePreset && (
        <div className="border-t border-gray-700 pt-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">Save as Custom Preset</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name..."
              className="flex-1 bg-gray-900 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={saveAsPreset}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
