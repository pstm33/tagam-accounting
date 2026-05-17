import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const migrationsDirectory = join(repositoryRoot, "db", "migrations");
const expectedTableCount = 65;

const db = new PGlite();

try {
  await db.exec(getPgliteCompatibilitySql());

  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of migrationFiles) {
    const rawSql = await readFile(join(migrationsDirectory, fileName), "utf8");
    await db.exec(stripUnsupportedExtensions(rawSql));
    console.log(`Smoke applied ${fileName}`);
  }

  const result = await db.query<{ table_count: number }>(
    "select count(*)::int as table_count from information_schema.tables where table_schema = 'public'",
  );
  const tableCount = result.rows[0]?.table_count ?? 0;

  if (tableCount < expectedTableCount) {
    throw new Error(`Expected at least ${expectedTableCount} tables, got ${tableCount}`);
  }

  console.log(`Migration smoke passed with ${tableCount} public tables`);
} finally {
  await db.close();
}

function stripUnsupportedExtensions(sql: string): string {
  return sql.replace(/^create extension if not exists pgcrypto;\s*/i, "");
}

function getPgliteCompatibilitySql(): string {
  return `
    create or replace function gen_random_uuid() returns uuid as $$
      select (
        substr(md5(random()::text || clock_timestamp()::text), 1, 8) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 9, 4) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 13, 4) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 17, 4) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 21, 12)
      )::uuid;
    $$ language sql volatile;
  `;
}
