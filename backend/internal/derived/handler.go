package derived

import "gofr.dev/pkg/gofr"

// Handler handles derived metrics API requests.
type Handler struct {
	svc *Service
}

// NewHandler creates a new derived metrics handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GetMetrics returns all computed metrics.
func (h *Handler) GetMetrics(ctx *gofr.Context) (any, error) {
	return h.svc.GetMetrics(ctx)
}
