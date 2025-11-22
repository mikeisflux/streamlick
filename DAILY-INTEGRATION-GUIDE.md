# Daily.co Integration Guide

## ✅ What's Been Completed

### 1. Backend Infrastructure
- ✅ Daily.co backend service (`backend/src/services/daily.service.ts`)
  - Create/delete rooms
  - Generate meeting tokens
  - Start/stop live streaming
  - Proxy REST API calls

- ✅ Daily API routes (`backend/src/api/daily.routes.ts`)
  - `POST /api/daily/broadcasts/:id/room` - Create Daily room
  - `POST /api/daily/broadcasts/:id/streaming/start` - Start RTMP
  - `POST /api/daily/broadcasts/:id/streaming/stop` - Stop RTMP
  - `GET /api/daily/broadcasts/:id/streaming/status` - Get status
  - `DELETE /api/daily/broadcasts/:id/room` - Cleanup room

- ✅ Admin settings updated
  - Added `daily_api_key` field in `/admin/settings`
  - Encrypted storage in `SystemSetting` table

### 2. Frontend Infrastructure
- ✅ Daily SDK installed (`@daily-co/daily-js`)
- ✅ Daily service (`frontend/src/services/daily.service.ts`)
  - Initialize Daily call object
  - Join/leave rooms
  - Set custom video/audio streams
  - Start/stop RTMP streaming
  - Reconnection logic

### 3. Compositor
- ✅ Already outputs `MediaStream` via `canvas.captureStream(30)`
- ✅ Compositor service provides `getOutputStream()`
- ✅ Video and audio tracks ready for Daily

---

## 🚧 What Needs to Be Done

### Step 1: Add Streaming Method Toggle

Add a system setting to choose between FFmpeg and Daily:

**Backend** (`backend/prisma/migrations/...create_streaming_method_setting.sql`):
```sql
INSERT INTO "system_settings" ("id", "category", "key", "value", "is_encrypted", "description", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'system',
  'streaming_method',
  'ffmpeg',
  false,
  'Streaming output method: ffmpeg (legacy) or daily (recommended)',
  NOW(),
  NOW()
) ON CONFLICT ("category", "key") DO NOTHING;
```

**Frontend** (`AdminSettings.tsx`):
```typescript
// Add to SystemConfig interface
interface SystemConfig {
  // ... existing fields
  streaming_method?: 'ffmpeg' | 'daily';
}

// Add to system settings fields
{
  category: 'Infrastructure & Deployment',
  fields: [
    // ... existing fields
    {
      key: 'streaming_method',
      label: 'Streaming Method',
      type: 'select',
      options: [
        { value: 'ffmpeg', label: 'FFmpeg (Legacy)' },
        { value: 'daily', label: 'Daily.co (Recommended)' }
      ],
      description: 'How to output RTMP streams to platforms'
    },
  ],
}
```

### Step 2: Integrate Daily into `useBroadcast` Hook

Modify `frontend/src/hooks/studio/useBroadcast.ts`:

