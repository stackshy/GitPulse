package github

import "gofr.dev/pkg/gofr"

type Store struct{}

func NewStore() *Store {
	return &Store{}
}

// UpsertDailyTraffic inserts or updates a daily traffic row.
func (*Store) UpsertDailyTraffic(ctx *gofr.Context, t *DailyTraffic) error {
	_, err := ctx.SQL.ExecContext(ctx, `
		INSERT INTO daily_traffic (date, clones, unique_cloners, views, unique_visitors, stars, forks, open_issues, watchers, repo_size)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			clones = IF(VALUES(clones) > 0, VALUES(clones), clones),
			unique_cloners = IF(VALUES(unique_cloners) > 0, VALUES(unique_cloners), unique_cloners),
			views = IF(VALUES(views) > 0, VALUES(views), views),
			unique_visitors = IF(VALUES(unique_visitors) > 0, VALUES(unique_visitors), unique_visitors),
			stars = IF(VALUES(stars) > 0, VALUES(stars), stars),
			forks = IF(VALUES(forks) > 0, VALUES(forks), forks),
			open_issues = IF(VALUES(open_issues) > 0, VALUES(open_issues), open_issues),
			watchers = IF(VALUES(watchers) > 0, VALUES(watchers), watchers),
			repo_size = IF(VALUES(repo_size) > 0, VALUES(repo_size), repo_size)
	`, t.Date, t.Clones, t.UniqueCloners, t.Views, t.UniqueVisitors, t.Stars, t.Forks, t.OpenIssues, t.Watchers, t.RepoSize)

	return err
}

// UpsertReferrer inserts or updates a referrer row.
func (*Store) UpsertReferrer(ctx *gofr.Context, r *Referrer) error {
	_, err := ctx.SQL.ExecContext(ctx, `
		INSERT INTO referrers (date, referrer, count, uniques)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			count = VALUES(count),
			uniques = VALUES(uniques)
	`, r.Date, r.Referrer, r.Count, r.Uniques)

	return err
}

// UpsertDailyTrafficAffected runs the merge-upsert and returns the MySQL
// affected-rows value: 1=inserted, 2=updated, 0=unchanged.
func (*Store) UpsertDailyTrafficAffected(ctx *gofr.Context, t *DailyTraffic) (int64, error) {
	res, err := ctx.SQL.ExecContext(ctx, `
		INSERT INTO daily_traffic (date, clones, unique_cloners, views, unique_visitors, stars, forks, open_issues, watchers, repo_size)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			clones = IF(VALUES(clones) > 0, VALUES(clones), clones),
			unique_cloners = IF(VALUES(unique_cloners) > 0, VALUES(unique_cloners), unique_cloners),
			views = IF(VALUES(views) > 0, VALUES(views), views),
			unique_visitors = IF(VALUES(unique_visitors) > 0, VALUES(unique_visitors), unique_visitors),
			stars = IF(VALUES(stars) > 0, VALUES(stars), stars),
			forks = IF(VALUES(forks) > 0, VALUES(forks), forks),
			open_issues = IF(VALUES(open_issues) > 0, VALUES(open_issues), open_issues),
			watchers = IF(VALUES(watchers) > 0, VALUES(watchers), watchers),
			repo_size = IF(VALUES(repo_size) > 0, VALUES(repo_size), repo_size)
	`, t.Date, t.Clones, t.UniqueCloners, t.Views, t.UniqueVisitors, t.Stars, t.Forks, t.OpenIssues, t.Watchers, t.RepoSize)
	if err != nil {
		return 0, err
	}

	return res.RowsAffected()
}

// UpsertReferrerAffected runs the upsert and returns the MySQL affected-rows
// value: 1=inserted, 2=updated, 0=unchanged.
func (*Store) UpsertReferrerAffected(ctx *gofr.Context, r *Referrer) (int64, error) {
	res, err := ctx.SQL.ExecContext(ctx, `
		INSERT INTO referrers (date, referrer, count, uniques)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			count = VALUES(count),
			uniques = VALUES(uniques)
	`, r.Date, r.Referrer, r.Count, r.Uniques)
	if err != nil {
		return 0, err
	}

	return res.RowsAffected()
}

