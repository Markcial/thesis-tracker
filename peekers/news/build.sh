#!/bin/bash

set -e

echo "Building Polymarket News Daemon..."

# Install dependencies
echo "Installing dependencies..."
bun install

# Build standalone binary
echo "Compiling to standalone binary..."
bun build src/index.ts --compile --outfile polymarket-news-daemon

# Make executable
chmod +x polymarket-news-daemon

echo ""
echo "Build complete!"
echo ""
echo "Binary: ./polymarket-news-daemon"
echo ""
echo "Usage:"
echo "  ./polymarket-news-daemon          # Run in foreground"
echo "  nohup ./polymarket-news-daemon &  # Run in background"
echo ""
echo "The daemon will:"
echo "  - Read config from ./config.json"
echo "  - Store headlines in ./news.db"
echo "  - Fetch every 10 minutes (configurable)"
echo "  - Auto-prune when DB exceeds 400MB"
