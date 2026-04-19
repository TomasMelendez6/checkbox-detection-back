#!/bin/sh
set -e
TARGET="${DETECTOR_WEIGHTS:-/app/runs/detect/checkbox/weights/best.pt}"
if [ ! -s "$TARGET" ] && [ -n "${WEIGHTS_DOWNLOAD_URL:-}" ]; then
  mkdir -p "$(dirname "$TARGET")"
  echo "Downloading weights to ${TARGET}..."
  curl -fSL "${WEIGHTS_DOWNLOAD_URL}" -o "$TARGET"
fi
if [ ! -s "$TARGET" ]; then
  echo "Missing weights at ${TARGET}." >&2
  echo "For Render: set runtime env WEIGHTS_DOWNLOAD_URL to a public HTTPS URL of best.pt." >&2
  echo "For local Docker: mount best.pt (see docker-compose.yml) or set WEIGHTS_DOWNLOAD_URL." >&2
  exit 1
fi
exec /usr/local/bin/server
