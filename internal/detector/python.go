package detector

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/TomasMelendez6/checkbox-detection-back/internal/model"
)

// PythonDetector runs the OpenCV script in a separate process.
type PythonDetector struct {
	python  string
	script  string
	timeout time.Duration
}

// NewPythonDetector resolves script to an absolute path when possible.
func NewPythonDetector(python, script string, timeout time.Duration) *PythonDetector {
	abs, err := filepath.Abs(script)
	if err == nil {
		script = abs
	}
	return &PythonDetector{python: python, script: script, timeout: timeout}
}

// Detect implements [Detector].
func (d *PythonDetector) Detect(ctx context.Context, imagePath string) (model.DetectResponse, error) {
	if d.timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, d.timeout)
		defer cancel()
	}

	cmd := exec.CommandContext(ctx, d.python, d.script, "--image", imagePath)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return model.DetectResponse{}, fmt.Errorf("detector process: %w (stderr: %s)", err, truncate(stderr.String(), 2048))
	}

	var resp model.DetectResponse
	if err := json.Unmarshal(stdout.Bytes(), &resp); err != nil {
		return model.DetectResponse{}, fmt.Errorf("detector json: %w", err)
	}
	return resp, nil
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}