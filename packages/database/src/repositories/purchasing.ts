import type { DatabaseClient, DatabasePool } from "../client.js";

export type SupplierRecord = {
  id: string;
  organizationId: string;
  name: string;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  paymentTerms: string | null;
  reliabilityScore: string | null;
  isActive: boolean;
};

export type ReceivingDocumentRecord = {
  id: string;
  locationId: string;
  locationName: string;
  supplierId: string | null;
  supplierName: string | null;
  documentNumber: string | null;
  status: string;
  receivedAt: string;
  lineCount: number;
  totalCost: string;
  currency: string | null;
};

export type InvoiceDocumentRecord = {
  id: string;
  locationId: string;
  locationName: string;
  supplierId: string | null;
  supplierName: string | null;
  receivingDocumentId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  status: string;
  subtotal: string | null;
  total: string | null;
  currency: string | null;
};

export type SupplierPriceRecord = {
  productId: string;
  productName: string;
  supplierId: string | null;
  supplierName: string | null;
  unitId: string;
  unitCode: string;
  unitPrice: string;
  currency: string;
  observedAt: string;
};

export type PurchasingOverviewRecord = {
  suppliers: SupplierRecord[];
  receivingDocuments: ReceivingDocumentRecord[];
  invoiceDocuments: InvoiceDocumentRecord[];
  latestPrices: SupplierPriceRecord[];
};

export type CreateSupplierInput = {
  organizationId: string;
  name: string;
  taxId?: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentTerms?: string;
  reliabilityScore?: number;
};

export type CreatePurchaseReceiptLineInput = {
  productId: string;
  quantity: number;
  unitId: string;
  unitPrice: number;
  lotCode?: string;
};

export type CreatePurchaseReceiptInput = {
  organizationId: string;
  locationId: string;
  supplierId: string;
  documentNumber?: string;
  invoiceNumber?: string;
  receivedAt?: string;
  invoiceDate?: string;
  currency?: string;
  lines: CreatePurchaseReceiptLineInput[];
};

export type PurchaseReceiptResult = {
  receivingDocumentId: string;
  invoiceDocumentId: string;
  documentNumber: string;
  invoiceNumber: string;
  lineCount: number;
  total: number;
  currency: string;
};

type ProductUnitRow = {
  id: string;
  name: string;
  baseUnitId: string;
  baseUnitCode: string;
};

type UnitRow = {
  id: string;
  code: string;
};

type ReceiptLinePrepared = {
  product: ProductUnitRow;
  input: CreatePurchaseReceiptLineInput;
  receivedUnit: UnitRow;
  baseQuantity: number;
  baseUnitCost: number;
  lineTotal: number;
  vendorItemId: string;
  receivingLineId: string;
};

type IdRow = {
  id: string;
};

const defaultCurrency = "TMT";

export async function listSuppliers(
  pool: DatabasePool,
  organizationId: string,
  options: { limit?: number } = {},
): Promise<SupplierRecord[]> {
  const limit = Math.min(options.limit ?? 100, 500);
  const result = await pool.query<SupplierRecord>(
    `
      select
        id,
        organization_id as "organizationId",
        name,
        tax_id as "taxId",
        phone,
        email,
        address,
        payment_terms as "paymentTerms",
        reliability_score as "reliabilityScore",
        is_active as "isActive"
      from suppliers
      where organization_id = $1
      order by is_active desc, name
      limit $2
    `,
    [organizationId, limit],
  );

  return result.rows;
}

export async function createSupplier(pool: DatabasePool, input: CreateSupplierInput): Promise<SupplierRecord> {
  validateSupplierInput(input);

  try {
    const result = await pool.query<SupplierRecord>(
      `
        insert into suppliers (
          organization_id,
          name,
          tax_id,
          phone,
          email,
          address,
          payment_terms,
          reliability_score,
          is_active
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, true)
        returning
          id,
          organization_id as "organizationId",
          name,
          tax_id as "taxId",
          phone,
          email,
          address,
          payment_terms as "paymentTerms",
          reliability_score as "reliabilityScore",
          is_active as "isActive"
      `,
      [
        input.organizationId,
        input.name.trim(),
        input.taxId?.trim() || null,
        input.phone?.trim() || null,
        input.email?.trim() || null,
        input.address?.trim() || null,
        input.paymentTerms?.trim() || null,
        input.reliabilityScore ?? null,
      ],
    );
    const supplier = result.rows[0];

    if (!supplier) {
      throw new Error("Failed to create supplier");
    }

    return supplier;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Supplier name already exists");
    }

    throw error;
  }
}

