# Checkbox detection (take-home)

HTTP API that accepts a form image and returns checkbox **bounding boxes** plus **`is_checked`** (checked vs empty). Production-style deployments use **YOLOv8** for localization and a small **OpenCV heuristic** (`classify` from `scripts/detect_checkboxes.py`) for the mark state inside each box.

## Live demo

**Dashboard (Render Static Site):** [open the app](https://CHECKBOX-DETECTION-WEB.onrender.com)

Replace `CHECKBOX-DETECTION-WEB` in this `README.md` with your **Render Static Site** hostname (Render dashboard → your static service → URL).

The stack runs on Render’s **free tier**: the **API web service sleeps** after a period of inactivity. The first load after sleep can take **roughly 30–90 seconds** (cold container, Python/PyTorch import, optional weight download). The dashboard shows a **top status bar** that calls **`GET /healthz` every 10 seconds**: **Checking API…** while waiting, then **API OK** (green) or **API not OK** (red).

## Why Go + Python instead of `gocv`

| Approach | Pros | Cons |
|----------|------|------|
| **Go + Python subprocess (this repo)** | OpenCV / Ultralytics install cleanly in Docker; no CGO on the reviewer’s machine; clear split between HTTP (Go) and vision (Python). | Two runtimes; per-request subprocess overhead; needs hardening for real production. |
| **Go + `gocv` (OpenCV CGO)** | Single process once linked. | OpenCV + CGO is often painful on Windows/macOS CI; harder “clone and run” story. |

This repo optimizes for **`docker compose up`** and a simple mental model for reviewers.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2 (`docker compose`).

No local Go or Python install is required if you use Docker.

## Fork and run

1. Fork this repository on GitHub (optional).
2. Clone:

   ```bash
   git clone https://github.com/TomasMelendez6/checkbox-detection-back.git
   cd checkbox-detection-back
   ```

3. Ensure `runs/detect/checkbox/weights/best.pt` exists locally (train with `scripts/train_checkbox_yolo.py` or copy weights), then:

   ```bash
   docker compose up --build
   ```

4. Call the API (`file` is the multipart field name):

   ```bash
   curl -s -X POST http://localhost:8080/detect \
     -F "file=@/path/to/your/image.png"
   ```

### Response shape

```json
{
  "boxes": [
    { "bbox": [10, 20, 40, 50], "is_checked": true },
    { "bbox": [10, 60, 40, 90], "is_checked": false }
  ]
}
```

`bbox` is `[x1, y1, x2, y2]` in **pixels** (top-left to bottom-right), origin top-left, `y` down.

## Detector layout (default: YOLO)

| Piece | Role |
|-------|------|
| `scripts/detect_checkboxes_yolo.py` | **Default in Docker:** runs **Ultralytics YOLO** (`best.pt`) for boxes; calls **`classify`** from `detect_checkboxes.py` for `is_checked` (unless `--no-classify`). |
| `scripts/detect_checkboxes.py` | Heuristic **full-page** detector + shared **`classify`** used by the YOLO pipeline. |
| `scripts/train_checkbox_yolo.py` | Training entrypoint; dataset under `data/dataset/` (images/labels gitignored; keep `data.yaml` + `.gitkeep`). |

### Optional: OpenCV-only detector (no YOLO)

Point `DETECTOR_SCRIPT` at `scripts/detect_checkboxes.py` and use only `requirements.txt` in a slim image if you want the legacy contour pipeline (no `requirements-ml.txt` / no weights file).

## Configuration (environment)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP listen port |
| `DETECTOR_TIMEOUT` | `180s` in code / often `300s` in `docker-compose` | Max time for the Python detector subprocess |
| `DETECTOR_PYTHON` | `python3` | Python executable |
| `DETECTOR_SCRIPT` | `scripts/detect_checkboxes.py` in `go run` / `detect_checkboxes_yolo.py` in Docker image | Detector entrypoint |
| `DETECTOR_WEIGHTS` | path to `best.pt` | YOLO weights path (used by `detect_checkboxes_yolo.py`) |
| `DETECTOR_CONF` | e.g. `0.45` | YOLO min confidence (read from env inside the YOLO script) |
| `WEIGHTS_DOWNLOAD_URL` | unset | If the weights file is missing at container start, download from this HTTPS URL (Render/GitHub clone has no `.pt`; see `.gitignore`). |
| `WEIGHTS_DOWNLOAD_TOKEN` | unset | Optional GitHub PAT (`Authorization: token …`) if the download URL is a **private** asset (anonymous `curl` gets 404). |
| `CORS_ALLOW_ORIGINS` | `*` if unset | Comma-separated `Origin` values allowed for browser calls from the static dashboard, or `*`. Set to your Render static origin in production if you prefer not to use `*`. |

### Render (API + weights)

Weights are **not** in git (`runs/`, `*.pt` ignored), so the image does not `COPY` `best.pt`.

1. Upload `best.pt` to a **public** URL (e.g. a [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) asset on a **public** repo).
2. On the **API** web service, set runtime env:
   - `WEIGHTS_DOWNLOAD_URL` — direct HTTPS URL to `best.pt`.
   - `DETECTOR_WEIGHTS` — default `/app/runs/detect/checkbox/weights/best.pt` is fine.
   - `CORS_ALLOW_ORIGINS` — your static site origin, e.g. `https://your-static.onrender.com`, or `*` for a quick demo.
3. Redeploy.

Local `docker-compose` **bind-mounts** `./runs/detect/checkbox/weights/best.pt` so you normally skip `WEIGHTS_DOWNLOAD_URL`.

#### GitHub release URL returns 404

The URL must match the published release:  
`https://github.com/<owner>/<repo>/releases/download/<tag>/<filename>`  
(tag = git tag, filename = exact asset name). Use **right click → copy link** on the asset. Private repos need `WEIGHTS_DOWNLOAD_TOKEN`.

### Render (static dashboard)

1. Create a **Static Site** with root directory `web`, build `npm install && npm run build`, publish directory `dist`.
2. Set **build** environment variable **`VITE_API_BASE_URL`** to your **API** HTTPS origin, e.g. `https://your-api.onrender.com` (no trailing slash). Rebuild after changing it.

## Local development (without Docker)

**Heuristic detector (no ML stack):**

```bash
pip install -r requirements.txt
export DETECTOR_SCRIPT="$(pwd)/scripts/detect_checkboxes.py"
go run ./cmd/server
```

**YOLO detector** (needs `requirements-ml.txt`, weights path, and a higher timeout for cold subprocess):

```bash
pip install -r requirements.txt -r requirements-ml.txt
export DETECTOR_SCRIPT="$(pwd)/scripts/detect_checkboxes_yolo.py"
export DETECTOR_WEIGHTS="$(pwd)/runs/detect/checkbox/weights/best.pt"
export DETECTOR_TIMEOUT=300s
go run ./cmd/server
```

## Web dashboard

See [`web/README.md`](web/README.md). In development, Vite proxies `/detect` and `/healthz` to `localhost:8080`. For a hosted static build, set **`VITE_API_BASE_URL`** to the public API URL and enable **CORS** on the API (`CORS_ALLOW_ORIGINS`).

## Tests

```bash
go test ./...
```

## License

Private / evaluation use unless otherwise stated.
