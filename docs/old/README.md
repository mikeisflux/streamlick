# 🎥 Streamlick

**Enterprise-grade multi-platform live streaming solution**

Streamlick is a comprehensive live streaming platform that enables simultaneous broadcasting to YouTube, Twitch, Facebook, LinkedIn, and Twitter/X from a single interface. Built with modern web technologies, it offers professional-grade features for content creators, businesses, and organizations.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)

---

## ✨ Features

### 🎯 Core Features

- **Multi-Platform Streaming**: Stream to YouTube, Twitch, Facebook, LinkedIn, and Twitter/X simultaneously
- **Professional Studio**: Advanced broadcasting interface with scenes, overlays, and real-time controls
- **WebRTC Infrastructure**: Low-latency video/audio streaming powered by Mediasoup
- **Guest Participants**: Invite guests to join your broadcast with approval workflow
- **Screen Sharing**: Share your screen alongside camera feed with system audio support
- **Live Chat Aggregation**: Unified chat from all connected platforms with moderation tools
- **Recording & VOD**: Auto-record broadcasts and generate video-on-demand content
- **Analytics Dashboard**: Comprehensive metrics including viewership, engagement, and platform performance

### 🛠️ Advanced Features

- **Adaptive Bitrate Streaming**: Automatic quality adjustment based on network conditions (9 quality profiles)
- **Chat Moderation**: Cross-platform bans, timeouts, and moderation actions with API integration
- **Scene Management**: Create and switch between multiple scenes with drag-and-drop layouts
- **Virtual Backgrounds**: Apply backgrounds and effects to your video feed
- **Platform Logos**: Customizable overlays for branding and platform indicators
- **Viewer Count Display**: Real-time aggregated viewer statistics across all platforms
- **Stream Health Monitoring**: Real-time metrics for bitrate, packet loss, framerate, and connection quality
- **Usage Analytics**: Track streaming time, viewership trends, and platform distribution
- **Subscription Management**: Integrated billing and subscription tiers with Stripe
- **RESTful API**: Complete API for integrations and automation
- **Webhook Support**: Real-time notifications for broadcast events

### 🔒 Security & Authentication

- **OAuth 2.0**: Secure authentication with all major platforms
- **JWT Tokens**: Stateless authentication with refresh token rotation
- **RBAC**: Role-based access control (Admin, User, Guest)
- **End-to-End Encryption**: Secure WebRTC connections with DTLS/SRTP
- **Rate Limiting**: Protection against abuse and DDoS attacks
- **CORS Protection**: Configurable cross-origin resource sharing

### 📊 Technical Highlights

- **Optimized Encoding**: FFmpeg with dynamic GOP, CBR simulation, and H.264 Main profile
- **High Performance**: Handles 1080p @ 60fps with 8 Mbps bitrate
- **Scalable Architecture**: Horizontal scaling with Redis clustering
- **Cloud-Ready**: Docker containerization with Kubernetes support
- **Real-time Communication**: Socket.IO for instant updates and messaging
- **Database**: PostgreSQL with Prisma ORM for type-safe queries
- **Caching Layer**: Redis for sessions, rate limiting, and real-time data

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Studio UI  │  │  Dashboard   │  │  Analytics       │   │
│  └────────────┘  └──────────────┘  └──────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/WebSocket
┌────────────────────────┴────────────────────────────────────┐
│                    Backend (Express.js)                      │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  REST API  │  │  Socket.IO   │  │  Auth & OAuth    │   │
│  └────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Platform  │  │  Moderation  │  │  Analytics       │   │
│  │  APIs      │  │  Service     │  │  Service         │   │
│  └────────────┘  └──────────────┘  └──────────────────┘   │
└────────────┬───────────────────┬───────────────────────────┘
             │                   │
    ┌────────┴────────┐   ┌──────┴──────┐
    │   PostgreSQL    │   │    Redis    │
    │   (Prisma)      │   │   (Cache)   │
    └─────────────────┘   └─────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Media Server (Mediasoup)                    │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  WebRTC    │  │  RTMP        │  │  Adaptive        │   │
│  │  Routing   │  │  Ingestion   │  │  Bitrate         │   │
│  └────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  FFmpeg    │  │  Recording   │  │  Stream Health   │   │
│  │  Encoding  │  │  Service     │  │  Monitor         │   │
│  └────────────┘  └──────────────┘  └──────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ RTMP/RTMPS
┌────────────────────────┴────────────────────────────────────┐
│              Streaming Platforms                             │
│   YouTube  │  Twitch  │  Facebook  │  LinkedIn  │  Twitter  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20.x or higher
- **PostgreSQL** 16.x or higher
- **Redis** 7.x or higher
- **FFmpeg** 6.x or higher
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/streamlick.git
cd streamlick

