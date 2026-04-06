package migrations

import "gofr.dev/pkg/gofr/migration"

// insertMissedMarchData adds March 19 and 20 traffic that was missed
// before the cron started. Numbers from GitHub traffic page.
func insertMissedMarchData() migration.Migrate {
	return migration.Migrate{
		UP: func(d migration.Datasource) error {
			_, err := d.SQL.Exec(`
				INSERT IGNORE INTO daily_traffic
					(date, clones, unique_cloners, views, unique_visitors)
				VALUES
					('2026-03-19', 580, 60, 190, 5),
					('2026-03-20', 520, 10, 20, 2)
			`)

			return err
		},
	}
}
