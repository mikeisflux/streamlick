import { useRef, useEffect } from 'react';

export function useSidebarVideoSync(localStream: MediaStream | null) {
  const sidebarVideoRef = useRef<HTMLVideoElement>(null);

  // Update video srcObject when localStream changes
  useEffect(() => {
    if (sidebarVideoRef.current && localStream) {
      sidebarVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return { sidebarVideoRef };
}
