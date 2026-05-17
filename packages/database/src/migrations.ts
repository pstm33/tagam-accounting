import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { DatabasePool } from "./client.js";

export type AppliedMigration = {
  name: string;
};

export type MigrationResult = {
  applied: AppliedMigration[];
};

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const migrationsDirectory = join(repositoryRoot, "db", "migrations");

export async function runMigrations(pool: DatabasePool): Promise<MigrationResult> {
  await pool.query(`
    create table if not exists accounting_schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const appliedRows = await pool.query<{ name: string }>(
    "select name from accounting_schema_migrations order by name",
  );
  const appliedNames = new Set(appliedRows.rows.map((row) => row.name));
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));
  const applied: AppliedMigration[] = [];

  for (const migrationFile of migrationFiles) {
    if (appliedNames.has(migrationFile)) {
      continue;
    }

    const sql = await readFile(join(migrationsDirectory, migrationFile), "utf8");
    const client = await pool.connect();

    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into accounting_schema_migrations (name) values ($1)", [migrationFile]);
      await client.query("commit");
      applied.push({ name: migrationFile });
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  return { applied };
}