// GetTraffic returns daily traffic for a date range.
func (*Store) GetTraffic(ctx *gofr.Context, from, to string) ([]DailyTraffic, error) {
	query := `SELECT id, date, clones, unique_cloners, views, unique_visitors, stars, forks, open_issues, watchers, repo_size
		FROM daily_traffic WHERE 1=1`
	args := make([]any, 0)

	if from != "" {
		query += " AND date >= ?"
		args = append(args, from)
	}

	if to != "" {
		query += " AND date <= ?"
		args = append(args, to)
	}

	query += " ORDER BY date ASC"

	rows, err := ctx.SQL.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var results []DailyTraffic

	for rows.Next() {
		var t DailyTraffic

		if err := rows.Scan(&t.ID, &t.Date, &t.Clones, &t.UniqueCloners, &t.Views, &t.UniqueVisitors,
			&t.Stars, &t.Forks, &t.OpenIssues, &t.Watchers, &t.RepoSize); err != nil {
			return nil, err
		}

		results = append(results, t)
	}

	return results, rows.Err()
}

// GetReferrers returns stored referrers.
func (*Store) GetReferrers(ctx *gofr.Context) ([]Referrer, error) {
	rows, err := ctx.SQL.QueryContext(ctx, `
		SELECT referrer, SUM(count) as count, SUM(uniques) as uniques
		FROM referrers
		GROUP BY referrer
		ORDER BY count DESC
		LIMIT 20
	`)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var results []Referrer

	for rows.Next() {
		var r Referrer
		if err := rows.Scan(&r.Referrer, &r.Count, &r.Uniques); err != nil {
			return nil, err
		}

		results = append(results, r)
	}

	return results, rows.Err()
}

// GetAllTraffic returns all daily traffic rows (for backup).
func (*Store) GetAllTraffic(ctx *gofr.Context) ([]DailyTraffic, error) {
	rows, err := ctx.SQL.QueryContext(ctx, `
		SELECT id, date, clones, unique_cloners, views, unique_visitors, stars, forks, open_issues, watchers, repo_size
		FROM daily_traffic ORDER BY date ASC
	`)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var results []DailyTraffic

	for rows.Next() {
		var t DailyTraffic

		if err := rows.Scan(&t.ID, &t.Date, &t.Clones, &t.UniqueCloners, &t.Views, &t.UniqueVisitors,
			&t.Stars, &t.Forks, &t.OpenIssues, &t.Watchers, &t.RepoSize); err != nil {
			return nil, err
		}

		results = append(results, t)
	}

	return results, rows.Err()
}

// GetAllReferrers returns all referrer rows (for backup).
func (*Store) GetAllReferrers(ctx *gofr.Context) ([]Referrer, error) {
	rows, err := ctx.SQL.QueryContext(ctx, `
		SELECT id, date, referrer, count, uniques FROM referrers ORDER BY date ASC
	`)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var results []Referrer

	for rows.Next() {
		var r Referrer
		if err := rows.Scan(&r.ID, &r.Date, &r.Referrer, &r.Count, &r.Uniques); err != nil {
			return nil, err
		}

		results = append(results, r)
	}

	return results, rows.Err()
}

// TrafficCount returns count of rows in daily_traffic.
func (*Store) TrafficCount(ctx *gofr.Context) (int, error) {
	var count int
	err := ctx.SQL.QueryRowContext(ctx, `SELECT COUNT(*) FROM daily_traffic`).Scan(&count)

	return count, err
}

// GetTotals returns sum of all traffic.
func (*Store) GetTotals(ctx *gofr.Context) (totalClones, totalViews int, err error) {
	err = ctx.SQL.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(clones), 0), COALESCE(SUM(views), 0) FROM daily_traffic
	`).Scan(&totalClones, &totalViews)

	return totalClones, totalViews, err
}
