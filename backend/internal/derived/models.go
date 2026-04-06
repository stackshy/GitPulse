package derived

// Metrics holds all computed metrics derived from existing GitHub data.
type Metrics struct {
	HealthScore       int     `json:"health_score"`        // 0-100 composite score
	BusFactor         int     `json:"bus_factor"`          // contributors needed for 50% commits
	IssueCloseRate    float64 `json:"issue_close_rate"`    // percentage of closed issues
	MedianCloseTime   float64 `json:"median_close_days"`   // median days to close an issue
	MedianMergeTime   float64 `json:"median_merge_days"`   // median days to merge a PR
	StarGrowthRate    float64 `json:"star_growth_rate"`    // stars per day (last 14 days)
	ForkStarRatio     float64 `json:"fork_star_ratio"`     // forks / stars
	ReleaseCadence    float64 `json:"release_cadence_days"` // avg days between releases
	StarConversion    float64 `json:"star_conversion_pct"` // new stars / unique visitors
	ContributorCount  int     `json:"contributor_count"`
	TotalCommits      int     `json:"total_commits"`
	OpenIssueCount    int     `json:"open_issue_count"`
	ClosedIssueCount  int     `json:"closed_issue_count"`
	OpenPRCount       int     `json:"open_pr_count"`
	MergedPRCount     int     `json:"merged_pr_count"`
}
