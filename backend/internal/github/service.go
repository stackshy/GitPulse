package github

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"gofr.dev/pkg/gofr"
)

const cacheTTL = 25 * time.Hour

type Service struct {
	store *Store
	token string
	repo  string
}

func NewService(store *Store, token, repo string) *Service {
	return &Service{store: store, token: token, repo: repo}
}

// toInt safely converts an interface{} to int.
func toInt(v any) int {
	if val, ok := v.(float64); ok {
		return int(val)
	}

	return 0
}

// toStr safely converts an interface{} to string.
func toStr(v any) string {
	if v == nil {
		return ""
	}

	return fmt.Sprintf("%v", v)
}

// toMap safely converts an interface{} to map[string]any.
func toMap(v any) map[string]any {
	if m, ok := v.(map[string]any); ok {
		return m
	}

	return nil
}

// setCache stores a JSON-serializable value in Redis.
func setCache(ctx *gofr.Context, key string, val any) {
	data, err := json.Marshal(val)
	if err != nil {
		return
	}

	ctx.Redis.Set(ctx, key, string(data), cacheTTL)
}

// getCache reads a cached value from Redis into dest. Returns true if found.
func getCache(ctx *gofr.Context, key string, dest any) bool {
	val, err := ctx.Redis.Get(ctx, key).Result()
	if err != nil || val == "" {
		return false
	}

	return json.Unmarshal([]byte(val), dest) == nil
}

// FetchAndStoreTraffic fetches all GitHub data and caches it in Redis + DB.
func (s *Service) FetchAndStoreTraffic(ctx *gofr.Context) {
	ctx.Logger.Infof("Fetching GitHub data for %s", s.repo)

	s.fetchAndStoreClones(ctx)
	s.fetchAndStoreViews(ctx)
	s.fetchAndStoreRepoInfo(ctx)
	s.fetchAndStoreReferrers(ctx)
	s.fetchAndCacheSummary(ctx)
	s.fetchAndCacheIssues(ctx)
	s.fetchAndCachePulls(ctx)
	s.fetchAndCacheContributors(ctx)
	s.fetchAndCacheCommits(ctx)
	s.fetchAndCacheReleases(ctx)
	s.fetchAndCacheLanguages(ctx)
	s.fetchAndCachePaths(ctx)

	ctx.Logger.Infof("GitHub data fetched and cached successfully")

	// Backup DB data to JSON file
	s.BackupToFile(ctx)
}

func (s *Service) fetchAndStoreClones(ctx *gofr.Context) {
	clones := s.fetchAPI(ctx, fmt.Sprintf("/repos/%s/traffic/clones", s.repo))
	if clones == nil {
		return
	}

	clonesArr, ok := clones["clones"].([]any)
	if !ok {
		return
	}

	for _, c := range clonesArr {
		entry := toMap(c)
		if entry == nil {
			continue
		}

		date := toStr(entry["timestamp"])
		if len(date) >= 10 {
			date = date[:10]
		}

		t := &DailyTraffic{
			Date:          date,
			Clones:        toInt(entry["count"]),
			UniqueCloners: toInt(entry["uniques"]),
		}

		if err := s.store.UpsertDailyTraffic(ctx, t); err != nil {
			ctx.Logger.Errorf("Failed to upsert clone data for %s: %v", date, err)
		}
	}
}

func (s *Service) fetchAndStoreViews(ctx *gofr.Context) {
	views := s.fetchAPI(ctx, fmt.Sprintf("/repos/%s/traffic/views", s.repo))
	if views == nil {
		return
	}

	viewsArr, ok := views["views"].([]any)
	if !ok {
		return
	}

	for _, v := range viewsArr {
		entry := toMap(v)
		if entry == nil {
			continue
		}

		date := toStr(entry["timestamp"])
		if len(date) >= 10 {
			date = date[:10]
		}

		t := &DailyTraffic{
			Date:           date,
			Views:          toInt(entry["count"]),
			UniqueVisitors: toInt(entry["uniques"]),
		}

		if err := s.store.UpsertDailyTraffic(ctx, t); err != nil {
			ctx.Logger.Errorf("Failed to upsert view data for %s: %v", date, err)
		}
	}
}

func (s *Service) fetchAndStoreRepoInfo(ctx *gofr.Context) {
	repo := s.fetchAPI(ctx, fmt.Sprintf("/repos/%s", s.repo))
	if repo == nil {
		return
	}

	today := time.Now().Format("2006-01-02")
	t := &DailyTraffic{
		Date:       today,
		Stars:      toInt(repo["stargazers_count"]),
		Forks:      toInt(repo["forks_count"]),
		OpenIssues: toInt(repo["open_issues_count"]),
		Watchers:   toInt(repo["subscribers_count"]),
		RepoSize:   toInt(repo["size"]),
	}

	if err := s.store.UpsertDailyTraffic(ctx, t); err != nil {
		ctx.Logger.Errorf("Failed to upsert repo info: %v", err)
	}
}

