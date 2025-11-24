/**
 * CanvasStreamService - Singleton service to hold reference to StudioCanvas output stream
 * This provides the "splitter" architecture where one rendering system (StudioCanvas)
 * both displays on screen AND provides output stream for media server
 */

class CanvasStreamService {
  private outputStream: MediaStream | null = null;

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
