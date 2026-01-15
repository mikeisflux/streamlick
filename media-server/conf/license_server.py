#!/usr/bin/env python3
"""
Internal License Validation Server for Ant Media Server.
This provides a local API endpoint for license validation.

Usage: python3 license_server.py [port]
Default port: 8765
"""

import json
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

LICENSE_RESPONSE = {
    "valid": True,
    "type": "enterprise",
    "expiry": "2050-02-15T04:14:31"
}

class LicenseHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests for license validation."""
        parsed = urlparse(self.path)

        # Accept any path - always return valid license
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(LICENSE_RESPONSE).encode())

    def do_POST(self):
        """Handle POST requests (for enable_ssl.sh compatibility)."""
        self.do_GET()

    def log_message(self, format, *args):
        """Suppress logging for cleaner output."""
        pass

def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = HTTPServer(('127.0.0.1', port), LicenseHandler)
    print(f"License server running on http://127.0.0.1:{port}")
    print("Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped")

if __name__ == '__main__':
    main()
