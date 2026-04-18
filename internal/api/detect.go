package api

import (
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"os"

	"github.com/TomasMelendez6/checkbox-detection-back/internal/detector"
	"github.com/TomasMelendez6/checkbox-detection-back/internal/model"
)

const multipartFieldFile = "file"

// NewDetectHandler returns POST /detect handler. maxBytes limits the entire request body size.
func NewDetectHandler(det detector.Detector, maxBytes int64) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
		if err := r.ParseMultipartForm(maxBytes); err != nil {
			writeError(w, http.StatusBadRequest, "invalid multipart form")
			return
		}
		fh, err := pickFile(r.MultipartForm)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		defer fh.Close()

		tmp, err := os.CreateTemp("", "upload-*")
		if err != nil {
			writeError(w, http.StatusInternalServerError, "temp file")
			return
		}
		tmpPath := tmp.Name()
		defer os.Remove(tmpPath)

		if _, err := io.Copy(tmp, fh); err != nil {
			tmp.Close()
			writeError(w, http.StatusInternalServerError, "save upload")
			return
		}
		if err := tmp.Close(); err != nil {
			writeError(w, http.StatusInternalServerError, "close temp")
			return
		}

		boxes, err := det.Detect(r.Context(), tmpPath)
		if err != nil {
			writeError(w, http.StatusBadGateway, "detection failed")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(model.DetectResponse{Boxes: boxes})
	}
}

func pickFile(f *multipart.Form) (multipart.File, error) {
	if f == nil {
		return nil, errors.New("missing multipart form")
	}
	files := f.File[multipartFieldFile]
	if len(files) == 0 {
		return nil, errors.New("missing file field (expected name: " + multipartFieldFile + ")")
	}
	return files[0].Open()
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}