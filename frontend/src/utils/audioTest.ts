/**
 * Audio Test Utility
 * Provides functions to test microphone and speaker audio
 */

export async function testMicrophone(deviceId?: string): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    video: false,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}

export function getAudioLevel(stream: MediaStream): number {
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  analyser.fftSize = 256;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
  return average / 255; // Normalize to 0-1
}

export function playTestSound(deviceId?: string): Promise<void> {
  return new Promise((resolve) => {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 440; // A4 note
    gainNode.gain.value = 0.3;

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
      resolve();
    }, 500);
  });
}

// Alias for backwards compatibility
export const playTestTone = playTestSound;