# Install dependencies
npm install

# Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit backend/.env with your database credentials
# Edit frontend/.env with API URLs

# Setup database
cd backend
npx prisma migrate dev
npx prisma db seed

# Start development servers
cd ..
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Media Server**: http://localhost:3001
- **Prisma Studio**: http://localhost:5555 (run `npx prisma studio`)

### Default Credentials

```
Admin: admin@streamlick.com / admin123
Test User: test@streamlick.com / test123
```

---

## 📚 Documentation

Comprehensive guides for setup, configuration, and deployment:

### Getting Started
- **[Setup Guide](docs/SETUP.md)** - Complete setup instructions for local development
- **[Configuration Guide](docs/CONFIGURATION.md)** - All environment variables and settings
- **[API Documentation](docs/API.md)** - REST API endpoints and usage

### Deployment
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment on VPS, cloud, and containers
- **[Docker Setup](docs/DOCKER.md)** - Containerized deployment with Docker Compose
- **[Kubernetes](docs/KUBERNETES.md)** - Kubernetes manifests and Helm charts

### Platform Integration
- **[YouTube Setup](docs/platforms/YOUTUBE.md)** - YouTube Live API integration
- **[Twitch Setup](docs/platforms/TWITCH.md)** - Twitch streaming integration
- **[Facebook Setup](docs/platforms/FACEBOOK.md)** - Facebook Live integration
- **[LinkedIn Setup](docs/platforms/LINKEDIN.md)** - LinkedIn Live integration
- **[Twitter Setup](docs/platforms/TWITTER.md)** - Twitter/X Spaces integration

### Development
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to Streamlick
- **[Architecture](docs/ARCHITECTURE.md)** - System design and technical decisions
- **[Development Workflow](docs/DEVELOPMENT.md)** - Local development best practices
- **[Testing Guide](docs/TESTING.md)** - Running and writing tests

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Socket.IO Client** - Real-time communication
- **React Router** - Client-side routing
- **Zustand** - State management
- **React Query** - Server state management

### Backend
- **Node.js 20** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Prisma** - ORM and database toolkit
- **PostgreSQL** - Primary database
- **Redis** - Caching and session store
- **Socket.IO** - WebSocket server
- **Passport.js** - Authentication middleware
- **Zod** - Schema validation

### Media Infrastructure
- **Mediasoup** - WebRTC SFU (Selective Forwarding Unit)
- **FFmpeg** - Video/audio processing and encoding
- **RTMP Server** - Live stream ingestion
- **Adaptive Bitrate** - Dynamic quality adjustment

### DevOps & Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Reverse proxy and load balancer
- **PM2** - Process manager
- **GitHub Actions** - CI/CD pipeline
- **Sentry** - Error tracking and monitoring

---

## 📦 Project Structure

```
streamlick/
├── backend/                  # Express.js API server
│   ├── src/
│   │   ├── api/             # REST API routes
│   │   │   ├── auth.routes.ts
│   │   │   ├── broadcast.routes.ts
│   │   │   ├── analytics.routes.ts
│   │   │   └── moderation.routes.ts
│   │   ├── services/        # Business logic
│   │   │   ├── auth.service.ts
│   │   │   ├── chat-moderation.service.ts
│   │   │   ├── analytics.service.ts
│   │   │   └── stream-health.service.ts
│   │   ├── socket/          # Socket.IO handlers
│   │   │   └── index.ts
│   │   ├── middleware/      # Express middleware
│   │   ├── utils/           # Helper functions
│   │   └── index.ts         # Entry point
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   ├── migrations/      # DB migrations
│   │   └── seed.ts          # Seed data
│   └── package.json
│
├── frontend/                # React application
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   │   ├── ChatModeration.tsx
│   │   │   ├── ScreenShareManager.tsx
│   │   │   └── StudioControls.tsx
│   │   ├── pages/           # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── StudioEnhanced.tsx
│   │   │   └── Analytics.tsx
│   │   ├── services/        # API clients
│   │   │   ├── api.service.ts
│   │   │   ├── socket.service.ts
│   │   │   └── webrtc.service.ts
│   │   ├── hooks/           # Custom React hooks
│   │   ├── utils/           # Helper functions
│   │   ├── App.tsx          # Root component
│   │   └── main.tsx         # Entry point
│   └── package.json
│
├── media-server/            # Mediasoup WebRTC server
│   ├── src/
│   │   ├── rtmp/           # RTMP streaming
│   │   │   └── streamer.ts
│   │   ├── services/       # Media services
│   │   │   ├── adaptive-bitrate.service.ts
│   │   │   └── recording.service.ts
│   │   ├── config/         # Configuration
│   │   │   └── mediasoup.ts
│   │   └── index.ts        # Entry point
│   └── package.json
│
├── docs/                   # Documentation
│   ├── SETUP.md
│   ├── CONFIGURATION.md
│   ├── DEPLOYMENT.md
│   └── API.md
│
├── docker-compose.yml      # Docker orchestration
├── Dockerfile              # Backend container
├── Dockerfile.frontend     # Frontend container
├── Dockerfile.media        # Media server container
├── .env.example            # Environment template
└── package.json            # Root package.json
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
cd frontend
npm run test:e2e

# Test coverage
npm run test:coverage
```

