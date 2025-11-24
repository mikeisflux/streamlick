/**
 * Clip Recording Service - Rolling Buffer Implementation
 *
 * Maintains a continuous rolling buffer of the last 60 seconds of stream content.
 * When user requests a clip, extracts the last 30s or 60s and saves it.
 *
 * Similar to instant replay in game streaming software (OBS Replay Buffer, ShadowPlay)
 */

interface ClipRecordingConfig {
  bufferDuration: number; // Maximum buffer duration in seconds (default: 60)
  videoQuality: number; // Video quality 0-1 (default: 0.8)
}

interface ClipData {
  blob: Blob;
  duration: number;
  timestamp: Date;
  thumbnail?: string;
}

class ClipRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isBuffering: boolean = false;
  private stream: MediaStream | null = null;
  private config: ClipRecordingConfig = {
    bufferDuration: 60,
    videoQuality: 0.8,
  };
  private startTime: number = 0;
  private chunkTimestamps: number[] = [];

  /**
   * Start the rolling buffer recording
   */
  async startBuffer(stream: MediaStream, config?: Partial<ClipRecordingConfig>): Promise<void> {
    if (this.isBuffering) {
      console.warn('Clip buffer already running');
      return;
    }

    this.config = { ...this.config, ...config };
    this.stream = stream;
    this.recordedChunks = [];
    this.chunkTimestamps = [];

    const options = {
      mimeType: this.getSupportedMimeType(),
      videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality clips
    };

    try {
      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          const now = Date.now();
          this.recordedChunks.push(event.data);
          this.chunkTimestamps.push(now);

          // Remove chunks older than buffer duration
          this.pruneOldChunks();
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      // Request data every second for fine-grained buffer control
      this.mediaRecorder.start(1000);
      this.startTime = Date.now();
      this.isBuffering = true;

    } catch (error) {
      console.error('Failed to start clip buffer:', error);
      throw error;
    }
  }

  /**
   * Stop the rolling buffer
   */
  stopBuffer(): void {
    if (!this.isBuffering || !this.mediaRecorder) {
      return;
    }

    this.mediaRecorder.stop();

    // Remove event handlers to prevent memory leaks
    this.mediaRecorder.ondataavailable = null;
    this.mediaRecorder.onerror = null;

    this.isBuffering = false;
    this.recordedChunks = [];
    this.chunkTimestamps = [];
    this.mediaRecorder = null;

  }

  /**
   * Create a clip from the buffer (last 30s or 60s)
   */
  async createClip(duration: 30 | 60): Promise<ClipData> {
    if (!this.isBuffering || this.recordedChunks.length === 0) {
      throw new Error('Clip buffer not active or empty');
    }

    const now = Date.now();
    const cutoffTime = now - (duration * 1000);

    // Find chunks within the requested duration
    const clipChunks: Blob[] = [];
    for (let i = 0; i < this.chunkTimestamps.length; i++) {
      if (this.chunkTimestamps[i] >= cutoffTime) {
        clipChunks.push(this.recordedChunks[i]);
      }
    }

    if (clipChunks.length === 0) {
      throw new Error(`Not enough buffer data for ${duration}s clip`);
    }

    const mimeType = this.getSupportedMimeType();
    const clipBlob = new Blob(clipChunks, { type: mimeType });

    // Generate thumbnail
    const thumbnail = await this.generateThumbnail(clipBlob);

    return {
      blob: clipBlob,
      duration,
      timestamp: new Date(),
      thumbnail,
    };
  }

  /**
   * Save clip to file system (download)
   */
  saveClip(clipData: ClipData, filename?: string): void {
    const defaultFilename = filename || `clip-${clipData.duration}s-${Date.now()}.webm`;

    const url = URL.createObjectURL(clipData.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  }

  /**
   * Upload clip to backend
   */
  async uploadClip(
    clipData: ClipData,
    broadcastId: string,
    title: string
  ): Promise<{ id: string; url: string }> {
    const formData = new FormData();
    formData.append('clip', clipData.blob, `clip-${Date.now()}.webm`);
    formData.append('broadcastId', broadcastId);
    formData.append('title', title);
    formData.append('duration', clipData.duration.toString());

    const response = await fetch('/api/clips', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload clip');
    }

    const result = await response.json();

    return result;
  }

  /**
   * Check if buffer is active
   */
  isActive(): boolean {
    return this.isBuffering;
  }

  /**
   * Get current buffer duration in seconds
   */
  getBufferDuration(): number {
    if (!this.isBuffering || this.chunkTimestamps.length === 0) {
      return 0;
    }

    const now = Date.now();
    const oldestChunk = this.chunkTimestamps[0];
    return Math.floor((now - oldestChunk) / 1000);
  }

  /**
   * Private: Remove chunks older than buffer duration
   */
  private pruneOldChunks(): void {
    const now = Date.now();
    const cutoffTime = now - (this.config.bufferDuration * 1000);

    let removeCount = 0;
    for (let i = 0; i < this.chunkTimestamps.length; i++) {
      if (this.chunkTimestamps[i] < cutoffTime) {
        removeCount++;
      } else {
        break;
      }
    }

    if (removeCount > 0) {
      this.recordedChunks.splice(0, removeCount);
      this.chunkTimestamps.splice(0, removeCount);
    }
  }

  /**
   * Private: Get supported MIME type for recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm';
  }

  /**
   * Private: Generate thumbnail from video blob
   */
  private async generateThumbnail(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const objectUrl = URL.createObjectURL(blob);
      video.src = objectUrl;
      video.muted = true;

      const cleanup = () => {
        // Stop video playback
        video.pause();
        video.src = '';
        video.load();

        // Revoke object URL
        URL.revokeObjectURL(objectUrl);

        // Remove event listeners to allow GC
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
      };

      video.onloadeddata = () => {
        // Seek to 1 second into the clip
        video.currentTime = 1;
      };

      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          cleanup();
          resolve(thumbnail);
        } else {
          cleanup();
          reject(new Error('Failed to get canvas context'));
        }
      };

      video.onerror = () => {
        cleanup();
        reject(new Error('Failed to load video for thumbnail'));
      };

      video.load();
    });
  }
}

export const clipRecordingService = new ClipRecordingService();
