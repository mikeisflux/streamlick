import { useState, useEffect } from 'react';

export function useAnalyticsDashboard() {
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false);
  const [analyticsDashboardPosition, setAnalyticsDashboardPosition] = useState({ x: 100, y: 50 });
  const [analyticsDashboardSize, setAnalyticsDashboardSize] = useState({ width: 800, height: 600 });
  const [isDraggingAnalytics, setIsDraggingAnalytics] = useState(false);
  const [isResizingAnalytics, setIsResizingAnalytics] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });

  const handleAnalyticsDashboardDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingAnalytics(true);
    setDragStartPos({
      x: e.clientX - analyticsDashboardPosition.x,
      y: e.clientY - analyticsDashboardPosition.y,
    });
  };

  const handleAnalyticsDashboardResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingAnalytics(true);
    setDragStartPos({
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Mouse move handler for analytics dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingAnalytics) {
        setAnalyticsDashboardPosition({
          x: e.clientX - dragStartPos.x,
          y: e.clientY - dragStartPos.y,
        });
      } else if (isResizingAnalytics) {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = e.clientY - dragStartPos.y;
        setAnalyticsDashboardSize((prev) => ({
          width: Math.max(400, prev.width + deltaX),
          height: Math.max(300, prev.height + deltaY),
        }));
        setDragStartPos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingAnalytics(false);
      setIsResizingAnalytics(false);
    };

    if (isDraggingAnalytics || isResizingAnalytics) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingAnalytics, isResizingAnalytics, dragStartPos]);

  return {
    showAnalyticsDashboard,
    setShowAnalyticsDashboard,
    analyticsDashboardPosition,
    analyticsDashboardSize,
    handleAnalyticsDashboardDragStart,
    handleAnalyticsDashboardResizeStart,
  };
}
