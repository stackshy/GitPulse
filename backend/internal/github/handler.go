package github

import "gofr.dev/pkg/gofr"

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) GetTraffic(ctx *gofr.Context) (any, error) {
	from := ctx.Param("from")
	to := ctx.Param("to")

	return h.service.GetTraffic(ctx, from, to)
}

func (h *Handler) GetSummary(ctx *gofr.Context) (any, error) {
	return h.service.GetSummary(ctx)
}

func (h *Handler) GetIssues(ctx *gofr.Context) (any, error) {
	return h.service.GetIssues(ctx)
}

func (h *Handler) GetPulls(ctx *gofr.Context) (any, error) {
	return h.service.GetPulls(ctx)
}

func (h *Handler) GetContributors(ctx *gofr.Context) (any, error) {
	return h.service.GetContributors(ctx)
}

func (h *Handler) GetCommitActivity(ctx *gofr.Context) (any, error) {
	return h.service.GetCommitActivity(ctx)
}

func (h *Handler) GetReleases(ctx *gofr.Context) (any, error) {
	return h.service.GetReleases(ctx)
}

func (h *Handler) GetLanguages(ctx *gofr.Context) (any, error) {
	return h.service.GetLanguages(ctx)
}

func (h *Handler) GetReferrers(ctx *gofr.Context) (any, error) {
	return h.service.GetReferrers(ctx)
}

func (h *Handler) GetPopularPaths(ctx *gofr.Context) (any, error) {
	return h.service.GetPopularPaths(ctx)
}

func (h *Handler) ReconcileBackup(ctx *gofr.Context) (any, error) {
	return h.service.ReconcileFromBackup(ctx)
}

func (h *Handler) WriteBackup(ctx *gofr.Context) (any, error) {
	h.service.BackupToFile(ctx)

	return map[string]string{"status": "ok"}, nil
}
