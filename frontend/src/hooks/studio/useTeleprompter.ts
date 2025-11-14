import { useState, useEffect, useRef } from 'react';

export interface TeleprompterSettings {
  notes: string;
  teleprompterMode: boolean;
  fontSize: number;
  scrollSpeed: number;
  isScrolling: boolean;
  showOnCanvas: boolean;
}

export function useTeleprompter() {
  const [notes, setNotes] = useState('');
  const [teleprompterMode, setTeleprompterMode] = useState(false);
  const [fontSize, setFontSize] = useState(24); // Larger default for on-screen display
  const [scrollSpeed, setScrollSpeed] = useState(2);
  const [isScrolling, setIsScrolling] = useState(false);
  const [showOnCanvas, setShowOnCanvas] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle auto-scrolling
  useEffect(() => {
    if (isScrolling && showOnCanvas) {
      scrollIntervalRef.current = setInterval(() => {
        setScrollPosition((prev) => prev + scrollSpeed * 0.5);
      }, 16); // ~60fps
    } else {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    }

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, [isScrolling, scrollSpeed, showOnCanvas]);

  const handleTeleprompterToggle = () => {
    setTeleprompterMode(!teleprompterMode);
    if (teleprompterMode) {
      setIsScrolling(false);
      setShowOnCanvas(false);
    }
  };

  const toggleShowOnCanvas = () => {
    const newValue = !showOnCanvas;
    setShowOnCanvas(newValue);
    if (!newValue) {
      setIsScrolling(false);
      setScrollPosition(0);
    }
  };

  const resetScroll = () => {
    setScrollPosition(0);
  };

  return {
    notes,
    setNotes,
    teleprompterMode,
    setTeleprompterMode,
    handleTeleprompterToggle,
    fontSize,
    setFontSize,
    scrollSpeed,
    setScrollSpeed,
    isScrolling,
    setIsScrolling,
    showOnCanvas,
    setShowOnCanvas,
    toggleShowOnCanvas,
    scrollPosition,
    resetScroll,
  };
}
