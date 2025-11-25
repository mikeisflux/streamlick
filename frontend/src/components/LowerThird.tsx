/**
 * ⚠️ CRITICAL WARNING ⚠️
 * THIS COMPONENT DISPLAYS LOWER THIRD GRAPHICS ON THE STUDIOCANVAS.
 * ANY CHANGE TO STYLING, POSITIONING, ANIMATIONS, OR APPEARANCE MUST ALSO BE
 * INTEGRATED INTO THE HIDDEN CANVAS IN StudioCanvas.tsx (drawToCanvas function)
 * OR YOU WILL CREATE A BREAK IN THE CODE.
 *
 * The hidden canvas captures the broadcast output and must be a CARBON COPY of what
 * is displayed in the React preview.
 */

import { useState, useEffect } from 'react';

export interface LowerThirdData {
  id: string;
  name: string;
  title?: string;
  subtitle?: string;
  duration?: number; // in milliseconds, 0 = infinite
  style?: 'modern' | 'classic' | 'minimal' | 'bold';
  position?: 'left' | 'center' | 'right';
}

interface LowerThirdProps {
  data: LowerThirdData | null;
  onComplete?: () => void;
}

export function LowerThird({ data, onComplete }: LowerThirdProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!data) {
      // Fade out
      setIsAnimating(false);
      setTimeout(() => setIsVisible(false), 500);
      return;
    }

    // Fade in
    setIsVisible(true);
    setTimeout(() => setIsAnimating(true), 50);

    // Auto-hide after duration
    if (data.duration && data.duration > 0) {
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setTimeout(() => {
          setIsVisible(false);
          onComplete?.();
        }, 500);
      }, data.duration);

      return () => clearTimeout(timer);
    }
  }, [data, onComplete]);

  if (!isVisible || !data) {
    return null;
  }

  const getStyleClasses = () => {
    const baseClasses = 'transition-all duration-500 ease-out';
    const style = data.style || 'modern';

    const styles = {
      modern: 'bg-gradient-to-r from-primary-600 to-primary-500',
      classic: 'bg-gradient-to-r from-gray-900 to-gray-800',
      minimal: 'bg-white/10 backdrop-blur-md',
      bold: 'bg-gradient-to-r from-red-600 to-orange-500',
    };

    return `${baseClasses} ${styles[style]}`;
  };

  const getPositionClasses = () => {
    const position = data.position || 'left';

    const positions = {
      left: 'left-8',
      center: 'left-1/2 -translate-x-1/2',
      right: 'right-8',
    };

    return positions[position];
  };

  return (
    <div
      className={`fixed bottom-20 ${getPositionClasses()} z-50 ${
        isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } transition-all duration-500`}
    >
      <div className={`${getStyleClasses()} rounded-lg shadow-2xl overflow-hidden max-w-md`}>
        <div className="px-6 py-4">
          <h3 className="text-xl font-bold text-white">{data.name}</h3>
          {data.title && (
            <p className="text-sm font-medium text-white/90 mt-1">{data.title}</p>
          )}
          {data.subtitle && (
            <p className="text-xs text-white/70 mt-1">{data.subtitle}</p>
          )}
        </div>
        {data.style !== 'minimal' && (
          <div className="h-1 bg-white/30"></div>
        )}
      </div>
    </div>
  );
}

/**
 * Lower Third Manager Component for Studio
 */
interface LowerThirdManagerProps {
  isLive: boolean;
}

export function LowerThirdManager({ isLive }: LowerThirdManagerProps) {
  const [currentLowerThird, setCurrentLowerThird] = useState<LowerThirdData | null>(null);
  const [queue, setQueue] = useState<LowerThirdData[]>([]);

  const showLowerThird = (data: LowerThirdData) => {
    setQueue((prev) => [...prev, data]);
  };

  const hideLowerThird = () => {
    setCurrentLowerThird(null);
  };

  useEffect(() => {
    // Process queue
    if (!currentLowerThird && queue.length > 0) {
      const next = queue[0];
      setCurrentLowerThird(next);
      setQueue((prev) => prev.slice(1));
    }
  }, [currentLowerThird, queue]);

  const handleComplete = () => {
    setCurrentLowerThird(null);
  };

  if (!isLive) {
    return null;
  }

  return (
    <>
      <LowerThird data={currentLowerThird} onComplete={handleComplete} />

      {/* Lower Third Controls (for testing/demo) */}
      <div className="fixed top-20 right-4 z-50 bg-gray-800 rounded-lg p-4 space-y-2">
        <h4 className="text-sm font-semibold text-gray-300">Lower Thirds</h4>
        <button
          onClick={() =>
            showLowerThird({
              id: Date.now().toString(),
              name: 'John Doe',
              title: 'Software Engineer',
              duration: 5000,
              style: 'modern',
              position: 'left',
            })
          }
          className="w-full px-3 py-1 text-xs bg-primary-600 hover:bg-primary-500 text-white rounded"
        >
          Show Sample (Modern)
        </button>
        <button
          onClick={() =>
            showLowerThird({
              id: Date.now().toString(),
              name: 'Jane Smith',
              title: 'Product Manager',
              subtitle: 'Acme Corporation',
              duration: 5000,
              style: 'classic',
              position: 'left',
            })
          }
          className="w-full px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded"
        >
          Show Sample (Classic)
        </button>
        <button
          onClick={() =>
            showLowerThird({
              id: Date.now().toString(),
              name: 'Alex Johnson',
              title: 'CEO',
              duration: 5000,
              style: 'minimal',
              position: 'center',
            })
          }
          className="w-full px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
        >
          Show Sample (Minimal)
        </button>
        <button
          onClick={() =>
            showLowerThird({
              id: Date.now().toString(),
              name: 'Breaking News',
              title: 'Important Announcement',
              duration: 7000,
              style: 'bold',
              position: 'center',
            })
          }
          className="w-full px-3 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
        >
          Show Sample (Bold)
        </button>
        <button
          onClick={hideLowerThird}
          className="w-full px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
        >
          Hide
        </button>
      </div>
    </>
  );
}
