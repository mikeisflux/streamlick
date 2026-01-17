// Media Storage Service - Uses IndexedDB for large files, localStorage for metadata
class MediaStorageService {
  private dbName = 'StreamlickMedia';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for media files
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' });
        }
      };
    });
  }

  async saveMedia(id: string, blob: Blob, metadata: any, thumbnail?: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media'], 'readwrite');
      const store = transaction.objectStore('media');

      const mediaData = {
        id,
        blob,
        metadata,
        thumbnail, // Store thumbnail with media
        timestamp: Date.now(),
      };

      const request = store.put(mediaData);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMedia(id: string): Promise<{ blob: Blob; metadata: any; thumbnail?: string } | null> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media'], 'readonly');
      const store = transaction.objectStore('media');
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          resolve({
            blob: request.result.blob,
            metadata: request.result.metadata,
            thumbnail: request.result.thumbnail,
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async deleteMedia(id: string): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media'], 'readwrite');
      const store = transaction.objectStore('media');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllMediaIds(): Promise<string[]> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media'], 'readonly');
      const store = transaction.objectStore('media');
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { usage: 0, quota: 0 };
  }

  async clearOldMedia(daysOld: number = 30): Promise<number> {
    if (!this.db) {
      await this.initialize();
    }

    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media'], 'readwrite');
      const store = transaction.objectStore('media');
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (cursor.value.timestamp < cutoffTime) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clearAllMedia(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media'], 'readwrite');
      const store = transaction.objectStore('media');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const mediaStorageService = new MediaStorageService();
