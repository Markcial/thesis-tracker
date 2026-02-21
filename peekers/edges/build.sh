#!/bin/bash

set -e

echo "Building Market Peeker Daemon..."

echo "Installing dependencies..."
bun install

echo "Compiling to standalone binary..."
bun build src/index.ts --compile --outfile polymarket-edges-daemon

chmod +x polymarket-edges-daemon

echo ""
echo "Build complete!"
echo ""
echo "Binary: ./polymarket-edges-daemon"
echo ""
echo "Usage:"
echo "  ./polymarket-edges-daemon          # Run in foreground"
echo "  nohup ./polymarket-edges-daemon &  # Run in background"
echo ""
echo "The daemon will:"
echo "  - Sync your portfolio positions every 60 minutes"
echo "  - Refresh market prices adaptively (10m/30m/2hr)"
echo "  - Track price history for watched markets"
echo "  - Auto-prune to stay under 50MB"