func (s *Service) fetchAndStoreReferrers(ctx *gofr.Context) {
	referrers := s.fetchAPIArray(ctx, fmt.Sprintf("/repos/%s/traffic/popular/referrers", s.repo))
	today := time.Now().Format("2006-01-02")

	for _, ref := range referrers {
		r := &Referrer{
			Date:     today,
			Referrer: toStr(ref["referrer"]),
			Count:    toInt(ref["count"]),
			Uniques:  toInt(ref["uniques"]),
		}

		if err := s.store.UpsertReferrer(ctx, r); err != nil {
			ctx.Logger.Errorf("Failed to upsert referrer: %v", err)
		}
	}
}

func (s *Service) fetchAndCacheSummary(ctx *gofr.Context) {
	repo := s.fetchAPI(ctx, fmt.Sprintf("/repos/%s", s.repo))
	if repo == nil {
		return
	}

	totalClones, totalViews, _ := s.store.GetTotals(ctx)

	summary := &RepoSummary{
		Repo:        s.repo,
		Stars:       toInt(repo["stargazers_count"]),
		Forks:       toInt(repo["forks_count"]),
		Watchers:    toInt(repo["subscribers_count"]),
		OpenIssues:  toInt(repo["open_issues_count"]),
		Description: toStr(repo["description"]),
		Language:    toStr(repo["language"]),
		Size:        toInt(repo["size"]),
		TotalClones: totalClones,
		TotalViews:  totalViews,
	}

	setCache(ctx, "cache:summary", summary)
}

func (s *Service) fetchAndCacheIssues(ctx *gofr.Context) {
	var allIssues []Issue

	page := 1

	for {
		items := s.fetchAPIArray(ctx, fmt.Sprintf("/repos/%s/issues?state=all&per_page=100&page=%d", s.repo, page))
		if len(items) == 0 {
			break
		}

		for _, item := range items {
			if _, isPR := item["pull_request"]; isPR {
				continue
			}

			var labels []string
			if lbls, ok := item["labels"].([]any); ok {
				for _, l := range lbls {
					if lbl := toMap(l); lbl != nil {
						labels = append(labels, toStr(lbl["name"]))
					}
				}
			}

			closedAt := ""
			if ca := toStr(item["closed_at"]); len(ca) >= 10 {
				closedAt = ca[:10]
			}

			user := toMap(item["user"])
			createdAt := toStr(item["created_at"])

			if len(createdAt) >= 10 {
				createdAt = createdAt[:10]
			}

			allIssues = append(allIssues, Issue{
				Number:    toInt(item["number"]),
				Title:     toStr(item["title"]),
				State:     toStr(item["state"]),
				Author:    toStr(user["login"]),
				Labels:    labels,
				CreatedAt: createdAt,
				ClosedAt:  closedAt,
				URL:       toStr(item["html_url"]),
			})
		}

		page++
	}

	setCache(ctx, "cache:issues", allIssues)
}

func (s *Service) fetchAndCachePulls(ctx *gofr.Context) {
	var allPRs []PullRequest

	page := 1

	for {
		items := s.fetchAPIArray(ctx, fmt.Sprintf("/repos/%s/pulls?state=all&per_page=100&page=%d", s.repo, page))
		if len(items) == 0 {
			break
		}

		for _, item := range items {
			mergedAt := ""
			if ma := toStr(item["merged_at"]); len(ma) >= 10 {
				mergedAt = ma[:10]
			}

			user := toMap(item["user"])
			draft, _ := item["draft"].(bool)
			createdAt := toStr(item["created_at"])

			if len(createdAt) >= 10 {
				createdAt = createdAt[:10]
			}

			allPRs = append(allPRs, PullRequest{
				Number:    toInt(item["number"]),
				Title:     toStr(item["title"]),
				State:     toStr(item["state"]),
				Author:    toStr(user["login"]),
				CreatedAt: createdAt,
				MergedAt:  mergedAt,
				URL:       toStr(item["html_url"]),
				Draft:     draft,
			})
		}

		page++
	}

	setCache(ctx, "cache:pulls", allPRs)
}

