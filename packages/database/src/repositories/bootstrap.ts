import type { DatabasePool } from "../client.js";

export type BootstrapOrganizationInput = {
  organizationName: string;
  legalName?: string;
  defaultCurrency?: string;
  timezone?: string;
  locationName?: string;
  kmrsMerchantId?: string;
};

export type BootstrapOrganizationResult = {
  organization: {
    id: string;
    name: string;
    defaultCurrency: string;
    timezone: string;
  };
  location: {
    id: string;
    name: string;
    kind: string;
  };
  units: Array<{
    id: string;
    code: string;
    name: string;
    measureType: string;
    isBase: boolean;
  }>;
};

export async function bootstrapOrganization(
  pool: DatabasePool,
  input: BootstrapOrganizationInput,
): Promise<BootstrapOrganizationResult> {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const organizationResult = await client.query<BootstrapOrganizationResult["organization"]>(
      `
        insert into organizations (name, legal_name, default_currency, timezone)
        values ($1, $2, $3, $4)
        returning
          id,
          name,
          default_currency as "defaultCurrency",
          timezone
      `,
      [
        input.organizationName,
        input.legalName ?? null,
        input.defaultCurrency ?? "TMT",
        input.timezone ?? "Asia/Ashgabat",
      ],
    );
    const organization = organizationResult.rows[0];

    if (!organization) {
      throw new Error("Failed to create organization");
    }

    const locationResult = await client.query<BootstrapOrganizationResult["location"]>(
      `
        insert into locations (organization_id, name, kind, kmrs_merchant_id, timezone)
        values ($1, $2, 'restaurant', $3, $4)
        returning id, name, kind
      `,
      [
        organization.id,
        input.locationName ?? organization.name,
        input.kmrsMerchantId ?? null,
        organization.timezone,
      ],
    );
    const location = locationResult.rows[0];

    if (!location) {
      throw new Error("Failed to create location");
    }

    const unitsResult = await client.query<BootstrapOrganizationResult["units"][number]>(
      `
        insert into units (organization_id, code, name, measure_type, is_base)
        values
          ($1, 'g', 'gram', 'weight', true),
          ($1, 'kg', 'kilogram', 'weight', false),
          ($1, 'ml', 'milliliter', 'volume', true),
          ($1, 'l', 'liter', 'volume', false),
          ($1, 'pcs', 'piece', 'count', true)
        returning
          id,
          code,
          name,
          measure_type as "measureType",
          is_base as "isBase"
      `,
      [organization.id],
    );

    await client.query(
      `
        insert into unit_conversions (organization_id, from_unit_id, to_unit_id, factor)
        select $1, kg.id, g.id, 1000
        from units kg
        join units g on g.organization_id = kg.organization_id and g.code = 'g'
        where kg.organization_id = $1 and kg.code = 'kg'
        union all
        select $1, g.id, kg.id, 0.001
        from units g
        join units kg on kg.organization_id = g.organization_id and kg.code = 'kg'
        where g.organization_id = $1 and g.code = 'g'
        union all
        select $1, l.id, ml.id, 1000
        from units l
        join units ml on ml.organization_id = l.organization_id and ml.code = 'ml'
        where l.organization_id = $1 and l.code = 'l'
        union all
        select $1, ml.id, l.id, 0.001
        from units ml
        join units l on l.organization_id = ml.organization_id and l.code = 'l'
        where ml.organization_id = $1 and ml.code = 'ml'
      `,
      [organization.id],
    );

    await client.query("commit");

    return {
      organization,
      location,
      units: unitsResult.rows,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
