export interface DetectBox {
  bbox: [number, number, number, number]
  is_checked: boolean
}

export interface DetectResponse {
  detector_version?: string
  image_width?: number
  image_height?: number
  boxes: DetectBox[]
}

export interface DetectErrorBody {
  error: string
}
