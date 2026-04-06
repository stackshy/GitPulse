package migrations

import "gofr.dev/pkg/gofr/migration"

func addRepoSizeColumn() migration.Migrate {
	return migration.Migrate{
		UP: func(d migration.Datasource) error {
			_, err := d.SQL.Exec(`ALTER TABLE daily_traffic ADD COLUMN repo_size INT DEFAULT 0`)
			return err
		},
	}
}
