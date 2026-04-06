package main

import (
	"strings"

	"gofr.dev/pkg/gofr"

	"github.com/zopdev/cloudemu-analytics/internal/derived"
	"github.com/zopdev/cloudemu-analytics/internal/github"
	"github.com/zopdev/cloudemu-analytics/internal/gomod"
	"github.com/zopdev/cloudemu-analytics/internal/social"
	"github.com/zopdev/cloudemu-analytics/migrations"
)

// parseRepo extracts "owner/repo" from a full GitHub URL or returns as-is if already in that format.
// e.g. "https://github.com/stackshy/cloudemu" → "stackshy/cloudemu"
func parseRepo(raw string) string {
	raw = strings.TrimSuffix(strings.TrimSpace(raw), "/")
	raw = strings.TrimSuffix(raw, ".git")
	raw = strings.TrimPrefix(raw, "https://github.com/")
	raw = strings.TrimPrefix(raw, "http://github.com/")

	return raw
}

func main() {
	app := gofr.New()
	app.Migrate(migrations.All())

	token := app.Config.Get("GITHUB_TOKEN")
	repoRaw := app.Config.GetOrDefault("GITHUB_REPO", "https://github.com/stackshy/cloudemu")
	repo := parseRepo(repoRaw)
	goModule := app.Config.GetOrDefault("GO_MODULE", "github.com/"+repo)
	searchQuery := app.Config.GetOrDefault("SEARCH_QUERY", strings.Split(repo, "/")[len(strings.Split(repo, "/"))-1])

	if token == "" {
		app.Logger().Warnf("GITHUB_TOKEN is not set — GitHub API will be rate-limited to 60 req/hr. Set it in configs/.env")
	}

	// GitHub
	ghStore := github.NewStore()
	ghSvc := github.NewService(ghStore, token, repo)
	ghHandler := github.NewHandler(ghSvc)

	// Go module + Scorecard
	gomodSvc := gomod.NewService(goModule, repo)
	gomodHandler := gomod.NewHandler(gomodSvc)

	// Social mentions (HN, Reddit, StackOverflow)
	socialSvc := social.NewService(searchQuery)
	socialHandler := social.NewHandler(socialSvc)

	// Derived metrics (computed from existing data)
	derivedSvc := derived.NewService(ghSvc)
	derivedHandler := derived.NewHandler(derivedSvc)

	// Restore from backup if DB is empty, then fetch fresh data
	app.OnStart(func(ctx *gofr.Context) error {
		ghSvc.RestoreFromBackup(ctx)
		ghSvc.FetchAndStoreTraffic(ctx)
		gomodSvc.FetchAndCache(ctx)
		socialSvc.FetchAndCache(ctx)

		return nil
	})

	// Daily cron at midnight
	app.AddCronJob("0 0 * * *", "fetch-all-data", func(ctx *gofr.Context) {
		ghSvc.FetchAndStoreTraffic(ctx)
		gomodSvc.FetchAndCache(ctx)
		socialSvc.FetchAndCache(ctx)
	})

	// GitHub routes
	app.GET("/api/traffic", ghHandler.GetTraffic)
	app.GET("/api/summary", ghHandler.GetSummary)
	app.GET("/api/issues", ghHandler.GetIssues)
	app.GET("/api/pulls", ghHandler.GetPulls)
	app.GET("/api/contributors", ghHandler.GetContributors)
	app.GET("/api/commits", ghHandler.GetCommitActivity)
	app.GET("/api/releases", ghHandler.GetReleases)
	app.GET("/api/languages", ghHandler.GetLanguages)
	app.GET("/api/referrers", ghHandler.GetReferrers)
	app.GET("/api/paths", ghHandler.GetPopularPaths)

	// Go module + Scorecard routes
	app.GET("/api/gomod/stats", gomodHandler.GetModuleStats)
	app.GET("/api/scorecard", gomodHandler.GetScorecard)

	// Social mentions route
	app.GET("/api/social/mentions", socialHandler.GetMentions)

	// Derived metrics route
	app.GET("/api/derived/metrics", derivedHandler.GetMetrics)

	app.Run()
}
