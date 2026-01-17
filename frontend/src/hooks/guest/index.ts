/**
 * Guest Hooks Index
 *
 * Custom hooks for GuestJoin page functionality.
 * These hooks extract reusable logic from the GuestJoin component.
 */

export { useDeviceEnumeration, type DeviceEnumerationResult } from './useDeviceEnumeration';
export { useStatusListeners, type GuestStatus, type StatusListenersOptions } from './useStatusListeners';
export { usePreviewStream } from './usePreviewStream';  // Legacy P2P preview (deprecated)
export { useCompositeStream } from './useCompositeStream';  // New: Server-side composite
export { useGuestStream } from './useGuestStream';
export { useGreenroomChat, type GreenroomParticipant, type ChatMessage } from './useGreenroomChat';
