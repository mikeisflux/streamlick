#!/bin/bash
# Setup nginx for media.streamlick.com on streamlick-media-1

echo "========================================="
echo "NGINX SETUP FOR MEDIA SERVER"
echo "========================================="
echo ""

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "Installing nginx..."
    apt update
    apt install -y nginx
    echo "✅ Nginx installed"
else
    echo "✅ Nginx already installed"
fi
echo ""

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    apt install -y certbot python3-certbot-nginx
    echo "✅ Certbot installed"
else
    echo "✅ Certbot already installed"
fi
echo ""

# Create nginx config for media.streamlick.com
echo "Creating nginx configuration..."
cat > /etc/nginx/sites-available/media-streamlick << 'EOF'
# Media Server - HTTP (will be upgraded to HTTPS by certbot)
server {
    listen 80;
    server_name media.streamlick.com;

    # Increase timeouts for long-running WebSocket connections
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
    proxy_connect_timeout 86400;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;

        # WebSocket support (CRITICAL for media server)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }
}
EOF

echo "✅ Nginx config created"
echo ""

# Enable the site
echo "Enabling site..."
ln -sf /etc/nginx/sites-available/media-streamlick /etc/nginx/sites-enabled/
echo "✅ Site enabled"
echo ""

# Remove default site if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    echo "Removing default site..."
    rm /etc/nginx/sites-enabled/default
    echo "✅ Default site removed"
fi
echo ""

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t
if [ $? -eq 0 ]; then
    echo "✅ Nginx config valid"
else
    echo "❌ Nginx config invalid - fix errors above"
    exit 1
fi
echo ""

# Reload nginx
echo "Reloading nginx..."
systemctl reload nginx
systemctl status nginx --no-pager -l
echo "✅ Nginx reloaded"
echo ""

# Get SSL certificate
echo "========================================="
echo "SSL CERTIFICATE SETUP"
echo "========================================="
echo ""
echo "Run this command to get SSL certificate:"
echo ""
echo "sudo certbot --nginx -d media.streamlick.com --non-interactive --agree-tos --email admin@streamlick.com --redirect"
echo ""
echo "Or if you already have a certificate:"
echo "sudo certbot --nginx -d media.streamlick.com"
echo ""
echo "========================================="
echo "SETUP COMPLETE"
echo "========================================="
echo ""
echo "Test the endpoints:"
echo "  HTTP:  curl -I http://media.streamlick.com/health"
echo "  HTTPS: curl -I https://media.streamlick.com/health"
echo ""