export async function getPurchasingOverview(
  pool: DatabasePool,
  organizationId: string,
  options: { locationId?: string; limit?: number } = {},
): Promise<PurchasingOverviewRecord> {
  const limit = Math.min(options.limit ?? 50, 200);
  const [suppliers, receivingDocuments, invoiceDocuments, latestPrices] = await Promise.all([
    listSuppliers(pool, organizationId, { limit: 500 }),
    listReceivingDocuments(pool, organizationId, { limit, ...(options.locationId ? { locationId: options.locationId } : {}) }),
    listInvoiceDocuments(pool, organizationId, { limit, ...(options.locationId ? { locationId: options.locationId } : {}) }),
    listLatestSupplierPrices(pool, organizationId, { limit }),
  ]);

  return {
    suppliers,
    receivingDocuments,
    invoiceDocuments,
    latestPrices,
  };
}

export async function createPurchaseReceipt(
  pool: DatabasePool,
  input: CreatePurchaseReceiptInput,
): Promise<PurchaseReceiptResult> {
  validateReceiptInput(input);

  const client = await pool.connect();
  const currency = normalizeCurrency(input.currency) ?? defaultCurrency;
  const documentNumber = input.documentNumber?.trim() || `RCV-${compactTimestamp()}`;
  const invoiceNumber = input.invoiceNumber?.trim() || `INV-${documentNumber}`;
  const receivedAt = input.receivedAt?.trim() || new Date().toISOString();
  const invoiceDate = input.invoiceDate?.trim() || receivedAt;

  try {
    await client.query("begin");
    await ensureLocationExists(client, input.organizationId, input.locationId);
    await ensureSupplierExists(client, input.organizationId, input.supplierId);
    await ensureDocumentNumberAvailable(client, input.organizationId, input.locationId, documentNumber);

    const receivingDocumentId = await insertReceivingDocument(client, {
      organizationId: input.organizationId,
      locationId: input.locationId,
      supplierId: input.supplierId,
      documentNumber,
      receivedAt,
    });
    const preparedLines: ReceiptLinePrepared[] = [];

    for (const [index, line] of input.lines.entries()) {
      const product = await loadProduct(client, input.organizationId, line.productId);
      const receivedUnit = await loadUnit(client, input.organizationId, line.unitId);
      const factor = await findConversionFactor(client, input.organizationId, product.id, receivedUnit.id, product.baseUnitId);
      const baseQuantity = line.quantity * factor;
      const baseUnitCost = line.unitPrice / factor;
      const vendorItemId = await upsertVendorItem(client, {
        organizationId: input.organizationId,
        supplierId: input.supplierId,
        product,
        receivedUnit,
        unitPrice: line.unitPrice,
        currency,
        factor,
      });
      const receivingLineId = await insertReceivingLine(client, {
        receivingDocumentId,
        vendorItemId,
        product,
        receivedUnit,
        line,
        baseQuantity,
        baseUnitCost,
        currency,
        lotCode: line.lotCode?.trim() || lotCode(documentNumber, index, product.id),
      });
      const stockLotId = await insertStockLot(client, {
        organizationId: input.organizationId,
        locationId: input.locationId,
        product,
        receivingLineId,
        baseQuantity,
        baseUnitCost,
        currency,
        lotCode: line.lotCode?.trim() || lotCode(documentNumber, index, product.id),
      });
      await insertStockMovement(client, {
        organizationId: input.organizationId,
        locationId: input.locationId,
        product,
        stockLotId,
        receivingLineId,
        baseQuantity,
        baseUnitCost,
        currency,
        documentNumber,
      });
      preparedLines.push({
        product,
        input: line,
        receivedUnit,
        baseQuantity,
        baseUnitCost,
        lineTotal: line.quantity * line.unitPrice,
        vendorItemId,
        receivingLineId,
      });
    }

    const total = preparedLines.reduce((sum, line) => sum + line.lineTotal, 0);
    const invoiceDocumentId = await insertInvoiceDocument(client, {
      organizationId: input.organizationId,
      locationId: input.locationId,
      supplierId: input.supplierId,
      receivingDocumentId,
      invoiceNumber,
      invoiceDate,
      total,
      currency,
    });

    for (const line of preparedLines) {
      const invoiceLineId = await insertInvoiceLine(client, {
        invoiceDocumentId,
        line,
      });
      await insertSupplierPriceHistory(client, {
        organizationId: input.organizationId,
        supplierId: input.supplierId,
        invoiceLineId,
        line,
        currency,
      });
    }

    await client.query("commit");

    return {
      receivingDocumentId,
      invoiceDocumentId,
      documentNumber,
      invoiceNumber,
      lineCount: preparedLines.length,
      total,
      currency,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function listReceivingDocuments(
  pool: DatabasePool,
  organizationId: string,
  options: { locationId?: string; limit?: number },
): Promise<ReceivingDocumentRecord[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const params: unknown[] = [organizationId, limit];
  const locationClause = options.locationId ? "and rd.location_id = $3" : "";

  if (options.locationId) {
    params.push(options.locationId);
  }

  const result = await pool.query<ReceivingDocumentRecord>(
    `
      select
        rd.id,
        rd.location_id as "locationId",
        l.name as "locationName",
        rd.supplier_id as "supplierId",
        s.name as "supplierName",
        rd.document_number as "documentNumber",
        rd.status,
        rd.received_at as "receivedAt",
        count(rl.id)::int as "lineCount",
        coalesce(sum(rl.base_quantity * coalesce(rl.unit_cost, 0)), 0) as "totalCost",
        min(rl.currency) as currency
      from receiving_documents rd
      join locations l on l.id = rd.location_id
      left join suppliers s on s.id = rd.supplier_id
      left join receiving_lines rl on rl.receiving_document_id = rd.id
      where rd.organization_id = $1
        ${locationClause}
      group by rd.id, l.name, s.name
      order by rd.received_at desc, rd.created_at desc
      limit $2
    `,
    params,
  );

  return result.rows;
}

async function listInvoiceDocuments(
  pool: DatabasePool,
  organizationId: string,
  options: { locationId?: string; limit?: number },
): Promise<InvoiceDocumentRecord[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const params: unknown[] = [organizationId, limit];
  const locationClause = options.locationId ? "and inv.location_id = $3" : "";

  if (options.locationId) {
    params.push(options.locationId);
  }

  const result = await pool.query<InvoiceDocumentRecord>(
    `
      select
        inv.id,
        inv.location_id as "locationId",
        l.name as "locationName",
        inv.supplier_id as "supplierId",
        s.name as "supplierName",
        inv.receiving_document_id as "receivingDocumentId",
        inv.invoice_number as "invoiceNumber",
        inv.invoice_date as "invoiceDate",
        inv.status,
        inv.subtotal,
        inv.total,
        inv.currency
      from invoice_documents inv
      join locations l on l.id = inv.location_id
      left join suppliers s on s.id = inv.supplier_id
      where inv.organization_id = $1
        ${locationClause}
      order by inv.invoice_date desc nulls last, inv.created_at desc
      limit $2
    `,
    params,
  );

  return result.rows;
}

async function listLatestSupplierPrices(
  pool: DatabasePool,
  organizationId: string,
  options: { limit?: number },
): Promise<SupplierPriceRecord[]> {
  const limit = Math.min(options.limit ?? 50, 200);
  const result = await pool.query<SupplierPriceRecord>(
    `
      with ranked as (
        select
          sph.product_id as "productId",
          p.name as "productName",
          sph.supplier_id as "supplierId",
          s.name as "supplierName",
          sph.unit_id as "unitId",
          u.code as "unitCode",
          sph.unit_price as "unitPrice",
          sph.currency,
          sph.observed_at as "observedAt",
          row_number() over (
            partition by sph.product_id
            order by sph.observed_at desc, sph.id desc
          ) as rn
        from supplier_price_history sph
        join products p on p.id = sph.product_id
        join units u on u.id = sph.unit_id
        left join suppliers s on s.id = sph.supplier_id
        where sph.organization_id = $1
      )
      select
        "productId",
        "productName",
        "supplierId",
        "supplierName",
        "unitId",
        "unitCode",
        "unitPrice",
        currency,
        "observedAt"
      from ranked
      where rn = 1
      order by "productName"
      limit $2
    `,
    [organizationId, limit],
  );

  return result.rows;
}

function validateSupplierInput(input: CreateSupplierInput): void {
  if (!input.organizationId.trim()) {
    throw new Error("organizationId is required");
  }

  if (!input.name.trim()) {
    throw new Error("name is required");
  }

  if (
    input.reliabilityScore !== undefined &&
    (!Number.isFinite(input.reliabilityScore) || input.reliabilityScore < 0)
  ) {
    throw new Error("reliabilityScore must be zero or greater");
  }
}

function validateReceiptInput(input: CreatePurchaseReceiptInput): void {
  if (!input.organizationId.trim()) {
    throw new Error("organizationId is required");
  }

  if (!input.locationId.trim()) {
    throw new Error("locationId is required");
  }

  if (!input.supplierId.trim()) {
    throw new Error("supplierId is required");
  }

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error("lines must contain at least one purchase line");
  }

  for (const [index, line] of input.lines.entries()) {
    if (!line.productId.trim()) {
      throw new Error(`lines[${index}].productId is required`);
    }

    if (!line.unitId.trim()) {
      throw new Error(`lines[${index}].unitId is required`);
    }

    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error(`lines[${index}].quantity must be greater than zero`);
    }

    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      throw new Error(`lines[${index}].unitPrice must be zero or greater`);
    }
  }
}

