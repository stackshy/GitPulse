package gomod

// ModuleStats holds Go module statistics from deps.dev.
type ModuleStats struct {
	Module         string      `json:"module"`
	LatestVersion  string      `json:"latest_version"`
	VersionCount   int         `json:"version_count"`
	DependentCount int         `json:"dependent_count"`
	License        string      `json:"license"`
	Dependents     []Dependent `json:"dependents,omitempty"`
}

// Dependent represents a project that depends on this module.
type Dependent struct {
	Module  string `json:"module"`
	Version string `json:"version"`
}

// Scorecard holds OpenSSF Scorecard data.
type Scorecard struct {
	Score  float64          `json:"score"`
	Date   string           `json:"date"`
	Checks []ScorecardCheck `json:"checks"`
}

// ScorecardCheck is a single scorecard check result.
type ScorecardCheck struct {
	Name  string `json:"name"`
	Score int    `json:"score"`
	Doc   string `json:"doc"`
}
