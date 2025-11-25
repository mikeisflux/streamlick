/**
 * ⚠️ NOTE ABOUT CANVAS SYNC ⚠️
 * This component may display captions that appear on the stream.
 * If this component is used on the StudioCanvas, any visual changes here
 * MUST ALSO BE INTEGRATED INTO THE HIDDEN CANVAS in StudioCanvas.tsx
 * (drawToCanvas function) OR YOU WILL CREATE A BREAK IN THE CODE.
 *
 * Check if this component is imported by StudioCanvas.tsx. If so, ensure
 * the hidden canvas drawing code matches this component's appearance.
 */

import { useState, useEffect, useRef } from 'react';
import { CaptionSegment } from '../services/captions.service';

interface CaptionOverlayProps {
  enabled: boolean;
  position?: 'top' | 'center' | 'bottom';
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  backgroundColor?: string;
  textColor?: string;
  maxLines?: number;
  showInterim?: boolean;
}

export function CaptionOverlay({
  enabled,
  position = 'bottom',
  fontSize = 'large',
  backgroundColor = 'rgba(0, 0, 0, 0.8)',
  textColor = '#ffffff',
  maxLines = 2,
  showInterim = true,
}: CaptionOverlayProps) {
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clean up old segments
    const cleanup = setInterval(() => {
      setSegments(prev => prev.filter(seg => Date.now() - seg.endTime < 5000));
    }, 1000);

    return () => clearInterval(cleanup);
  }, []);

  // Public method to add caption segment
  useEffect(() => {
    // @ts-ignore - Expose method globally for captions service
    window.__addCaptionSegment = (segment: CaptionSegment) => {
      setSegments(prev => {
        // Keep only final segments and the latest interim
        const finals = prev.filter(s => s.isFinal);
        const newSegments = [...finals];

        if (segment.isFinal) {
          newSegments.push(segment);
        } else if (showInterim) {
          newSegments.push(segment);
        }

        // Keep only maxLines worth of segments
        return newSegments.slice(-maxLines);
      });
    };

    return () => {
      // @ts-ignore
      delete window.__addCaptionSegment;
    };
  }, [maxLines, showInterim]);

  if (!enabled || segments.length === 0) {
    return null;
  }

  const fontSizeMap = {
    small: '16px',
    medium: '24px',
    large: '32px',
    xlarge: '48px',
  };

  const positionMap = {
    top: 'top-12',
    center: 'top-1/2 transform -translate-y-1/2',
    bottom: 'bottom-24',
  };

  return (
    <div
      ref={containerRef}
      className={`absolute left-1/2 transform -translate-x-1/2 ${positionMap[position]} z-50 max-w-4xl w-11/12 pointer-events-none`}
      style={{
        fontSize: fontSizeMap[fontSize],
      }}
    >
      <div
        className="px-6 py-3 rounded-lg shadow-2xl"
        style={{
          backgroundColor,
          color: textColor,
        }}
      >
        {segments.map((segment, index) => (
          <div
            key={segment.id}
            className={`text-center font-semibold leading-tight ${
              !segment.isFinal ? 'opacity-70 italic' : ''
            } ${index > 0 ? 'mt-2' : ''}`}
            style={{
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
            }}
          >
            {segment.text}
          </div>
        ))}
      </div>

      {/* Confidence indicator (for debugging) */}
      {process.env.NODE_ENV === 'development' && segments.length > 0 && (
        <div className="text-xs text-white/50 text-center mt-1">
          Confidence: {Math.round((segments[segments.length - 1]?.confidence || 0) * 100)}%
        </div>
      )}
    </div>
  );
}

/**
 * Caption Settings Panel Component
 */
interface CaptionSettingsPanelProps {
  onConfigChange: (config: Partial<CaptionOverlayProps>) => void;
  currentConfig: Partial<CaptionOverlayProps>;
}

export function CaptionSettingsPanel({
  onConfigChange,
  currentConfig,
}: CaptionSettingsPanelProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Caption Settings</h3>

      {/* Position */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Position
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['top', 'center', 'bottom'] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => onConfigChange({ position: pos })}
              className={`px-4 py-2 rounded-lg border-2 transition-all text-sm capitalize ${
                currentConfig.position === pos
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Font Size
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(['small', 'medium', 'large', 'xlarge'] as const).map((size) => (
            <button
              key={size}
              onClick={() => onConfigChange({ fontSize: size })}
              className={`px-3 py-2 rounded-lg border-2 transition-all text-xs capitalize ${
                currentConfig.fontSize === size
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Background Color */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Background Color
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { name: 'Black', value: 'rgba(0, 0, 0, 0.8)' },
            { name: 'Gray', value: 'rgba(75, 75, 75, 0.8)' },
            { name: 'Blue', value: 'rgba(37, 99, 235, 0.8)' },
            { name: 'None', value: 'rgba(0, 0, 0, 0)' },
          ].map((color) => (
            <button
              key={color.name}
              onClick={() => onConfigChange({ backgroundColor: color.value })}
              className={`px-3 py-2 rounded-lg border-2 transition-all text-xs ${
                currentConfig.backgroundColor === color.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              {color.name}
            </button>
          ))}
        </div>
      </div>

      {/* Text Color */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Text Color
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { name: 'White', value: '#ffffff' },
            { name: 'Yellow', value: '#fbbf24' },
            { name: 'Green', value: '#34d399' },
            { name: 'Blue', value: '#60a5fa' },
          ].map((color) => (
            <button
              key={color.name}
              onClick={() => onConfigChange({ textColor: color.value })}
              className={`px-3 py-2 rounded-lg border-2 transition-all text-xs ${
                currentConfig.textColor === color.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              <span style={{ color: color.value }}>A</span> {color.name}
            </button>
          ))}
        </div>
      </div>

      {/* Max Lines */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Max Lines: {currentConfig.maxLines || 2}
        </label>
        <input
          type="range"
          min="1"
          max="4"
          value={currentConfig.maxLines || 2}
          onChange={(e) => onConfigChange({ maxLines: parseInt(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Show Interim Results */}
      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={currentConfig.showInterim ?? true}
            onChange={(e) => onConfigChange({ showInterim: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">
            Show interim results (faster but less accurate)
          </span>
        </label>
      </div>
    </div>
  );
}
