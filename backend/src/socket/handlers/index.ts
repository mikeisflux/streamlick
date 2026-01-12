/**
 * Socket Handlers Index
 *
 * Central export point for all socket handler modules.
 * These handlers are designed to be registered with a Socket.IO socket instance.
 *
 * Usage in main socket/index.ts:
 *
 * ```typescript
 * import {
 *   registerStudioHandlers,
 *   registerParticipantHandlers,
 *   registerGreenroomHandlers,
 *   registerChatHandlers,
 *   registerScreenShareHandlers,
 *   registerWebRTCSignalingHandlers,
 *   registerHealthMonitoringHandlers,
 *   registerRtmpHandlers,
 *   registerDisconnectHandler,
 * } from './handlers';
 *
 * io.on('connection', (socket) => {
 *   registerStudioHandlers(socket, io);
 *   registerParticipantHandlers(socket, io);
 *   // ... other handlers
 *   registerDisconnectHandler(socket, io);
 * });
 * ```
 */

export { registerStudioHandlers, pendingDisconnects, DISCONNECT_GRACE_PERIOD_MS } from './studio.handlers';
export { registerParticipantHandlers } from './participant.handlers';
export { registerGreenroomHandlers } from './greenroom.handlers';
export { registerChatHandlers, activeChatManagers } from './chat.handlers';
export { registerScreenShareHandlers } from './screen-share.handlers';
export { registerWebRTCSignalingHandlers } from './webrtc-signaling.handlers';
export { registerHealthMonitoringHandlers } from './health-monitoring.handlers';
export { registerRtmpHandlers } from './rtmp.handlers';
export { registerDisconnectHandler } from './disconnect.handler';
