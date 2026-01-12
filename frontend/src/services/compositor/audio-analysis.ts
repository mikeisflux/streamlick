/**
 * Compositor Audio Analysis
 *
 * Utilities for analyzing audio levels for visual feedback (pulsating rings).
 */

/**
 * Create an audio analyser for visualizing participant audio levels
 */
export function createAudioAnalyser(
  audioStream: MediaStream
): { analyser: AnalyserNode; context: AudioContext } | null {
  try {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(audioStream);
    const analyser = audioContext.createAnalyser();

    // Configure analyser for speech detection
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    // Connect source to analyser (don't connect to destination - just analyze)
    source.connect(analyser);

    return { analyser, context: audioContext };
  } catch (error) {
    console.error('Failed to create audio analyser:', error);
    return null;
  }
}

/**
 * Get normalized audio level from an analyser (0-1 range)
 */
export function getAudioLevel(analyser: AnalyserNode): number {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  // Calculate average volume
  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    sum += dataArray[i];
  }
  const average = sum / bufferLength;

  // Normalize to 0-1 range (0-255 → 0-1)
  return average / 255;
}

/**
 * Draw pulsating audio rings around a center point
 */
export function drawAudioRings(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  baseRadius: number,
  audioLevel: number,
  ringCount = 3,
  color = 'rgba(66, 153, 225, 1)' // Default blue
): void {
  const time = Date.now() / 1000;

  for (let i = 0; i < ringCount; i++) {
    const ringDelay = i * 0.3;
    const ringPulse = Math.sin(time * 4 - ringDelay) * 0.5 + 0.5;
    const radius = baseRadius + (i * 20) + (ringPulse * audioLevel * 30);
    const alpha = (1 - i * 0.3) * audioLevel * 0.6;

    // Parse color to add alpha
    const colorMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (colorMatch) {
      ctx.strokeStyle = `rgba(${colorMatch[1]}, ${colorMatch[2]}, ${colorMatch[3]}, ${alpha})`;
    } else {
      ctx.strokeStyle = color;
    }

    ctx.lineWidth = 3 + audioLevel * 5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}
