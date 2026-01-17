import { LayoutType } from '../../../store/studioStore';

interface StylePanelProps {
  currentLayout: LayoutType;
  backgroundColor: string;
  onLayoutChange: (layout: LayoutType) => void;
  onBackgroundColorChange: (color: string) => void;
}

const LAYOUTS: { value: LayoutType; label: string; icon: string; description: string }[] = [
  { value: 'grid', label: 'Grid', icon: '⊞', description: 'Equal sized tiles in a grid' },
  { value: 'spotlight', label: 'Spotlight', icon: '◐', description: 'One large, others small' },
  { value: 'side-by-side', label: 'Side by Side', icon: '⊟', description: 'Two participants side by side' },
  { value: 'picture-in-picture', label: 'PiP', icon: '◲', description: 'Small overlay on main video' },
  { value: 'single', label: 'Single', icon: '□', description: 'Show only one participant' },
];

const PRESET_COLORS = [
  '#1a1a2e', // Dark blue
  '#16213e', // Navy
  '#0f3460', // Deep blue
  '#1a1a1a', // Black
  '#2d2d2d', // Dark gray
  '#1e3a5f', // Steel blue
  '#2c3e50', // Charcoal
  '#1a472a', // Forest green
  '#4a1942', // Deep purple
  '#4a0e0e', // Dark red
];

export function StylePanel({
  currentLayout,
  backgroundColor,
  onLayoutChange,
  onBackgroundColorChange,
}: StylePanelProps) {
  return (
    <div className="p-4 space-y-6">
      {/* Layout Selection */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Layout</h4>
        <div className="grid grid-cols-2 gap-2">
          {LAYOUTS.map((layout) => (
            <button
              key={layout.value}
              onClick={() => onLayoutChange(layout.value)}
              className={`p-3 rounded-lg text-left transition border ${
                currentLayout === layout.value
                  ? 'bg-brand-600/20 border-brand-500 text-brand-400'
                  : 'bg-dark-800 border-dark-700 hover:border-dark-600'
              }`}
            >
              <div className="text-2xl mb-1">{layout.icon}</div>
              <div className="text-xs font-medium">{layout.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Background Color */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Background Color</h4>

        {/* Preset Colors */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onBackgroundColorChange(color)}
              className={`w-10 h-10 rounded-lg border-2 transition ${
                backgroundColor === color
                  ? 'border-brand-500 ring-2 ring-brand-500/30'
                  : 'border-dark-700 hover:border-dark-600'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>

        {/* Custom Color Picker */}
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => onBackgroundColorChange(e.target.value)}
            className="w-10 h-10 rounded-lg border border-dark-700 cursor-pointer"
          />
          <input
            type="text"
            value={backgroundColor}
            onChange={(e) => onBackgroundColorChange(e.target.value)}
            className="flex-1 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm focus:outline-none focus:border-brand-500"
            placeholder="#000000"
          />
        </div>
      </div>

      {/* Overlays (Placeholder) */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Overlays</h4>
        <div className="space-y-2">
          <label className="flex items-center justify-between p-3 bg-dark-800 rounded-lg cursor-pointer hover:bg-dark-750 transition">
            <span className="text-sm">Show Name Labels</span>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-brand-600 focus:ring-brand-500"
            />
          </label>
          <label className="flex items-center justify-between p-3 bg-dark-800 rounded-lg cursor-pointer hover:bg-dark-750 transition">
            <span className="text-sm">Show Logo</span>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-brand-600 focus:ring-brand-500"
            />
          </label>
        </div>
      </div>

      {/* Logo Upload (Placeholder) */}
      <div>
        <h4 className="text-sm font-semibold mb-3">Logo</h4>
        <button className="w-full p-4 border border-dashed border-dark-700 rounded-lg text-center hover:border-dark-600 transition">
          <div className="text-dark-500 text-sm">
            Click to upload logo
          </div>
          <div className="text-dark-600 text-xs mt-1">
            PNG, JPG up to 2MB
          </div>
        </button>
      </div>
    </div>
  );
}