async function ensureLocationExists(client: DatabaseClient, organizationId: string, locationId: string): Promise<void> {
  const result = await client.query(
    "select id from locations where organization_id = $1 and id = $2 limit 1",
    [organizationId, locationId],
  );

  if (!result.rows[0]) {
    throw new Error("Location was not found");
  }
}

async function ensureSupplierExists(client: DatabaseClient, organizationId: string, supplierId: string): Promise<void> {
  const result = await client.query(
    "select id from suppliers where organization_id = $1 and id = $2 and is_active = true limit 1",
    [organizationId, supplierId],
  );

  if (!result.rows[0]) {
    throw new Error("Supplier was not found");
  }
}

async function ensureDocumentNumberAvailable(
  client: DatabaseClient,
  organizationId: string,
  locationId: string,
  documentNumber: string,
): Promise<void> {
  const result = await client.query(
    `
      select id
      from receiving_documents
      where organization_id = $1
        and location_id = $2
        and document_number = $3
      limit 1
    `,
    [organizationId, locationId, documentNumber],
  );

  if (result.rows[0]) {
    throw new Error("Receiving document number already exists");
  }
}

async function loadProduct(
  client: DatabaseClient,
  organizationId: string,
  productId: string,
): Promise<ProductUnitRow> {
  const result = await client.query<ProductUnitRow>(
    `
      select
        p.id,
        p.name,
        p.base_unit_id as "baseUnitId",
        u.code as "baseUnitCode"
      from products p
      join units u on u.id = p.base_unit_id
      where p.organization_id = $1
        and p.id = $2
        and p.is_active = true
      limit 1
    `,
    [organizationId, productId],
  );
  const product = result.rows[0];

  if (!product) {
    throw new Error("Product was not found");
  }

  return product;
}

