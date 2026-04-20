#!/bin/sh
set -e
TARGET="${DETECTOR_WEIGHTS:-/app/runs/detect/checkbox/weights/best.pt}"

if [ -e "$TARGET" ] && [ ! -f "$TARGET" ]; then
  echo "Invalid weights path: ${TARGET} is not a regular file (often a directory)." >&2
  echo "Cause: docker compose bind-mount when host ./runs/.../best.pt was missing — Docker created a directory named best.pt on the host." >&2
  echo "Fix on host: rm -rf runs/detect/checkbox/weights/best.pt then add the real best.pt, or remove the volumes: block and set WEIGHTS_DOWNLOAD_URL." >&2
  exit 1
fi

if [ ! -s "$TARGET" ] && [ -n "${WEIGHTS_DOWNLOAD_URL:-}" ]; then
  mkdir -p "$(dirname "$TARGET")"
  echo "Downloading weights to ${TARGET}..."
  if [ -n "${WEIGHTS_DOWNLOAD_TOKEN:-}" ]; then
    curl -fSL \
      -A "checkbox-detection/entrypoint" \
      -H "Accept: application/octet-stream" \
      -H "Authorization: token ${WEIGHTS_DOWNLOAD_TOKEN}" \
      -o "$TARGET" \
      "${WEIGHTS_DOWNLOAD_URL}"
  else
    curl -fSL \
      -A "checkbox-detection/entrypoint" \
      -o "$TARGET" \
      "${WEIGHTS_DOWNLOAD_URL}"
  fi
fi

if [ ! -s "$TARGET" ]; then
  echo "Missing weights at ${TARGET}." >&2
  echo "For Render: set runtime env WEIGHTS_DOWNLOAD_URL to a public HTTPS URL of best.pt." >&2
  echo "For local Docker: place runs/detect/checkbox/weights/best.pt before first compose, or remove volumes: and set WEIGHTS_DOWNLOAD_URL." >&2
  exit 1
fi

exec /usr/local/bin/server
