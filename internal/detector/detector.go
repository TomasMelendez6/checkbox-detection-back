package detector

import (
	"context"

	"github.com/TomasMelendez6/checkbox-detection-back/internal/model"
)

// Detector runs checkbox detection on an image file path.
type Detector interface {
	Detect(ctx context.Context, imagePath string) (model.DetectResponse, error)
}