# Checkbox detection dashboard

React + TypeScript UI: upload an image, call `POST /detect`, inspect crops.

## Prerequisites

- API on **port 8080** when developing locally (`docker compose up` or `go run` from repo root).

## Setup

```bash
cd web
npm install
```

## Development

1. Start the API from the **repository root**.
2. In `web/`: `npm run dev` and open the URL shown (usually `http://localhost:5173`).

Vite **proxies** `/detect` and `/healthz` to `http://127.0.0.1:8080` for both **`npm run dev`** and **`npm run preview`**, so you can leave `VITE_API_BASE_URL` unset on `localhost` / `127.0.0.1` and the browser keeps same-origin requests that forward to the API.

## Production / Render Static Site

Set **`VITE_API_BASE_URL`** at **build time** to the HTTPS origin of your Go service (example: `https://your-api.onrender.com`, no trailing slash). The dashboard calls `GET /healthz` and `POST /detect` against that host; the API must send **CORS** headers (see root `README.md`: `CORS_ALLOW_ORIGINS`).

Copy from example:

```bash
cp .env.example .env
# edit .env, then:
npm run build
```

On Render, add `VITE_API_BASE_URL` under **Environment** for the static site and trigger a new deploy.

## Production build (local)

```bash
npm run build
npm run preview
```

For `preview` to reach a remote API, set `VITE_API_BASE_URL` in `.env` before `npm run build` (or export it in the shell if your setup injects env at build time).
