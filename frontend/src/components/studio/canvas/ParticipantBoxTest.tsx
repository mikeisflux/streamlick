/**
 * ParticipantBoxTest - Isolated test component for debugging video display
 *
 * This component is completely standalone - no dependencies on existing services.
 * It directly accesses the webcam and displays video to verify the pipeline works.
 */
import { useRef, useEffect, useState } from 'react';

export function ParticipantBoxTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const [videoState, setVideoState] = useState({
    hasStream: false,
    readyState: 0,
    videoWidth: 0,
    videoHeight: 0,
    trackEnabled: false,
    trackMuted: false,
    trackReadyState: '',
  });

  // Force re-request camera
  const forceNewCamera = async () => {
    // Stop existing stream
    if (stream) {
      stream.getTracks().forEach(t => {
        console.log('[ParticipantBoxTest] Stopping track:', t.kind, t.label);
        t.stop();
      });
      setStream(null);
    }
    setRequestCount(c => c + 1);
  };

  // Get webcam directly - fresh request each time
  useEffect(() => {
    let mounted = true;
    let localStream: MediaStream | null = null;

    async function getWebcam() {
      try {
        console.log('[ParticipantBoxTest] Requesting FRESH webcam (request #' + requestCount + ')...');

        // Enumerate devices first to see what's available
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        console.log('[ParticipantBoxTest] Available video devices:', videoDevices.map(d => ({ id: d.deviceId, label: d.label })));

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!mounted) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        localStream = mediaStream;
        const track = mediaStream.getVideoTracks()[0];

        console.log('[ParticipantBoxTest] Got webcam stream:', {
          id: mediaStream.id,
          videoTracks: mediaStream.getVideoTracks().length,
          trackEnabled: track?.enabled,
          trackMuted: track?.muted,
          trackReadyState: track?.readyState,
          trackLabel: track?.label,
          trackSettings: track?.getSettings(),
          trackConstraints: track?.getConstraints(),
        });

        // Force enable the track
        if (track && !track.enabled) {
          console.log('[ParticipantBoxTest] Track was disabled, enabling it...');
          track.enabled = true;
        }

        setStream(mediaStream);
        setError(null);
      } catch (err: any) {
        console.error('[ParticipantBoxTest] Webcam error:', err);
        setError(err.message || 'Failed to access webcam');
      }
    }

    getWebcam();

    return () => {
      mounted = false;
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [requestCount]);

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    console.log('[ParticipantBoxTest] Attaching stream to video element...');
    video.srcObject = stream;

    const handleLoadedMetadata = () => {
      const track = stream.getVideoTracks()[0];
      console.log('[ParticipantBoxTest] Video loadedmetadata:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        trackEnabled: track?.enabled,
        trackMuted: track?.muted,
        trackReadyState: track?.readyState,
        trackSettings: track?.getSettings(),
      });
      setVideoState({
        hasStream: true,
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        trackEnabled: track?.enabled || false,
        trackMuted: track?.muted || false,
        trackReadyState: track?.readyState || '',
      });
    };

    const handleCanPlay = () => {
      console.log('[ParticipantBoxTest] Video canplay - ready to display');
      setVideoState(prev => ({ ...prev, readyState: video.readyState }));
    };

    const handlePlaying = () => {
      console.log('[ParticipantBoxTest] Video playing!');
    };

    const handleError = (e: Event) => {
      console.error('[ParticipantBoxTest] Video error:', e);
      setError('Video element error');
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);

    video.play().catch(err => {
      console.error('[ParticipantBoxTest] Play failed:', err);
    });

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
    };
  }, [stream]);

  // Draw video to canvas
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 640;
    canvas.height = 360;

    let animationId: number;
    let frameCount = 0;

    const render = () => {
      frameCount++;

      // Clear canvas with alternating color to prove rendering works
      const pulse = Math.sin(frameCount * 0.05) * 0.1 + 0.15;
      ctx.fillStyle = `rgb(${Math.floor(26 + pulse * 50)}, ${Math.floor(26 + pulse * 20)}, ${Math.floor(26 + pulse * 20)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw test pattern in corner to prove canvas works
      ctx.fillStyle = `hsl(${frameCount % 360}, 100%, 50%)`;
      ctx.fillRect(canvas.width - 60, 10, 50, 50);
      ctx.fillStyle = 'white';
      ctx.font = '10px monospace';
      ctx.fillText('TEST', canvas.width - 55, 40);

      // Draw video if ready
      if (video.readyState >= 2 && video.videoWidth > 0) {
        // Try to grab a frame and check if it's black
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Sample some pixels to check if video is actually rendering or just black
        const imageData = ctx.getImageData(canvas.width / 2, canvas.height / 2, 10, 10);
        const pixels = imageData.data;
        let totalBrightness = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          totalBrightness += pixels[i] + pixels[i + 1] + pixels[i + 2];
        }
        const avgBrightness = totalBrightness / (pixels.length / 4) / 3;

        // Draw border - green if video has content, red if black
        ctx.strokeStyle = avgBrightness > 5 ? '#00ff00' : '#ff0000';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

        // Show brightness
        ctx.fillStyle = avgBrightness > 5 ? '#00ff00' : '#ff0000';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`Brightness: ${avgBrightness.toFixed(1)} ${avgBrightness > 5 ? '✓' : '(BLACK!)'}`, 10, canvas.height - 10);
      } else {
        // Show waiting message
        ctx.fillStyle = '#666';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for video...', canvas.width / 2, canvas.height / 2);
        ctx.font = '14px sans-serif';
        ctx.fillText(`readyState: ${video.readyState}`, canvas.width / 2, canvas.height / 2 + 30);
        ctx.textAlign = 'left';
      }

      // Draw debug info
      ctx.fillStyle = 'white';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Stream: ${stream ? 'YES' : 'NO'}`, 10, 20);
      ctx.fillText(`ReadyState: ${video.readyState}`, 10, 36);
      ctx.fillText(`Size: ${video.videoWidth}x${video.videoHeight}`, 10, 52);
      ctx.fillText(`Frame: ${frameCount}`, 10, 68);

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [stream]);

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-white text-lg font-bold">ParticipantBoxTest (Isolated)</h3>
        <button
          onClick={forceNewCamera}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
        >
          🔄 Refresh Camera
        </button>
      </div>

      {error && (
        <div className="bg-red-500 text-white p-2 rounded mb-2">
          Error: {error}
        </div>
      )}

      <div className="mb-2 text-sm text-gray-400 space-y-1">
        <div>Stream: {stream ? '✅ Active' : '❌ None'}</div>
        <div>Video Ready: {videoState.readyState >= 2 ? '✅' : '⏳'} (state: {videoState.readyState})</div>
        <div>Dimensions: {videoState.videoWidth}x{videoState.videoHeight}</div>
        <div className={videoState.trackEnabled ? '' : 'text-red-400 font-bold'}>
          Track Enabled: {videoState.trackEnabled ? '✅ Yes' : '❌ NO - DISABLED!'}
        </div>
        <div className={videoState.trackMuted ? 'text-yellow-400' : ''}>
          Track Muted: {videoState.trackMuted ? '⚠️ MUTED' : '✅ Not muted'}
        </div>
        <div>Track State: {videoState.trackReadyState || 'unknown'}</div>
      </div>

      {/* Hidden video element - source for canvas */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: 'none' }}
      />

      {/* Canvas output - what you see */}
      <canvas
        ref={canvasRef}
        className="border border-gray-700 rounded"
        style={{ width: '100%', maxWidth: '640px' }}
      />

      {/* Also show raw video for comparison */}
      <div className="mt-2">
        <div className="text-xs text-gray-500 mb-1">Raw video element (for comparison):</div>
        <video
          autoPlay
          playsInline
          muted
          ref={(el) => {
            if (el && stream && el.srcObject !== stream) {
              el.srcObject = stream;
              el.play().catch(() => {});
            }
          }}
          className="border border-gray-700 rounded"
          style={{ width: '100%', maxWidth: '320px' }}
        />
      </div>
    </div>
  );
}
