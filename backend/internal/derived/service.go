package derived

import (
	"math"
	"sort"
	"time"

	"github.com/zopdev/cloudemu-analytics/internal/github"
	"gofr.dev/pkg/gofr"
)

// Service computes derived metrics from existing GitHub data.
type Service struct {
	ghSvc *github.Service
}

// NewService creates a derived metrics service.
func NewService(ghSvc *github.Service) *Service {
	return &Service{ghSvc: ghSvc}
}

// GetMetrics computes all derived metrics.
func (s *Service) GetMetrics(ctx *gofr.Context) (*Metrics, error) {
	m := &Metrics{}

	s.computeContributorMetrics(ctx, m)
	s.computeIssueMetrics(ctx, m)
	s.computePRMetrics(ctx, m)
	s.computeStarMetrics(ctx, m)
	s.computeReleaseMetrics(ctx, m)
	s.computeHealthScore(m)

	return m, nil
}

func (s *Service) computeContributorMetrics(ctx *gofr.Context, m *Metrics) {
	contributors, err := s.ghSvc.GetContributors(ctx)
	if err != nil || len(contributors) == 0 {
		return
	}

	m.ContributorCount = len(contributors)

	// Bus factor: how many contributors account for 50% of commits
	totalCommits := 0
	for _, c := range contributors {
		totalCommits += c.Commits
	}

	m.TotalCommits = totalCommits

	if totalCommits == 0 {
		return
	}

	// Contributors are already sorted by commits desc from GitHub
	half := totalCommits / 2
	running := 0

	for i, c := range contributors {
		running += c.Commits
		if running >= half {
			m.BusFactor = i + 1
			break
		}
	}
}

func (s *Service) computeIssueMetrics(ctx *gofr.Context, m *Metrics) {
	issues, err := s.ghSvc.GetIssues(ctx)
	if err != nil {
		return
	}

	var closeDays []float64

	for _, issue := range issues {
		if issue.State == "open" {
			m.OpenIssueCount++
		} else {
			m.ClosedIssueCount++

			if issue.CreatedAt != "" && issue.ClosedAt != "" {
				created, err1 := time.Parse("2006-01-02", issue.CreatedAt)
				closed, err2 := time.Parse("2006-01-02", issue.ClosedAt)

				if err1 == nil && err2 == nil {
					days := closed.Sub(created).Hours() / 24
					closeDays = append(closeDays, days)
				}
			}
		}
	}

	total := m.OpenIssueCount + m.ClosedIssueCount
	if total > 0 {
		m.IssueCloseRate = math.Round(float64(m.ClosedIssueCount)/float64(total)*1000) / 10
	}

	m.MedianCloseTime = median(closeDays)
}

func (s *Service) computePRMetrics(ctx *gofr.Context, m *Metrics) {
	pulls, err := s.ghSvc.GetPulls(ctx)
	if err != nil {
		return
	}

	var mergeDays []float64

	for _, pr := range pulls {
		if pr.State == "open" {
			m.OpenPRCount++
		}

		if pr.MergedAt != "" {
			m.MergedPRCount++

			if pr.CreatedAt != "" {
				created, err1 := time.Parse("2006-01-02", pr.CreatedAt)
				merged, err2 := time.Parse("2006-01-02", pr.MergedAt)

				if err1 == nil && err2 == nil {
					days := merged.Sub(created).Hours() / 24
					mergeDays = append(mergeDays, days)
				}
			}
		}
	}

	m.MedianMergeTime = median(mergeDays)
}

