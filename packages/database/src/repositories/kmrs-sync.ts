import type { DatabasePool } from "../client.js";

export type KmrsSyncRunRecord = {
  id: string;
  organizationId: string;
  kmrsConnectionId: string | null;
  locationId: string | null;
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
  options: { locationId?: string; kmrsConnectionId?: string; limit?: number } = {},
): Promise<KmrsSyncRunRecord[]> {
  const limit = Math.min(options.limit ?? 25, 100);
  const params: unknown[] = [organizationId, limit];
  const clauses = ["ksr.organization_id = $1"];

  if (options.locationId) {
    params.push(options.locationId);
    clauses.push(`kc.location_id = $${params.length}`);
  }

  if (options.kmrsConnectionId) {
    params.push(options.kmrsConnectionId);
    clauses.push(`ksr.kmrs_connection_id = $${params.length}`);
  }

  const result = await pool.query<KmrsSyncRunRecord>(
    `
      select
        ksr.id,
        ksr.organization_id as "organizationId",
        ksr.kmrs_connection_id as "kmrsConnectionId",
        kc.location_id as "locationId",
        ksr.sync_type as "syncType",
        ksr.status,
        ksr.started_at as "startedAt",
        ksr.finished_at as "finishedAt",
        ksr.imported_count as "importedCount",
        ksr.exported_count as "exportedCount",
        ksr.error_message as "errorMessage"
      from kmrs_sync_runs ksr
      left join kmrs_connections kc on kc.id = ksr.kmrs_connection_id
      where ${clauses.join(" and ")}
      order by ksr.started_at desc
      limit $2
    `,
    params,
  );

  return result.rows;
}
