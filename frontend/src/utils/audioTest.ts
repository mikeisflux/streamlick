/**
 * Audio Testing Utilities
 * Provides speaker and microphone testing functionality
 */

/**
 * Play a test tone through the speakers
 * @param duration Duration in milliseconds (default 1000ms)
 * @param frequency Frequency in Hz (default 440Hz - A note)
 */
export function playTestTone(duration: number = 1000, frequency: number = 440): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create oscillator (tone generator)
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      // Connect oscillator -> gain -> speakers
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure tone
      oscillator.frequency.value = frequency; // 440 Hz = A note
      oscillator.type = 'sine'; // Smooth sine wave

      // Configure volume envelope (fade in/out to avoid clicks)
      const now = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01); // Fade in
      gainNode.gain.linearRampToValueAtTime(0.3, now + duration / 1000 - 0.01); // Hold
      gainNode.gain.linearRampToValueAtTime(0, now + duration / 1000); // Fade out

      // Start and stop
      oscillator.start(now);
      oscillator.stop(now + duration / 1000);

      // Cleanup when done
      oscillator.onended = () => {
        audioContext.close();
        resolve();
      };

    } catch (error) {
      console.error('Failed to play test tone:', error);
      reject(error);
    }
  });
}

/**
 * Play a voice test message "Testing speakers, one, two, three"
 * Uses Web Speech API if available
 */
export function playVoiceTest(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Testing speakers. One, two, three.');
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      utterance.onend = () => resolve();
      utterance.onerror = (err) => reject(err);

      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback to beep if speech synthesis not available
      playTestTone(1000).then(resolve).catch(reject);
    }
  });
}

/**
 * Get available audio output devices
 */
export async function getAudioOutputDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audiooutput');
  } catch (error) {
    console.error('Failed to get audio output devices:', error);
    return [];
  }
}
