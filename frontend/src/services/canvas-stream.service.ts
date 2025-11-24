/**
 * CanvasStreamService - Singleton service to hold reference to StudioCanvas output stream
 * This provides the "splitter" architecture where one rendering system (StudioCanvas)
 * both displays on screen AND provides output stream for media server
 */

class CanvasStreamService {
  private outputStream: MediaStream | null = null;
  private streamReadyResolvers: Array<(stream: MediaStream) => void> = [];

  /**
   * Set the canvas output stream
   * Called by StudioCanvas when canvas.captureStream() is ready
   */
  setOutputStream(stream: MediaStream | null): void {
    this.outputStream = stream;

    if (stream) {
      console.log('[CanvasStreamService] Output stream set:', {
        streamId: stream.id,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
      });

      // Resolve all waiting promises
      while (this.streamReadyResolvers.length > 0) {
        const resolve = this.streamReadyResolvers.shift();
        if (resolve) {
          resolve(stream);
        }
      }
    } else {
      console.log('[CanvasStreamService] Output stream cleared');
    }
  }

  /**
   * Wait for the canvas output stream to be ready
   * Returns a promise that resolves when the stream is available
   * If stream is already available, resolves immediately
   */
  async waitForStream(timeoutMs: number = 5000): Promise<MediaStream> {
    // If stream is already available, return it immediately
    if (this.outputStream) {
      console.log('[CanvasStreamService] Stream already available');
      return this.outputStream;
    }

    // Otherwise, wait for it to be set
    return new Promise<MediaStream>((resolve, reject) => {
      console.log('[CanvasStreamService] Waiting for stream to be ready...');

      // Set up timeout
      const timeout = setTimeout(() => {
        // Remove this resolver from the list
        const index = this.streamReadyResolvers.indexOf(resolve);
        if (index > -1) {
          this.streamReadyResolvers.splice(index, 1);
        }
        reject(new Error('Timeout waiting for canvas stream to be ready'));
      }, timeoutMs);

      // Create resolver that clears timeout
      const wrappedResolve = (stream: MediaStream) => {
        clearTimeout(timeout);
        resolve(stream);
      };

      // Add to resolvers list
      this.streamReadyResolvers.push(wrappedResolve);
    });
  }

  /**
   * Get the canvas output stream
   * Called by useBroadcast to send stream to media server
   */
  getOutputStream(): MediaStream | null {
    if (!this.outputStream) {
      console.warn('[CanvasStreamService] No output stream available');
      return null;
    }

    return this.outputStream;
  }

  /**
   * Combine canvas video track with audio from audio mixer
   * This creates the final composite stream with both video and audio
   */
  combineWithAudio(audioTrack: MediaStreamTrack): MediaStream | null {
    if (!this.outputStream) {
      console.error('[CanvasStreamService] Cannot combine audio - no output stream');
      return null;
    }

    const videoTrack = this.outputStream.getVideoTracks()[0];
    if (!videoTrack) {
      console.error('[CanvasStreamService] No video track in output stream');
      return null;
    }

    // Create new stream with video from canvas and audio from mixer
    const combinedStream = new MediaStream([videoTrack, audioTrack]);

    console.log('[CanvasStreamService] Combined stream created:', {
      streamId: combinedStream.id,
      videoTracks: combinedStream.getVideoTracks().length,
      audioTracks: combinedStream.getAudioTracks().length,
    });

    return combinedStream;
  }
}

// Export singleton instance
export const canvasStreamService = new CanvasStreamService();
