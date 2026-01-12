/**
 * Socket Handlers Index
 *
 * Central export point for all socket handler modules.
 * These handlers are designed to be registered with a Socket.IO socket instance.
 *
 * Usage in main socket/index.ts:
 *
 * ```typescript
 * import { registerParticipantHandlers, registerWebRTCSignalingHandlers } from './handlers';
 *
 * io.on('connection', (socket) => {
 *   registerParticipantHandlers(socket, io);
 *   registerWebRTCSignalingHandlers(socket, io);
 *   // ... other handlers
 * });
 * ```
 */

export { registerParticipantHandlers } from './participant.handlers';
export { registerWebRTCSignalingHandlers } from './webrtc-signaling.handlers';

// TODO: Create and export these handlers:
// export { registerStudioHandlers } from './studio.handlers';
// export { registerGreenroomHandlers } from './greenroom.handlers';
// export { registerChatHandlers } from './chat.handlers';
// export { registerScreenShareHandlers } from './screen-share.handlers';
// export { registerHealthMonitoringHandlers } from './health-monitoring.handlers';
// export { registerRtmpHandlers } from './rtmp.handlers';
// export { registerDisconnectHandler } from './disconnect.handler';
