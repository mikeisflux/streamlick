import { ReactNode } from 'react';

interface VideoGridProps {
  children: ReactNode;
  participantCount: number;
}

export function VideoGrid({ children, participantCount }: VideoGridProps) {
  const getGridClass = () => {
    if (participantCount === 1) return 'grid-cols-1';
    if (participantCount === 2) return 'grid-cols-2';
    if (participantCount <= 4) return 'grid-cols-2';
    if (participantCount <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  const getAspectClass = () => {
    if (participantCount === 1) return 'aspect-video';
    if (participantCount === 2) return 'aspect-video';
    return 'aspect-square';
  };

  return (
    <div className={`grid ${getGridClass()} gap-4 w-full h-full`}>
      {children}
    </div>
  );
}