async function loadUnit(client: DatabaseClient, organizationId: string, unitId: string): Promise<UnitRow> {
  const result = await client.query<UnitRow>(
    "select id, code from units where organization_id = $1 and id = $2 limit 1",
    [organizationId, unitId],
  );
  const unit = result.rows[0];

  if (!unit) {
    throw new Error("Unit was not found");
  }

  return unit;
}

async function findConversionFactor(
  client: DatabaseClient,
  organizationId: string,
  productId: string,
  fromUnitId: string,
  toUnitId: string,
): Promise<number> {
  if (fromUnitId === toUnitId) {
    return 1;
  }

  const result = await client.query<{ factor: string | null }>(
    `
      select coalesce(product_conversion.factor, global_conversion.factor) as factor
      from (select 1) seed
      left join unit_conversions product_conversion
        on product_conversion.organization_id = $1
        and product_conversion.product_id = $2
        and product_conversion.from_unit_id = $3
        and product_conversion.to_unit_id = $4
      left join unit_conversions global_conversion
        on global_conversion.organization_id = $1
        and global_conversion.product_id is null
        and global_conversion.from_unit_id = $3
        and global_conversion.to_unit_id = $4
      limit 1
    `,
    [organizationId, productId, fromUnitId, toUnitId],
  );
  const factor = result.rows[0]?.factor ? Number(result.rows[0].factor) : null;

  if (factor === null || !Number.isFinite(factor) || factor <= 0) {
    throw new Error("Unit conversion was not found");
  }

  return factor;
}

