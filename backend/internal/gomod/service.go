package gomod

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"gofr.dev/pkg/gofr"
)

const cacheTTL = 25 * time.Hour

// Service fetches Go module and scorecard data.
type Service struct {
	module string // e.g. "github.com/stackshy/cloudemu"
	repo   string // e.g. "stackshy/cloudemu"
}

// NewService creates a gomod service.
func NewService(module, repo string) *Service {
	return &Service{module: module, repo: repo}
}

// FetchAndCache fetches all gomod data and caches in Redis.
func (s *Service) FetchAndCache(ctx *gofr.Context) {
	s.fetchModuleStats(ctx)
	s.fetchScorecard(ctx)
}

func (s *Service) fetchModuleStats(ctx *gofr.Context) {
	encoded := url.PathEscape(s.module)
	apiURL := fmt.Sprintf("https://api.deps.dev/v3/systems/go/packages/%s", encoded)

	data := fetchJSON(ctx, apiURL)
	if data == nil {
		return
	}

	stats := &ModuleStats{Module: s.module}

	if versions, ok := data["versions"].([]any); ok {
		stats.VersionCount = len(versions)
		if len(versions) > 0 {
			last := versions[len(versions)-1]
			if vm, ok := last.(map[string]any); ok {
				if vk, ok := vm["versionKey"].(map[string]any); ok {
					stats.LatestVersion = fmt.Sprintf("%v", vk["version"])
				}
			}
		}
	}

	// Fetch version details for dependency count
	if stats.LatestVersion != "" {
		verURL := fmt.Sprintf("https://api.deps.dev/v3/systems/go/packages/%s/versions/%s",
			encoded, url.PathEscape(stats.LatestVersion))

		verData := fetchJSON(ctx, verURL)
		if verData != nil {
			if links, ok := verData["links"].([]any); ok {
				for _, l := range links {
					if lm, ok := l.(map[string]any); ok {
						if fmt.Sprintf("%v", lm["label"]) == "SOURCE_REPO" {
							// Has source repo link
							_ = lm
						}
					}
				}
			}
		}
	}

	cacheSet(ctx, "cache:gomod:stats", stats)
}

func (s *Service) fetchScorecard(ctx *gofr.Context) {
	apiURL := fmt.Sprintf("https://api.securityscorecards.dev/projects/github.com/%s", s.repo)

	data := fetchJSON(ctx, apiURL)
	if data == nil {
		return
	}

	sc := &Scorecard{}

	if score, ok := data["score"].(float64); ok {
		sc.Score = score
	}

	if date, ok := data["date"].(string); ok && len(date) >= 10 {
		sc.Date = date[:10]
	}

	if checks, ok := data["checks"].([]any); ok {
		for _, c := range checks {
			if cm, ok := c.(map[string]any); ok {
				check := ScorecardCheck{
					Name: fmt.Sprintf("%v", cm["name"]),
				}

				if s, ok := cm["score"].(float64); ok {
					check.Score = int(s)
				}

				if doc, ok := cm["documentation"].(map[string]any); ok {
					check.Doc = fmt.Sprintf("%v", doc["short"])
				}

				sc.Checks = append(sc.Checks, check)
			}
		}
	}

	cacheSet(ctx, "cache:scorecard", sc)
}

// GetModuleStats returns cached module stats.
func (s *Service) GetModuleStats(ctx *gofr.Context) (*ModuleStats, error) {
	var cached ModuleStats
	if cacheGet(ctx, "cache:gomod:stats", &cached) {
		return &cached, nil
	}

	return &ModuleStats{Module: s.module}, nil
}

// GetScorecard returns cached scorecard.
func (s *Service) GetScorecard(ctx *gofr.Context) (*Scorecard, error) {
	var cached Scorecard
	if cacheGet(ctx, "cache:scorecard", &cached) {
		return &cached, nil
	}

	return &Scorecard{}, nil
}

func fetchJSON(ctx *gofr.Context, apiURL string) map[string]any {
	req, err := http.NewRequestWithContext(ctx.Context, http.MethodGet, apiURL, nil)
	if err != nil {
		ctx.Logger.Errorf("Request error for %s: %v", apiURL, err)
		return nil
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		ctx.Logger.Errorf("Fetch error for %s: %v", apiURL, err)
		return nil
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode != http.StatusNotFound {
			ctx.Logger.Errorf("API %s returned %d", apiURL, resp.StatusCode)
		}

		return nil
	}

	body, _ := io.ReadAll(resp.Body)

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil
	}

	return result
}

func cacheSet(ctx *gofr.Context, key string, val any) {
	data, err := json.Marshal(val)
	if err != nil {
		return
	}

	ctx.Redis.Set(ctx, key, string(data), cacheTTL)
}

func cacheGet(ctx *gofr.Context, key string, dest any) bool {
	val, err := ctx.Redis.Get(ctx, key).Result()
	if err != nil || val == "" {
		return false
	}

	return json.Unmarshal([]byte(val), dest) == nil
}
