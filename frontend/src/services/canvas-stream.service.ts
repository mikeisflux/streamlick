/**
 * CanvasStreamService - Singleton service to hold reference to StudioCanvas output stream
 * This provides the "splitter" architecture where one rendering system (StudioCanvas)
 * both displays on screen AND provides output stream for media server
 */

type StreamReadyCallback = (stream: MediaStream) => void;

class CanvasStreamService {
  private outputStream: MediaStream | null = null;
  private streamReadyCallbacks: Set<StreamReadyCallback> = new Set();

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

      // Notify all waiting callbacks that stream is ready
      this.streamReadyCallbacks.forEach(callback => {
        try {
          callback(stream);
        } catch (error) {
          console.error('[CanvasStreamService] Error in stream ready callback:', error);
        }
      });
      this.streamReadyCallbacks.clear();
    } else {
      console.log('[CanvasStreamService] Output stream cleared');
    }
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
   * Check if stream is available
   */
  isStreamReady(): boolean {
    return this.outputStream !== null;
  }

  /**
   * Subscribe to be notified when stream becomes ready
   * If stream is already ready, callback is invoked immediately
   * Returns unsubscribe function
   */
  onStreamReady(callback: StreamReadyCallback): () => void {
    // If stream is already available, call immediately
    if (this.outputStream) {
      callback(this.outputStream);
      return () => {}; // No-op unsubscribe since callback already fired
    }

    // Otherwise, queue the callback
    this.streamReadyCallbacks.add(callback);
    console.log('[CanvasStreamService] Queued stream ready callback, waiting for canvas...');

    // Return unsubscribe function
    return () => {
      this.streamReadyCallbacks.delete(callback);
    };
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