func (s *Service) fetchAndCacheContributors(ctx *gofr.Context) {
	items := s.fetchAPIArray(ctx, fmt.Sprintf("/repos/%s/contributors?per_page=100", s.repo))

	var contributors []Contributor

	for _, item := range items {
		contributors = append(contributors, Contributor{
			Login:   toStr(item["login"]),
			Avatar:  toStr(item["avatar_url"]),
			Commits: toInt(item["contributions"]),
			URL:     toStr(item["html_url"]),
		})
	}

	setCache(ctx, "cache:contributors", contributors)
}

func (s *Service) fetchAndCacheCommits(ctx *gofr.Context) {
	// GitHub returns 202 the first time stats are requested (computing).
	// Retry with backoff; on persistent 202, leave the cache untouched.
	endpoint := fmt.Sprintf("/repos/%s/stats/commit_activity", s.repo)

	var items []map[string]any

	delays := []time.Duration{2, 4, 8, 15, 20, 30}

	for i, d := range delays {
		items = s.fetchAPIArray(ctx, endpoint)
		if items != nil {
			break
		}

		if i < len(delays)-1 {
			time.Sleep(d * time.Second)
		}
	}

	if items == nil {
		ctx.Logger.Warnf("commit_activity still computing after retries; keeping previous cache")
		return
	}

	var commits []WeeklyCommit

	for _, item := range items {
		weekTS := toInt(item["week"])
		if weekTS == 0 {
			continue
		}

		week := time.Unix(int64(weekTS), 0).Format("2006-01-02")
		commits = append(commits, WeeklyCommit{
			Week:  week,
			Total: toInt(item["total"]),
		})
	}

	setCache(ctx, "cache:commits", commits)
}

func (s *Service) fetchAndCacheReleases(ctx *gofr.Context) {
	items := s.fetchAPIArray(ctx, fmt.Sprintf("/repos/%s/releases?per_page=100", s.repo))

	var releases []Release

	for _, item := range items {
		author := toMap(item["author"])
		publishedAt := ""

		if pa := toStr(item["published_at"]); len(pa) >= 10 {
			publishedAt = pa[:10]
		}

		releases = append(releases, Release{
			Tag:         toStr(item["tag_name"]),
			Name:        toStr(item["name"]),
			PublishedAt: publishedAt,
			Author:      toStr(author["login"]),
			URL:         toStr(item["html_url"]),
		})
	}

	setCache(ctx, "cache:releases", releases)
}

func (s *Service) fetchAndCacheLanguages(ctx *gofr.Context) {
	data := s.fetchAPI(ctx, fmt.Sprintf("/repos/%s/languages", s.repo))
	if data == nil {
		return
	}

	langs := make(map[string]int)

	for k, v := range data {
		langs[k] = toInt(v)
	}

	setCache(ctx, "cache:languages", langs)
}

func (s *Service) fetchAndCachePaths(ctx *gofr.Context) {
	items := s.fetchAPIArray(ctx, fmt.Sprintf("/repos/%s/traffic/popular/paths", s.repo))

	var paths []PopularPath

	for _, item := range items {
		paths = append(paths, PopularPath{
			Path:    toStr(item["path"]),
			Title:   toStr(item["title"]),
			Count:   toInt(item["count"]),
			Uniques: toInt(item["uniques"]),
		})
	}

	setCache(ctx, "cache:paths", paths)
}

const backupPath = "data/backup.json"

// BackupToFile dumps all DB data to a JSON file.
func (s *Service) BackupToFile(ctx *gofr.Context) {
	traffic, err := s.store.GetAllTraffic(ctx)
	if err != nil {
		ctx.Logger.Errorf("Backup: failed to read traffic: %v", err)
		return
	}

	referrers, err := s.store.GetAllReferrers(ctx)
	if err != nil {
		ctx.Logger.Errorf("Backup: failed to read referrers: %v", err)
		return
	}

	backup := Backup{
		LastUpdated:  time.Now().Format(time.RFC3339),
		DailyTraffic: traffic,
		Referrers:    referrers,
	}

	data, err := json.MarshalIndent(backup, "", "  ")
	if err != nil {
		ctx.Logger.Errorf("Backup: failed to marshal: %v", err)
		return
	}

	if err := os.MkdirAll("data", 0o755); err != nil {
		ctx.Logger.Errorf("Backup: failed to create dir: %v", err)
		return
	}

	if err := os.WriteFile(backupPath, data, 0o644); err != nil {
		ctx.Logger.Errorf("Backup: failed to write file: %v", err)
		return
	}

	ctx.Logger.Infof("Backup: saved %d traffic rows and %d referrer rows to %s", len(traffic), len(referrers), backupPath)
}

