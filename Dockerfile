# Build static Go binary (no CGO).

FROM golang:1.22-bookworm AS gobuild

WORKDIR /src

COPY go.mod ./

COPY cmd ./cmd

COPY internal ./internal

ENV CGO_ENABLED=0

RUN go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server



FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgomp1 \
        libglib2.0-0 \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt

COPY requirements-ml.txt /app/requirements-ml.txt

# ultralytics pulls opencv-python (needs libGL). Uninstall GUI build, then force-reinstall
# headless — otherwise pip may skip reinstall because opencv-python-headless is still "installed".
RUN set -eux; \
    pip install --no-cache-dir -r /app/requirements.txt -r /app/requirements-ml.txt; \
    pip uninstall -y opencv-python opencv-contrib-python 2>/dev/null || true; \
    pip install --no-cache-dir --force-reinstall opencv-python-headless==4.10.0.84; \
    python3 -c "import cv2; print('cv2 OK', cv2.__version__)"

COPY scripts/detect_checkboxes.py /app/scripts/detect_checkboxes.py

COPY scripts/detect_checkboxes_yolo.py /app/scripts/detect_checkboxes_yolo.py

COPY scripts/docker-entrypoint.sh /app/scripts/docker-entrypoint.sh
# Strip Windows CRLF so shebang is valid inside Linux (avoids "no such file or directory").
RUN sed -i 's/\r$//' /app/scripts/docker-entrypoint.sh && chmod +x /app/scripts/docker-entrypoint.sh

# Weights: not in git (.gitignore). Local: bind-mount (docker-compose) or set WEIGHTS_DOWNLOAD_URL at runtime (Render).

COPY --from=gobuild /out/server /usr/local/bin/server

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]

ENV PORT=8080

ENV DETECTOR_PYTHON=python3

ENV DETECTOR_SCRIPT=/app/scripts/detect_checkboxes_yolo.py

ENV DETECTOR_CONF=0.45

EXPOSE 8080
