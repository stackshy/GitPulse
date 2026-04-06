package social

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"time"

	"gofr.dev/pkg/gofr"
)

const cacheTTL = 25 * time.Hour

// Service fetches social mentions from HN, Reddit, StackOverflow.
type Service struct {
	query string // search term, e.g. "cloudemu"
}

// NewService creates a social service.
func NewService(query string) *Service {
	return &Service{query: query}
}

// FetchAndCache fetches all social data and caches in Redis.
func (s *Service) FetchAndCache(ctx *gofr.Context) {
	var all []Mention

	all = append(all, s.fetchHN(ctx)...)
	all = append(all, s.fetchReddit(ctx)...)
	all = append(all, s.fetchSO(ctx)...)

	// Sort by date descending
	sort.Slice(all, func(i, j int) bool { return all[i].Date > all[j].Date })

	stats := &SocialStats{
		TotalMentions: len(all),
		Mentions:      all,
	}

	for _, m := range all {
		switch m.Source {
		case "hackernews":
			stats.HNMentions++
		case "reddit":
			stats.RedditPosts++
		case "stackoverflow":
			stats.SOQuestions++
		}
	}

	data, _ := json.Marshal(stats)
	ctx.Redis.Set(ctx, "cache:social", string(data), cacheTTL)
}

func (s *Service) fetchHN(ctx *gofr.Context) []Mention {
	url := fmt.Sprintf("https://hn.algolia.com/api/v1/search?query=%s&tags=story&hitsPerPage=50", s.query)

	data := fetchJSONMap(ctx, url)
	if data == nil {
		return nil
	}

	hits, ok := data["hits"].([]any)
	if !ok {
		return nil
	}

	var mentions []Mention

	for _, h := range hits {
		hit, ok := h.(map[string]any)
		if !ok {
			continue
		}

		date := ""
		if d, ok := hit["created_at"].(string); ok && len(d) >= 10 {
			date = d[:10]
		}

		points := 0
		if p, ok := hit["points"].(float64); ok {
			points = int(p)
		}

		comments := 0
		if c, ok := hit["num_comments"].(float64); ok {
			comments = int(c)
		}

		objectID := ""
		if id, ok := hit["objectID"].(string); ok {
			objectID = id
		}

		mentions = append(mentions, Mention{
			Source:   "hackernews",
			Title:    fmt.Sprintf("%v", hit["title"]),
			URL:      fmt.Sprintf("https://news.ycombinator.com/item?id=%s", objectID),
			Points:   points,
			Comments: comments,
			Author:   fmt.Sprintf("%v", hit["author"]),
			Date:     date,
		})
	}

	return mentions
}

func (s *Service) fetchReddit(ctx *gofr.Context) []Mention {
	url := fmt.Sprintf("https://www.reddit.com/search.json?q=%s&sort=new&limit=50", s.query)

	req, err := http.NewRequestWithContext(ctx.Context, http.MethodGet, url, nil)
	if err != nil {
		return nil
	}

	req.Header.Set("User-Agent", "cloudemu-analytics/1.0")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		ctx.Logger.Errorf("Reddit fetch error: %v", err)
		return nil
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		ctx.Logger.Errorf("Reddit returned %d", resp.StatusCode)
		return nil
	}

	body, _ := io.ReadAll(resp.Body)

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil
	}

	data, ok := result["data"].(map[string]any)
	if !ok {
		return nil
	}

	children, ok := data["children"].([]any)
	if !ok {
		return nil
	}

	var mentions []Mention

	for _, c := range children {
		child, ok := c.(map[string]any)
		if !ok {
			continue
		}

		post, ok := child["data"].(map[string]any)
		if !ok {
			continue
		}

		date := ""
		if ts, ok := post["created_utc"].(float64); ok {
			date = time.Unix(int64(ts), 0).Format("2006-01-02")
		}

		ups := 0
		if u, ok := post["ups"].(float64); ok {
			ups = int(u)
		}

		comments := 0
		if nc, ok := post["num_comments"].(float64); ok {
			comments = int(nc)
		}

		mentions = append(mentions, Mention{
			Source:    "reddit",
			Title:     fmt.Sprintf("%v", post["title"]),
			URL:       fmt.Sprintf("https://reddit.com%v", post["permalink"]),
			Points:    ups,
			Comments:  comments,
			Author:    fmt.Sprintf("%v", post["author"]),
			Subreddit: fmt.Sprintf("%v", post["subreddit"]),
			Date:      date,
		})
	}

	return mentions
}

func (s *Service) fetchSO(ctx *gofr.Context) []Mention {
	url := fmt.Sprintf("https://api.stackexchange.com/2.3/search?intitle=%s&site=stackoverflow&order=desc&sort=creation&filter=default",
		s.query)

	data := fetchJSONMap(ctx, url)
	if data == nil {
		return nil
	}

	items, ok := data["items"].([]any)
	if !ok {
		return nil
	}

	var mentions []Mention

	for _, it := range items {
		item, ok := it.(map[string]any)
		if !ok {
			continue
		}

		date := ""
		if ts, ok := item["creation_date"].(float64); ok {
			date = time.Unix(int64(ts), 0).Format("2006-01-02")
		}

		score := 0
		if s, ok := item["score"].(float64); ok {
			score = int(s)
		}

		answers := 0
		if a, ok := item["answer_count"].(float64); ok {
			answers = int(a)
		}

		owner := ""
		if o, ok := item["owner"].(map[string]any); ok {
			owner = fmt.Sprintf("%v", o["display_name"])
		}

		mentions = append(mentions, Mention{
			Source:   "stackoverflow",
			Title:    fmt.Sprintf("%v", item["title"]),
			URL:      fmt.Sprintf("%v", item["link"]),
			Points:   score,
			Comments: answers,
			Author:   owner,
			Date:     date,
		})
	}

	return mentions
}

// GetMentions returns cached social mentions.
func (s *Service) GetMentions(ctx *gofr.Context) (*SocialStats, error) {
	var cached SocialStats

	val, err := ctx.Redis.Get(ctx, "cache:social").Result()
	if err == nil && val != "" {
		if json.Unmarshal([]byte(val), &cached) == nil {
			return &cached, nil
		}
	}

	return &SocialStats{Mentions: []Mention{}}, nil
}

func fetchJSONMap(ctx *gofr.Context, apiURL string) map[string]any {
	req, err := http.NewRequestWithContext(ctx.Context, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		ctx.Logger.Errorf("Fetch error for %s: %v", apiURL, err)
		return nil
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		ctx.Logger.Errorf("API %s returned %d", apiURL, resp.StatusCode)
		return nil
	}

	body, _ := io.ReadAll(resp.Body)

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil
	}

	return result
}
