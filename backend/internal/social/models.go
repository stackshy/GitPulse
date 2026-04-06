package social

// Mention represents a social media mention of the project.
type Mention struct {
	Source    string `json:"source"`     // hackernews, reddit, stackoverflow
	Title     string `json:"title"`
	URL       string `json:"url"`
	Points    int    `json:"points"`
	Comments  int    `json:"comments"`
	Author    string `json:"author"`
	Subreddit string `json:"subreddit,omitempty"`
	Date      string `json:"date"`
}

// SocialStats holds aggregated social data.
type SocialStats struct {
	TotalMentions int       `json:"total_mentions"`
	HNMentions    int       `json:"hn_mentions"`
	RedditPosts   int       `json:"reddit_posts"`
	SOQuestions   int       `json:"so_questions"`
	Mentions      []Mention `json:"mentions"`
}
