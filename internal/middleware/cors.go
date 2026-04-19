package middleware

import (
	"net/http"
	"os"
	"strings"
)

// CORS wraps h with Access-Control headers for browser clients (e.g. static site on another origin).
// Set CORS_ALLOW_ORIGINS to a comma-separated list of allowed Origin values, or "*" for any origin
// (convenient for demos; tighten in production). If unset, defaults to "*".
func CORS(h http.Handler) http.Handler {
	allowed := parseAllowedOrigins()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := pickAllowOrigin(r.Header.Get("Origin"), allowed); origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func parseAllowedOrigins() []string {
	raw := strings.TrimSpace(os.Getenv("CORS_ALLOW_ORIGINS"))
	if raw == "" {
		return []string{"*"}
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{"*"}
	}
	return out
}

func pickAllowOrigin(requestOrigin string, allowed []string) string {
	for _, a := range allowed {
		if a == "*" {
			return "*"
		}
		if requestOrigin != "" && a == requestOrigin {
			return requestOrigin
		}
	}
	return ""
}
