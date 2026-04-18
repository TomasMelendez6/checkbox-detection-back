# Checkbox detection (take-home)

HTTP service that accepts a document image and returns detected checkboxes with `is_checked` classification.

## Why Go + Python (OpenCV) instead of `gocv`

| Approach | Pros | Cons |
|----------|------|------|
| **Go + Python subprocess (this repo)** | OpenCV via `opencv-python-headless` installs cleanly in Docker; no CGO on your machine; clear split between HTTP/API (Go) and CV (Python). | Two runtimes; process spawn overhead; need to harden the subprocess boundary for production. |
| **Go + `gocv` (OpenCV CGO)** | Single process, lower per-request overhead once linked. | OpenCV + CGO is often painful on Windows/macOS CI; harder “clone and run” story for reviewers without matching toolchains. |

We optimized for **reproducible `docker compose up`** and a **simple mental model** for the take-home.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2 (`docker compose`).

No local Go or Python install is required if you use Docker.

## Fork and run

1. Fork this repository on GitHub (optional).
2. Clone your fork:

   ```bash
   git clone https://github.com/TomasMelendez6/checkbox-detection.git
   cd checkbox-detection
   ```

3. Build and start:

   ```bash
   docker compose up --build
   ```

4. Call the API (`file` is the multipart field name for the upload):

   ```bash
   curl -s -X POST http://localhost:8080/detect \
     -F "file=@/path/to/your/image.png"
   ```

Response shape (fields may include `detector_version`, `image_width`, `image_height`):

```json
{
  "detector_version": "median-local-ring-v3-elongated-blob",
  "image_width": 1024,
  "image_height": 637,
  "boxes": [
    { "bbox": [10, 20, 40, 50], "is_checked": true },
    { "bbox": [10, 60, 40, 90], "is_checked": false }
  ]
}
```

`bbox` is `[x1, y1, x2, y2]` in **pixels** (top-left, bottom-right exclusive), origin top-left, `y` down.

### Optional: YOLO detector

Train with `pip install -r requirements-ml.txt` and `python scripts/train_checkbox_yolo.py`. Infer with `scripts/detect_checkboxes_yolo.py` and point `DETECTOR_SCRIPT` at that file when deploying. Dataset layout lives under `data/dataset/` (images/labels are gitignored; keep `data.yaml` + `.gitkeep` in repo).

## Configuration (environment)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP listen port |
| `DETECTOR_TIMEOUT` | `60s` | Max time for the Python detector process |
| `DETECTOR_PYTHON` | `python3` | Python executable (override to `python` if needed) |
| `DETECTOR_SCRIPT` | `/app/scripts/detect_checkboxes.py` | Detector script (`detect_checkboxes_yolo.py` after training YOLO) |

## Local development (without Docker)

Requires Go 1.22+, Python 3.11+, and OpenCV for Python:

```bash
pip install -r requirements.txt
export DETECTOR_SCRIPT="$(pwd)/scripts/detect_checkboxes.py"
go run ./cmd/server
```

## Tests

```bash
go test ./...
```

## License

Private / evaluation use unless otherwise stated.