import "dotenv/config";

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for TAGAM Accounting database access");
  }

  return databaseUrl;
}
