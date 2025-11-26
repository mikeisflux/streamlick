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
  const [videoState, setVideoState] = useState({
    hasStream: false,
    readyState: 0,
    videoWidth: 0,
    videoHeight: 0,
  });

  // Get webcam directly
  useEffect(() => {
    let mounted = true;

    async function getWebcam() {
      try {
        console.log('[ParticipantBoxTest] Requesting webcam...');
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: false,
        });

        if (!mounted) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        console.log('[ParticipantBoxTest] Got webcam stream:', {
          id: mediaStream.id,
          videoTracks: mediaStream.getVideoTracks().length,
          trackEnabled: mediaStream.getVideoTracks()[0]?.enabled,
          trackReadyState: mediaStream.getVideoTracks()[0]?.readyState,
        });

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
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    console.log('[ParticipantBoxTest] Attaching stream to video element...');
    video.srcObject = stream;

    const handleLoadedMetadata = () => {
      console.log('[ParticipantBoxTest] Video loadedmetadata:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
      });
      setVideoState({
        hasStream: true,
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
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

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw video if ready
      if (video.readyState >= 2 && video.videoWidth > 0) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Draw green border to show it's working
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
      } else {
        // Show waiting message
        ctx.fillStyle = '#666';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for video...', canvas.width / 2, canvas.height / 2);
        ctx.font = '14px sans-serif';
        ctx.fillText(`readyState: ${video.readyState}`, canvas.width / 2, canvas.height / 2 + 30);
      }

      // Draw debug info
      ctx.fillStyle = 'white';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Stream: ${stream ? 'YES' : 'NO'}`, 10, 20);
      ctx.fillText(`ReadyState: ${video.readyState}`, 10, 36);
      ctx.fillText(`Size: ${video.videoWidth}x${video.videoHeight}`, 10, 52);

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [stream]);

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <h3 className="text-white text-lg font-bold mb-2">ParticipantBoxTest (Isolated)</h3>

      {error && (
        <div className="bg-red-500 text-white p-2 rounded mb-2">
          Error: {error}
        </div>
      )}

      <div className="mb-2 text-sm text-gray-400">
        <div>Stream: {stream ? '✅ Active' : '❌ None'}</div>
        <div>Video Ready: {videoState.readyState >= 2 ? '✅' : '⏳'} (state: {videoState.readyState})</div>
        <div>Dimensions: {videoState.videoWidth}x{videoState.videoHeight}</div>
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
