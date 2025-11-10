# Live Broadcast Countdown Timer - Integration Guide

This guide explains how to integrate the 15-second countdown timer into your streaming application.

---

## Overview

When users click "Go Live", a 15-second animated countdown appears, giving the system time to:
- Create live videos on platforms (Facebook, YouTube, etc.)
- Validate authentication tokens
- Establish RTMP connections
- Prepare all broadcast destinations

---

## Backend Implementation

### 1. Countdown Workflow

```
User clicks "Go Live"
    ↓
POST /api/broadcasts/:id/start
    ↓
Set broadcast status to "countdown"
    ↓
Return immediately (status: countdown, countdown: 15)
    ↓
[Async] Create platform live videos (Facebook, etc.)
    ↓
[Async] Emit socket events every second (countdown-tick)
    ↓
After 15 seconds: Update status to "live"
    ↓
Emit countdown-complete event
```

### 2. API Response

```typescript
// POST /api/broadcasts/:broadcastId/start
// Body: { destinationIds: ['id1', 'id2'] }

// Response:
{
  "message": "Countdown started",
  "broadcastId": "broadcast-uuid",
  "countdown": 15,
  "status": "countdown"
}
```

### 3. Socket Events

**countdown-tick** - Emitted every second
```typescript
{
  broadcastId: string,
  secondsRemaining: number  // 14, 13, 12, ... 1, 0
}
```

**countdown-complete** - Emitted when countdown finishes
```typescript
{
  broadcastId: string,
  status: "live"
}
```

---

## Frontend Integration

### 1. Import the Countdown Component

```typescript
import CountdownTimer from '../components/CountdownTimer';
```

### 2. Add State Management

```typescript
const [isCountingDown, setIsCountingDown] = useState(false);
const [countdownSeconds, setCountdownSeconds] = useState(15);
```

### 3. Start Broadcast with Countdown

```typescript
const handleGoLive = async () => {
  try {
    // Call the start broadcast API
    const response = await axios.post(
      `/api/broadcasts/${broadcastId}/start`,
      { destinationIds: selectedDestinations },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data.status === 'countdown') {
      setIsCountingDown(true);
      setCountdownSeconds(response.data.countdown);
    }
  } catch (error) {
    console.error('Failed to start broadcast:', error);
  }
};
```

### 4. Listen to Socket Events

```typescript
useEffect(() => {
  if (!socket || !broadcastId) return;

  // Listen for countdown ticks
  socket.on('countdown-tick', (data) => {
    if (data.broadcastId === broadcastId) {
      setCountdownSeconds(data.secondsRemaining);
    }
  });

  // Listen for countdown complete
  socket.on('countdown-complete', (data) => {
    if (data.broadcastId === broadcastId) {
      setIsCountingDown(false);
      setBroadcastStatus('live');
    }
  });

  return () => {
    socket.off('countdown-tick');
    socket.off('countdown-complete');
  };
}, [socket, broadcastId]);
```

### 5. Render the Countdown Component

```typescript
return (
  <>
    {/* Main Studio UI */}
    <div className="studio-container">
      {/* ... your studio components ... */}
    </div>

    {/* Countdown Overlay */}
    {isCountingDown && (
      <CountdownTimer
        initialSeconds={countdownSeconds}
        onComplete={() => {
          setIsCountingDown(false);
          setBroadcastStatus('live');
        }}
        onCancel={async () => {
          // Cancel the broadcast
          await axios.post(`/api/broadcasts/${broadcastId}/end`, {}, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setIsCountingDown(false);
        }}
      />
    )}
  </>
);
```

---

## Complete Studio.tsx Integration Example

```typescript
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CountdownTimer from '../components/CountdownTimer';
import { useSocket } from '../hooks/useSocket';

const Studio: React.FC = () => {
  const [broadcastId, setBroadcastId] = useState<string | null>(null);
  const [broadcastStatus, setBroadcastStatus] = useState<string>('scheduled');
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(15);
  const socket = useSocket();
  const token = localStorage.getItem('access_token');

  // Join broadcast room when component mounts
  useEffect(() => {
    if (socket && broadcastId) {
      socket.emit('join-studio', { broadcastId, participantId: 'host' });
    }
  }, [socket, broadcastId]);

  // Listen for countdown events
  useEffect(() => {
    if (!socket || !broadcastId) return;

    socket.on('countdown-tick', (data) => {
      if (data.broadcastId === broadcastId) {
        setCountdownSeconds(data.secondsRemaining);
      }
    });

    socket.on('countdown-complete', (data) => {
      if (data.broadcastId === broadcastId) {
        setIsCountingDown(false);
        setBroadcastStatus('live');
      }
    });

    return () => {
      socket.off('countdown-tick');
      socket.off('countdown-complete');
    };
  }, [socket, broadcastId]);

  const handleGoLive = async () => {
    try {
      const response = await axios.post(
        `/api/broadcasts/${broadcastId}/start`,
        {
          destinationIds: ['facebook-dest-id', 'youtube-dest-id'], // Your selected destinations
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.status === 'countdown') {
        setIsCountingDown(true);
        setCountdownSeconds(response.data.countdown);
      }
    } catch (error) {
      console.error('Failed to start broadcast:', error);
      alert('Failed to start broadcast');
    }
  };

  const handleCancelCountdown = async () => {
    try {
      await axios.post(
        `/api/broadcasts/${broadcastId}/end`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setIsCountingDown(false);
      setBroadcastStatus('ended');
    } catch (error) {
      console.error('Failed to cancel broadcast:', error);
    }
  };

  return (
    <div className="studio-page">
      {/* Main Studio UI */}
      <div className="studio-controls">
        <button
          onClick={handleGoLive}
          disabled={broadcastStatus !== 'scheduled'}
          className="go-live-button"
        >
          Go Live
        </button>
      </div>

      {/* Video Preview */}
      <video id="localVideo" autoPlay muted />

      {/* Countdown Overlay */}
      {isCountingDown && (
        <CountdownTimer
          initialSeconds={countdownSeconds}
          onComplete={() => {
            setIsCountingDown(false);
            setBroadcastStatus('live');
          }}
          onCancel={handleCancelCountdown}
        />
      )}
    </div>
  );
};

export default Studio;
```

