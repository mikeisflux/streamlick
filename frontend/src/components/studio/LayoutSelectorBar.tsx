import { Edit2, Plus, Settings } from 'lucide-react';

// Layout names matching the design
const LAYOUT_NAMES = {
  1: 'Solo',
  2: 'Grid 2x2',
  3: 'Grid 3x3',
  4: 'Grid 4x4',
  5: 'Side by Side',
  6: 'Spotlight Left',
  7: 'Spotlight Right',
  8: 'Picture-in-Picture',
  9: 'News Panel',
  10: 'Screen Share',
} as const;

interface LayoutSelectorBarProps {
  selectedLayout: number;
  onLayoutChange: (layoutId: number) => void;
  editMode?: boolean;
  onEditModeToggle?: () => void;
  onAddLayout?: () => void;
  onSettingsClick?: () => void;
}

export function LayoutSelectorBar({
  selectedLayout,
  onLayoutChange,
  editMode = false,
  onEditModeToggle,
  onAddLayout,
  onSettingsClick,
}: LayoutSelectorBarProps) {
  const renderLayoutIcon = (layoutId: number) => {
    const iconClass = "w-6 h-6";

    switch (layoutId) {
      case 1: // Solo - Single person fills screen
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="20" height="20" rx="2" />
          </svg>
        );
      case 2: // Grid 2x2
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="9" height="9" rx="1" />
            <rect x="13" y="2" width="9" height="9" rx="1" />
            <rect x="2" y="13" width="9" height="9" rx="1" />
            <rect x="13" y="13" width="9" height="9" rx="1" />
          </svg>
        );
      case 3: // Grid 3x3
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="6" height="6" rx="1" />
            <rect x="9" y="2" width="6" height="6" rx="1" />
            <rect x="16" y="2" width="6" height="6" rx="1" />
            <rect x="2" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
            <rect x="16" y="9" width="6" height="6" rx="1" />
            <rect x="2" y="16" width="6" height="6" rx="1" />
            <rect x="9" y="16" width="6" height="6" rx="1" />
            <rect x="16" y="16" width="6" height="6" rx="1" />
          </svg>
        );
      case 4: // Grid 4x4
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
            {[0, 1, 2, 3].map(row =>
              [0, 1, 2, 3].map(col => (
                <rect key={`${row}-${col}`} x={2 + col * 5.5} y={2 + row * 5.5} width="4.5" height="4.5" rx="0.5" />
              ))
            )}
          </svg>
        );
      case 5: // Side by Side
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="9" height="20" rx="1" />
            <rect x="13" y="2" width="9" height="20" rx="1" />
          </svg>
        );
      case 6: // Spotlight Left - Large left, small right
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="14" height="20" rx="1" />
            <rect x="18" y="2" width="4" height="6" rx="0.5" />
            <rect x="18" y="9" width="4" height="6" rx="0.5" />
            <rect x="18" y="16" width="4" height="6" rx="0.5" />
          </svg>
        );
      case 7: // Spotlight Right - Small left, large right
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="4" height="6" rx="0.5" />
            <rect x="2" y="9" width="4" height="6" rx="0.5" />
            <rect x="2" y="16" width="4" height="6" rx="0.5" />
            <rect x="8" y="2" width="14" height="20" rx="1" />
          </svg>
        );
      case 8: // Picture-in-Picture
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="20" height="20" rx="1" />
            <rect x="13" y="13" width="8" height="8" rx="1" fill="white" />
          </svg>
        );
      case 9: // News Panel - Main with strip at top
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="5" height="4" rx="0.5" />
            <rect x="8" y="2" width="5" height="4" rx="0.5" />
            <rect x="14" y="2" width="5" height="4" rx="0.5" />
            <rect x="20" y="2" width="2" height="4" rx="0.5" />
            <rect x="2" y="8" width="20" height="14" rx="1" />
          </svg>
        );
      case 10: // Screen Share - Full screen with small participant strip
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
            <rect x="2" y="2" width="20" height="16" rx="1" />
            <rect x="2" y="20" width="4" height="2" rx="0.5" />
            <rect x="8" y="20" width="4" height="2" rx="0.5" />
            <rect x="14" y="20" width="4" height="2" rx="0.5" />
            <rect x="20" y="20" width="2" height="2" rx="0.5" />
          </svg>
        );
      default:
        return <span className="text-xs">{layoutId}</span>;
    }
  };

  return (
    <div className="flex items-center justify-center gap-1 px-4 py-2 bg-dark-800/90 backdrop-blur rounded-xl shadow-lg border border-dark-700">
      {/* 10 Layout Buttons */}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((layoutId) => (
        <button
          key={layoutId}
          onClick={() => onLayoutChange(layoutId)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
            selectedLayout === layoutId
              ? 'bg-brand-600 text-white'
              : 'text-dark-400 hover:bg-dark-700 hover:text-white'
          }`}
          title={`${LAYOUT_NAMES[layoutId as keyof typeof LAYOUT_NAMES]} (${layoutId})`}
        >
          {renderLayoutIcon(layoutId)}
        </button>
      ))}

      {/* Divider */}
      <div className="h-8 w-px bg-dark-600 mx-2" />

      {/* Edit Mode Button */}
      {onEditModeToggle && (
        <button
          onClick={onEditModeToggle}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
            editMode
              ? 'bg-purple-600 text-white'
              : 'text-dark-400 hover:bg-dark-700 hover:text-white'
          }`}
          title="Edit Layout"
        >
          <Edit2 className="w-5 h-5" />
        </button>
      )}

      {/* Add Layout Button */}
      {onAddLayout && (
        <button
          onClick={onAddLayout}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-dark-400 hover:bg-dark-700 hover:text-white transition-all"
          title="Add Custom Layout"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}

      {/* Settings Button */}
      {onSettingsClick && (
        <button
          onClick={onSettingsClick}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-dark-400 hover:bg-dark-700 hover:text-white transition-all"
          title="Layout Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

export { LAYOUT_NAMES };