```typescript
import { dailyService } from '../../services/daily.service';
import api from '../../services/api';

// Add state for Daily
const [dailyRoomInfo, setDailyRoomInfo] = useState<any>(null);
const [streamingMethod, setStreamingMethod] = useState<'ffmpeg' | 'daily'>('ffmpeg');

// Load streaming method from system settings
useEffect(() => {
  async function loadStreamingMethod() {
    try {
      const response = await api.get('/admin/system-config');
      if (response.data.streaming_method) {
        setStreamingMethod(response.data.streaming_method);
      }
    } catch (error) {
      console.error('Failed to load streaming method:', error);
    }
  }
  loadStreamingMethod();
}, []);

// Modify handleGoLive function
const handleGoLive = useCallback(async () => {
  // ... existing validation code ...

  try {
    // ... existing WebRTC and compositor initialization ...

    if (streamingMethod === 'daily') {
      // === DAILY.CO PATH ===
      console.log('[useBroadcast] Using Daily.co for streaming');

      // 1. Create Daily room
      console.log('[useBroadcast] Creating Daily room...');
      const roomResponse = await api.post(`/daily/broadcasts/${broadcastId}/room`);
      const { room, token } = roomResponse.data;
      setDailyRoomInfo(room);

      // 2. Initialize and join Daily room
      await dailyService.initialize({ roomName: room.name, token });
      await dailyService.joinRoom({ roomName: room.name, token, userName: 'Broadcaster' });

      // 3. Set compositor stream as Daily input
      const compositeStream = compositorService.getOutputStream();
      const videoTrack = compositeStream.getVideoTracks()[0];
      const audioTrack = compositeStream.getAudioTracks()[0];
      await dailyService.setCompositeStream(videoTrack, audioTrack);

      // 4. Format destinations for Daily
      const dailyDestinations = destinationsToStream.map((d: any) => ({
        rtmpUrl: d.rtmpUrl,
        streamKey: d.streamKey,
        platform: d.platform,
      }));

      // 5. Start RTMP streaming via Daily
      console.log('[useBroadcast] Starting Daily RTMP streaming...');
      await dailyService.startStreaming(dailyDestinations);

      console.log('[useBroadcast] ✅ Daily streaming started');
      toast.success('Connected via Daily.co - starting countdown...');

    } else {
      // === FFMPEG PATH (existing) ===
      console.log('[useBroadcast] Using FFmpeg for streaming');

      // ... existing mediaServerSocketService.emit('start-rtmp', ...) code ...
    }

    // Continue with countdown, intro video, etc. (same for both methods)
    setIsLive(true);
    await compositorService.startCountdown(30);
    await api.post(`/broadcasts/${broadcastId}/transition-youtube-to-live`);
    await compositorService.playIntroVideo('/backgrounds/videos/StreamLick.mp4');

    // ... rest of existing code ...

  } catch (error) {
    console.error('Go live error:', error);
    toast.error('Failed to go live');

    // Cleanup Daily on error
    if (streamingMethod === 'daily') {
      await dailyService.destroy();
    }
  }
}, [/* dependencies */]);

// Modify handleStopBroadcast
const handleStopBroadcast = useCallback(async () => {
  try {
    if (streamingMethod === 'daily') {
      console.log('[useBroadcast] Stopping Daily streaming...');
      await dailyService.stopStreaming();
      await dailyService.leaveRoom();
      await api.delete(`/daily/broadcasts/${broadcastId}/room`);
      await dailyService.destroy();
    } else {
      // Existing FFmpeg stop logic
      mediaServerSocketService.emit('stop-rtmp', { broadcastId });
    }

    // ... rest of existing stop logic ...
  } catch (error) {
    console.error('Stop broadcast error:', error);
  }
}, [/* dependencies */]);
```

### Step 3: Handle Compositor Stream Updates

When participants join/leave, update the Daily stream:

```typescript
// In useBroadcast or wherever participants change
useEffect(() => {
  if (streamingMethod === 'daily' && dailyService.getStatus().isConnected) {
    // Get updated composite stream
    const compositeStream = compositorService.getOutputStream();
    if (compositeStream) {
      const videoTrack = compositeStream.getVideoTracks()[0];
      const audioTrack = compositeStream.getAudioTracks()[0];

      // Update Daily with new stream
      dailyService.setCompositeStream(videoTrack, audioTrack).catch(error => {
        console.error('Failed to update Daily stream:', error);
      });
    }
  }
}, [remoteParticipants, streamingMethod]);
```

### Step 4: Add Daily Status Monitoring

Create a component to show Daily connection status:

