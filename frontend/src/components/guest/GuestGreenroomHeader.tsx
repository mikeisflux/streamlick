/**
 * GuestGreenroomHeader Component
 *
 * Header bar showing broadcast title and status badge.
 */

import { GuestStatus } from './GuestStatusBanner';

interface GuestGreenroomHeaderProps {
  broadcastTitle: string;
  status: GuestStatus;
}

function getStatusBadge(status: GuestStatus) {
  switch (status) {
    case 'live':
      return {
        bg: 'bg-red-600',
        text: 'text-white',
        label: 'LIVE',
        icon: '🔴',
        dot: 'bg-red-500',
        pulse: true,
      };
    case 'backstage':
      return {
        bg: 'bg-yellow-600',
        text: 'text-white',
        label: 'Backstage',
        icon: '⏱️',
        dot: 'bg-yellow-500',
        pulse: false,
      };
    default:
      return {
        bg: 'bg-green-600',
        text: 'text-white',
        label: 'In Greenroom',
        icon: '🎭',
        dot: 'bg-green-500',
        pulse: false,
      };
  }
}

export function GuestGreenroomHeader({ broadcastTitle, status }: GuestGreenroomHeaderProps) {
  const statusBadge = getStatusBadge(status);

  return (
    <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{broadcastTitle}</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${statusBadge.dot} ${statusBadge.pulse ? 'animate-pulse' : ''}`}></div>
            <p className="text-sm text-gray-400">{statusBadge.label}</p>
          </div>
        </div>
        {/* Status badge */}
        <div className={`px-4 py-2 rounded-full ${statusBadge.bg} ${statusBadge.text} font-medium flex items-center gap-2`}>
          <span>{statusBadge.icon}</span>
          <span>{statusBadge.label}</span>
        </div>
      </div>
    </header>
  );
}
