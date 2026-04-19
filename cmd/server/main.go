package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/TomasMelendez6/checkbox-detection-back/internal/api"
	"github.com/TomasMelendez6/checkbox-detection-back/internal/detector"
	"github.com/TomasMelendez6/checkbox-detection-back/internal/middleware"
)

const defaultMaxUpload = 32 << 20

func main() {
	port := getenv("PORT", "8080")
	py := getenv("DETECTOR_PYTHON", "python3")
	script := getenv("DETECTOR_SCRIPT", "scripts/detect_checkboxes.py")
	timeout := getenvDuration("DETECTOR_TIMEOUT", 180*time.Second)

	det := detector.NewPythonDetector(py, script, timeout)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /detect", api.NewDetectHandler(det, defaultMaxUpload))
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           middleware.CORS(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func getenvDuration(k string, def time.Duration) time.Duration {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return def
	}
	return d
}