```typescript
// frontend/src/components/DailyStatusIndicator.tsx
import { useEffect, useState } from 'react';
import { dailyService } from '../services/daily.service';

export function DailyStatusIndicator() {
  const [status, setStatus] = useState(dailyService.getStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(dailyService.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!status.isInitialized) return null;

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className={`w-2 h-2 rounded-full ${status.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-gray-300">
        Daily: {status.isConnected ? 'Connected' : 'Disconnected'}
        {status.isStreaming && ' • Streaming'}
      </span>
    </div>
  );
}
```

---

## 🧪 Testing Checklist

### Local Testing

1. **Setup Daily.co Account**
   - Sign up at https://daily.co
   - Get API key from dashboard
   - Add API key in `/admin/settings`

2. **Test Room Creation**
   ```bash
   # Backend logs should show:
   [Daily Backend] Service initialized successfully
   [Daily Backend] Room created successfully: streamlick-broadcast-{id}
   ```

3. **Test Streaming**
   - Start broadcast
   - Check Daily dashboard for active room
   - Verify RTMP connections to platforms
   - Monitor Daily status indicator

4. **Test Failure Scenarios**
   - Network disconnection → Should reconnect
   - Invalid API key → Should fail gracefully
   - No destinations → Should show error

### Production Testing

1. **Cost Monitoring**
   - Daily dashboard → Usage tab
   - Confirm only 1 participant minute per broadcast
   - Confirm RTMP output costs ($0.015/min per stream)

2. **Quality Verification**
   - Check YouTube/Facebook stream quality
   - Verify audio sync
   - Test with 4+ participants

---

## 💰 Cost Comparison

### Current FFmpeg Approach
- **Media Server**: VPS cost (~$20/month)
- **CPU Usage**: High (transcoding)
- **Reliability**: Manual error handling

### Daily.co Approach
- **Participant Minutes**: $0.004/min × 1 broadcaster = $0.24/hour
- **RTMP Streaming**: $0.015/min = $0.90/hour per destination
- **Total Cost**: $1.14/hour (1 destination), $2.04/hour (2 destinations)
- **Reliability**: Managed by Daily, auto-reconnection
- **CPU Usage**: Zero (offloaded to Daily)

**Break-even**: ~20 hours of streaming/month with current VPS

---

## 🐛 Common Issues & Solutions

### Issue: Daily API key not found
**Solution**: Ensure key is set in `/admin/settings` and database is updated

### Issue: Stream not starting
**Solution**:
1. Check browser console for Daily errors
2. Verify compositor is outputting tracks
3. Check Daily dashboard for room status

### Issue: Audio/video out of sync
**Solution**:
- Ensure `canvas.captureStream(30)` matches compositor FPS
- Check audio context sample rate (48000 Hz)

### Issue: Reconnection failures
**Solution**: Increase `maxReconnectAttempts` in `daily.service.ts`

---

## 📚 Resources

- [Daily.co Live Streaming Guide](https://docs.daily.co/guides/products/live-streaming-recording/live-streaming)
- [Daily.co JavaScript SDK](https://docs.daily.co/reference/daily-js)
- [setInputDevicesAsync() Documentation](https://docs.daily.co/reference/daily-js/instance-methods/set-input-devices-async)
- [Daily.co Pricing](https://www.daily.co/pricing/video-sdk/)

---

## ✅ Final Checklist

- [ ] Daily API key configured
- [ ] Streaming method toggle added
- [ ] useBroadcast updated with Daily logic
- [ ] Status monitoring component added
- [ ] Error handling implemented
- [ ] Local testing complete
- [ ] Production testing complete
- [ ] Cost monitoring setup
- [ ] Documentation updated
- [ ] Team trained on new system

---

## 🚀 Next Steps After Integration

1. **Gradual Rollout**
   - Start with 1-2 test broadcasts
   - Monitor costs and quality
   - Gather user feedback

2. **Optimization**
   - Fine-tune video quality settings
   - Optimize reconnection logic
   - Add analytics dashboard

3. **Future Enhancements**
   - Multi-bitrate streaming (ABR)
   - HLS output for website embedding
   - Recording via Daily
   - Advanced layouts/overlays
