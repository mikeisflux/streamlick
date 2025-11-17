import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface StylePanelProps {
  broadcastId?: string;
}

export function StylePanel({ broadcastId }: StylePanelProps) {
  // Load styles from localStorage
  const [primaryColor, setPrimaryColor] = useState(() =>
    localStorage.getItem('style_primaryColor') || '#0066ff'
  );
  const [secondaryColor, setSecondaryColor] = useState(() =>
    localStorage.getItem('style_secondaryColor') || '#6366f1'
  );
  const [backgroundColor, setBackgroundColor] = useState(() =>
    localStorage.getItem('style_backgroundColor') || '#1a1a1a'
  );
  const [textColor, setTextColor] = useState(() =>
    localStorage.getItem('style_textColor') || '#ffffff'
  );
  const [theme, setTheme] = useState<'dark' | 'light' | 'custom'>(() =>
    (localStorage.getItem('style_theme') as any) || 'dark'
  );
  const [cameraFrame, setCameraFrame] = useState<'none' | 'rounded' | 'circle' | 'square'>(() =>
    (localStorage.getItem('style_cameraFrame') as any) || 'rounded'
  );
  const [borderWidth, setBorderWidth] = useState(() => {
    const saved = localStorage.getItem('style_borderWidth');
    return saved ? parseInt(saved) : 2;
  });

  // Persist all style changes to localStorage
  useEffect(() => {
    localStorage.setItem('style_primaryColor', primaryColor);
  }, [primaryColor]);

  useEffect(() => {
    localStorage.setItem('style_secondaryColor', secondaryColor);
  }, [secondaryColor]);

  useEffect(() => {
    localStorage.setItem('style_backgroundColor', backgroundColor);
    // Also update canvas settings for background color
    try {
      const canvasSettingsStr = localStorage.getItem('streamlick_canvas_settings');
      if (canvasSettingsStr) {
        const canvasSettings = JSON.parse(canvasSettingsStr);
        canvasSettings.canvasBackgroundColor = backgroundColor;
        localStorage.setItem('streamlick_canvas_settings', JSON.stringify(canvasSettings));
      }
    } catch (error) {
      console.error('Failed to update canvas background color:', error);
    }
  }, [backgroundColor]);

  useEffect(() => {
    localStorage.setItem('style_textColor', textColor);
  }, [textColor]);

  useEffect(() => {
    localStorage.setItem('style_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('style_cameraFrame', cameraFrame);
  }, [cameraFrame]);

  useEffect(() => {
    localStorage.setItem('style_borderWidth', borderWidth.toString());
  }, [borderWidth]);

  const themes = [
    { id: 'dark', name: 'Dark', colors: { primary: '#0066ff', bg: '#1a1a1a', text: '#ffffff' } },
    { id: 'light', name: 'Light', colors: { primary: '#0066ff', bg: '#ffffff', text: '#000000' } },
    { id: 'custom', name: 'Custom', colors: { primary: primaryColor, bg: backgroundColor, text: textColor } },
  ];

  const handleThemeChange = (themeId: 'dark' | 'light' | 'custom') => {
    // Save current custom colors before switching
    if (theme === 'custom') {
      localStorage.setItem('style_customPrimaryColor', primaryColor);
      localStorage.setItem('style_customBackgroundColor', backgroundColor);
      localStorage.setItem('style_customTextColor', textColor);
    }

    setTheme(themeId);
    const selectedTheme = themes.find(t => t.id === themeId);

    if (themeId === 'custom') {
      // Restore saved custom colors
      const savedCustomPrimary = localStorage.getItem('style_customPrimaryColor');
      const savedCustomBg = localStorage.getItem('style_customBackgroundColor');
      const savedCustomText = localStorage.getItem('style_customTextColor');

      if (savedCustomPrimary) setPrimaryColor(savedCustomPrimary);
      if (savedCustomBg) setBackgroundColor(savedCustomBg);
      if (savedCustomText) setTextColor(savedCustomText);

      toast.success('Switched to custom theme');
    } else if (selectedTheme) {
      setPrimaryColor(selectedTheme.colors.primary);
      setBackgroundColor(selectedTheme.colors.bg);
      setTextColor(selectedTheme.colors.text);
      toast.success(`Switched to ${selectedTheme.name} theme`);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Theme</h3>
        <div className="space-y-2">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => handleThemeChange(t.id as any)}
              className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                theme === t.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{t.name}</span>
                <div className="flex gap-1">
                  <div
                    className="w-6 h-6 rounded border border-gray-200"
                    style={{ backgroundColor: t.colors.primary }}
                  />
                  <div
                    className="w-6 h-6 rounded border border-gray-200"
                    style={{ backgroundColor: t.colors.bg }}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Brand Colors</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Primary Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                placeholder="#0066ff"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Secondary Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                placeholder="#6366f1"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Background Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                placeholder="#1a1a1a"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Text Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="h-10 w-16 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                placeholder="#ffffff"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Camera Frame</h3>
        <div className="grid grid-cols-2 gap-2">
          {['none', 'rounded', 'circle', 'square'].map((frame) => (
            <button
              key={frame}
              onClick={() => setCameraFrame(frame as any)}
              className={`p-3 rounded-lg border-2 transition-colors ${
                cameraFrame === frame
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-16 h-12 bg-gray-200 ${
                    frame === 'rounded'
                      ? 'rounded-lg'
                      : frame === 'circle'
                      ? 'rounded-full'
                      : frame === 'square'
                      ? 'rounded-none'
                      : ''
                  }`}
                  style={{
                    border: frame !== 'none' ? `${borderWidth}px solid ${primaryColor}` : 'none',
                  }}
                />
                <span className="text-xs capitalize text-gray-700">{frame}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {cameraFrame !== 'none' && (
        <div>
          <label className="block text-xs text-gray-600 mb-2">Border Width</label>
          <input
            type="range"
            min="1"
            max="10"
            value={borderWidth}
            onChange={(e) => setBorderWidth(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1px</span>
            <span>{borderWidth}px</span>
            <span>10px</span>
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={() => {
            // Force update canvas background color in case it wasn't synced
            try {
              const canvasSettingsStr = localStorage.getItem('streamlick_canvas_settings');
              if (canvasSettingsStr) {
                const canvasSettings = JSON.parse(canvasSettingsStr);
                canvasSettings.canvasBackgroundColor = backgroundColor;
                localStorage.setItem('streamlick_canvas_settings', JSON.stringify(canvasSettings));
              }
            } catch (error) {
              console.error('Failed to update canvas settings:', error);
            }

            // Dispatch event to notify StudioCanvas of style changes
            window.dispatchEvent(new Event('storage'));
            // Also dispatch a custom event for immediate updates
            window.dispatchEvent(new CustomEvent('styleSettingsUpdated', {
              detail: {
                primaryColor,
                secondaryColor,
                backgroundColor,
                textColor,
                cameraFrame,
                borderWidth
              }
            }));
            toast.success('Style applied successfully!');
          }}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Apply Style
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-3">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Preview</h4>
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: backgroundColor,
            color: textColor,
            border: `2px solid ${primaryColor}`,
          }}
        >
          <p className="text-sm mb-2" style={{ color: primaryColor }}>
            Primary Color
          </p>
          <p className="text-xs">Your brand colors will appear throughout the stream overlay.</p>
        </div>
      </div>
    </div>
  );
}
