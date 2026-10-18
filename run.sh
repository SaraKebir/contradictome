#!/usr/bin/env bash
# Contradictome Launcher Script

# Add Homebrew to PATH
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

PORT="${CONTRADICTOME_PORT:-5050}"
HOST="${CONTRADICTOME_HOST:-127.0.0.1}"

echo "=========================================================="
echo " Starting Contradictome: Dialectical AI Research Assistant"
echo " Primary Port: ${PORT}"
echo "=========================================================="

python3 app.py
