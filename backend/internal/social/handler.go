package social

import "gofr.dev/pkg/gofr"

// Handler handles social mentions API requests.
type Handler struct {
	svc *Service
}

// NewHandler creates a new social handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GetMentions returns all social mentions.
func (h *Handler) GetMentions(ctx *gofr.Context) (any, error) {
	return h.svc.GetMentions(ctx)
}