---

## Styling

The CountdownTimer component includes its own styles. You can customize the appearance by:

### 1. Modifying the Component

Edit `frontend/src/components/CountdownTimer.tsx`:

```typescript
// Change colors
<stop offset="0%" stopColor="#3b82f6" /> // Blue gradient start
<stop offset="100%" stopColor="#8b5cf6" /> // Purple gradient end

// Change size
const radius = 120; // Circle radius
const textSize = "text-8xl" // Number size
```

### 2. Override with CSS

```css
/* In your global CSS or styled-components */
.countdown-overlay {
  background-color: rgba(0, 0, 0, 0.95); /* Darker overlay */
}

.countdown-number {
  font-family: 'Your Custom Font';
  color: #yourColor;
}
```

---

## Testing

### 1. Test Countdown Flow

```typescript
// In your component or test file
test('countdown starts when going live', async () => {
  const { getByText } = render(<Studio />);

  // Click Go Live button
  fireEvent.click(getByText('Go Live'));

  // Wait for countdown to appear
  await waitFor(() => {
    expect(getByText('15')).toBeInTheDocument();
  });

  // Countdown should decrement
  await waitFor(() => {
    expect(getByText('14')).toBeInTheDocument();
  }, { timeout: 2000 });
});
```

### 2. Manual Testing

1. Start your backend: `cd backend && npm run dev`
2. Start your frontend: `cd frontend && npm run dev`
3. Create a broadcast
4. Click "Go Live"
5. Observe the 15-second countdown
6. Verify broadcast goes live after countdown completes

---

## Troubleshooting

### Countdown doesn't appear

**Check:**
- Socket connection is established
- `broadcastId` is set correctly
- `join-studio` socket event is emitted
- API response includes `status: 'countdown'`

**Debug:**
```typescript
console.log('Socket connected:', socket?.connected);
console.log('Broadcast ID:', broadcastId);
console.log('API Response:', response.data);
```

### Countdown ticks not updating

**Check:**
- Socket listeners are attached before countdown starts
- `countdown-tick` events are being received

**Debug:**
```typescript
socket.on('countdown-tick', (data) => {
  console.log('Countdown tick received:', data);
  setCountdownSeconds(data.secondsRemaining);
});
```

### Broadcast doesn't go live after countdown

**Check:**
- Backend logs for errors during destination setup
- `countdown-complete` event is emitted
- Database broadcast status is updated to 'live'

**Debug:**
```typescript
socket.on('countdown-complete', (data) => {
  console.log('Countdown complete:', data);
  setBroadcastStatus('live');
});
```

---

## Customization Options

### Change Countdown Duration

**Backend** (`broadcasts.routes.ts`):
```typescript
// Change from 15 to 20 seconds
const COUNTDOWN_DURATION = 20;

res.json({
  countdown: COUNTDOWN_DURATION,
  // ...
});

setTimeout(async () => {
  // ...
}, COUNTDOWN_DURATION * 1000);
```

### Add Custom Messages During Countdown

```typescript
const getCountdownMessage = (seconds: number): string => {
  if (seconds > 10) return 'Preparing your broadcast...';
  if (seconds > 5) return 'Creating live videos...';
  if (seconds > 0) return 'Almost ready...';
  return 'Going live!';
};

<p className="text-xl text-gray-300">
  {getCountdownMessage(countdownSeconds)}
</p>
```

### Show Destination Progress

```typescript
// Listen to destination setup events
socket.on('destination-ready', (data) => {
  // Update UI to show which destinations are ready
  setReadyDestinations(prev => [...prev, data.destinationId]);
});
```

---

## Summary

✅ **Backend**: Countdown status, async destination setup, socket events
✅ **Frontend**: CountdownTimer component, socket listeners, state management
✅ **User Experience**: Smooth 15-second countdown with animated circle
✅ **Reliability**: Platform connections established during countdown

The countdown timer ensures users have a clear indication of when their broadcast will go live, while giving the system enough time to prepare all streaming destinations properly.
