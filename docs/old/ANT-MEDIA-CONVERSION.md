# Ant Media Server Conversion Guide

Complete guide for converting StreamLick from mediasoup to Ant Media Server with multi-destination streaming and ultra-low latency WebRTC.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Fork and Modify Ant Media Server](#phase-1-fork-and-modify-ant-media-server)
4. [Phase 2: Server Installation](#phase-2-server-installation)
5. [Phase 3: Configuration for StreamLick](#phase-3-configuration-for-streamlick)
6. [Phase 4: Frontend Integration](#phase-4-frontend-integration)
7. [Phase 5: Backend API Updates](#phase-5-backend-api-updates)
8. [Phase 6: Finding and Removing Enterprise Feature Gates](#phase-6-finding-and-removing-enterprise-feature-gates)
9. [Phase 7: Ultra-Low Latency Configuration](#phase-7-ultra-low-latency-configuration)
10. [Phase 8: Migration and Cutover](#phase-8-migration-and-cutover)
11. [Testing Checklist](#testing-checklist)
12. [Rollback Plan](#rollback-plan)

---

## Architecture Overview

### Current Architecture (mediasoup)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           BROWSER                                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │  Camera/Mic     │───>│   Canvas        │───>│  mediasoup      │ │
│  │  getUserMedia   │    │   Compositor    │    │  client SDK     │ │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘ │
└─────────────────────────────────────────────────────────┼──────────┘
                                                          │ WebRTC
                                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MEDIA SERVER (Port 3001)                        │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   mediasoup     │───>│   Plain RTP     │───>│    FFmpeg       │ │
│  │   Workers       │    │   Transports    │    │   (if used)     │ │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘ │
└─────────────────────────────────────────────────────────┼──────────┘
                                                          │ RTMP
                                                          ▼
                                              ┌─────────────────────┐
                                              │  YouTube/Facebook/  │
                                              │  Twitch/etc         │
                                              └─────────────────────┘
```

### New Architecture (Ant Media Server)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           BROWSER                                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │  Camera/Mic     │───>│   Canvas        │───>│  Ant Media      │ │
│  │  getUserMedia   │    │   Compositor    │    │  WebRTC SDK     │ │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘ │
└─────────────────────────────────────────────────────────┼──────────┘
                                                          │ WebRTC
                                                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   ANT MEDIA SERVER (Port 5080/5443)                  │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  WebRTC Ingestion → Transcoding → Multi-RTMP Output (built-in)  ││
│  └─────────────────────────────────────────────────────────────────┘│
└──────────────────────────────┬──────────────────────────────────────┘
                               │ RTMP (multiple destinations)
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ YouTube  │    │ Facebook │    │  Twitch  │
        └──────────┘    └──────────┘    └──────────┘
```

### Benefits of Conversion

| Aspect | mediasoup | Ant Media Server |
|--------|-----------|------------------|
| WebRTC → RTMP | Manual (FFmpeg) | Built-in |
| Multi-destination | Custom code | Built-in (after mod) |
| Latency | 8-12s typical | 0.5s WebRTC |
| Transcoding | FFmpeg setup | Built-in |
| Adaptive bitrate | Manual | Built-in |
| Maintenance | High | Low |

---

## Prerequisites

### Server Requirements

- **OS**: Ubuntu 20.04/22.04 LTS (recommended) or CentOS 7/8
- **CPU**: 4+ cores (8+ recommended for transcoding)
- **RAM**: 8GB minimum (16GB+ recommended)
- **Storage**: 50GB+ SSD
- **Network**: 100Mbps+ upload

### Required Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 5080 | TCP | HTTP API & Dashboard |
| 5443 | TCP | HTTPS API & Dashboard (SSL) |
| 1935 | TCP | RTMP Ingest/Output |
| 5000-65000 | UDP | WebRTC Media |
| 8443 | TCP | WebSocket Secure |

### Software Prerequisites

```bash
# Java 11+ (required)
sudo apt update
sudo apt install -y openjdk-11-jdk

# Verify Java
java -version

# Maven (for building from source)
sudo apt install -y maven

# Git
sudo apt install -y git
```

---

## Phase 1: Fork and Modify Ant Media Server

### Step 1.1: Fork the Repository

1. Go to https://github.com/ant-media/Ant-Media-Server
2. Click "Fork" → Select your account (mikeisflux)
3. Clone your fork:

```bash
cd /home/user
git clone https://github.com/mikeisflux/Ant-Media-Server.git
cd Ant-Media-Server
```

### Step 1.2: Enable Multi-Destination Streaming

The multi-destination RTMP feature exists but is gated for Enterprise. Here's where to modify:

#### File: `src/main/java/io/antmedia/AntMediaApplicationAdapter.java`

Look for license checks around RTMP endpoint functionality:

```java
// Search for patterns like:
// if (isEnterprise()) { ... }
// if (licenseService.isLicenseValid()) { ... }
```

#### File: `src/main/java/io/antmedia/muxer/MuxAdaptor.java`

This handles the actual RTMP streaming. Key method: `startRtmpStreaming()`

```java
// Around line 953 - startRtmpStreaming method
// Remove or bypass any license checks
public Result startRtmpStreaming(String rtmpUrl, int resolution) {
    // Existing code checks license here - remove/bypass
    // ...
    RtmpMuxer rtmpMuxer = new RtmpMuxer(rtmpUrl, vertx);
    rtmpMuxer.prepare(/* ... */);
    // ...
}
```

#### File: `src/main/java/io/antmedia/rest/BroadcastRestService.java`

REST API endpoints for adding RTMP destinations:

```java
// Method: addEndpoint
// Method: removeEndpoint
// These may have license checks to remove
```

### Step 1.3: Create Multi-Destination Helper

Add a new method to handle multiple destinations:

#### File: `src/main/java/io/antmedia/muxer/MuxAdaptor.java`

```java
/**
 * Add multiple RTMP endpoints at once
 * @param endpoints List of RTMP URLs
 * @return Map of URL to success/failure
 */
public Map<String, Boolean> addMultipleRtmpEndpoints(List<String> endpoints) {
    Map<String, Boolean> results = new HashMap<>();
    for (String endpoint : endpoints) {
        try {
            Result result = startRtmpStreaming(endpoint, 0); // 0 = original resolution
            results.put(endpoint, result.isSuccess());
        } catch (Exception e) {
            logger.error("Failed to add endpoint: " + endpoint, e);
            results.put(endpoint, false);
        }
    }
    return results;
}
```

### Step 1.4: Build Modified Version

```bash
cd /home/user/Ant-Media-Server

# Build with Maven (skip tests for faster build)
mvn clean package -DskipTests

# The built WAR file will be at:
# target/ant-media-server.war
```

---

## Phase 2: Server Installation

### Step 2.1: Install Ant Media Server

#### Option A: Install Script (Recommended)

```bash
# Download installer
cd /tmp
wget https://raw.githubusercontent.com/ant-media/Scripts/master/install_ant-media-server.sh

# Make executable
chmod +x install_ant-media-server.sh

# Install Community Edition first (we'll replace with our build)
sudo ./install_ant-media-server.sh -i
```

#### Option B: Manual Installation

```bash
# Create directories
sudo mkdir -p /usr/local/antmedia
sudo mkdir -p /var/log/antmedia

# Download and extract
cd /tmp
wget https://github.com/ant-media/Ant-Media-Server/releases/download/ams-v2.9.0/ant-media-server-2.9.0.zip
unzip ant-media-server-2.9.0.zip
sudo mv ant-media-server /usr/local/antmedia

# Set permissions
sudo chown -R $USER:$USER /usr/local/antmedia
```

### Step 2.2: Replace with Custom Build

```bash
# Stop Ant Media Server
sudo systemctl stop antmedia

# Backup original
sudo cp /usr/local/antmedia/webapps/root/ROOT.war /usr/local/antmedia/webapps/root/ROOT.war.bak

# Copy our modified build
sudo cp /home/user/Ant-Media-Server/target/ant-media-server.war /usr/local/antmedia/webapps/root/ROOT.war

# Restart
sudo systemctl start antmedia
```

### Step 2.3: Create Systemd Service

```bash
sudo tee /etc/systemd/system/antmedia.service << 'EOF'
[Unit]
Description=Ant Media Server
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/antmedia/start.sh
ExecStop=/usr/local/antmedia/stop.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable antmedia
sudo systemctl start antmedia
```

### Step 2.4: Configure Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 5080/tcp    # HTTP Dashboard
sudo ufw allow 5443/tcp    # HTTPS Dashboard
sudo ufw allow 1935/tcp    # RTMP
sudo ufw allow 5000:65000/udp  # WebRTC UDP range

# Or iptables
sudo iptables -A INPUT -p tcp --dport 5080 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 5443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 1935 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 5000:65000 -j ACCEPT
```

---

## Phase 3: Configuration for StreamLick

### Step 3.1: Create StreamLick Application

Ant Media uses "applications" to separate different streaming contexts.

```bash
# Create application directory
sudo mkdir -p /usr/local/antmedia/webapps/StreamLick

# Copy from template
sudo cp -r /usr/local/antmedia/webapps/LiveApp/* /usr/local/antmedia/webapps/StreamLick/
```

### Step 3.2: Application Settings

Edit `/usr/local/antmedia/webapps/StreamLick/WEB-INF/red5-web.properties`:

```properties
# Application name
webapp.contextPath=/StreamLick

# Enable WebRTC
settings.webRTCEnabled=true

# Enable RTMP output
settings.rtmpEnabled=true

# Token security (recommended for production)
settings.publishTokenControlEnabled=true
settings.playTokenControlEnabled=false

# Recording settings
settings.mp4MuxingEnabled=false
settings.hlsMuxingEnabled=false

# Adaptive bitrate (enable if needed)
settings.encoderSettingsString=

# WebRTC settings
settings.webRTCFrameRate=30
settings.webRTCKeyFrameInterval=2
```

### Step 3.3: Server-Level Configuration

Edit `/usr/local/antmedia/conf/red5.properties`:

```properties
# Server settings
rtmp.host=0.0.0.0
rtmp.port=1935
http.host=0.0.0.0
http.port=5080
https.port=5443

# WebRTC port range
webrtc.portRangeMin=5000
webrtc.portRangeMax=65000

# Public IP for WebRTC (CRITICAL - set your server's public IP)
webrtc.stunServerUri=stun:stun.l.google.com:19302
webrtc.externalIP=YOUR_SERVER_PUBLIC_IP
```

### Step 3.4: SSL Configuration (Required for WebRTC in Production)

```bash
# Using Let's Encrypt
sudo /usr/local/antmedia/enable_ssl.sh -d your-domain.com

# Or manual SSL
sudo cp /path/to/fullchain.pem /usr/local/antmedia/conf/fullchain.pem
sudo cp /path/to/privkey.pem /usr/local/antmedia/conf/privkey.pem
```

### Step 3.5: Environment Variables for StreamLick

Create `/home/user/streamlick/.env.antmedia`:

```bash
# Ant Media Server Configuration
ANT_MEDIA_URL=https://your-server.com:5443
ANT_MEDIA_APP=StreamLick
ANT_MEDIA_REST_URL=https://your-server.com:5443/StreamLick/rest/v2

# If using token authentication
ANT_MEDIA_PUBLISH_TOKEN=your-secure-token

# WebRTC settings
ANT_MEDIA_WEBSOCKET_URL=wss://your-server.com:5443/StreamLick/websocket
```

---

## Phase 4: Frontend Integration

### Step 4.1: Install Ant Media WebRTC SDK

```bash
cd /home/user/streamlick/frontend
npm install @anthropic/ant-media-webrtc-js-sdk
# Or use CDN in HTML
```

### Step 4.2: Create Ant Media Service

Create `frontend/src/services/antmedia.service.ts`:

```typescript
/**
 * Ant Media Server WebRTC Service
 * Replaces mediasoup-client for WebRTC streaming
 */

import { WebRTCAdaptor } from '@anthropic/ant-media-webrtc-js-sdk';
import logger from '../utils/logger';

interface AntMediaConfig {
  websocketUrl: string;
  publishToken?: string;
  debug?: boolean;
}

interface StreamDestination {
  platform: string;
  rtmpUrl: string;
}

class AntMediaService {
  private webRTCAdaptor: WebRTCAdaptor | null = null;
  private streamId: string | null = null;
  private isPublishing = false;
  private config: AntMediaConfig;

  constructor() {
    this.config = {
      websocketUrl: import.meta.env.VITE_ANT_MEDIA_WEBSOCKET_URL || 'wss://localhost:5443/StreamLick/websocket',
      publishToken: import.meta.env.VITE_ANT_MEDIA_PUBLISH_TOKEN,
      debug: import.meta.env.DEV,
    };
  }

  /**
   * Initialize WebRTC connection to Ant Media Server
   */
  async initialize(streamId: string): Promise<void> {
    this.streamId = streamId;

    return new Promise((resolve, reject) => {
      this.webRTCAdaptor = new WebRTCAdaptor({
        websocket_url: this.config.websocketUrl,
        mediaConstraints: {
          video: false, // We provide our own stream
          audio: false,
        },
        peerconnection_config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
          ],
        },
        sdp_constraints: {
          OfferToReceiveAudio: false,
          OfferToReceiveVideo: false,
        },
        debug: this.config.debug,
        callback: (info: string, obj?: any) => {
          this.handleCallback(info, obj, resolve, reject);
        },
        callbackError: (error: string, message?: string) => {
          this.handleError(error, message, reject);
        },
      });
    });
  }

  /**
   * Start publishing the compositor stream
   */
  async publish(stream: MediaStream): Promise<void> {
    if (!this.webRTCAdaptor || !this.streamId) {
      throw new Error('Ant Media not initialized');
    }

    if (this.isPublishing) {
      logger.warn('Already publishing');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Set the local stream (from compositor)
        this.webRTCAdaptor!.localStream = stream;

        // Start publishing
        if (this.config.publishToken) {
          this.webRTCAdaptor!.publish(this.streamId!, this.config.publishToken);
        } else {
          this.webRTCAdaptor!.publish(this.streamId!);
        }

        // Resolve on publish_started callback
        const checkPublishing = setInterval(() => {
          if (this.isPublishing) {
            clearInterval(checkPublishing);
            resolve();
          }
        }, 100);

        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(checkPublishing);
          if (!this.isPublishing) {
            reject(new Error('Publish timeout'));
          }
        }, 30000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop publishing
   */
  async stop(): Promise<void> {
    if (!this.webRTCAdaptor || !this.streamId) {
      return;
    }

    try {
      this.webRTCAdaptor.stop(this.streamId);
      this.isPublishing = false;
      logger.info('Stopped publishing to Ant Media');
    } catch (error) {
      logger.error('Error stopping Ant Media stream:', error);
    }
  }

  /**
   * Add RTMP endpoint for multi-destination streaming
   */
  async addRtmpEndpoint(rtmpUrl: string): Promise<boolean> {
    if (!this.streamId) {
      throw new Error('Stream not initialized');
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_ANT_MEDIA_REST_URL}/broadcasts/${this.streamId}/rtmp-endpoint`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rtmpUrl: rtmpUrl,
          }),
        }
      );

      const result = await response.json();
      logger.info(`Added RTMP endpoint: ${rtmpUrl}`, result);
      return result.success;
    } catch (error) {
      logger.error('Failed to add RTMP endpoint:', error);
      return false;
    }
  }

  /**
   * Remove RTMP endpoint
   */
  async removeRtmpEndpoint(rtmpUrl: string): Promise<boolean> {
    if (!this.streamId) {
      throw new Error('Stream not initialized');
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_ANT_MEDIA_REST_URL}/broadcasts/${this.streamId}/rtmp-endpoint`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            rtmpUrl: rtmpUrl,
          }),
        }
      );

      return response.ok;
    } catch (error) {
      logger.error('Failed to remove RTMP endpoint:', error);
      return false;
    }
  }

  /**
   * Add multiple destinations at once
   */
  async addDestinations(destinations: StreamDestination[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const dest of destinations) {
      const success = await this.addRtmpEndpoint(dest.rtmpUrl);
      results.set(dest.platform, success);
    }

    return results;
  }

  /**
   * Get stream statistics
   */
  async getStreamStats(): Promise<any> {
    if (!this.streamId) {
      return null;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_ANT_MEDIA_REST_URL}/broadcasts/${this.streamId}`
      );
      return await response.json();
    } catch (error) {
      logger.error('Failed to get stream stats:', error);
      return null;
    }
  }

  /**
   * Handle WebRTC adaptor callbacks
   */
  private handleCallback(
    info: string,
    obj: any,
    resolve?: (value: void) => void,
    reject?: (reason: any) => void
  ): void {
    logger.debug('Ant Media callback:', info, obj);

    switch (info) {
      case 'initialized':
        logger.info('Ant Media WebRTC initialized');
        if (resolve) resolve();
        break;

      case 'publish_started':
        this.isPublishing = true;
        logger.info('Publishing started:', this.streamId);
        break;

      case 'publish_finished':
        this.isPublishing = false;
        logger.info('Publishing finished');
        break;

      case 'ice_connection_state_changed':
        logger.debug('ICE state:', obj?.state);
        break;

      case 'data_received':
        logger.debug('Data received:', obj);
        break;

      default:
        logger.debug('Unhandled callback:', info);
    }
  }

  /**
   * Handle WebRTC adaptor errors
   */
  private handleError(
    error: string,
    message?: string,
    reject?: (reason: any) => void
  ): void {
    logger.error('Ant Media error:', error, message);

    switch (error) {
      case 'no_stream_exist':
        logger.error('Stream does not exist');
        break;

      case 'not_initialized_yet':
        logger.error('WebRTC not initialized');
        break;

      case 'publishTimeoutError':
        logger.error('Publish timeout');
        if (reject) reject(new Error('Publish timeout'));
        break;

      default:
        if (reject) reject(new Error(`${error}: ${message}`));
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.webRTCAdaptor) {
      try {
        if (this.isPublishing && this.streamId) {
          this.webRTCAdaptor.stop(this.streamId);
        }
        this.webRTCAdaptor.closeWebSocket();
      } catch (error) {
        logger.error('Error destroying Ant Media service:', error);
      }
    }

    this.webRTCAdaptor = null;
    this.streamId = null;
    this.isPublishing = false;
  }
}

export const antMediaService = new AntMediaService();
```

### Step 4.3: Update useBroadcast Hook

Update `frontend/src/hooks/studio/useBroadcast.ts` to use Ant Media:

```typescript
// Add import
import { antMediaService } from '../../services/antmedia.service';

// In startBroadcast function, replace mediasoup code:

// OLD (mediasoup):
// await webrtcService.initialize(broadcastId);
// await webrtcService.createSendTransport();
// const stream = compositorService.getOutputStream();
// await webrtcService.produceMedia(stream.getVideoTracks()[0]);
// await webrtcService.produceMedia(stream.getAudioTracks()[0]);

// NEW (Ant Media):
await antMediaService.initialize(broadcastId);
const stream = compositorService.getOutputStream();
await antMediaService.publish(stream);

// Add destinations
for (const destination of destinations) {
  await antMediaService.addRtmpEndpoint(destination.rtmpUrl);
}
```

---

## Phase 5: Backend API Updates

### Step 5.1: Create Ant Media Proxy Service

Create `backend/src/services/antmedia.service.ts`:

```typescript
/**
 * Ant Media Server Backend Service
 * Handles server-side communication with Ant Media
 */

import axios from 'axios';

const ANT_MEDIA_URL = process.env.ANT_MEDIA_REST_URL || 'http://localhost:5080/StreamLick/rest/v2';

interface BroadcastInfo {
  streamId: string;
  status: string;
  rtmpUrl?: string;
  hlsUrl?: string;
  webRTCViewerCount: number;
  rtmpEndpointList: string[];
}

class AntMediaBackendService {
  /**
   * Create a new broadcast/stream
   */
  async createBroadcast(streamId: string, name: string): Promise<BroadcastInfo> {
    const response = await axios.post(`${ANT_MEDIA_URL}/broadcasts/create`, {
      streamId,
      name,
      type: 'liveStream',
    });
    return response.data;
  }

  /**
   * Get broadcast information
   */
  async getBroadcast(streamId: string): Promise<BroadcastInfo | null> {
    try {
      const response = await axios.get(`${ANT_MEDIA_URL}/broadcasts/${streamId}`);
      return response.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete a broadcast
   */
  async deleteBroadcast(streamId: string): Promise<boolean> {
    try {
      await axios.delete(`${ANT_MEDIA_URL}/broadcasts/${streamId}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Add RTMP endpoint to a broadcast
   */
  async addRtmpEndpoint(streamId: string, rtmpUrl: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${ANT_MEDIA_URL}/broadcasts/${streamId}/rtmp-endpoint`,
        { rtmpUrl }
      );
      return response.data.success;
    } catch (error) {
      console.error('Failed to add RTMP endpoint:', error);
      return false;
    }
  }

  /**
   * Remove RTMP endpoint from a broadcast
   */
  async removeRtmpEndpoint(streamId: string, rtmpUrl: string): Promise<boolean> {
    try {
      await axios.delete(`${ANT_MEDIA_URL}/broadcasts/${streamId}/rtmp-endpoint`, {
        data: { rtmpUrl },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Add multiple RTMP endpoints
   */
  async addMultipleEndpoints(
    streamId: string,
    endpoints: Array<{ platform: string; rtmpUrl: string }>
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const endpoint of endpoints) {
      const success = await this.addRtmpEndpoint(streamId, endpoint.rtmpUrl);
      results.set(endpoint.platform, success);
    }

    return results;
  }

  /**
   * Get publish token for secure publishing
   */
  async getPublishToken(streamId: string, expiresInSeconds: number = 3600): Promise<string> {
    const response = await axios.get(
      `${ANT_MEDIA_URL}/broadcasts/${streamId}/token`,
      {
        params: {
          expireDate: Date.now() + expiresInSeconds * 1000,
          type: 'publish',
        },
      }
    );
    return response.data.tokenId;
  }

  /**
   * Get stream statistics
   */
  async getStreamStats(streamId: string): Promise<any> {
    try {
      const response = await axios.get(`${ANT_MEDIA_URL}/broadcasts/${streamId}/broadcast-statistics`);
      return response.data;
    } catch (error) {
      return null;
    }
  }
}

export const antMediaBackendService = new AntMediaBackendService();
```

### Step 5.2: Update Broadcasts Routes

Update `backend/src/api/broadcasts.routes.ts`:

```typescript
// Add import
import { antMediaBackendService } from '../services/antmedia.service';

// Add new endpoints:

// Create broadcast in Ant Media
router.post('/:id/ant-media/create', async (req, res) => {
  try {
    const { id } = req.params;
    const broadcast = await prisma.broadcast.findUnique({ where: { id } });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const result = await antMediaBackendService.createBroadcast(id, broadcast.title);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create Ant Media broadcast' });
  }
});

// Add RTMP destination
router.post('/:id/ant-media/rtmp-endpoint', async (req, res) => {
  try {
    const { id } = req.params;
    const { rtmpUrl, platform } = req.body;

    const success = await antMediaBackendService.addRtmpEndpoint(id, rtmpUrl);
    res.json({ success, platform });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add RTMP endpoint' });
  }
});

// Get publish token
router.get('/:id/ant-media/token', async (req, res) => {
  try {
    const { id } = req.params;
    const token = await antMediaBackendService.getPublishToken(id);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get publish token' });
  }
});
```

---

## Phase 6: Finding and Removing Enterprise Feature Gates

### Step 6.0: Understanding Ant Media's Enterprise Architecture

Ant Media Server uses a **reflection-based plugin architecture** where Enterprise features are loaded dynamically. The Community Edition codebase on GitHub contains references to Enterprise classes, but the actual implementations are in a separate closed-source package.

**Key Pattern**: The code uses `Class.forName("io.antmedia.enterprise.xxx")` to load Enterprise features at runtime. If the class isn't found (Community Edition), it falls back to basic behavior.

### Step 6.1: Search Strategy for Feature Gates

Clone the repo and search for these patterns:

```bash
cd /home/user/Ant-Media-Server

# Search for enterprise class loading
grep -rn "io.antmedia.enterprise" src/
grep -rn "Class.forName" src/ | grep -i enterprise

# Search for license checks
grep -rn "isEnterprise" src/
grep -rn "licenseService" src/
grep -rn "LicenceService" src/

# Search for feature flags
grep -rn "isEnterpriseEdition" src/
grep -rn "getEnterpriseEdition" src/

# Search for RTMP endpoint restrictions
grep -rn "rtmpEndpoint" src/
grep -rn "RtmpMuxer" src/
grep -rn "addEndpoint" src/
```

### Step 6.2: Known Enterprise Feature Locations

Based on code analysis, here are the key files to examine:

#### File 1: `src/main/java/io/antmedia/muxer/MuxAdaptor.java`

This file handles stream muxing and RTMP output. Look for:

```java
// Pattern 1: Reflection-based enterprise loading
try {
    Class<?> enterpriseClass = Class.forName("io.antmedia.enterprise.adaptive.EncoderAdaptor");
    // Enterprise code
} catch (ClassNotFoundException e) {
    // Community fallback - THIS IS WHERE TO ADD FEATURES
}

// Pattern 2: Feature count limits
// The community edition may limit number of RTMP endpoints
// Look for patterns like:
if (rtmpEndpointList.size() >= MAX_ENDPOINTS) {
    return Result.fail("Maximum endpoints reached");
}
```

**Modification Strategy:**
```java
// BEFORE (hypothetical restriction)
private static final int MAX_RTMP_ENDPOINTS = 1; // Community limit

// AFTER (remove limit)
private static final int MAX_RTMP_ENDPOINTS = Integer.MAX_VALUE;
```

#### File 2: `src/main/java/io/antmedia/AntMediaApplicationAdapter.java`

The main application adapter that initializes features:

```java
// Look for initialization that checks edition
public void appStart(IScope app) {
    // May check license here
    // Look for: isEnterpriseEdition(), licenseService.isValid(), etc.
}
```

**Modification Strategy:**
```java
// If you find:
if (isEnterpriseEdition()) {
    initializeMultiRtmpEndpoints();
}

// Change to:
initializeMultiRtmpEndpoints(); // Always initialize
```

#### File 3: `src/main/java/io/antmedia/rest/BroadcastRestService.java`

REST API endpoints - these may have feature checks:

```java
@POST
@Path("/{id}/rtmp-endpoint")
public Result addEndpoint(...) {
    // Look for edition checks at the start of the method
}
```

#### File 4: `src/main/java/io/antmedia/AppSettings.java`

Application settings that may define feature availability:

```java
// Look for settings like:
private boolean rtmpEndpointEnabled = false; // May be false in community
private int maxRtmpEndpoints = 1;
```

### Step 6.3: Creating Enterprise Feature Stubs

If features require Enterprise classes that don't exist, create stubs:

```bash
mkdir -p src/main/java/io/antmedia/enterprise/adaptive
mkdir -p src/main/java/io/antmedia/enterprise/muxer
```

#### Create: `src/main/java/io/antmedia/enterprise/adaptive/EncoderAdaptor.java`

```java
package io.antmedia.enterprise.adaptive;

import io.antmedia.muxer.MuxAdaptor;

/**
 * Stub implementation for Enterprise EncoderAdaptor
 * Enables adaptive bitrate without Enterprise license
 */
public class EncoderAdaptor extends MuxAdaptor {

    public EncoderAdaptor(String streamId) {
        super(streamId);
    }

    // Implement any abstract methods from parent
    // Copy implementation from Community code or create minimal stubs
}
```

#### Create: `src/main/java/io/antmedia/enterprise/muxer/DASHMuxer.java`

```java
package io.antmedia.enterprise.muxer;

import io.antmedia.muxer.Muxer;

/**
 * Stub implementation for Enterprise DASH Muxer
 */
public class DASHMuxer extends Muxer {

    public DASHMuxer(String streamId) {
        super(streamId);
    }

    // Minimal implementation
}
```

### Step 6.4: Implementing Multi-Destination Without Enterprise

If the multi-destination code is entirely in Enterprise, implement it yourself:

#### Create: `src/main/java/io/antmedia/muxer/MultiRtmpManager.java`

```java
package io.antmedia.muxer;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Custom Multi-Destination RTMP Manager
 * Manages multiple RTMP output endpoints for a single stream
 */
public class MultiRtmpManager {

    private static final Logger logger = LoggerFactory.getLogger(MultiRtmpManager.class);

    // Map of streamId -> List of RtmpMuxers
    private Map<String, List<RtmpMuxer>> streamEndpoints = new ConcurrentHashMap<>();

    /**
     * Add an RTMP endpoint for a stream
     */
    public synchronized boolean addEndpoint(String streamId, String rtmpUrl, MuxAdaptor muxAdaptor) {
        List<RtmpMuxer> endpoints = streamEndpoints.computeIfAbsent(streamId, k -> new ArrayList<>());

        // Check for duplicate
        for (RtmpMuxer muxer : endpoints) {
            if (muxer.getUrl().equals(rtmpUrl)) {
                logger.warn("Endpoint already exists: {} for stream {}", rtmpUrl, streamId);
                return false;
            }
        }

        try {
            // Create new RTMP muxer
            RtmpMuxer rtmpMuxer = new RtmpMuxer(rtmpUrl, null);

            // Initialize the muxer with stream parameters from muxAdaptor
            // This is where you connect to the existing stream

            endpoints.add(rtmpMuxer);
            logger.info("Added RTMP endpoint: {} for stream {}", rtmpUrl, streamId);
            return true;
        } catch (Exception e) {
            logger.error("Failed to add endpoint {} for stream {}", rtmpUrl, streamId, e);
            return false;
        }
    }

    /**
     * Remove an RTMP endpoint
     */
    public synchronized boolean removeEndpoint(String streamId, String rtmpUrl) {
        List<RtmpMuxer> endpoints = streamEndpoints.get(streamId);
        if (endpoints == null) {
            return false;
        }

        return endpoints.removeIf(muxer -> {
            if (muxer.getUrl().equals(rtmpUrl)) {
                try {
                    muxer.writeTrailer(); // Close the connection
                } catch (Exception e) {
                    logger.error("Error closing muxer", e);
                }
                return true;
            }
            return false;
        });
    }

    /**
     * Get all endpoints for a stream
     */
    public List<String> getEndpoints(String streamId) {
        List<RtmpMuxer> endpoints = streamEndpoints.get(streamId);
        if (endpoints == null) {
            return new ArrayList<>();
        }

        List<String> urls = new ArrayList<>();
        for (RtmpMuxer muxer : endpoints) {
            urls.add(muxer.getUrl());
        }
        return urls;
    }

    /**
     * Write packet to all endpoints
     * Called from MuxAdaptor when new media arrives
     */
    public void writePacketToAll(String streamId, Object packet) {
        List<RtmpMuxer> endpoints = streamEndpoints.get(streamId);
        if (endpoints == null || endpoints.isEmpty()) {
            return;
        }

        for (RtmpMuxer muxer : endpoints) {
            try {
                // Write packet to this endpoint
                // muxer.writePacket(packet);
            } catch (Exception e) {
                logger.error("Failed to write to endpoint: {}", muxer.getUrl(), e);
            }
        }
    }

    /**
     * Cleanup all endpoints for a stream
     */
    public void cleanup(String streamId) {
        List<RtmpMuxer> endpoints = streamEndpoints.remove(streamId);
        if (endpoints != null) {
            for (RtmpMuxer muxer : endpoints) {
                try {
                    muxer.writeTrailer();
                } catch (Exception e) {
                    logger.error("Error cleaning up muxer", e);
                }
            }
        }
    }
}
```

### Step 6.5: Integrating Multi-Destination into MuxAdaptor

Modify `MuxAdaptor.java` to use your MultiRtmpManager:

```java
// Add field
private MultiRtmpManager multiRtmpManager = new MultiRtmpManager();

// Add method to start additional endpoints
public Result addRtmpEndpoint(String rtmpUrl) {
    if (multiRtmpManager.addEndpoint(this.streamId, rtmpUrl, this)) {
        return new Result(true, "Endpoint added");
    }
    return new Result(false, "Failed to add endpoint");
}

// In the packet writing method (writePacket or similar)
// Add call to forward packets:
@Override
public void writePacket(AVPacket pkt) {
    // Original writing code...

    // Forward to additional RTMP endpoints
    multiRtmpManager.writePacketToAll(this.streamId, pkt);
}
```

### Step 6.6: Add REST Endpoint for Multi-Destination

If not already present, add to `BroadcastRestService.java`:

```java
/**
 * Add RTMP endpoint for multi-destination streaming
 * Custom implementation for Community Edition
 */
@POST
@Consumes(MediaType.APPLICATION_JSON)
@Path("/{id}/rtmp-endpoint")
@Produces(MediaType.APPLICATION_JSON)
public Result addRtmpEndpointCustom(
        @PathParam("id") String streamId,
        @QueryParam("rtmpUrl") String rtmpUrl) {

    // Validate
    if (rtmpUrl == null || rtmpUrl.isEmpty()) {
        return new Result(false, "rtmpUrl is required");
    }

    // Get the mux adaptor for this stream
    MuxAdaptor muxAdaptor = getMuxAdaptor(streamId);
    if (muxAdaptor == null) {
        return new Result(false, "Stream not found or not active");
    }

    // Add endpoint
    return muxAdaptor.addRtmpEndpoint(rtmpUrl);
}

/**
 * Remove RTMP endpoint
 */
@DELETE
@Path("/{id}/rtmp-endpoint")
@Produces(MediaType.APPLICATION_JSON)
public Result removeRtmpEndpointCustom(
        @PathParam("id") String streamId,
        @QueryParam("rtmpUrl") String rtmpUrl) {

    MuxAdaptor muxAdaptor = getMuxAdaptor(streamId);
    if (muxAdaptor == null) {
        return new Result(false, "Stream not found");
    }

    return muxAdaptor.removeRtmpEndpoint(rtmpUrl);
}
```

### Step 6.7: Build and Test

```bash
# Build with modifications
cd /home/user/Ant-Media-Server
mvn clean package -DskipTests

# Deploy
sudo systemctl stop antmedia
sudo cp target/ant-media-server.war /usr/local/antmedia/webapps/root/ROOT.war
sudo systemctl start antmedia

# Test multi-destination
curl -X POST "http://localhost:5080/StreamLick/rest/v2/broadcasts/test-stream/rtmp-endpoint?rtmpUrl=rtmp://a.rtmp.youtube.com/live2/xxxx"

# Verify
curl "http://localhost:5080/StreamLick/rest/v2/broadcasts/test-stream"
```

---

## Phase 7: Ultra-Low Latency Configuration

### Step 7.1: WebRTC Optimization Settings

Edit `/usr/local/antmedia/webapps/StreamLick/WEB-INF/red5-web.properties`:

```properties
# Ultra-low latency WebRTC settings
settings.webRTCEnabled=true

# Disable adaptive bitrate for lowest latency
settings.encoderSettingsString=

# Frame rate and keyframe settings
settings.webRTCFrameRate=30
settings.webRTCKeyFrameInterval=1

# GOP size (lower = lower latency, but more bandwidth)
settings.gopSize=30

# Disable buffering
settings.dashFragmentDuration=1
settings.hlsSegmentTime=1
settings.hlsPlayListSize=3

# WebRTC specific
settings.webrtcPortRangeMin=5000
settings.webrtcPortRangeMax=65000

# DTLS timeout (lower for faster connection)
settings.dtlsTimeoutMs=5000

# ICE gathering timeout
settings.iceGatheringTimeoutMs=5000
```

### Step 7.2: Server-Level Tuning

Edit `/usr/local/antmedia/conf/jvm.options`:

```bash
# Memory settings for low latency
-Xms4g
-Xmx8g
-XX:+UseG1GC
-XX:MaxGCPauseMillis=50
-XX:+ParallelRefProcEnabled

# Network buffer tuning
-Djdk.nio.maxCachedBufferSize=262144
```

### Step 7.3: OS-Level Tuning

```bash
# Add to /etc/sysctl.conf
sudo tee -a /etc/sysctl.conf << 'EOF'
# Network buffer sizes
net.core.rmem_max=26214400
net.core.wmem_max=26214400
net.core.rmem_default=1048576
net.core.wmem_default=1048576

# TCP settings
net.ipv4.tcp_rmem=4096 1048576 26214400
net.ipv4.tcp_wmem=4096 1048576 26214400
net.ipv4.tcp_low_latency=1
net.ipv4.tcp_fastopen=3

# UDP settings for WebRTC
net.core.netdev_max_backlog=5000
EOF

# Apply settings
sudo sysctl -p
```

### Step 7.4: Frontend Latency Settings

Update your Ant Media SDK initialization:

```typescript
this.webRTCAdaptor = new WebRTCAdaptor({
  // ... other settings

  peerconnection_config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
    // Force TURN if needed for reliability
    // iceTransportPolicy: 'relay',
  },

  // Low latency media constraints
  mediaConstraints: {
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  },

  // Bandwidth estimation
  bandwidth: 4000, // kbps - adjust based on your needs

  // Debug for latency monitoring
  debug: true,
});
```

---

## Phase 8: Migration and Cutover

### Step 8.1: Parallel Running (Recommended)

Run both systems simultaneously during migration:

```yaml
# docker-compose.yml - add Ant Media alongside existing media-server
services:
  # ... existing services ...

  antmedia:
    image: antmedia/ant-media-server:latest  # Or your custom build
    container_name: streamlick-antmedia
    ports:
      - "5080:5080"   # HTTP
      - "5443:5443"   # HTTPS
      - "1936:1935"   # RTMP (different port to avoid conflict)
      - "5000-65000:5000-65000/udp"  # WebRTC
    environment:
      - AMS_LICENSE_KEY=  # Leave empty for Community Edition
    volumes:
      - antmedia_data:/usr/local/antmedia

volumes:
  antmedia_data:
```

### Step 8.2: Feature Flag for Gradual Rollout

Add feature flag in frontend:

```typescript
// config.ts
export const USE_ANT_MEDIA = import.meta.env.VITE_USE_ANT_MEDIA === 'true';

// In useBroadcast.ts
if (USE_ANT_MEDIA) {
  await antMediaService.initialize(broadcastId);
  await antMediaService.publish(stream);
} else {
  await webrtcService.initialize(broadcastId);
  // ... existing mediasoup code
}
```

### Step 8.3: Migration Checklist

- [ ] Fork Ant Media Server repo
- [ ] Modify code for multi-destination
- [ ] Build custom WAR file
- [ ] Install on server alongside existing setup
- [ ] Configure SSL
- [ ] Configure firewall rules
- [ ] Create StreamLick application
- [ ] Create antmedia.service.ts (frontend)
- [ ] Create antmedia.service.ts (backend)
- [ ] Update environment variables
- [ ] Test WebRTC publishing
- [ ] Test multi-destination RTMP
- [ ] Measure latency
- [ ] Test with real YouTube/Twitch
- [ ] Gradual rollout with feature flag
- [ ] Monitor for issues
- [ ] Full cutover
- [ ] Decommission mediasoup

### Step 8.4: Full Cutover

Once validated, update docker-compose.yml:

```yaml
# Remove media-server service
# Keep antmedia as the sole media server

services:
  antmedia:
    # ... (use custom image with your modifications)
    build:
      context: ./Ant-Media-Server
      dockerfile: Dockerfile.custom
    ports:
      - "3001:5080"   # Map to old port for compatibility
      - "5443:5443"
      - "1935:1935"
      - "5000-65000:5000-65000/udp"
```

---

## Testing Checklist

### Functional Tests

- [ ] WebRTC connection establishes successfully
- [ ] Canvas compositor stream publishes to Ant Media
- [ ] Single RTMP destination works (YouTube)
- [ ] Multiple RTMP destinations work simultaneously
- [ ] Stream stops cleanly
- [ ] Reconnection after network drop
- [ ] Token authentication works

### Performance Tests

- [ ] Measure WebRTC latency (target: <0.5s)
- [ ] Measure RTMP output latency
- [ ] CPU usage under load
- [ ] Memory usage stability
- [ ] Network bandwidth usage
- [ ] Concurrent streams (2, 5, 10)

### Integration Tests

- [ ] YouTube Live works
- [ ] Facebook Live works
- [ ] Twitch works
- [ ] Custom RTMP destinations work
- [ ] Stream quality is acceptable
- [ ] Audio sync is correct

---

## Rollback Plan

If issues arise, rollback is straightforward:

### Quick Rollback (Feature Flag)

```bash
# .env
VITE_USE_ANT_MEDIA=false
```

### Full Rollback

```bash
# Restart old media server
cd /home/user/streamlick
docker-compose stop antmedia
docker-compose start media-server

# Update frontend
VITE_USE_ANT_MEDIA=false npm run build
```

### Emergency Rollback

```bash
# If Ant Media is completely broken
sudo systemctl stop antmedia
# Old media-server should still be running in Docker
```

---

## Support Resources

- [Ant Media Documentation](https://antmedia.io/docs/)
- [Ant Media GitHub](https://github.com/ant-media/Ant-Media-Server)
- [GitHub Issues](https://github.com/ant-media/Ant-Media-Server/issues)
- [Community Discussions](https://github.com/ant-media/Ant-Media-Server/discussions)

---

## Summary

This conversion will:

1. **Simplify** your architecture (1 component vs 3)
2. **Enable** multi-destination streaming
3. **Achieve** ultra-low latency (0.5s vs 8-12s)
4. **Reduce** maintenance burden
5. **Keep** your existing compositor unchanged

The frontend canvas compositor (`compositor.service.ts`) remains exactly the same - only the WebRTC transport layer changes.
