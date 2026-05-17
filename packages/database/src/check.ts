import { createDatabasePool } from "./client.js";

const pool = createDatabasePool();

try {
  const result = await pool.query<{ now: Date; database_name: string }>(
    "select now() as now, current_database() as database_name",
  );

  console.log(`Connected to ${result.rows[0]?.database_name ?? "database"} at ${result.rows[0]?.now}`);
} finally {
  await pool.end();
}
