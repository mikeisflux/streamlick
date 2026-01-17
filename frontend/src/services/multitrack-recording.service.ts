/**
 * Multi-Track Recording Service
 *
 * Records each participant's audio/video separately for post-production editing.
 * Professional podcasters and video editors need this for mixing/editing.
 */

interface ParticipantTrack {
  participantId: string;
  participantName: string;
  mediaRecorder: MediaRecorder | null;
  chunks: Blob[];
  stream: MediaStream;
  trackType: 'audio' | 'video' | 'both';
}

interface MultiTrackRecordingConfig {
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  separateAudioVideo?: boolean; // Record audio and video as separate files
}

interface RecordedTrack {
  participantId: string;
  participantName: string;
  trackType: 'audio' | 'video' | 'combined';
  blob: Blob;
  duration: number;
  size: number;
}

class MultiTrackRecordingService {
  private isRecording: boolean = false;
  private participantTracks: Map<string, ParticipantTrack[]> = new Map();
  private startTime: number = 0;
  private config: MultiTrackRecordingConfig = {
    videoBitsPerSecond: 5000000, // 5 Mbps
    audioBitsPerSecond: 192000, // 192 kbps for high-quality audio
    separateAudioVideo: true,
  };

  /**
   * Start multi-track recording for all participants
   */
  async startRecording(
    participants: Array<{
      id: string;
      name: string;
      stream: MediaStream;
    }>,
    config?: Partial<MultiTrackRecordingConfig>
  ): Promise<void> {
    if (this.isRecording) {
      throw new Error('Multi-track recording already in progress');
    }

    this.config = { ...this.config, ...config };
    this.participantTracks.clear();
    this.startTime = Date.now();

    for (const participant of participants) {
      await this.addParticipantTrack(participant.id, participant.name, participant.stream);
    }

    this.isRecording = true;
  }

  /**
   * Add a new participant to the recording session
   */
  async addParticipantTrack(
    participantId: string,
    participantName: string,
    stream: MediaStream
  ): Promise<void> {
    const tracks: ParticipantTrack[] = [];

    if (this.config.separateAudioVideo) {
      // Record audio and video separately
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();

      // Audio track
      if (audioTracks.length > 0) {
        const audioStream = new MediaStream(audioTracks);
        const audioTrack: ParticipantTrack = {
          participantId,
          participantName,
          mediaRecorder: null,
          chunks: [],
          stream: audioStream,
          trackType: 'audio',
        };
        const audioRecorder = this.createMediaRecorder(audioStream, 'audio', audioTrack);
        audioTrack.mediaRecorder = audioRecorder;
        tracks.push(audioTrack);
        audioRecorder.start(1000);
      }

      // Video track
      if (videoTracks.length > 0) {
        const videoStream = new MediaStream(videoTracks);
        const videoTrack: ParticipantTrack = {
          participantId,
          participantName,
          mediaRecorder: null,
          chunks: [],
          stream: videoStream,
          trackType: 'video',
        };
        const videoRecorder = this.createMediaRecorder(videoStream, 'video', videoTrack);
        videoTrack.mediaRecorder = videoRecorder;
        tracks.push(videoTrack);
        videoRecorder.start(1000);
      }
    } else {
      // Record combined audio/video
      const combinedTrack: ParticipantTrack = {
        participantId,
        participantName,
        mediaRecorder: null,
        chunks: [],
        stream,
        trackType: 'both',
      };
      const combinedRecorder = this.createMediaRecorder(stream, 'both', combinedTrack);
      combinedTrack.mediaRecorder = combinedRecorder;
      tracks.push(combinedTrack);
      combinedRecorder.start(1000);
    }

    this.participantTracks.set(participantId, tracks);
  }

  /**
   * Remove a participant from the recording session
   */
  removeParticipantTrack(participantId: string): void {
    const tracks = this.participantTracks.get(participantId);
    if (!tracks) return;

    tracks.forEach((track) => {
      if (track.mediaRecorder && track.mediaRecorder.state !== 'inactive') {
        track.mediaRecorder.stop();
      }
    });

    this.participantTracks.delete(participantId);
  }

