interface LayoutSelectorProps {
  selectedLayout: number;
  onLayoutChange: (layoutId: number) => void;
}

export function LayoutSelector({ selectedLayout, onLayoutChange }: LayoutSelectorProps) {
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
    </div>
  );
}
