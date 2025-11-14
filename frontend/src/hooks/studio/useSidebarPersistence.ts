import { useState, useEffect, useRef } from 'react';

type RightTabType = 'comments' | 'banners' | 'media' | 'style' | 'notes' | 'people' | 'chat' | 'recording' | null;

export function useSidebarPersistence() {
  // State initialization from localStorage
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(
    () => localStorage.getItem('scenesPanelOpen') === 'true'
  );
  const [rightSidebarOpen, setRightSidebarOpen] = useState(
    () => localStorage.getItem('tabbedPanelsOpen') === 'true'
  );
  const [activeRightTab, setActiveRightTab] = useState<RightTabType>(() => {
    const saved = localStorage.getItem('activeRightTab');
    return saved as RightTabType;
  });

  // Refs for click outside detection
  const leftSidebarRef = useRef<HTMLElement>(null);
  const rightSidebarRef = useRef<HTMLElement>(null);

  // Save left sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('scenesPanelOpen', leftSidebarOpen.toString());
  }, [leftSidebarOpen]);

  // Save right sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('tabbedPanelsOpen', rightSidebarOpen.toString());
  }, [rightSidebarOpen]);

  // Save active right tab to localStorage
  useEffect(() => {
    if (activeRightTab) {
      localStorage.setItem('activeRightTab', activeRightTab);
    } else {
      localStorage.removeItem('activeRightTab');
    }
  }, [activeRightTab]);

  // Click outside to close sidebars
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if clicking outside left sidebar
      if (leftSidebarOpen && leftSidebarRef.current && !leftSidebarRef.current.contains(target)) {
        const toggleButton = document.querySelector('[aria-label="Open Scenes Panel"]');
        if (!toggleButton || !toggleButton.contains(target)) {
          setLeftSidebarOpen(false);
        }
      }

      // Check if clicking outside right sidebar (but not on the button bar)
      if (rightSidebarOpen && rightSidebarRef.current && !rightSidebarRef.current.contains(target)) {
        // Don't close if clicking on a right sidebar button (they have their own toggle logic)
        const clickedButton = (target as HTMLElement).closest('button[aria-label$="Panel"]');
        if (!clickedButton) {
          setRightSidebarOpen(false);
          setActiveRightTab(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [leftSidebarOpen, rightSidebarOpen]);

  // Mutual exclusivity: only one sidebar can be open at a time
  const handleLeftSidebarToggle = () => {
    if (!leftSidebarOpen && rightSidebarOpen) {
      setRightSidebarOpen(false);
      setActiveRightTab(null);
    }
    setLeftSidebarOpen(!leftSidebarOpen);
  };

  const handleRightSidebarToggle = (
    tab: 'comments' | 'banners' | 'media' | 'style' | 'notes' | 'people' | 'chat' | 'recording'
  ) => {
    if (leftSidebarOpen) {
      setLeftSidebarOpen(false);
    }

    // If clicking the same tab, close the sidebar
    if (activeRightTab === tab && rightSidebarOpen) {
      setRightSidebarOpen(false);
      setActiveRightTab(null);
    } else {
      // Otherwise, open sidebar and switch to the clicked tab
      setRightSidebarOpen(true);
      setActiveRightTab(tab);
    }
  };

  return {
    leftSidebarOpen,
    rightSidebarOpen,
    activeRightTab,
    leftSidebarRef,
    rightSidebarRef,
    handleLeftSidebarToggle,
    handleRightSidebarToggle,
    setLeftSidebarOpen,
    setRightSidebarOpen,
    setActiveRightTab,
  };
}
