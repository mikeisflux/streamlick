# Streamlick Firewall Configuration Guide

This guide provides the required firewall rules for your Streamlick live streaming platform.

## Architecture Overview

Your setup consists of two servers:
1. **Frontend/Backend Server** - Hosts the web application and API
2. **Media Server** - Handles WebRTC media streaming and RTMP output

---

## Frontend/Backend Server Firewall Rules

### Required Inbound Ports

```bash
# HTTP (Redirect to HTTPS)
Port: 80
Protocol: TCP
Source: 0.0.0.0/0
Purpose: HTTP traffic (should redirect to HTTPS)

# HTTPS (Main website)
Port: 443
Protocol: TCP
Source: 0.0.0.0/0
Purpose: HTTPS traffic for web application

# SSH (Optional - for administration)
Port: 22
Protocol: TCP
Source: YOUR_ADMIN_IP (restrict to your IP for security)
Purpose: Server administration
```

### Internal Ports (DO NOT expose publicly)

```bash
# Backend API (proxied through nginx)
Port: 3000
Protocol: TCP
Source: localhost/127.0.0.1 only
Purpose: Backend API (accessed via nginx proxy)

# Frontend Dev Server (proxied through nginx)
Port: 3002
Protocol: TCP
Source: localhost/127.0.0.1 only
Purpose: Frontend server (accessed via nginx proxy)

# PostgreSQL Database
Port: 5432
Protocol: TCP
Source: localhost/127.0.0.1 only
Purpose: Database access

# Redis Cache
Port: 6379
Protocol: TCP
Source: localhost/127.0.0.1 only
Purpose: Session storage and pub/sub
```

### UFW Commands (Ubuntu/Debian)

```bash
# Enable firewall
sudo ufw enable

# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to internal services
sudo ufw deny 3000/tcp
sudo ufw deny 3002/tcp
sudo ufw deny 5432/tcp
sudo ufw deny 6379/tcp

# Check status
sudo ufw status verbose
```

### Firewalld Commands (CentOS/RHEL/Fedora)

```bash
# Start and enable firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld

# Allow SSH
sudo firewall-cmd --permanent --add-service=ssh

# Allow HTTP and HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Block direct access to internal services
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" port port="3000" protocol="tcp" reject'
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" port port="3002" protocol="tcp" reject'
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" port port="5432" protocol="tcp" reject'
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" port port="6379" protocol="tcp" reject'

# Reload firewall
sudo firewall-cmd --reload

# Check status
sudo firewall-cmd --list-all
```

---

## Media Server Firewall Rules

### Required Inbound Ports

```bash
# HTTP/WebSocket (Media Server)
Port: 3001
Protocol: TCP
Source: 0.0.0.0/0
Purpose: Media server HTTP API and Socket.io WebSocket connections
Note: Should be accessed via HTTPS reverse proxy (nginx) in production

# HTTPS (If using reverse proxy)
Port: 443
Protocol: TCP
Source: 0.0.0.0/0
Purpose: HTTPS traffic for media server (recommended)

# MediaSoup RTC Ports (CRITICAL FOR WEBRTC)
Ports: 40000-49999
Protocol: UDP (NOT TCP!)
Source: 0.0.0.0/0
Purpose: WebRTC media streams (audio/video data)
Note: These MUST be UDP. TCP will NOT work for WebRTC.

# SSH (Optional - for administration)
Port: 22
Protocol: TCP
Source: YOUR_ADMIN_IP (restrict to your IP for security)
Purpose: Server administration
```

### UFW Commands (Ubuntu/Debian)

```bash
# Enable firewall
sudo ufw enable

# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow 22/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Allow media server HTTP/WebSocket
sudo ufw allow 3001/tcp

# CRITICAL: Allow mediasoup RTC ports (UDP only)
sudo ufw allow 40000:49999/udp

# Check status
sudo ufw status verbose
```

### Firewalld Commands (CentOS/RHEL/Fedora)

```bash
# Start and enable firewalld
sudo systemctl start firewalld
sudo systemctl enable firewalld

# Allow SSH
sudo firewall-cmd --permanent --add-service=ssh

# Allow HTTPS
sudo firewall-cmd --permanent --add-service=https

# Allow media server HTTP/WebSocket
sudo firewall-cmd --permanent --add-port=3001/tcp

# CRITICAL: Allow mediasoup RTC ports (UDP only)
sudo firewall-cmd --permanent --add-port=40000-49999/udp

# Reload firewall
sudo firewall-cmd --reload

# Check status
sudo firewall-cmd --list-all
```

---

## Production Nginx Reverse Proxy Setup

### Frontend Server (streamlick.com)

