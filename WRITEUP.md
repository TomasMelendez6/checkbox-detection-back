# Checkbox detection take-home — approach, tradeoffs, and limitations

## Problem (as stated)

Build a system that:

1. **Detects** all checkboxes (filled and unfilled) in a document image.  
2. **Classifies** each as checked or not.  
3. Exposes **`POST /detect`** accepting a file upload and returning JSON **`{ "boxes": [ { "bbox": [x1,y1,x2,y2], "is_checked": bool }, ... ] }`**.

Perfect accuracy was not required; the prompt values clear reasoning and runnable instructions.

## High-level approach

- **HTTP API in Go** (`cmd/server`): multipart upload, temp file, subprocess call, JSON parse, errors surfaced as HTTP status + JSON where appropriate.  
- **Vision in Python**: OpenCV for I/O and preprocessing; **Ultralytics YOLOv8** (`detect_checkboxes_yolo.py` + `best.pt`) for **localization**; a **hand-tuned grayscale heuristic** (`classify` in `detect_checkboxes.py`) for **`is_checked`** on each YOLO box (same idea as classic appraisal forms: ink vs paper contrast inside the cell).  
- **Optional legacy path**: `detect_checkboxes.py` alone implements full OpenCV contour detection + the same `classify`—useful for local runs without the ML stack.  
- **Dashboard** (`web/`): React + TypeScript, image upload, `POST /detect`, crops per box, loading states, and a **health strip** polling `GET /healthz` for demos on cold/slow hosts.  
- **Reproducible run**: `docker compose` builds a single image (Go binary + Python + deps + entrypoint that can **download weights** when they are not in git). **Render** hosts the API (Docker web service) and the static UI separately, with **CORS** and **`VITE_API_BASE_URL`** so the browser targets the API origin.

This matches the role’s stack emphasis (**Go**, **React/TypeScript**, **Docker**); AWS was not required for the take-home, so deployment is **Render** instead of Lambda/SQS, with the same separation-of-concerns mindset (stateless API, heavy work off the request path in a fuller production design).

## Why this split (Go + Python subprocess)

| Decision | Rationale |
|----------|-----------|
| **Go owns HTTP** | Small, typed, easy to review; good fit for upload limits, timeouts, and stable JSON contracts. |
| **Python owns vision** | Ultralytics + OpenCV + NumPy are the fastest path to a working YOLO pipeline without CGO (`gocv`) or embedding Python in-process. |
| **One subprocess per request** | Simple boundary: stdin/stdout discipline, env-configured script and weights. **Tradeoff:** high latency vs a long-lived inference worker or gRPC sidecar (called out below). |

## Tradeoffs

1. **Subprocess per `/detect` vs in-process or sidecar**  
   - *Chosen:* fork Python each time, read JSON from stdout.  
   - *Gain:* isolation, simple deploy, no shared memory bugs between requests.  
   - *Cost:* every call pays **Python + torch + model load** on the free tier; dominates latency on Render.

2. **YOLO + heuristic `is_checked` vs end-to-end two-class detector**  
   - *Chosen:* YOLO for boxes (single class “checkbox”), OpenCV heuristic for checked state.  
   - *Gain:* reuses stable geometry; `classify` is interpretable and cheap per box.  
   - *Cost:* checked state is **not** learned jointly with localization; domain shift (scanners, noise) can hurt more than a second-stage classifier trained on marks.

3. **JSON only on stdout from Python**  
   - *Chosen:* suppress stray prints from Ultralytics so Go can `json.Unmarshal` stdout.  
   - *Cost:* brittle if a dependency prints to stdout in a future upgrade—better long-term is structured logging to stderr only or a small gRPC/HTTP sidecar.

4. **Weights outside git**  
   - *Chosen:* `.gitignore` for `*.pt`; Docker entrypoint **`WEIGHTS_DOWNLOAD_URL`** (optional token for private assets).  
   - *Gain:* small clone, clear separation of code vs artifacts.  
   - *Cost:* deployers must configure one more secret/URL.

5. **Static dashboard + CORS**  
   - *Chosen:* `VITE_API_BASE_URL`, `CORS_ALLOW_ORIGINS`, health polling.  
   - *Cost:* two deployables and build-time env for the front; misconfiguration shows a clear “API base URL” state in the UI.

## Known limitations

- **Latency:** On Render’s **free tier**, **every** detection is slow: limited CPU/RAM plus **cold Python/torch/weights per request**. Not representative of a production worker pool or batch GPU service.  
- **Accuracy:** YOLO + fixed `conf` + heuristic `classify` will miss merged boxes, unusual shapes, and low-contrast marks; no active learning or document-type conditioning.  
- **Security (intentionally minimal for a take-home):** no auth on `/detect`, bounded upload size only, no rate limiting, no virus scan of uploads, subprocess inherits broad filesystem access inside the container.  
- **Observability:** basic `log` on detector failure; no metrics/tracing, no structured request IDs across Go ↔ Python.  
- **Scaling:** single instance assumptions; no queue, no horizontal shard of inference, no model versioning in the API contract.

## What I would do next for “production quality”

- **Inference service:** long-lived Python process (or separate container) with **model loaded once**, queue + worker concurrency, health/readiness that reflects model load—not just “process up.”  
- **Contract:** optional `request_id`, versioned detector id in headers or separate field if product needs it again.  
- **Tests:** golden JSON fixtures for the Python scripts; integration test with `httptest` + small fixture image.  
- **AWS-shaped deploy:** container on **ECS/Fargate** or **Lambda + container** for inference if latency targets allow cold starts; **S3** for uploads; **SQS** for async jobs on large documents.  
- **Frontend:** virtualize many boxes, better error copy for 502/timeouts, optional client-side downscale before upload for huge scans.

## How to run

See the root **`README.md`** (`docker compose up --build`, env vars for Render, and optional local Go/Python paths).
