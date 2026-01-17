/**
 * Hotkey Service
 * Manages keyboard shortcuts for studio controls
 */

export interface HotkeyAction {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  enabled?: boolean;
}

export interface HotkeyCategory {
  name: string;
  hotkeys: HotkeyAction[];
}

class HotkeyService {
  private hotkeys: Map<string, HotkeyAction> = new Map();
  private enabled: boolean = true;
  private listeners: Set<EventListener> = new Set();

  /**
   * Initialize the hotkey service
   */
  initialize(): void {
    this.cleanup();
    this.attachListener();
  }

  /**
   * Register a hotkey
   */
  register(hotkey: HotkeyAction): void {
    const key = this.getHotkeyKey(hotkey);
    this.hotkeys.set(key, hotkey);
  }

  /**
   * Unregister a hotkey
   */
  unregister(hotkey: Pick<HotkeyAction, 'key' | 'ctrl' | 'shift' | 'alt'>): void {
    const key = this.getHotkeyKey(hotkey);
    this.hotkeys.delete(key);
  }

  /**
   * Unregister all hotkeys
   */
  unregisterAll(): void {
    this.hotkeys.clear();
  }

  /**
   * Enable hotkeys
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable hotkeys
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Check if hotkeys are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get all registered hotkeys organized by category
   */
  getAllHotkeys(): HotkeyCategory[] {
    const categories: HotkeyCategory[] = [
      {
        name: 'Media Controls',
        hotkeys: [],
      },
      {
        name: 'Broadcast Controls',
        hotkeys: [],
      },
      {
        name: 'Layout & Display',
        hotkeys: [],
      },
      {
        name: 'Recording',
        hotkeys: [],
      },
      {
        name: 'General',
        hotkeys: [],
      },
    ];

    this.hotkeys.forEach((hotkey) => {
      const description = hotkey.description.toLowerCase();

      if (description.includes('mute') || description.includes('camera') || description.includes('video') || description.includes('audio')) {
        categories[0].hotkeys.push(hotkey);
      } else if (description.includes('live') || description.includes('broadcast') || description.includes('stream')) {
        categories[1].hotkeys.push(hotkey);
      } else if (description.includes('layout') || description.includes('chat')) {
        categories[2].hotkeys.push(hotkey);
      } else if (description.includes('record')) {
        categories[3].hotkeys.push(hotkey);
      } else {
        categories[4].hotkeys.push(hotkey);
      }
    });

    return categories.filter((cat) => cat.hotkeys.length > 0);
  }

  /**
   * Get hotkey display string
   */
  getHotkeyDisplay(hotkey: Pick<HotkeyAction, 'key' | 'ctrl' | 'shift' | 'alt'>): string {
    const parts: string[] = [];

    if (hotkey.ctrl) parts.push('Ctrl');
    if (hotkey.shift) parts.push('Shift');
    if (hotkey.alt) parts.push('Alt');
    parts.push(hotkey.key.toUpperCase());

    return parts.join(' + ');
  }

  /**
   * Cleanup listeners
   */
  cleanup(): void {
    this.listeners.forEach((listener) => {
      window.removeEventListener('keydown', listener as any);
    });
    this.listeners.clear();
  }

  /**
   * Get unique key for hotkey
   */
  private getHotkeyKey(hotkey: Pick<HotkeyAction, 'key' | 'ctrl' | 'shift' | 'alt'>): string {
    return `${hotkey.ctrl ? 'ctrl+' : ''}${hotkey.shift ? 'shift+' : ''}${hotkey.alt ? 'alt+' : ''}${hotkey.key.toLowerCase()}`;
  }

  /**
   * Attach keyboard event listener
   */
  private attachListener(): void {
    const listener = (event: KeyboardEvent) => {
      if (!this.enabled) return;

      // Don't trigger hotkeys when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Build hotkey key
      const hotkeyKey = this.getHotkeyKey({
        key: event.key.toLowerCase(),
        ctrl: event.ctrlKey || event.metaKey, // Support both Ctrl and Cmd
        shift: event.shiftKey,
        alt: event.altKey,
      });

      // Find and execute hotkey
      const hotkey = this.hotkeys.get(hotkeyKey);
      if (hotkey && (hotkey.enabled === undefined || hotkey.enabled)) {
        event.preventDefault();
        event.stopPropagation();
        hotkey.action();
      }
    };

    window.addEventListener('keydown', listener);
    this.listeners.add(listener as any);
  }
}

// Export singleton instance
export const hotkeyService = new HotkeyService();
