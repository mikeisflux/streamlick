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
  // Load initial state from localStorage
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('teleprompter_notes');
    return saved || '';
  });
  const [teleprompterMode, setTeleprompterMode] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('teleprompter_fontSize');
    return saved ? parseInt(saved) : 24;
  });
  const [scrollSpeed, setScrollSpeed] = useState(() => {
    const saved = localStorage.getItem('teleprompter_scrollSpeed');
    return saved ? parseInt(saved) : 2;
  });
  const [isScrolling, setIsScrolling] = useState(false);
  const [showOnCanvas, setShowOnCanvas] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Persist notes to localStorage
  useEffect(() => {
    localStorage.setItem('teleprompter_notes', notes);
  }, [notes]);

  // Persist fontSize to localStorage
  useEffect(() => {
    localStorage.setItem('teleprompter_fontSize', fontSize.toString());
  }, [fontSize]);

  // Persist scrollSpeed to localStorage
  useEffect(() => {
    localStorage.setItem('teleprompter_scrollSpeed', scrollSpeed.toString());
  }, [scrollSpeed]);

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
