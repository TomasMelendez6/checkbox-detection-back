# Checkbox detection dashboard

Small **React + TypeScript** UI for the take-home API: upload an image, call `POST /detect`, and view per-checkbox crops.

## Prerequisites

- API running on **port 8080** (e.g. `go run ./cmd/server` from the repo root, or `docker compose up`).

## Setup

```bash
cd web
npm install
```

## Development

The Vite dev server proxies `/detect` and `/healthz` to `http://127.0.0.1:8080`, so the browser does not need CORS on the Go app.

1. Start the API (from repository root).
2. In `web/`:

```bash
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

Serving the built static files on the same host as the API would require a reverse proxy or separate deployment; for the take-home, dev + proxy is the intended workflow.
