# StreamLick - Native Ubuntu Deployment Guide

 

Deploy Ant Media Server natively on Ubuntu using systemd (recommended for production).

 

## Domain Configuration

- **Media Server**: `media.streamlick.com`

- **Backend API**: `api.streamlick.com` (your Node.js backend - can use pm2)

 

---

 

## Prerequisites

 

### System Requirements

- Ubuntu 20.04 LTS or 22.04 LTS

- 4+ CPU cores (8+ recommended)

- 8GB RAM minimum (16GB for transcoding)

- 50GB+ SSD storage

- 100Mbps+ upload bandwidth

 

### Required Ports

| Port | Protocol | Service |

|------|----------|---------|

| 5080 | TCP | HTTP API/Dashboard |

| 5443 | TCP | HTTPS/SSL |

| 1935 | TCP | RTMP |

| 8443 | TCP | WebSocket |

| 5000-65000 | UDP | WebRTC Media |

 

---

 

## Step 1: System Preparation

 

```bash

# Update system

sudo apt update && sudo apt upgrade -y

 

# Install Java 17

sudo apt install -y openjdk-17-jdk

 

# Verify Java installation

java -version

 

# Install build tools

sudo apt install -y maven git curl wget unzip

 

# Install media libraries (for transcoding)

sudo apt install -y libva-drm2 libva2 libvdpau1

 

# Create antmedia user

sudo useradd -r -m -s /bin/bash antmedia

 

# Create installation directory

sudo mkdir -p /usr/local/antmedia

sudo chown antmedia:antmedia /usr/local/antmedia

```

 

---

 

## Step 2: Build Ant Media Server

 

```bash

# Clone the repository (as your user)

cd /opt

sudo git clone https://github.com/mikeisflux/Anthill.git antmedia-source

cd antmedia-source

 

# Build with Maven

sudo mvn clean package -DskipTests -Dmaven.javadoc.skip=true

 

# Copy built files to installation directory

sudo cp -r src/main/server/* /usr/local/antmedia/

sudo cp target/*.war /usr/local/antmedia/webapps/ 2>/dev/null || true

 

# Copy StreamLick application

sudo cp -r src/main/server/webapps/StreamLick /usr/local/antmedia/webapps/

 

# Set permissions

sudo chown -R antmedia:antmedia /usr/local/antmedia

sudo chmod +x /usr/local/antmedia/*.sh

```

 

---

 

## Step 3: Configure Systemd Service

 

```bash

# Create systemd service file

sudo tee /etc/systemd/system/antmedia.service > /dev/null << 'EOF'

[Unit]

Description=Ant Media Server - StreamLick

Documentation=https://antmedia.io/docs

After=network.target

 

[Service]

Type=simple

User=antmedia

Group=antmedia

WorkingDirectory=/usr/local/antmedia

 

# Environment

Environment="JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64"

Environment="ANT_MEDIA_HOME=/usr/local/antmedia"

Environment="SERVER_NAME=media.streamlick.com"

 

# JVM Options (load from file or inline)

EnvironmentFile=-/usr/local/antmedia/conf/antmedia.env

 

# Start command

ExecStart=/usr/local/antmedia/start.sh

ExecStop=/usr/local/antmedia/shutdown.sh

 

# Restart policy

Restart=on-failure

RestartSec=10

 

# Limits

LimitNOFILE=65535

LimitNPROC=65535

 

# Security

NoNewPrivileges=true

PrivateTmp=true

 

[Install]

WantedBy=multi-user.target

EOF

 

# Create environment file

sudo tee /usr/local/antmedia/conf/antmedia.env > /dev/null << 'EOF'

JAVA_OPTS=-Xms4g -Xmx8g -XX:+UseG1GC -XX:MaxGCPauseMillis=50 -Djava.net.preferIPv4Stack=true

SERVER_NAME=media.streamlick.com

EOF

 

# Reload systemd

sudo systemctl daemon-reload

 

# Enable service to start on boot

sudo systemctl enable antmedia

```

 

---

 

## Step 4: Configure Firewall

 

```bash

# Using UFW (Ubuntu Firewall)

sudo ufw allow 5080/tcp comment "Ant Media HTTP"

sudo ufw allow 5443/tcp comment "Ant Media HTTPS"

sudo ufw allow 1935/tcp comment "Ant Media RTMP"

sudo ufw allow 8443/tcp comment "Ant Media WebSocket"

sudo ufw allow 5000:65000/udp comment "Ant Media WebRTC"

 

# Enable firewall (if not already)

sudo ufw enable

 

# Verify rules

sudo ufw status verbose

```

 

---

 

## Step 5: Apply System Tuning

 

```bash

# Copy sysctl configuration

sudo cp /opt/antmedia-source/src/main/server/conf/sysctl-streaming.conf /etc/sysctl.d/99-antmedia-streaming.conf

 

# Apply sysctl settings

sudo sysctl -p /etc/sysctl.d/99-antmedia-streaming.conf

 

# Increase file descriptor limits

sudo tee -a /etc/security/limits.conf > /dev/null << 'EOF'

antmedia soft nofile 65535

antmedia hard nofile 65535

antmedia soft nproc 65535

antmedia hard nproc 65535

EOF

```

 

---

 

## Step 6: Configure SSL (Let's Encrypt)

 

```bash

# Install Certbot

sudo apt install -y certbot

 

# Get certificate for media.streamlick.com

sudo certbot certonly --standalone -d media.streamlick.com

 

# Link certificates to Ant Media

sudo mkdir -p /usr/local/antmedia/certs

sudo ln -sf /etc/letsencrypt/live/media.streamlick.com/fullchain.pem /usr/local/antmedia/certs/fullchain.pem

sudo ln -sf /etc/letsencrypt/live/media.streamlick.com/privkey.pem /usr/local/antmedia/certs/privkey.pem

 

# Or use the built-in SSL script

sudo /usr/local/antmedia/enable_ssl.sh -d media.streamlick.com

```

 

