package github

import "time"

// DailyTraffic represents a single day's GitHub traffic data stored in DB.
type DailyTraffic struct {
	ID             int       `json:"id"`
	Date           string    `json:"date"`
	Clones         int       `json:"clones"`
	UniqueCloners  int       `json:"unique_cloners"`
	Views          int       `json:"views"`
	UniqueVisitors int       `json:"unique_visitors"`
	Stars          int       `json:"stars"`
	Forks          int       `json:"forks"`
	OpenIssues     int       `json:"open_issues"`
	Watchers       int       `json:"watchers"`
	RepoSize       int       `json:"repo_size"`
	CreatedAt      time.Time `json:"created_at"`
}

// Referrer represents a traffic referrer stored in DB.
type Referrer struct {
	ID       int    `json:"id"`
	Date     string `json:"date"`
	Referrer string `json:"referrer"`
	Count    int    `json:"count"`
	Uniques  int    `json:"uniques"`
}

// RepoSummary is the current state of the repo.
type RepoSummary struct {
	Repo        string `json:"repo"`
	Stars       int    `json:"stars"`
	Forks       int    `json:"forks"`
	Watchers    int    `json:"watchers"`
	OpenIssues  int    `json:"open_issues"`
	Description string `json:"description"`
	Language    string `json:"language"`
	Size        int    `json:"size"`
	TotalClones int    `json:"total_clones"`
	TotalViews  int    `json:"total_views"`
}

// Issue represents a GitHub issue.
type Issue struct {
	Number    int      `json:"number"`
	Title     string   `json:"title"`
	State     string   `json:"state"`
	Author    string   `json:"author"`
	Labels    []string `json:"labels"`
	CreatedAt string   `json:"created_at"`
	ClosedAt  string   `json:"closed_at,omitempty"`
	URL       string   `json:"url"`
}

// PullRequest represents a GitHub PR.
type PullRequest struct {
	Number    int    `json:"number"`
	Title     string `json:"title"`
	State     string `json:"state"`
	Author    string `json:"author"`
	CreatedAt string `json:"created_at"`
	MergedAt  string `json:"merged_at,omitempty"`
	URL       string `json:"url"`
	Draft     bool   `json:"draft"`
}

// Contributor represents a GitHub contributor.
type Contributor struct {
	Login    string `json:"login"`
	Avatar   string `json:"avatar"`
	Commits  int    `json:"commits"`
	URL      string `json:"url"`
}

// WeeklyCommit represents weekly commit activity.
type WeeklyCommit struct {
	Week  string `json:"week"`
	Total int    `json:"total"`
}

// Release represents a GitHub release.
type Release struct {
	Tag         string `json:"tag"`
	Name        string `json:"name"`
	PublishedAt string `json:"published_at"`
	Author      string `json:"author"`
	URL         string `json:"url"`
}

// Backup represents the JSON backup file structure.
type Backup struct {
	LastUpdated  string         `json:"last_updated"`
	DailyTraffic []DailyTraffic `json:"daily_traffic"`
	Referrers    []Referrer     `json:"referrers"`
}

// PopularPath represents a popular content path.
type PopularPath struct {
	Path    string `json:"path"`
	Title   string `json:"title"`
	Count   int    `json:"count"`
	Uniques int    `json:"uniques"`
}
