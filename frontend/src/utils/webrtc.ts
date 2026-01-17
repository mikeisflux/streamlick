/**
 * WebRTC Utility Functions
 */

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function createPeerConnection(config?: RTCConfiguration): RTCPeerConnection {
  return new RTCPeerConnection(config || ICE_SERVERS);
}

export async function getLocalStream(
  video: boolean = true,
  audio: boolean = true,
  videoDeviceId?: string,
  audioDeviceId?: string
): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    video: video
      ? {
          deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        }
      : false,
    audio: audio
      ? {
          deviceId: audioDeviceId ? { exact: audioDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : false,
  };

  return navigator.mediaDevices.getUserMedia(constraints);
}

export function stopStream(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}

export function replaceTrack(
  pc: RTCPeerConnection,
  oldTrack: MediaStreamTrack,
  newTrack: MediaStreamTrack
): Promise<void> {
  const sender = pc.getSenders().find((s) => s.track?.kind === oldTrack.kind);
  if (sender) {
    return sender.replaceTrack(newTrack);
  }
  return Promise.resolve();
}
