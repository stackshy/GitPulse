package gomod

import "gofr.dev/pkg/gofr"

// Handler handles Go module API requests.
type Handler struct {
	svc *Service
}

// NewHandler creates a new gomod handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GetModuleStats returns Go module statistics.
func (h *Handler) GetModuleStats(ctx *gofr.Context) (any, error) {
	return h.svc.GetModuleStats(ctx)
}

// GetScorecard returns OpenSSF scorecard data.
func (h *Handler) GetScorecard(ctx *gofr.Context) (any, error) {
	return h.svc.GetScorecard(ctx)
}
