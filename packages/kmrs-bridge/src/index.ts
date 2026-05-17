export type KmrsBridgeDirection = "kmrs_to_accounting" | "accounting_to_kmrs";

export type KmrsMenuItemImport = {
  merchantId: string;
  kmrsItemId: string;
  categoryId?: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  isAvailable?: boolean;
  raw?: unknown;
};

export type KmrsOrderLineImport = {
  kmrsItemId: string;
  name: string;
  quantity: number;
  salePrice?: number;
  modifiers?: KmrsOrderLineImport[];
  raw?: unknown;
};

export type KmrsOrderImport = {
  merchantId: string;
  orderId: string;
  orderUuid?: string;
  status: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  orderedAt: string;
  lines: KmrsOrderLineImport[];
  raw?: unknown;
};

export type AccountingMenuPublishRequest = {
  merchantId: string;
  kmrsItemId: string;
  approvedByUserId: string;
  price?: number;
  currency?: string;
  description?: string;
  composition?: string;
  allergens?: string[];
  portionNote?: string;
};

export type AccountingStopListPublishRequest = {
  merchantId: string;
  kmrsItemId: string;
  reason: "missing_ingredient" | "manual" | "expired_lot" | "low_stock";
  available: boolean;
  approvedByUserId?: string;
};

export type KmrsBridgeEvent =
  | {
      direction: "kmrs_to_accounting";
      type: "menu_item_imported";
      payload: KmrsMenuItemImport;
    }
  | {
      direction: "kmrs_to_accounting";
      type: "order_imported";
      payload: KmrsOrderImport;
    }
  | {
      direction: "accounting_to_kmrs";
      type: "menu_item_publish_requested";
      payload: AccountingMenuPublishRequest;
    }
  | {
      direction: "accounting_to_kmrs";
      type: "stop_list_publish_requested";
      payload: AccountingStopListPublishRequest;
    };