---

 

## Step 7: Start Ant Media Server

 

```bash

# Start the service

sudo systemctl start antmedia

 

# Check status

sudo systemctl status antmedia

 

# View logs

sudo journalctl -u antmedia -f

 

# Or check application logs

tail -f /usr/local/antmedia/log/ant-media-server.log

```

 

---

 

## Step 8: Verify Installation

 

```bash

# Check if server is responding

curl http://localhost:5080/StreamLick/rest/v2/version

 

# Check WebRTC ports

sudo ss -tulpn | grep java

 

# Test from external

curl https://media.streamlick.com/StreamLick/rest/v2/version

```

 

---

 

## Service Management Commands

 

```bash

# Start server

sudo systemctl start antmedia

 

# Stop server

sudo systemctl stop antmedia

 

# Restart server

sudo systemctl restart antmedia

 

# Check status

sudo systemctl status antmedia

 

# View logs

sudo journalctl -u antmedia -f

 

# Enable auto-start on boot

sudo systemctl enable antmedia

 

# Disable auto-start

sudo systemctl disable antmedia

```

 

---

 

## Integration with Backend (api.streamlick.com)

 

Your Node.js backend at `api.streamlick.com` can use **pm2** for process management:

 

```bash

# On your API server

cd /opt/streamlick-api

 

# Install pm2 globally

npm install -g pm2

 

# Start your Node.js backend

pm2 start server.js --name streamlick-api

 

# Configure pm2 startup

pm2 startup

pm2 save

 

# View logs

pm2 logs streamlick-api

```

 

### Backend Communication with Ant Media

 

Configure your backend to communicate with Ant Media at `media.streamlick.com`:

 

```javascript

// api.streamlick.com backend configuration

const ANT_MEDIA_CONFIG = {

  baseUrl: 'https://media.streamlick.com',

  appName: 'StreamLick',

  restPath: '/StreamLick/rest/v2',

};

 

// Example: Create a broadcast

async function createBroadcast(name) {

  const response = await fetch(`${ANT_MEDIA_CONFIG.baseUrl}${ANT_MEDIA_CONFIG.restPath}/broadcasts`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({ name }),

  });

  return response.json();

}

```

 

---

 

## Monitoring

 

### Check Server Health

```bash

# Server status

curl https://media.streamlick.com/StreamLick/rest/v2/version

 

# List broadcasts

curl https://media.streamlick.com/StreamLick/rest/v2/broadcasts/list/0/10

 

# Server statistics

curl https://media.streamlick.com/StreamLick/rest/v2/server-settings

```

 

### Resource Monitoring

```bash

# CPU and Memory

htop

 

# Disk usage

df -h /usr/local/antmedia

 

# Network connections

ss -tulpn | grep -E '5080|5443|1935|8443'

 

# Process info

ps aux | grep antmedia

```

 

---

 

## Log Locations

 

| Log | Path |

|-----|------|

| Application log | `/usr/local/antmedia/log/ant-media-server.log` |

| Access log | `/usr/local/antmedia/log/access.log` |

| Error log | `/usr/local/antmedia/log/error.log` |

| Systemd journal | `journalctl -u antmedia` |

 

---

 

## Updating Ant Media

 

```bash

# Stop service

sudo systemctl stop antmedia

 

# Backup current installation

sudo cp -r /usr/local/antmedia /usr/local/antmedia.backup

 

# Pull latest code

cd /opt/antmedia-source

sudo git pull

 

# Rebuild

sudo mvn clean package -DskipTests

 

# Deploy new build

sudo cp target/*.war /usr/local/antmedia/webapps/

 

# Restart service

sudo systemctl start antmedia

```

 

---

 

## Troubleshooting

 

### Server won't start

```bash

# Check Java

java -version

 

# Check ports in use

sudo ss -tulpn | grep -E '5080|5443'

 

# Check logs

sudo journalctl -u antmedia --no-pager -n 100

```

 

### WebRTC not connecting

```bash

# Check UDP ports

sudo ss -tulpn | grep udp

 

# Check firewall

sudo ufw status

 

# Test STUN

curl stun.l.google.com:19302

```

 

### High memory usage

```bash

# Check heap usage

jstat -gc $(pgrep -f antmedia) 1000

 

# Adjust JVM memory in /usr/local/antmedia/conf/antmedia.env

JAVA_OPTS=-Xms2g -Xmx4g ...

```

 

---

 

## Architecture Overview

 

```

                    ┌─────────────────────────────────────────────┐

                    │           Ubuntu Server                      │

                    │                                              │

 Users              │  ┌──────────────────────────────────────┐   │

   │                │  │    Ant Media Server (systemd)         │   │

   │ WebRTC         │  │    media.streamlick.com               │   │

   ▼                │  │    Port: 5080, 5443, 1935, 5000-65000│   │

┌──────┐           │  └──────────────────────────────────────┘   │

│Browser├──────────┼──►                  │                        │

└──────┘           │                     │ webhooks               │

                    │                     ▼                        │

                    │  ┌──────────────────────────────────────┐   │

                    │  │    Node.js Backend (pm2)              │   │

                    │  │    api.streamlick.com                 │   │

                    │  │    Port: 3000                         │   │

                    │  └──────────────────────────────────────┘   │

                    │                     │                        │

                    │                     ▼                        │

                    │             YouTube / Twitch / Facebook      │

                    └─────────────────────────────────────────────┘

```
