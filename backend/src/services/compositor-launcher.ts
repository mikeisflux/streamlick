/**
 * Compositor Launcher Service
 *
 * Launches a headless Chrome instance on the AMS server to run the
 * streamlick_composite.html page for a given broadcast.
 *
 * The compositor:
 * 1. Connects to the backend socket as a "compositor" identity
 * 2. Subscribes to all on-stage participant streams from AMS via WebRTC
 * 3. Renders them to a hidden canvas with audio mixing
 * 4. Publishes the composite stream back to AMS as "composite_{broadcastId}"
 * 5. Emits "composite-ready" to notify the backend of the output stream ID
 *
 * The stream lives entirely on the AMS server, independent of any host
 * browser connection. The host can disconnect and reconnect freely.
 */

import { spawn, ChildProcess } from 'child_process';

const ANTMEDIA_URL = process.env.ANTMEDIA_URL || 'https://media.streamlick.com:5443';
const ANTMEDIA_APP = process.env.ANTMEDIA_APP || 'LiveApp';
const ANTMEDIA_WS_URL = process.env.ANTMEDIA_WS_URL ||
  `${ANTMEDIA_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/${ANTMEDIA_APP}/websocket`;

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const COMPOSITOR_SECRET = process.env.COMPOSITOR_SECRET || 'hHr20r6DjMVVen5RJfmOzzorFOyitmiK';

// AMS serves the compositor HTML from its webapps directory
const COMPOSITOR_HTML_URL = process.env.COMPOSITOR_HTML_URL ||
  `${ANTMEDIA_URL}/${ANTMEDIA_APP}/streamlick_composite.html`;

// Track running compositor processes per broadcast
const compositorProcesses = new Map<string, ChildProcess>();

function getChromePath(): string {
  // Try common headless Chrome/Chromium paths
  const paths = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/local/bin/chromium',
    '/snap/bin/chromium',
  ].filter(Boolean) as string[];

  return paths[0] || 'google-chrome';
}

export async function launchCompositor(broadcastId: string): Promise<boolean> {
  if (compositorProcesses.has(broadcastId)) {
    console.log(`[Compositor] Already running for broadcast ${broadcastId}`);
    return true;
  }

  const backendWs = BACKEND_URL.replace('http://', 'ws://').replace('https://', 'wss://');

  const compositorUrl = [
    COMPOSITOR_HTML_URL,
    `?broadcastId=${encodeURIComponent(broadcastId)}`,
    `&backendWs=${encodeURIComponent(backendWs)}`,
    `&antmediaWs=${encodeURIComponent(ANTMEDIA_WS_URL)}`,
    `&compositorSecret=${encodeURIComponent(COMPOSITOR_SECRET)}`,
  ].join('');

  const chromeArgs = [
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--use-fake-ui-for-media-stream',  // Auto-grant camera/mic permissions
    '--use-fake-device-for-media-stream',  // Allow getUserMedia in headless mode
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1920,1080',
    '--disable-web-security',           // Allow WebSocket connections to AMS
    `--app=${compositorUrl}`,
  ];

  console.log(`[Compositor] Launching headless Chrome for broadcast ${broadcastId}`);
  console.log(`[Compositor] URL: ${compositorUrl}`);

  try {
    const chromePath = getChromePath();
    const process = spawn(chromePath, chromeArgs, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    process.stdout?.on('data', (data) => {
      console.log(`[Compositor:${broadcastId}] ${data.toString().trim()}`);
    });

    process.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      // Only log non-trivial Chrome messages
      if (!msg.includes('DevTools') && !msg.includes('Created new window')) {
        console.log(`[Compositor:${broadcastId}] stderr: ${msg}`);
      }
    });

    let cleanedUp = false;
    const cleanup = (label: string, code?: number | null) => {
      if (cleanedUp) return;
      cleanedUp = true;
      console.log(`[Compositor:${broadcastId}] Chrome ${label}${code != null ? ` with code ${code}` : ''}`);
      compositorProcesses.delete(broadcastId);
    };

    process.on('exit', (code) => cleanup('exited', code));
    process.on('error', (err) => {
      console.error(`[Compositor:${broadcastId}] Chrome error:`, err.message);
      cleanup('errored');
    });

    compositorProcesses.set(broadcastId, process);
    return true;
  } catch (error) {
    console.error(`[Compositor] Failed to launch Chrome for ${broadcastId}:`, error);
    return false;
  }
}

export function stopCompositor(broadcastId: string): void {
  const proc = compositorProcesses.get(broadcastId);
  if (proc) {
    console.log(`[Compositor] Stopping Chrome for broadcast ${broadcastId}`);
    proc.kill('SIGTERM');
    compositorProcesses.delete(broadcastId);

    // SIGKILL fallback: if the process hasn't exited within 5 seconds, force kill it
    const killTimer = setTimeout(() => {
      if (!proc.killed && proc.exitCode === null) {
        console.warn(`[Compositor:${broadcastId}] Process did not exit after SIGTERM, sending SIGKILL`);
        try { proc.kill('SIGKILL'); } catch (e) { /* already dead */ }
      }
    }, 5000);
    // Don't block the event loop
    if (killTimer.unref) killTimer.unref();
  }
}

export function isCompositorRunning(broadcastId: string): boolean {
  return compositorProcesses.has(broadcastId);
}

export function getCompositorUrl(broadcastId: string): string {
  const backendWs = BACKEND_URL.replace('http://', 'ws://').replace('https://', 'wss://');
  return [
    COMPOSITOR_HTML_URL,
    `?broadcastId=${encodeURIComponent(broadcastId)}`,
    `&backendWs=${encodeURIComponent(backendWs)}`,
    `&antmediaWs=${encodeURIComponent(ANTMEDIA_WS_URL)}`,
    `&compositorSecret=${encodeURIComponent(COMPOSITOR_SECRET)}`,
  ].join('');
}
