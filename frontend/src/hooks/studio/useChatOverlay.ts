import { useState, useEffect, useRef } from 'react';

export function useChatOverlay() {
  const [showChatOnStream, setShowChatOnStream] = useState(true);
  const [chatOverlayPosition, setChatOverlayPosition] = useState({ x: 0, y: 0 });
  const [chatOverlaySize, setChatOverlaySize] = useState({ width: 320, height: 384 });
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const chatOverlayRef = useRef<HTMLDivElement>(null);
  const chatDragOffsetRef = useRef({ x: 0, y: 0 });

  const handleChatOverlayDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingChat(true);
    chatDragOffsetRef.current = {
      x: e.clientX - chatOverlayPosition.x,
      y: e.clientY - chatOverlayPosition.y,
    };
  };

  const handleChatOverlayResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingChat(true);
    setDragStartPos({
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Mouse move handler for dragging and resizing
  useEffect(() => {
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingChat) {
        // Use requestAnimationFrame and direct DOM manipulation to avoid re-renders
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        animationFrameId = requestAnimationFrame(() => {
          const newX = e.clientX - chatDragOffsetRef.current.x;
          const newY = e.clientY - chatDragOffsetRef.current.y;

          if (chatOverlayRef.current) {
            chatOverlayRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
          }
        });
      } else if (isResizingChat) {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = e.clientY - dragStartPos.y;
        setChatOverlaySize((prev) => ({
          width: Math.max(200, prev.width + deltaX),
          height: Math.max(150, prev.height + deltaY),
        }));
        setDragStartPos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      if (isDraggingChat && chatOverlayRef.current) {
        // Save the final position to state when dragging ends
        const transform = chatOverlayRef.current.style.transform;
        const match = transform.match(/translate\((-?\d+)px,\s*(-?\d+)px\)/);
        if (match) {
          setChatOverlayPosition({
            x: parseInt(match[1]),
            y: parseInt(match[2]),
          });
        }
        // Reset transform
        chatOverlayRef.current.style.transform = '';
      }

      setIsDraggingChat(false);
      setIsResizingChat(false);

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };

    if (isDraggingChat || isResizingChat) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDraggingChat, isResizingChat, dragStartPos, chatOverlayPosition]);

  return {
    showChatOnStream,
    setShowChatOnStream,
    chatOverlayPosition,
    chatOverlaySize,
    isDraggingChat,
    isResizingChat,
    chatOverlayRef,
    handleChatOverlayDragStart,
    handleChatOverlayResizeStart,
  };
}
