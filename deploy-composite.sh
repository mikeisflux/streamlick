#!/bin/bash
# Deploy composite HTML to Ant Media server

set -e

SOURCE="/home/user/streamlick/media-server/webapps/LiveApp/streamlick_composite.html"
TARGET="root@media.streamlick.com:/usr/local/antmedia/webapps/LiveApp/"

echo "Deploying composite HTML to Ant Media server..."
scp "$SOURCE" "$TARGET"
echo "Done! Composite deployed."
echo ""
echo "Test URL (will auto-load a test background):"
echo "https://media.streamlick.com:5443/LiveApp/streamlick_composite.html?roomId=YOUR_ROOM_ID"