async function insertReceivingDocument(
  client: DatabaseClient,
  input: {
    organizationId: string;
    locationId: string;
    supplierId: string;
    documentNumber: string;
    receivedAt: string;
  },
): Promise<string> {
  const result = await client.query<IdRow>(
    `
      insert into receiving_documents (
        organization_id,
        location_id,
        supplier_id,
        document_number,
        status,
        received_at
      )
      values ($1, $2, $3, $4, 'posted', $5::timestamptz)
      returning id
    `,
    [input.organizationId, input.locationId, input.supplierId, input.documentNumber, input.receivedAt],
  );

  return getId(result.rows[0], "receiving document");
}

async function upsertVendorItem(
  client: DatabaseClient,
  input: {
    organizationId: string;
    supplierId: string;
    product: ProductUnitRow;
    receivedUnit: UnitRow;
    unitPrice: number;
    currency: string;
    factor: number;
  },
): Promise<string> {
  const result = await client.query<IdRow>(
    `
      insert into vendor_items (
        organization_id,
        supplier_id,
        product_id,
        vendor_sku,
        vendor_name,
        purchase_unit_id,
        inventory_unit_id,
        purchase_to_inventory_factor,
        pack_description,
        last_price,
        last_price_currency,
        review_status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'mapped')
      on conflict (organization_id, supplier_id, vendor_sku)
      do update set
        product_id = excluded.product_id,
        vendor_name = excluded.vendor_name,
        purchase_unit_id = excluded.purchase_unit_id,
        inventory_unit_id = excluded.inventory_unit_id,
        purchase_to_inventory_factor = excluded.purchase_to_inventory_factor,
        pack_description = excluded.pack_description,
        last_price = excluded.last_price,
        last_price_currency = excluded.last_price_currency,
        review_status = 'mapped',
        updated_at = now()
      returning id
    `,
    [
      input.organizationId,
      input.supplierId,
      input.product.id,
      `MANUAL-${input.product.id}-${input.receivedUnit.id}`,
      input.product.name,
      input.receivedUnit.id,
      input.product.baseUnitId,
      input.factor,
      `1 ${input.receivedUnit.code}`,
      input.unitPrice,
      input.currency,
    ],
  );

  return getId(result.rows[0], "vendor item");
}

async function insertReceivingLine(
  client: DatabaseClient,
  input: {
    receivingDocumentId: string;
    vendorItemId: string;
    product: ProductUnitRow;
    receivedUnit: UnitRow;
    line: CreatePurchaseReceiptLineInput;
    baseQuantity: number;
    baseUnitCost: number;
    currency: string;
    lotCode: string;
  },
): Promise<string> {
  const result = await client.query<IdRow>(
    `
      insert into receiving_lines (
        receiving_document_id,
        vendor_item_id,
        product_id,
        received_quantity,
        received_unit_id,
        base_quantity,
        base_unit_id,
        unit_cost,
        currency,
        lot_code
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning id
    `,
    [
      input.receivingDocumentId,
      input.vendorItemId,
      input.product.id,
      input.line.quantity,
      input.receivedUnit.id,
      input.baseQuantity,
      input.product.baseUnitId,
      input.baseUnitCost,
      input.currency,
      input.lotCode,
    ],
  );

  return getId(result.rows[0], "receiving line");
}

async function insertStockLot(
  client: DatabaseClient,
  input: {
    organizationId: string;
    locationId: string;
    product: ProductUnitRow;
    receivingLineId: string;
    baseQuantity: number;
    baseUnitCost: number;
    currency: string;
    lotCode: string;
  },
): Promise<string> {
  const result = await client.query<IdRow>(
    `
      insert into stock_lots (
        organization_id,
        location_id,
        product_id,
        source_receiving_line_id,
        lot_code,
        base_unit_id,
        initial_quantity,
        current_quantity,
        unit_cost,
        currency
      )
      values ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9)
      returning id
    `,
    [
      input.organizationId,
      input.locationId,
      input.product.id,
      input.receivingLineId,
      input.lotCode,
      input.product.baseUnitId,
      input.baseQuantity,
      input.baseUnitCost,
      input.currency,
    ],
  );

  return getId(result.rows[0], "stock lot");
}

