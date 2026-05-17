import type { DatabasePool } from "../client.js";

export type KmrsSyncRunRecord = {
  id: string;
  organizationId: string;
  kmrsConnectionId: string | null;
  syncType: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  importedCount: number;
  exportedCount: number;
  errorMessage: string | null;
};

export async function listKmrsSyncRuns(
  pool: DatabasePool,
  organizationId: string,
  options: { limit?: number } = {},
): Promise<KmrsSyncRunRecord[]> {
  const limit = Math.min(options.limit ?? 25, 100);
  const result = await pool.query<KmrsSyncRunRecord>(
    `
      select
        id,
        organization_id as "organizationId",
        kmrs_connection_id as "kmrsConnectionId",
        sync_type as "syncType",
        status,
        started_at as "startedAt",
        finished_at as "finishedAt",
        imported_count as "importedCount",
        exported_count as "exportedCount",
        error_message as "errorMessage"
      from kmrs_sync_runs
      where organization_id = $1
      order by started_at desc
      limit $2
    `,
    [organizationId, limit],
  );

  return result.rows;
}
