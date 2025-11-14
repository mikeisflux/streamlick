import { useTeleprompter } from '../hooks/studio/useTeleprompter';

interface NotesPanelProps {
  broadcastId?: string;
  teleprompterState: ReturnType<typeof useTeleprompter>;
}

export function NotesPanel({ broadcastId, teleprompterState }: NotesPanelProps) {
  const {
    notes,
    setNotes,
    teleprompterMode,
    handleTeleprompterToggle,
    fontSize,
    setFontSize,
    scrollSpeed,
    setScrollSpeed,
    isScrolling,
    setIsScrolling,
    showOnCanvas,
    toggleShowOnCanvas,
  } = teleprompterState;

  return (
    <div className="h-full flex flex-col">
      {!teleprompterMode ? (
        // Normal Notes Mode
        <div className="flex-1 flex flex-col p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
            <button
              onClick={handleTeleprompterToggle}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              📜 Teleprompter
            </button>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write your show notes, talking points, or script here..."
            className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            style={{ minHeight: '400px' }}
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors">
              💾 Save
            </button>
            <button className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors">
              📋 Templates
            </button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-900 mb-2">
              <strong>💡 Tip:</strong> Use teleprompter mode to display your notes while streaming!
            </p>
            <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
              <li>Adjust font size and scroll speed</li>
              <li>Auto-scroll or manual control</li>
              <li>Mirror mode for physical teleprompters</li>
            </ul>
          </div>
        </div>
      ) : (
        // Teleprompter Mode
        <div className="flex-1 flex flex-col bg-black">
          {/* Teleprompter Controls */}
          <div className="bg-gray-900 p-3 border-b border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTeleprompterToggle}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded transition-colors"
                >
                  ← Exit
                </button>
                <button
                  onClick={() => setIsScrolling(!isScrolling)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    isScrolling
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                  disabled={!showOnCanvas}
                >
                  {isScrolling ? '⏸ Pause' : '▶ Start'}
                </button>
              </div>
              <button
                onClick={toggleShowOnCanvas}
                className={`px-3 py-1 text-xs rounded transition-colors font-semibold ${
                  showOnCanvas
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                {showOnCanvas ? '👁 Hide on Screen' : '👁 Show on Screen'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Font:</span>
                <button
                  onClick={() => setFontSize(Math.max(12, fontSize - 2))}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                >
                  A-
                </button>
                <span className="text-xs text-white w-8 text-center">{fontSize}px</span>
                <button
                  onClick={() => setFontSize(Math.min(48, fontSize + 2))}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                >
                  A+
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Speed:</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={scrollSpeed}
                  onChange={(e) => setScrollSpeed(parseInt(e.target.value))}
                  className="w-20"
                />
                <span className="text-xs text-white w-4">{scrollSpeed}</span>
              </div>
            </div>
          </div>

          {/* Teleprompter Display */}
          <div className="flex-1 overflow-hidden relative">
            <div
              className={`p-8 text-white ${isScrolling ? 'animate-scroll' : ''}`}
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: 1.8,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                whiteSpace: 'pre-wrap',
              }}
            >
              {notes || (
                <div className="text-center text-gray-500 mt-20">
                  <p className="mb-4">No notes to display</p>
                  <p className="text-sm">Exit teleprompter mode to add your script</p>
                </div>
              )}
            </div>

            {/* Reading Guide Line */}
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{
                top: '40%',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5), transparent)',
              }}
            />
          </div>

          {/* Progress Indicator */}
          <div className="bg-gray-900 px-3 py-2 border-t border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Word count: {notes.split(/\s+/).filter(Boolean).length}</span>
              <span>Estimated time: {Math.ceil(notes.split(/\s+/).filter(Boolean).length / 150)} min</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
