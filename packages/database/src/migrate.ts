import { createDatabasePool } from "./client.js";
import { runMigrations } from "./migrations.js";

const pool = createDatabasePool();

try {
  const result = await runMigrations(pool);

  for (const migration of result.applied) {
    console.log(`Applied ${migration.name}`);
  }

  if (result.applied.length === 0) {
    console.log("Database is already up to date");
  }
} finally {
  await pool.end();
}
