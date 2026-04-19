import { useCallback, useEffect, useRef } from 'react'

/** Extra pixels around API bbox when cropping (clamped to image bounds). */
const CROP_PAD_PX = 16

type BBox = [number, number, number, number]

type Props = {
  imageUrl: string
  bbox: BBox
  isChecked: boolean
  index: number
}

function expandedCropRect(
  bbox: BBox,
  imageWidth: number,
  imageHeight: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const [x1, y1, x2, y2] = bbox
  const iw = Math.max(1, imageWidth)
  const ih = Math.max(1, imageHeight)

  const sx = Math.max(0, x1 - CROP_PAD_PX)
  const sy = Math.max(0, y1 - CROP_PAD_PX)
  const ex = Math.min(iw, x2 + CROP_PAD_PX)
  const ey = Math.min(ih, y2 + CROP_PAD_PX)

  const sw = Math.max(1, ex - sx)
  const sh = Math.max(1, ey - sy)
  return { sx, sy, sw, sh }
}

/** Draw API bbox in crop-local pixels (after expandedCropRect). Kept minimal so small checkboxes stay visible. */
function drawDetectedRegionOverlay(
  ctx: CanvasRenderingContext2D,
  apiBbox: BBox,
  cropSx: number,
  cropSy: number,
  cropW: number,
  cropH: number,
) {
  const [bx1, by1, bx2, by2] = apiBbox
  const lx1 = bx1 - cropSx
  const ly1 = by1 - cropSy
  const lx2 = bx2 - cropSx
  const ly2 = by2 - cropSy
  const bw = Math.max(1, lx2 - lx1)
  const bh = Math.max(1, ly2 - ly1)

  const minSide = Math.min(bw, bh, cropW, cropH)
  const tick = Math.max(2, Math.min(minSide * 0.22, 7))
  const lineW = 1

  ctx.save()

  ctx.strokeStyle = 'rgba(190, 24, 93, 0.88)'
  ctx.lineWidth = lineW
  ctx.lineJoin = 'miter'
  ctx.lineCap = 'butt'

  ctx.beginPath()
  ctx.moveTo(lx1 + 0.5, ly1 + tick + 0.5)
  ctx.lineTo(lx1 + 0.5, ly1 + 0.5)
  ctx.lineTo(lx1 + tick + 0.5, ly1 + 0.5)
  ctx.moveTo(lx2 - tick - 0.5, ly1 + 0.5)
  ctx.lineTo(lx2 - 0.5, ly1 + 0.5)
  ctx.lineTo(lx2 - 0.5, ly1 + tick + 0.5)
  ctx.moveTo(lx2 - 0.5, ly2 - tick - 0.5)
  ctx.lineTo(lx2 - 0.5, ly2 - 0.5)
  ctx.lineTo(lx2 - tick - 0.5, ly2 - 0.5)
  ctx.moveTo(lx1 + tick + 0.5, ly2 - 0.5)
  ctx.lineTo(lx1 + 0.5, ly2 - 0.5)
  ctx.lineTo(lx1 + 0.5, ly2 - tick - 0.5)
  ctx.stroke()

  if (bw >= 2 && bh >= 2) {
    ctx.strokeStyle = 'rgba(157, 23, 77, 0.5)'
    ctx.setLineDash([3, 2])
    ctx.strokeRect(lx1 + 0.5, ly1 + 0.5, bw - 1, bh - 1)
    ctx.setLineDash([])
  }

  ctx.restore()
}

function fitCanvasToVisual(canvas: HTMLCanvasElement, visual: HTMLDivElement) {
  const sw = canvas.width
  const sh = canvas.height
  if (sw < 1 || sh < 1) return

  const cs = getComputedStyle(visual)
  const padX =
    (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
  const padY =
    (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
  const availW = Math.max(1, visual.clientWidth - padX)
  const availH = Math.max(1, visual.clientHeight - padY)

  const scale = Math.min(availW / sw, availH / sh)
  const dw = Math.max(1, Math.floor(sw * scale))
  const dh = Math.max(1, Math.floor(sh * scale))
  canvas.style.width = `${dw}px`
  canvas.style.height = `${dh}px`
}

export function BBoxCrop({ imageUrl, bbox, isChecked, index }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visualRef = useRef<HTMLDivElement>(null)
  const [x1, y1, x2, y2] = bbox

  const syncCanvasLayout = useCallback(() => {
    const canvas = canvasRef.current
    const visual = visualRef.current
    if (canvas && visual) fitCanvasToVisual(canvas, visual)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const visual = visualRef.current
    if (!canvas || !visual) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let drawn = false
    const ro = new ResizeObserver(() => {
      if (drawn) syncCanvasLayout()
    })
    ro.observe(visual)

    const img = new Image()
    let cancelled = false
    img.onload = () => {
      if (cancelled) return
      const { sx, sy, sw, sh } = expandedCropRect(
        [x1, y1, x2, y2],
        img.naturalWidth,
        img.naturalHeight,
      )
      canvas.width = sw
      canvas.height = sh
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      drawDetectedRegionOverlay(ctx, [x1, y1, x2, y2], sx, sy, sw, sh)
      drawn = true
      syncCanvasLayout()
    }
    img.src = imageUrl

    return () => {
      cancelled = true
      drawn = false
      img.onload = null
      ro.disconnect()
      canvas.style.width = ''
      canvas.style.height = ''
    }
  }, [imageUrl, x1, y1, x2, y2, syncCanvasLayout])

  const status = isChecked ? 'Checked' : 'Unchecked'

  return (
    <figure className="crop-card">
      <div className="crop-visual" ref={visualRef}>
        <canvas
          ref={canvasRef}
          className="crop-canvas"
          aria-label={`Checkbox region ${index + 1}, ${status}`}
        />
      </div>
      <figcaption className="crop-caption">
        <span className="crop-coords">
          [{x1}, {y1}, {x2}, {y2}]
        </span>
        <span className={`crop-status ${isChecked ? 'checked' : ''}`}>
          {status}
        </span>
      </figcaption>
    </figure>
  )
}
