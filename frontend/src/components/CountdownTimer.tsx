import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  initialSeconds: number;
  onComplete: () => void;
  onCancel?: () => void;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  initialSeconds,
  onComplete,
  onCancel,
}) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isActive) return;

    if (seconds <= 0) {
      onComplete();
      return;
    }

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          setIsActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [seconds, isActive, onComplete]);

  const handleCancel = () => {
    setIsActive(false);
    onCancel?.();
  };

  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const progress = ((initialSeconds - seconds) / initialSeconds) * circumference;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="text-center">
        {/* Animated Circle */}
        <div className="relative inline-block mb-8">
          <svg width="300" height="300" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="150"
              cy="150"
              r={radius}
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="8"
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx="150"
              cy="150"
              r={radius}
              stroke="url(#gradient)"
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-linear"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>

          {/* Number in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div
                className={`text-8xl font-bold text-white transition-all duration-300 ${
                  seconds <= 3 ? 'scale-125 text-red-500' : ''
                }`}
              >
                {seconds}
              </div>
              <div className="text-xl text-gray-300 mt-2">
                {seconds === 1 ? 'second' : 'seconds'}
              </div>
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-white">Going Live...</h2>
          <p className="text-xl text-gray-300">
            Preparing your broadcast destinations
          </p>

          {/* Progress indicator */}
          <div className="flex items-center justify-center space-x-2 mt-6">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '75ms' }}></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
          </div>

          {/* Cancel button */}
          {onCancel && (
            <button
              onClick={handleCancel}
              className="mt-8 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Cancel Broadcast
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CountdownTimer;
