import { useState } from 'react';
import { hotkeyService } from '../services/hotkey.service';

export function HotkeyReference() {
  const [isOpen, setIsOpen] = useState(false);
  const categories = hotkeyService.getAllHotkeys();

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-700 hover:bg-gray-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-colors z-40"
        title="Keyboard Shortcuts (Press ? to toggle)"
      >
        <span className="text-xl font-bold">?</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Keyboard Shortcuts</h2>
            <p className="text-sm text-gray-400 mt-1">Quick controls for your broadcast</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="overflow-y-auto flex-1 p-6">
          {categories.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <p>No hotkeys are currently registered.</p>
              <p className="text-sm mt-2">Hotkeys become available when you're in a broadcast.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category.name}>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    {category.name}
                  </h3>
                  <div className="space-y-2">
                    {category.hotkeys.map((hotkey) => (
                      <div
                        key={hotkeyService.getHotkeyDisplay(hotkey)}
                        className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3"
                      >
                        <span className="text-gray-200">{hotkey.description}</span>
                        <div className="flex items-center gap-1">
                          {renderHotkeyKeys(hotkey)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-750">
          <p className="text-xs text-gray-400 text-center">
            Press <kbd className="px-2 py-1 bg-gray-600 rounded text-xs">?</kbd> anytime to toggle this reference
          </p>
        </div>
      </div>
    </div>
  );
}

function renderHotkeyKeys(hotkey: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean }) {
  const keys: string[] = [];

  if (hotkey.ctrl) keys.push('Ctrl');
  if (hotkey.shift) keys.push('Shift');
  if (hotkey.alt) keys.push('Alt');
  keys.push(hotkey.key.toUpperCase());

  return keys.map((key, index) => (
    <span key={index} className="flex items-center">
      <kbd className="px-3 py-1 bg-gray-600 text-white rounded font-mono text-sm min-w-[40px] text-center">
        {key}
      </kbd>
      {index < keys.length - 1 && (
        <span className="text-gray-400 mx-1">+</span>
      )}
    </span>
  ));
}
