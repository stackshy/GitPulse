package migrations

import "gofr.dev/pkg/gofr/migration"

func All() map[int64]migration.Migrate {
	return map[int64]migration.Migrate{
		20260404120000: createTables(),
		20260404180000: insertMissedMarchData(),
		20260404190000: addRepoSizeColumn(),
	}
}
