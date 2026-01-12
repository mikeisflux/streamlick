/**
 * WebRTC Configuration
 *
 * Centralized ICE server configuration for all WebRTC connections.
 * Supports STUN (public) and TURN (configured via environment variables).
 */

// Build ICE servers configuration
function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    // Public Google STUN servers (free, but only work for simple NAT traversal)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  // Add TURN server if configured (required for symmetric NAT traversal)
  const turnUrl = import.meta.env.VITE_TURN_SERVER_URL;
  const turnUsername = import.meta.env.VITE_TURN_SERVER_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_SERVER_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
    console.log('[WebRTC] TURN server configured:', turnUrl);
  } else if (turnUrl) {
    // TURN URL without credentials (some services don't need them)
    servers.push({ urls: turnUrl });
    console.log('[WebRTC] TURN server configured (no credentials):', turnUrl);
  } else {
    console.warn(
      '[WebRTC] No TURN server configured. Guests behind symmetric NATs may not be able to connect. ' +
        'Set VITE_TURN_SERVER_URL, VITE_TURN_SERVER_USERNAME, and VITE_TURN_SERVER_CREDENTIAL in .env'
    );
  }

  return servers;
}

// Export the ICE servers configuration
export const ICE_SERVERS: RTCIceServer[] = getIceServers();

// Export RTCConfiguration for convenience
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
};
