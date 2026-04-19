import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { apiUrl, isRemoteStaticMissingApiBase } from './api'
import { BBoxCrop } from './BBoxCrop'
import type { DetectErrorBody, DetectResponse } from './types/detect'
import './App.css'

type ApiHealth = 'checking' | 'ok' | 'down' | 'misconfigured'

function isImageFile(f: File) {
  return f.type.startsWith('image/')
}

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`spinner spinner--${size}`} aria-hidden />
}

export default function App() {
  const inputId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DetectResponse | null>(null)
  const [apiHealth, setApiHealth] = useState<ApiHealth>('checking')

  useEffect(() => {
    let cancelled = false
    const ping = async () => {
      if (isRemoteStaticMissingApiBase()) {
        if (!cancelled) setApiHealth('misconfigured')
        return
      }
      try {
        const res = await fetch(apiUrl('/healthz'), { method: 'GET', cache: 'no-store' })
        const body = (await res.text()).trim()
        if (cancelled) return
        setApiHealth(res.ok && body === 'ok' ? 'ok' : 'down')
      } catch {
        if (!cancelled) setApiHealth('down')
      }
    }
    setApiHealth('checking')
    void ping()
    const id = window.setInterval(() => void ping(), 10_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  )

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const onFileChosen = useCallback((f: File | null) => {
    setError(null)
    setResult(null)
    if (!f || !isImageFile(f)) {
      setFile(null)
      return
    }
    setFile(f)
  }, [])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    onFileChosen(f)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const f = e.dataTransfer.files?.[0] ?? null
    onFileChosen(f)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const runDetection = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(apiUrl('/detect'), { method: 'POST', body })
      const text = await res.text()
      let data: unknown
      try {
        data = JSON.parse(text) as unknown
      } catch {
        setError(res.ok ? 'Invalid JSON from server' : text || `Error ${res.status}`)
        return
      }
      if (!res.ok) {
        const err = data as Partial<DetectErrorBody>
        setError(err.error ?? `Request failed (${res.status})`)
        return
      }
      const parsed = data as DetectResponse
      if (!Array.isArray(parsed.boxes)) {
        setError('Response missing boxes array')
        return
      }
      setResult(parsed)
    } catch {
      setError(
        'Network error — start the API (local :8080) or set VITE_API_BASE_URL for a remote host.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <div
        className={`api-status api-status--${apiHealth}`}
        role="status"
        aria-live="polite"
        title="Polls GET /healthz every 10s. On Render free tier the API sleeps after inactivity; the first successful check may take up to a minute."
      >
        {apiHealth === 'checking' && (
          <>
            <Spinner size="sm" />
            <span>Checking API…</span>
          </>
        )}
        {apiHealth === 'ok' && <span>API OK</span>}
        {apiHealth === 'down' && <span>API not OK</span>}
        {apiHealth === 'misconfigured' && (
          <span>
            Set <code>VITE_API_BASE_URL</code> at build or <code>window.__API_BASE__</code> in index.html — relative
            URLs hit this host, not the API
          </span>
        )}
      </div>

      <header className="header">
        <h1>Checkbox detection</h1>
        <p className="lede">
          Upload a form image, run detection, and inspect each bounding box crop.
        </p>
      </header>

      <section
        className="dropzone"
        onDrop={onDrop}
        onDragOver={onDragOver}
        aria-label="Image drop zone"
      >
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="file-input"
          onChange={onInputChange}
        />
        <label htmlFor={inputId} className="dropzone-label">
          <span className="dropzone-title">Drop an image here</span>
          <span className="dropzone-sub">or click to choose a file</span>
        </label>
      </section>

      {file && (
        <p className="file-name">
          Selected: <strong>{file.name}</strong>
        </p>
      )}

      {previewUrl && (
        <section className="preview-section">
          <h2>Original</h2>
          <img src={previewUrl} alt="Uploaded preview" className="preview-img" />
          <div className="actions">
            <button
              type="button"
              className="btn-primary"
              disabled={!file || loading || isRemoteStaticMissingApiBase()}
              aria-busy={loading}
              onClick={runDetection}
            >
              {loading ? (
                <>
                  <Spinner size="sm" />
                  <span>Running detection…</span>
                </>
              ) : (
                'Run detection'
              )}
            </button>
          </div>
        </section>
      )}

      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      {loading && previewUrl && (
        <section
          className="results results--loading"
          aria-busy="true"
          aria-live="polite"
        >
          <h2>Regions</h2>
          <div className="results-loading-panel">
            <Spinner size="lg" />
            <p className="results-loading-text">Analyzing image…</p>
          </div>
        </section>
      )}

      {result && previewUrl && (
        <section className="results">
          <div className="meta">
            <p>
              <span className="meta-label">Boxes</span> {result.boxes.length}
            </p>
          </div>
          <h2>Regions</h2>
          <div className="crop-grid">
            {result.boxes.map((box, i) => (
              <BBoxCrop
                key={`${box.bbox.join(',')}-${i}`}
                imageUrl={previewUrl}
                bbox={box.bbox}
                isChecked={box.is_checked}
                index={i}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
