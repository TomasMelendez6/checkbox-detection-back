export interface DetectBox {
  bbox: [number, number, number, number]
  is_checked: boolean
}

export interface DetectResponse {
  boxes: DetectBox[]
}

export interface DetectErrorBody {
  error: string
}
