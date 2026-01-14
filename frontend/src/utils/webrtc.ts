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
  // Environment variables match webrtc.service.ts
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnTlsUrl = import.meta.env.VITE_TURN_TLS_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnPassword = import.meta.env.VITE_TURN_PASSWORD;

  if (turnUrl && turnUsername && turnPassword) {
    // Build TURN URLs array - include TLS if configured
    const turnUrls = [turnUrl];
    if (turnTlsUrl) {
      turnUrls.push(turnTlsUrl);
    }

    servers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnPassword,
    });
    console.log('[WebRTC] TURN server configured:', turnUrls);
  } else if (turnUrl) {
    // TURN URL without credentials (some services don't need them)
    servers.push({ urls: turnUrl });
    console.log('[WebRTC] TURN server configured (no credentials):', turnUrl);
  } else {
    console.warn(
      '[WebRTC] No TURN server configured. Guests behind symmetric NATs may not be able to connect. ' +
        'Set VITE_TURN_URL, VITE_TURN_USERNAME, and VITE_TURN_PASSWORD in .env'
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