// RestoreFromBackup restores data from JSON file if DB is empty.
func (s *Service) RestoreFromBackup(ctx *gofr.Context) {
	count, err := s.store.TrafficCount(ctx)
	if err != nil || count > 0 {
		return // DB has data, no need to restore
	}

	data, err := os.ReadFile(backupPath)
	if err != nil {
		return // No backup file, nothing to restore
	}

	var backup Backup
	if err := json.Unmarshal(data, &backup); err != nil {
		ctx.Logger.Errorf("Restore: failed to parse backup: %v", err)
		return
	}

	for _, t := range backup.DailyTraffic {
		if err := s.store.UpsertDailyTraffic(ctx, &t); err != nil {
			ctx.Logger.Errorf("Restore: failed to insert traffic for %s: %v", t.Date, err)
		}
	}

	for _, r := range backup.Referrers {
		if err := s.store.UpsertReferrer(ctx, &r); err != nil {
			ctx.Logger.Errorf("Restore: failed to insert referrer %s: %v", r.Referrer, err)
		}
	}

	ctx.Logger.Infof("Restore: restored %d traffic rows and %d referrer rows from backup", len(backup.DailyTraffic), len(backup.Referrers))
}

// ReconcileFromBackup merges backup.json into the DB without touching existing
// non-zero values. Safe to run repeatedly: the underlying upserts use UNIQUE
// keys (date / date+referrer) so duplicates can't be inserted, and the
// daily_traffic upsert only overwrites a column when the incoming value is > 0.
func (s *Service) ReconcileFromBackup(ctx *gofr.Context) (ReconcileReport, error) {
	var rep ReconcileReport

	data, err := os.ReadFile(backupPath)
	if err != nil {
		return rep, fmt.Errorf("read backup file: %w", err)
	}

	var backup Backup
	if err := json.Unmarshal(data, &backup); err != nil {
		return rep, fmt.Errorf("parse backup: %w", err)
	}

	rep.TrafficSeen = len(backup.DailyTraffic)
	rep.ReferrersSeen = len(backup.Referrers)

	for _, t := range backup.DailyTraffic {
		// Backup dates look like "2026-03-19T00:00:00+05:30"; trim to YYYY-MM-DD.
		if len(t.Date) >= 10 {
			t.Date = t.Date[:10]
		}

		affected, err := s.store.UpsertDailyTrafficAffected(ctx, &t)
		switch {
		case err != nil:
			ctx.Logger.Errorf("Reconcile: traffic upsert for %s: %v", t.Date, err)
			rep.TrafficErrors++
		case affected == 1:
			rep.TrafficInserted++
		case affected == 2:
			rep.TrafficUpdated++
		default:
			rep.TrafficUnchanged++
		}
	}

	for _, r := range backup.Referrers {
		if len(r.Date) >= 10 {
			r.Date = r.Date[:10]
		}

		affected, err := s.store.UpsertReferrerAffected(ctx, &r)
		switch {
		case err != nil:
			ctx.Logger.Errorf("Reconcile: referrer upsert for %s/%s: %v", r.Date, r.Referrer, err)
			rep.ReferrerErrors++
		case affected == 1:
			rep.ReferrersInserted++
		case affected == 2:
			rep.ReferrersUpdated++
		default:
			rep.ReferrersUnchanged++
		}
	}

	ctx.Logger.Infof("Reconcile: traffic seen=%d inserted=%d updated=%d unchanged=%d errors=%d; referrers seen=%d inserted=%d updated=%d unchanged=%d errors=%d",
		rep.TrafficSeen, rep.TrafficInserted, rep.TrafficUpdated, rep.TrafficUnchanged, rep.TrafficErrors,
		rep.ReferrersSeen, rep.ReferrersInserted, rep.ReferrersUpdated, rep.ReferrersUnchanged, rep.ReferrerErrors)

	return rep, nil
}

// --- API handlers read from cache, fallback to GitHub ---

// GetTraffic returns stored daily traffic from DB.
func (s *Service) GetTraffic(ctx *gofr.Context, from, to string) ([]DailyTraffic, error) {
	return s.store.GetTraffic(ctx, from, to)
}

// GetSummary returns cached repo summary.
func (s *Service) GetSummary(ctx *gofr.Context) (*RepoSummary, error) {
	var cached RepoSummary
	if getCache(ctx, "cache:summary", &cached) {
		totalClones, totalViews, _ := s.store.GetTotals(ctx)
		cached.Repo = s.repo
		cached.TotalClones = totalClones
		cached.TotalViews = totalViews

		return &cached, nil
	}

	// Fallback: build from DB only
	totalClones, totalViews, _ := s.store.GetTotals(ctx)

	return &RepoSummary{Repo: s.repo, TotalClones: totalClones, TotalViews: totalViews}, nil
}

