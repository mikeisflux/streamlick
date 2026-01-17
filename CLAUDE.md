# Streamlick v2.0 - StreamYard Competitor

## IMPORTANT: Architecture Constraints

### NO CLIENT-SIDE CANVAS RENDERING

**The frontend MUST NOT perform any canvas compositing.** All video compositing happens on the server-side headless browser at `media-server/webapps/LiveApp/streamlick_composite.html`.

The Studio/Dashboard is a **CONTROL PANEL** that:
- Sends commands to the server compositor (layout, background, overlays)
- Receives the pre-composed video stream from Ant Media and displays it
- Does NOT render or composite any video locally

If you find any client-side canvas rendering code in the frontend, **remove it immediately**.

## Architecture Overview

```
Participants (Host + Guests)
         ↓
    Ant Media SFU (Individual Streams)
         ↓
    Server Composite HTML (composites all streams)
         ↓
    +----+----+
    ↓         ↓
RTMP Out   All clients subscribe for "LIVE" preview
```

## Project Structure

```
streamlick/
├── backend/                 # Node.js/Express backend
│   ├── prisma/              # Database schema
│   │   └── schema.prisma    # Prisma schema (PostgreSQL)
│   └── src/
│       ├── api/             # REST API routes
│       ├── middleware/      # Express middleware
│       ├── services/        # Business logic services
│       ├── socket/          # Socket.io handlers
│       ├── types/           # TypeScript types
│       └── index.ts         # Server entry point
│
├── frontend/                # React/Vite frontend
│   └── src/
│       ├── components/      # Reusable components
│       ├── hooks/           # Custom React hooks
│       ├── pages/           # Page components
│       ├── services/        # API & WebRTC services
│       ├── store/           # Zustand state stores
│       ├── types/           # TypeScript types
│       └── App.tsx          # Main app component
│
├── compositor/              # Server-side HTML compositor
│   └── index.html           # Compositor HTML page
│
├── promo-website/           # Marketing landing page
│
└── streamlick-backup/       # Old codebase backup (DO NOT USE)
```

## Key Technologies

- **Backend**: Node.js, Express, Socket.io, Prisma, PostgreSQL
- **Frontend**: React, TypeScript, Vite, TailwindCSS, Zustand
- **Media**: Ant Media Server (WebRTC SFU)
- **Streaming**: RTMP output to YouTube/Twitch/Facebook/Custom

## Database Schema

- **User**: Hosts/admins
- **Broadcast**: Live streaming sessions
- **Participant**: Host + guests in a broadcast
- **Destination**: RTMP output targets
- **BroadcastOutput**: Active stream to a destination
- **Recording**: Recorded broadcasts

## Development Commands

```bash
# Install dependencies
npm install

# Run database migrations
npm run db:push

# Start development servers
npm run dev

# Build for production
npm run build
```

## Environment Variables

See `.env.example` files in root, backend, and frontend directories.

## Key Workflows

### Creating a Broadcast
1. Host creates broadcast via Dashboard
2. Host enters Studio
3. Host invites guests with invite links
4. Guests join via GuestJoin page
5. Host adds guests to stage
6. Host selects layout and branding
7. Host clicks "Go Live" to start streaming

### Guest Flow
1. Guest receives invite link
2. Guest enters name in lobby
3. Guest enters greenroom
4. Guest enables camera/mic
5. Host brings guest on stage
6. Guest can see live preview of broadcast

### WebRTC Flow
1. Participant publishes stream to Ant Media SFU
2. Compositor subscribes to all on-stage streams
3. Compositor composites streams into single output
4. Output is sent to RTMP destinations
5. Preview stream is published back to Ant Media
6. All participants can subscribe to preview
