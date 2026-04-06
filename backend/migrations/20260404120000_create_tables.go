package migrations

import "gofr.dev/pkg/gofr/migration"

func createTables() migration.Migrate {
	return migration.Migrate{
		UP: func(d migration.Datasource) error {
			_, err := d.SQL.Exec(`
				CREATE TABLE IF NOT EXISTS daily_traffic (
					id INT AUTO_INCREMENT PRIMARY KEY,
					date DATE NOT NULL,
					clones INT DEFAULT 0,
					unique_cloners INT DEFAULT 0,
					views INT DEFAULT 0,
					unique_visitors INT DEFAULT 0,
					stars INT DEFAULT 0,
					forks INT DEFAULT 0,
					open_issues INT DEFAULT 0,
					watchers INT DEFAULT 0,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					UNIQUE KEY idx_date (date)
				)
			`)
			if err != nil {
				return err
			}

			_, err = d.SQL.Exec(`
				CREATE TABLE IF NOT EXISTS referrers (
					id INT AUTO_INCREMENT PRIMARY KEY,
					date DATE NOT NULL,
					referrer VARCHAR(255) NOT NULL,
					count INT DEFAULT 0,
					uniques INT DEFAULT 0,
					UNIQUE KEY idx_date_referrer (date, referrer)
				)
			`)

			return err
		},
	}
}
