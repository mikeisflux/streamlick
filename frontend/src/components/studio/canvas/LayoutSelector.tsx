interface LayoutSelectorProps {
  selectedLayout: number;
  onLayoutChange: (layoutId: number) => void;
  editMode?: boolean;
  onEditModeToggle?: () => void;
  onAddParticipant?: () => void;
  onSettingsClick?: () => void;
}

export function LayoutSelector({
  selectedLayout,
  onLayoutChange,
  editMode = false,
  onEditModeToggle,
  onAddParticipant,
  onSettingsClick
}: LayoutSelectorProps) {
  const renderLayoutIcon = (layoutId: number) => {
    const iconProps = { className: "w-8 h-8", fill: "currentColor", viewBox: "0 0 24 24" };

    switch (layoutId) {
      case 1: // Grid 2x2
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="9" height="9" rx="1" />
            <rect x="13" y="2" width="9" height="9" rx="1" />
            <rect x="2" y="13" width="9" height="9" rx="1" />
            <rect x="13" y="13" width="9" height="9" rx="1" />
          </svg>
        );
      case 2: // Spotlight (one large, thumbnails on right)
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="13" height="20" rx="1" />
            <rect x="17" y="2" width="5" height="6" rx="1" />
            <rect x="17" y="9" width="5" height="6" rx="1" />
            <rect x="17" y="16" width="5" height="6" rx="1" />
          </svg>
        );
      case 3: // Sidebar left
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="7" height="20" rx="1" />
            <rect x="11" y="2" width="11" height="20" rx="1" />
          </svg>
        );
      case 4: // Picture-in-picture
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="20" height="20" rx="1" />
            <rect x="13" y="13" width="7" height="7" rx="1" fill="white" />
          </svg>
        );
      case 5: // Vertical split
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="9" height="20" rx="1" />
            <rect x="13" y="2" width="9" height="20" rx="1" />
          </svg>
        );
      case 6: // Horizontal split
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="20" height="9" rx="1" />
            <rect x="2" y="13" width="20" height="9" rx="1" />
          </svg>
        );
      case 7: // Grid 3x3
        return (
          <svg {...iconProps}>
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
      case 8: // Corner layout (4 corners)
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="8" height="8" rx="1" />
            <rect x="14" y="2" width="8" height="8" rx="1" />
            <rect x="2" y="14" width="8" height="8" rx="1" />
            <rect x="14" y="14" width="8" height="8" rx="1" />
          </svg>
        );
      case 9: // Full screen single
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="20" height="20" rx="1" />
          </svg>
        );
      default:
        return <span className="text-white text-xs">{layoutId}</span>;
    }
  };

  return (
    <div
      className="flex items-center justify-center gap-2 border-t px-4 overflow-x-auto"
      style={{
        height: '72px',
        backgroundColor: '#2d2d2d',
        borderColor: '#404040'
      }}
    >
      {/* 9 Layout Buttons */}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((layoutId) => (
        <button
          key={layoutId}
          onClick={() => onLayoutChange(layoutId)}
          className="rounded hover:bg-gray-600 transition-all flex items-center justify-center flex-shrink-0 text-white"
          style={{
            width: '56px',
            height: '56px',
            backgroundColor: selectedLayout === layoutId ? '#0066ff' : '#3d3d3d'
          }}
          title={`Layout ${layoutId}`}
        >
          {renderLayoutIcon(layoutId)}
        </button>
      ))}

      {/* Divider */}
      <div className="h-12 w-px bg-gray-600 mx-1" />

      {/* Edit Mode Button */}
      {onEditModeToggle && (
        <button
          onClick={onEditModeToggle}
          className="rounded hover:bg-gray-600 transition-all flex items-center justify-center flex-shrink-0 text-white"
          style={{
            width: '56px',
            height: '56px',
            backgroundColor: editMode ? '#8B5CF6' : '#3d3d3d'
          }}
          title="Edit Mode"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
      )}

      {/* Add Participant Button */}
      {onAddParticipant && (
        <button
          onClick={onAddParticipant}
          className="rounded hover:bg-gray-600 transition-all flex items-center justify-center flex-shrink-0 text-white"
          style={{
            width: '56px',
            height: '56px',
            backgroundColor: '#3d3d3d'
          }}
          title="Add Participant"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      )}

      {/* Settings Button */}
      {onSettingsClick && (
        <button
          onClick={onSettingsClick}
          className="rounded hover:bg-gray-600 transition-all flex items-center justify-center flex-shrink-0 text-white"
          style={{
            width: '56px',
            height: '56px',
            backgroundColor: '#3d3d3d'
          }}
          title="Canvas Settings"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
