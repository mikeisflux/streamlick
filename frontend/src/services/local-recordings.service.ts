/**
 * Local Recordings Service
 *
 * Manages locally saved recordings using IndexedDB for metadata
 * and local file system for video files
 */

export interface LocalRecording {
  id: string;
  title: string;
  broadcastId?: string;
  filename: string;
  size: number;
  duration: number;
  mimeType: string;
  createdAt: string;
  thumbnail?: string;
}

class LocalRecordingsService {
  private dbName = 'StreamlickRecordings';
  private storeName = 'recordings';
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: 'id',
          });

          // Create indexes
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
          objectStore.createIndex('broadcastId', 'broadcastId', {
            unique: false,
          });
        }
      };
    });
  }

  /**
   * Save recording metadata
   */
  async saveRecording(recording: LocalRecording): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(recording);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all recordings
   */
  async getAllRecordings(): Promise<LocalRecording[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by creation date, newest first
        const recordings = request.result.sort(
          (a: LocalRecording, b: LocalRecording) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        resolve(recordings);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get recording by ID
   */
  async getRecording(id: string): Promise<LocalRecording | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete recording metadata
   */
  async deleteRecording(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get total storage used (in bytes)
   */
  async getTotalSize(): Promise<number> {
    const recordings = await this.getAllRecordings();
    return recordings.reduce((total, r) => total + r.size, 0);
  }

  /**
   * Format bytes to human readable string
   */
  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Format duration from seconds to HH:MM:SS
   */
  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (h > 0) parts.push(h.toString().padStart(2, '0'));
    parts.push(m.toString().padStart(2, '0'));
    parts.push(s.toString().padStart(2, '0'));

    return parts.join(':');
  }
}

// Export singleton instance
export const localRecordingsService = new LocalRecordingsService();