  /**
   * Stop recording and return all recorded tracks
   */
  async stopRecording(): Promise<RecordedTrack[]> {
    if (!this.isRecording) {
      throw new Error('No multi-track recording in progress');
    }

    this.isRecording = false;
    const duration = (Date.now() - this.startTime) / 1000; // seconds
    const allRecordedTracks: RecordedTrack[] = [];

    // Stop all recorders and collect blobs
    const stopPromises: Promise<RecordedTrack[]>[] = [];

    this.participantTracks.forEach((tracks, participantId) => {
      const promise = Promise.all(
        tracks.map((track) =>
          this.stopTrackRecorder(track, duration)
        )
      );
      stopPromises.push(promise);
    });

    const results = await Promise.all(stopPromises);
    results.forEach((tracks) => {
      allRecordedTracks.push(...tracks);
    });

    this.participantTracks.clear();

    return allRecordedTracks;
  }

  /**
   * Stop a single track recorder and create blob
   */
  private stopTrackRecorder(
    track: ParticipantTrack,
    duration: number
  ): Promise<RecordedTrack> {
    return new Promise((resolve, reject) => {
      if (!track.mediaRecorder) {
        reject(new Error('MediaRecorder not initialized'));
        return;
      }

      track.mediaRecorder.onstop = () => {
        const mimeType = track.mediaRecorder!.mimeType;
        const blob = new Blob(track.chunks, { type: mimeType });

        resolve({
          participantId: track.participantId,
          participantName: track.participantName,
          trackType: track.trackType === 'both' ? 'combined' : track.trackType,
          blob,
          duration,
          size: blob.size,
        });
      };

      track.mediaRecorder.stop();
    });
  }

  /**
   * Create a MediaRecorder for a specific track type
   */
  private createMediaRecorder(
    stream: MediaStream,
    trackType: 'audio' | 'video' | 'both',
    track: ParticipantTrack
  ): MediaRecorder {
    let mimeType: string;
    let options: any = {};

    if (trackType === 'audio') {
      mimeType = this.getAudioMimeType();
      options.audioBitsPerSecond = this.config.audioBitsPerSecond;
    } else if (trackType === 'video') {
      mimeType = this.getVideoMimeType();
      options.videoBitsPerSecond = this.config.videoBitsPerSecond;
    } else {
      mimeType = this.getCombinedMimeType();
      options.videoBitsPerSecond = this.config.videoBitsPerSecond;
      options.audioBitsPerSecond = this.config.audioBitsPerSecond;
    }

    options.mimeType = mimeType;

    const recorder = new MediaRecorder(stream, options);

    // Push chunks directly to the track's chunks array
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        track.chunks.push(event.data);
      }
    };

    return recorder;
  }

  /**
   * Download all recorded tracks as separate files
   */
  downloadAllTracks(tracks: RecordedTrack[], sessionName?: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const baseName = sessionName || `multitrack-${timestamp}`;

    tracks.forEach((track, index) => {
      const extension = this.getFileExtension(track.trackType);
      const filename = `${baseName}_${track.participantName}_${track.trackType}${extension}`;

      const url = URL.createObjectURL(track.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    });

  }

  /**
   * Get supported audio MIME type
   */
  private getAudioMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm';
  }

  /**
   * Get supported video MIME type
   */
  private getVideoMimeType(): string {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
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
   * Get supported combined MIME type
   */
  private getCombinedMimeType(): string {
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
   * Get file extension based on track type
   */
  private getFileExtension(trackType: 'audio' | 'video' | 'combined'): string {
    if (trackType === 'audio') {
      return '.webm'; // or .opus
    } else {
      return '.webm';
    }
  }

  /**
   * Get recording status
   */
  active(): boolean {
    return this.isRecording;
  }

  /**
   * Get number of active tracks
   */
  getTrackCount(): number {
    let count = 0;
    this.participantTracks.forEach((tracks) => {
      count += tracks.length;
    });
    return count;
  }

  /**
   * Get recording duration in seconds
   */
  getDuration(): number {
    if (!this.isRecording) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

export const multiTrackRecordingService = new MultiTrackRecordingService();
export type { RecordedTrack, MultiTrackRecordingConfig };
