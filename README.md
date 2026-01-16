# Streamlick

Professional live streaming studio - a StreamYard competitor.

## Features

- **Multi-guest shows**: Invite up to 10 guests with a simple link
- **Multistream**: Stream to YouTube, Twitch, Facebook, and custom RTMP
- **Custom branding**: Logos, backgrounds, lower thirds, and overlays
- **Live preview**: See what viewers see in real-time
- **Flexible layouts**: Grid, spotlight, side-by-side, picture-in-picture

## Architecture

```
Participants (Host + Guests)
         ↓
    Ant Media SFU (Individual Streams)
         ↓
    Server Composite HTML
         ↓
    +----+----+
    ↓         ↓
RTMP Out   Live Preview
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL
- Ant Media Server

### Installation

```bash
# Clone the repo
git clone https://github.com/mikeisflux/streamlick.git
cd streamlick

# Install dependencies
npm install

# Setup environment
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Configure your environment variables in the .env files

# Setup database
npm run db:push

# Start development
npm run dev
```

### Environment Variables

See `.env.example` files for required configuration:
- Database connection
- JWT secret
- Ant Media Server URLs
- TURN server credentials
- Platform OAuth credentials (optional)

## Development

```bash
# Run backend only
npm run dev:backend

# Run frontend only
npm run dev:frontend

# Generate Prisma client
npm run db:generate

# View database
npm run db:studio
```

## License

Private - All rights reserved.