---

## 🚢 Deployment

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d --build

# Run migrations
docker-compose exec backend npx prisma migrate deploy

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Deployment

See the [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions on:
- VPS deployment (DigitalOcean, AWS EC2, Linode)
- Cloud deployment (Heroku, Google Cloud, AWS)
- Kubernetes deployment
- SSL/HTTPS setup
- Domain configuration
- Monitoring and logging

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Code of conduct
- Development setup
- Coding standards
- Commit message format
- Pull request process

### Quick Contribution Guide

```bash
# Fork the repository
# Clone your fork
git clone https://github.com/yourusername/streamlick.git

# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes
# Commit with conventional commits
git commit -m "feat: add amazing feature"

# Push to your fork
git push origin feature/amazing-feature

# Open a Pull Request
```

---

## 📊 Performance

### Benchmarks

- **Concurrent Broadcasts**: 100+ simultaneous streams
- **Viewers per Broadcast**: 1000+ concurrent viewers
- **Latency**: <500ms glass-to-glass (WebRTC)
- **Encoding**: Real-time 1080p@60fps on 4-core CPU
- **Database Queries**: <50ms average response time
- **API Response Time**: <100ms (p95)

### Optimizations

- **FFmpeg**: Dynamic GOP, CBR, H.264 Main profile
- **WebRTC**: 8 Mbps initial bitrate, adaptive quality
- **Adaptive Bitrate**: 9 quality profiles (360p - 4K)
- **Database**: Connection pooling, optimized indexes
- **Caching**: Redis for sessions and hot data
- **CDN Ready**: Static assets and recordings

---

## 🔐 Security

- **Authentication**: JWT with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: HTTPS/TLS for all connections
- **WebRTC Security**: DTLS/SRTP encryption
- **Input Validation**: Zod schema validation
- **SQL Injection**: Parameterized queries via Prisma
- **XSS Protection**: Content Security Policy headers
- **CSRF Protection**: Token-based protection
- **Rate Limiting**: Per-IP and per-user limits
- **Password Hashing**: Bcrypt with 10 rounds

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Streamlick

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- [Mediasoup](https://mediasoup.org/) - WebRTC SFU
- [FFmpeg](https://ffmpeg.org/) - Video processing
- [Prisma](https://www.prisma.io/) - Database ORM
- [Socket.IO](https://socket.io/) - Real-time communication
- [React](https://reactjs.org/) - UI framework
- All our [contributors](https://github.com/yourusername/streamlick/graphs/contributors)

---

## 📞 Support

- **Documentation**: https://docs.streamlick.com
- **Discord Community**: https://discord.gg/streamlick
- **GitHub Issues**: https://github.com/yourusername/streamlick/issues
- **Email**: support@streamlick.com
- **Twitter**: [@streamlick](https://twitter.com/streamlick)

---

## 🗺️ Roadmap

### Version 1.1 (Q1 2025)
- [ ] Mobile apps (iOS, Android)
- [ ] Advanced virtual backgrounds
- [ ] AI-powered auto-captioning
- [ ] Multi-language support
- [ ] Custom RTMP destinations

### Version 1.2 (Q2 2025)
- [ ] Live stream scheduling
- [ ] Automated highlights generation
- [ ] Advanced analytics and AI insights
- [ ] Team collaboration features
- [ ] White-label options

### Version 2.0 (Q3 2025)
- [ ] NDI support
- [ ] Hardware encoder support
- [ ] Multi-camera switching
- [ ] Professional mixer interface
- [ ] Enterprise SSO integration

---

## ⭐ Star History

If you find Streamlick useful, please consider giving it a star! ⭐

---

<div align="center">

**Built with ❤️ by the Streamlick Team**

[Website](https://streamlick.com) • [Documentation](https://docs.streamlick.com) • [Discord](https://discord.gg/streamlick) • [Twitter](https://twitter.com/streamlick)

</div>