// GetIssues returns cached issues.
func (s *Service) GetIssues(ctx *gofr.Context) ([]Issue, error) {
	var cached []Issue
	if getCache(ctx, "cache:issues", &cached) {
		return cached, nil
	}

	return []Issue{}, nil
}

// GetPulls returns cached PRs.
func (s *Service) GetPulls(ctx *gofr.Context) ([]PullRequest, error) {
	var cached []PullRequest
	if getCache(ctx, "cache:pulls", &cached) {
		return cached, nil
	}

	return []PullRequest{}, nil
}

// GetContributors returns cached contributors.
func (s *Service) GetContributors(ctx *gofr.Context) ([]Contributor, error) {
	var cached []Contributor
	if getCache(ctx, "cache:contributors", &cached) {
		return cached, nil
	}

	return []Contributor{}, nil
}

// GetCommitActivity returns cached commit activity.
func (s *Service) GetCommitActivity(ctx *gofr.Context) ([]WeeklyCommit, error) {
	var cached []WeeklyCommit
	if getCache(ctx, "cache:commits", &cached) {
		return cached, nil
	}

	return []WeeklyCommit{}, nil
}

// GetReleases returns cached releases.
func (s *Service) GetReleases(ctx *gofr.Context) ([]Release, error) {
	var cached []Release
	if getCache(ctx, "cache:releases", &cached) {
		return cached, nil
	}

	return []Release{}, nil
}

// GetLanguages returns cached languages.
func (s *Service) GetLanguages(ctx *gofr.Context) (map[string]int, error) {
	var cached map[string]int
	if getCache(ctx, "cache:languages", &cached) {
		return cached, nil
	}

	return map[string]int{}, nil
}

// GetPopularPaths returns cached paths.
func (s *Service) GetPopularPaths(ctx *gofr.Context) ([]PopularPath, error) {
	var cached []PopularPath
	if getCache(ctx, "cache:paths", &cached) {
		return cached, nil
	}

	return []PopularPath{}, nil
}

// GetReferrers returns stored referrers from DB.
func (s *Service) GetReferrers(ctx *gofr.Context) ([]Referrer, error) {
	return s.store.GetReferrers(ctx)
}

// fetchAPI calls GitHub API and returns a map.
func (s *Service) fetchAPI(ctx *gofr.Context, endpoint string) map[string]any {
	url := "https://api.github.com" + endpoint

	req, err := http.NewRequestWithContext(ctx.Context, http.MethodGet, url, nil)
	if err != nil {
		ctx.Logger.Errorf("GitHub API request error: %v", err)
		return nil
	}

	req.Header.Set("Accept", "application/vnd.github+json")
	if s.token != "" {
		req.Header.Set("Authorization", "Bearer "+s.token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		ctx.Logger.Errorf("GitHub API error: %v", err)
		return nil
	}

	defer resp.Body.Close()

	if resp.StatusCode == http.StatusAccepted {
		ctx.Logger.Debugf("GitHub API %s returned 202 (computing, will retry)", endpoint)
		return nil
	}

	if resp.StatusCode != http.StatusOK {
		ctx.Logger.Errorf("GitHub API %s returned %d", endpoint, resp.StatusCode)
		return nil
	}

	body, _ := io.ReadAll(resp.Body)

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil
	}

	return result
}

// fetchAPIArray calls GitHub API and returns an array.
func (s *Service) fetchAPIArray(ctx *gofr.Context, endpoint string) []map[string]any {
	url := "https://api.github.com" + endpoint

	req, err := http.NewRequestWithContext(ctx.Context, http.MethodGet, url, nil)
	if err != nil {
		ctx.Logger.Errorf("GitHub API request error: %v", err)
		return nil
	}

	req.Header.Set("Accept", "application/vnd.github+json")
	if s.token != "" {
		req.Header.Set("Authorization", "Bearer "+s.token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		ctx.Logger.Errorf("GitHub API error: %v", err)
		return nil
	}

	defer resp.Body.Close()

	if resp.StatusCode == http.StatusAccepted {
		ctx.Logger.Debugf("GitHub API %s returned 202 (computing, will retry)", endpoint)
		return nil
	}

	if resp.StatusCode != http.StatusOK {
		ctx.Logger.Errorf("GitHub API %s returned %d", endpoint, resp.StatusCode)
		return nil
	}

	body, _ := io.ReadAll(resp.Body)

	var result []map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil
	}

	return result
}
