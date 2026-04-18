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
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY scripts/detect_checkboxes.py /app/scripts/detect_checkboxes.py
COPY --from=gobuild /out/server /usr/local/bin/server
ENV PORT=8080
ENV DETECTOR_PYTHON=python3
ENV DETECTOR_SCRIPT=/app/scripts/detect_checkboxes.py
EXPOSE 8080
CMD ["server"]