```nginx
server {
    listen 80;
    server_name streamlick.com www.streamlick.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name streamlick.com www.streamlick.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    # Frontend static files
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend WebSocket
    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

### Media Server (media.streamlick.com)

```nginx
server {
    listen 80;
    server_name media.streamlick.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name media.streamlick.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    # Media server HTTP API
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Media server WebSocket (Socket.io)
    location /socket.io {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

---

## Security Considerations

### 1. SSL/TLS Certificates
- Use Let's Encrypt for free SSL certificates
- Install certbot: `sudo apt install certbot python3-certbot-nginx`
- Get certificate: `sudo certbot --nginx -d streamlick.com -d www.streamlick.com`

### 2. Rate Limiting
Add to nginx config to prevent abuse:
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=websocket_limit:10m rate=5r/s;

location /api {
    limit_req zone=api_limit burst=20 nodelay;
    # ... rest of config
}

location /socket.io {
    limit_req zone=websocket_limit burst=10 nodelay;
    # ... rest of config
}
```

### 3. Fail2Ban (Optional but recommended)
Protect against brute force attacks:
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4. Cloud Provider Security Groups
If using AWS, GCP, or Azure, also configure security groups:

**Frontend/Backend Server:**
- Inbound: 22 (SSH), 80 (HTTP), 443 (HTTPS)
- Outbound: All

**Media Server:**
- Inbound: 22 (SSH), 443 (HTTPS), 3001 (TCP), 40000-49999 (UDP)
- Outbound: All

---

## Testing Your Firewall Configuration

### Test Media Server WebSocket Connection

```bash
# From your local machine
curl -v https://media.streamlick.com/socket.io/?EIO=4&transport=polling
```

Expected: HTTP 200 response

### Test RTC Port Range (UDP)

```bash
# Install netcat UDP
sudo apt install netcat-openbsd

# On media server (listen)
nc -ul 40000

# From another machine (send)
echo "test" | nc -u media.streamlick.com 40000
```

If UDP is working, you should see "test" on the media server.

### Test Frontend WebSocket

```bash
curl -v https://streamlick.com/socket.io/?EIO=4&transport=polling
```

Expected: HTTP 200 response

---

## Troubleshooting

### WebRTC Connection Fails
**Symptom:** "Media server connection timeout after 10 seconds"

**Solution:**
1. Verify UDP ports 40000-49999 are open: `sudo ufw status | grep 40000`
2. Check MEDIASOUP_ANNOUNCED_IP is set to public IP (not localhost)
3. Verify no cloud firewall blocking UDP
4. Test with: `nc -ul 40000` and send packet from remote

### WebSocket Connection Fails
**Symptom:** "WebSocket is closed before the connection is established"

**Solution:**
1. Verify port 3001 is open: `sudo ufw status | grep 3001`
2. Check nginx proxy settings for /socket.io path
3. Verify Upgrade and Connection headers in nginx config
4. Check CORS settings in media server

### Cannot Access Website
**Symptom:** Connection timeout to streamlick.com

**Solution:**
1. Verify ports 80 and 443 are open: `sudo ufw status`
2. Check nginx is running: `sudo systemctl status nginx`
3. Check DNS is pointing to correct IP: `dig streamlick.com`
4. Verify SSL certificates: `sudo certbot certificates`

---

## Environment Variables Checklist

### Media Server (.env)
```bash
MEDIA_SERVER_PORT=3001
FRONTEND_URL=https://streamlick.com
MEDIASOUP_ANNOUNCED_IP=YOUR_PUBLIC_IP  # NOT localhost!
MEDIASOUP_WORKERS=2
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=49999
REDIS_URL=redis://localhost:6379
NODE_ENV=production
```

### Frontend (.env)
```bash
VITE_API_URL=https://streamlick.com/api
VITE_MEDIA_SERVER_URL=https://media.streamlick.com
```

### Backend (.env)
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/streamlick_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
PORT=3000
NODE_ENV=production
```

---

## Quick Setup Script

```bash
#!/bin/bash
# run-on-media-server.sh

# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Allow media server
sudo ufw allow 3001/tcp

# CRITICAL: Allow RTC ports
sudo ufw allow 40000:49999/udp

# Check status
sudo ufw status verbose

echo "Media server firewall configured!"
echo "Don't forget to set MEDIASOUP_ANNOUNCED_IP in .env"
```

```bash
#!/bin/bash
# run-on-frontend-server.sh

# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to internal services
sudo ufw deny 3000/tcp
sudo ufw deny 3002/tcp
sudo ufw deny 5432/tcp
sudo ufw deny 6379/tcp

# Check status
sudo ufw status verbose

echo "Frontend/Backend server firewall configured!"
```

---

## Summary

**Media Server requires:**
- TCP 443 (HTTPS)
- TCP 3001 (Media server WebSocket)
- UDP 40000-49999 (WebRTC media - CRITICAL!)

**Frontend/Backend Server requires:**
- TCP 80 (HTTP redirect)
- TCP 443 (HTTPS)
- Internal only: 3000 (Backend), 3002 (Frontend), 5432 (DB), 6379 (Redis)

**Most common issue:** Forgetting to open UDP ports 40000-49999 on media server!