func (s *Service) computeStarMetrics(ctx *gofr.Context, m *Metrics) {
	traffic, err := s.ghSvc.GetTraffic(ctx, "", "")
	if err != nil || len(traffic) < 2 {
		return
	}

	summary, err := s.ghSvc.GetSummary(ctx)
	if err != nil || summary == nil {
		return
	}

	stars := summary.Stars
	forks := summary.Forks

	if stars > 0 {
		m.ForkStarRatio = math.Round(float64(forks)/float64(stars)*100) / 100
	}

	// Star growth: difference between first and last day's stars / days
	first := traffic[0]
	last := traffic[len(traffic)-1]

	if first.Stars > 0 && last.Stars > 0 && last.Stars >= first.Stars {
		daysDiff := float64(len(traffic))
		if daysDiff > 0 {
			m.StarGrowthRate = math.Round(float64(last.Stars-first.Stars)/daysDiff*10) / 10
		}
	}

	// Visitor-to-star conversion
	totalVisitors := 0
	for _, t := range traffic {
		totalVisitors += t.UniqueVisitors
	}

	starGain := 0
	if last.Stars > first.Stars {
		starGain = last.Stars - first.Stars
	}

	if totalVisitors > 0 && starGain > 0 {
		m.StarConversion = math.Round(float64(starGain)/float64(totalVisitors)*1000) / 10
	}
}

func (s *Service) computeReleaseMetrics(ctx *gofr.Context, m *Metrics) {
	releases, err := s.ghSvc.GetReleases(ctx)
	if err != nil || len(releases) < 2 {
		return
	}

	var dates []time.Time

	for _, r := range releases {
		if r.PublishedAt != "" {
			t, err := time.Parse("2006-01-02", r.PublishedAt)
			if err == nil {
				dates = append(dates, t)
			}
		}
	}

	if len(dates) < 2 {
		return
	}

	sort.Slice(dates, func(i, j int) bool { return dates[i].Before(dates[j]) })

	totalDays := 0.0

	for i := 1; i < len(dates); i++ {
		totalDays += dates[i].Sub(dates[i-1]).Hours() / 24
	}

	m.ReleaseCadence = math.Round(totalDays/float64(len(dates)-1)*10) / 10
}

func (s *Service) computeHealthScore(m *Metrics) {
	score := 0.0

	// Issue close rate (15 points)
	if m.IssueCloseRate > 0 {
		score += math.Min(m.IssueCloseRate/100*15, 15)
	}

	// Median close time (15 points) — faster is better, <7 days = full score
	if m.MedianCloseTime > 0 {
		closeScore := math.Max(0, 15-m.MedianCloseTime/7*15)
		score += math.Min(closeScore, 15)
	}

	// PR merge velocity (15 points) — <3 days = full score
	if m.MedianMergeTime > 0 {
		mergeScore := math.Max(0, 15-m.MedianMergeTime/3*15)
		score += math.Min(mergeScore, 15)
	}

	// Bus factor (15 points) — 3+ = full score
	if m.BusFactor >= 3 {
		score += 15
	} else if m.BusFactor > 0 {
		score += float64(m.BusFactor) / 3 * 15
	}

	// Contributors (10 points) — 10+ = full score
	if m.ContributorCount >= 10 {
		score += 10
	} else if m.ContributorCount > 0 {
		score += float64(m.ContributorCount) / 10 * 10
	}

	// Star growth (10 points) — 1+/day = full score
	if m.StarGrowthRate >= 1 {
		score += 10
	} else if m.StarGrowthRate > 0 {
		score += m.StarGrowthRate * 10
	}

	// Fork/star ratio (10 points) — 0.2+ = healthy
	if m.ForkStarRatio >= 0.2 {
		score += 10
	} else if m.ForkStarRatio > 0 {
		score += m.ForkStarRatio / 0.2 * 10
	}

	// Release cadence (10 points) — releasing at all = some points
	if m.ReleaseCadence > 0 && m.ReleaseCadence <= 30 {
		score += 10
	} else if m.ReleaseCadence > 30 {
		score += math.Max(0, 10-((m.ReleaseCadence-30)/30)*10)
	}

	m.HealthScore = int(math.Round(score))
}

func median(vals []float64) float64 {
	if len(vals) == 0 {
		return 0
	}

	sort.Float64s(vals)
	n := len(vals)

	if n%2 == 0 {
		return math.Round((vals[n/2-1]+vals[n/2])/2*10) / 10
	}

	return math.Round(vals[n/2]*10) / 10
}
