/**
 * Recording Service
 *
 * Records composite video stream to local files using MediaRecorder API
 */

interface RecordingConfig {
  mimeType?: string;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
}

class RecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;
  private isRecording = false;

  /**
   * Start recording a media stream
   */
  async startRecording(
    stream: MediaStream,
    config: RecordingConfig = {}
  ): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    // Determine best mime type
    const mimeType = this.getSupportedMimeType(config.mimeType);
    if (!mimeType) {
      throw new Error('No supported video MIME types found');
    }

    console.log('Starting recording with mime type:', mimeType);

    // Create MediaRecorder
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: config.videoBitsPerSecond || 5000000, // 5 Mbps
      audioBitsPerSecond: config.audioBitsPerSecond || 128000, // 128 kbps
    });

    // Reset state
    this.recordedChunks = [];
    this.startTime = Date.now();

    // Handle data available
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    // Handle recording stop
    this.mediaRecorder.onstop = () => {
      console.log('Recording stopped, chunks:', this.recordedChunks.length);
    };

    // Handle errors
    this.mediaRecorder.onerror = (event: Event) => {
      console.error('MediaRecorder error:', event);
    };

    // Start recording (request data every 1 second)
    this.mediaRecorder.start(1000);
    this.isRecording = true;

    console.log('Recording started');
  }

  /**
   * Stop recording and return the recorded blob
   */
  async stopRecording(): Promise<Blob> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('No recording in progress');
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not initialized'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        console.log('Recording stopped, creating blob...');

        const blob = new Blob(this.recordedChunks, {
          type: this.mediaRecorder!.mimeType,
        });

        this.isRecording = false;
        this.recordedChunks = [];

        console.log('Recording blob created:', blob.size, 'bytes');
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('No recording in progress');
    }

    if (this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      console.log('Recording paused');
    }
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('No recording in progress');
    }

    if (this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      console.log('Recording resumed');
    }
  }

  /**
   * Get recording duration in seconds
   */
  getDuration(): number {
    if (!this.isRecording) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Download the recorded blob as a file
   */
  downloadRecording(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    console.log('Recording download started:', filename);
  }

  /**
   * Upload recording to backend
   */
  async uploadRecording(
    blob: Blob,
    broadcastId: string,
    title: string
  ): Promise<void> {
    const formData = new FormData();
    formData.append('file', blob, `${broadcastId}-${Date.now()}.webm`);
    formData.append('title', title);
    formData.append('broadcastId', broadcastId);

    const response = await fetch('/api/recordings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload recording');
    }

    console.log('Recording uploaded successfully');
  }

  /**
   * Get supported MIME type for recording
   */
  private getSupportedMimeType(preferredType?: string): string | null {
    const types = [
      preferredType,
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
    ].filter(Boolean) as string[];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return null;
  }

  /**
   * Get list of supported MIME types
   */
  getSupportedMimeTypes(): string[] {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
      'video/x-matroska;codecs=avc1',
    ];

    return types.filter((type) => MediaRecorder.isTypeSupported(type));
  }
}

// Export singleton instance
export const recordingService = new RecordingService();
