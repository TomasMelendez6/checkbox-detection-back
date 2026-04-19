import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { BBoxCrop } from './BBoxCrop'
import type { DetectErrorBody, DetectResponse } from './types/detect'
import './App.css'

function isImageFile(f: File) {
  return f.type.startsWith('image/')
}

export default function App() {
  const inputId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DetectResponse | null>(null)

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
      const res = await fetch('/detect', { method: 'POST', body })
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
      setError('Network error — is the API running on port 8080?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
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

      <div className="actions">
        <button
          type="button"
          className="btn-primary"
          disabled={!file || loading}
          onClick={runDetection}
        >
          {loading ? 'Running detection…' : 'Run detection'}
        </button>
      </div>

      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      {previewUrl && (
        <section className="preview-section">
          <h2>Original</h2>
          <img src={previewUrl} alt="Uploaded preview" className="preview-img" />
        </section>
      )}

      {result && previewUrl && (
        <section className="results">
          <div className="meta">
            {result.detector_version && (
              <p>
                <span className="meta-label">Detector</span>{' '}
                <code>{result.detector_version}</code>
              </p>
            )}
            {(result.image_width != null && result.image_height != null) && (
              <p>
                <span className="meta-label">Image size</span>{' '}
                {result.image_width} × {result.image_height}px
              </p>
            )}
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