async function insertStockMovement(
  client: DatabaseClient,
  input: {
    organizationId: string;
    locationId: string;
    product: ProductUnitRow;
    stockLotId: string;
    receivingLineId: string;
    baseQuantity: number;
    baseUnitCost: number;
    currency: string;
    documentNumber: string;
  },
): Promise<void> {
  await client.query(
    `
      insert into stock_movements (
        organization_id,
        location_id,
        product_id,
        stock_lot_id,
        movement_type,
        quantity_delta,
        unit_id,
        unit_cost,
        currency,
        reference_type,
        reference_id,
        reason
      )
      values ($1, $2, $3, $4, 'purchase_receipt', $5, $6, $7, $8, 'receiving_line', $9, $10)
    `,
    [
      input.organizationId,
      input.locationId,
      input.product.id,
      input.stockLotId,
      input.baseQuantity,
      input.product.baseUnitId,
      input.baseUnitCost,
      input.currency,
      input.receivingLineId,
      `Receiving document ${input.documentNumber}`,
    ],
  );
}

async function insertInvoiceDocument(
  client: DatabaseClient,
  input: {
    organizationId: string;
    locationId: string;
    supplierId: string;
    receivingDocumentId: string;
    invoiceNumber: string;
    invoiceDate: string;
    total: number;
    currency: string;
  },
): Promise<string> {
  const result = await client.query<IdRow>(
    `
      insert into invoice_documents (
        organization_id,
        location_id,
        supplier_id,
        receiving_document_id,
        invoice_number,
        invoice_date,
        status,
        source,
        subtotal,
        tax_total,
        total,
        currency,
        raw_payload
      )
      values ($1, $2, $3, $4, $5, $6::date, 'approved', 'manual', $7, 0, $7, $8, $9::jsonb)
      returning id
    `,
    [
      input.organizationId,
      input.locationId,
      input.supplierId,
      input.receivingDocumentId,
      input.invoiceNumber,
      input.invoiceDate,
      input.total,
      input.currency,
      JSON.stringify({ source: "dashboard_manual_receipt" }),
    ],
  );

  return getId(result.rows[0], "invoice document");
}

async function insertInvoiceLine(
  client: DatabaseClient,
  input: {
    invoiceDocumentId: string;
    line: ReceiptLinePrepared;
  },
): Promise<string> {
  const result = await client.query<IdRow>(
    `
      insert into invoice_lines (
        invoice_document_id,
        receiving_line_id,
        vendor_item_id,
        product_id,
        raw_name,
        invoiced_quantity,
        invoiced_unit_id,
        unit_price,
        line_total,
        tax_total,
        review_status
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'approved')
      returning id
    `,
    [
      input.invoiceDocumentId,
      input.line.receivingLineId,
      input.line.vendorItemId,
      input.line.product.id,
      input.line.product.name,
      input.line.input.quantity,
      input.line.receivedUnit.id,
      input.line.input.unitPrice,
      input.line.lineTotal,
    ],
  );

  return getId(result.rows[0], "invoice line");
}

async function insertSupplierPriceHistory(
  client: DatabaseClient,
  input: {
    organizationId: string;
    supplierId: string;
    invoiceLineId: string;
    line: ReceiptLinePrepared;
    currency: string;
  },
): Promise<void> {
  await client.query(
    `
      insert into supplier_price_history (
        organization_id,
        supplier_id,
        vendor_item_id,
        product_id,
        unit_id,
        unit_price,
        currency,
        observed_at,
        source_invoice_line_id,
        source_receiving_line_id
      )
      values ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9)
    `,
    [
      input.organizationId,
      input.supplierId,
      input.line.vendorItemId,
      input.line.product.id,
      input.line.receivedUnit.id,
      input.line.input.unitPrice,
      input.currency,
      input.invoiceLineId,
      input.line.receivingLineId,
    ],
  );
}

function compactTimestamp(): string {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

function lotCode(documentNumber: string, index: number, productId: string): string {
  const safeDocument = documentNumber.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 40);
  return `${safeDocument}-${index + 1}-${productId.slice(0, 8)}`;
}

function normalizeCurrency(currency: string | undefined): string | undefined {
  const value = currency?.trim().toUpperCase();
  return value && value.length === 3 ? value : undefined;
}

function getId(row: IdRow | undefined, label: string): string {
  if (!row) {
    throw new Error(`Failed to create ${label}`);
  }

  return row.id;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}
