export type MoneyAmount = {
  amount: number;
  currency: string;
};

export type AccountingQuantity = {
  amount: number;
  unit: string;
};

export type ProcessingKind =
  | "cleaning"
  | "trimming"
  | "defrosting"
  | "boiling"
  | "frying"
  | "baking"
  | "drying"
  | "absorption"
  | "portioning"
  | "custom";

export type ProcessingYieldRule = {
  id?: string;
  name: string;
  kind: ProcessingKind;
  /**
   * Output as a percent of input. 70 means 1000 g input becomes 700 g output.
   * Values above 100 are valid for absorption, for example rice after boiling.
   */
  yieldPercent: number;
  note?: string;
};

export type RecipeLineQuantityMode = "stock_input" | "prepared_output";

export type RecipeIngredientLine = {
  id: string;
  productId: string;
  productName?: string;
  quantity: AccountingQuantity;
  quantityMode: RecipeLineQuantityMode;
  processing?: ProcessingYieldRule[];
  extraWastePercent?: number;
};

export type RecipeCard = {
  id: string;
  name: string;
  version: string;
  kmrsMenuItemId?: string;
  yieldQuantity: AccountingQuantity;
  salePrice?: MoneyAmount;
  targetFoodCostPercent?: number;
  lines: RecipeIngredientLine[];
};

export type ProductCostSnapshot = {
  productId: string;
  costPerUnit: MoneyAmount;
  unit: string;
  source?: "average" | "fifo" | "last_purchase" | "manual";
};

export type CostedRecipeLine = {
  lineId: string;
  productId: string;
  productName?: string;
  unit: string;
  stockInputQuantity: number;
  preparedOutputQuantity: number;
  processingDeltaQuantity: number;
  effectiveYieldPercent: number;
  cost: MoneyAmount;
};

export type RecipeCostSummary = {
  recipeId: string;
  recipeName: string;
  version: string;
  currency: string;
  totalCost: MoneyAmount;
  costPerYieldUnit: MoneyAmount;
  foodCostPercent?: number;
  grossMargin?: MoneyAmount;
  recommendedSalePrice?: MoneyAmount;
  lines: CostedRecipeLine[];
};

export function calculateEffectiveYieldFactor(rules: ProcessingYieldRule[] = []): number {
  return rules.reduce((factor, rule) => {
    assertPositiveFinite(rule.yieldPercent, `yieldPercent for ${rule.name}`);
    return factor * (rule.yieldPercent / 100);
  }, 1);
}

export function calculateProcessedQuantity(inputQuantity: number, rules: ProcessingYieldRule[] = []): number {
  assertNonNegativeFinite(inputQuantity, "inputQuantity");
  return inputQuantity * calculateEffectiveYieldFactor(rules);
}

export function calculateRequiredInput(preparedOutputQuantity: number, rules: ProcessingYieldRule[] = []): number {
  assertNonNegativeFinite(preparedOutputQuantity, "preparedOutputQuantity");

  const factor = calculateEffectiveYieldFactor(rules);
  assertPositiveFinite(factor, "effective yield factor");

  return preparedOutputQuantity / factor;
}

export function calculateRecipeCost(
  recipe: RecipeCard,
  costs: ProductCostSnapshot[],
): RecipeCostSummary {
  assertPositiveFinite(recipe.yieldQuantity.amount, "recipe yieldQuantity.amount");

  const costsByProduct = new Map(costs.map((cost) => [cost.productId, cost]));
  const lines = recipe.lines.map((line) => costRecipeLine(line, costsByProduct));
  const currency = resolveCurrency(recipe, lines);
  const totalCostAmount = lines.reduce((sum, line) => sum + line.cost.amount, 0);
  const costPerYieldUnitAmount = totalCostAmount / recipe.yieldQuantity.amount;
  const foodCostPercent = recipe.salePrice
    ? (costPerYieldUnitAmount / recipe.salePrice.amount) * 100
    : undefined;
  const grossMargin = recipe.salePrice
    ? { amount: recipe.salePrice.amount - costPerYieldUnitAmount, currency }
    : undefined;
  const recommendedSalePrice = recipe.targetFoodCostPercent
    ? { amount: costPerYieldUnitAmount / (recipe.targetFoodCostPercent / 100), currency }
    : undefined;

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    version: recipe.version,
    currency,
    totalCost: { amount: totalCostAmount, currency },
    costPerYieldUnit: { amount: costPerYieldUnitAmount, currency },
    lines,
    ...(foodCostPercent !== undefined ? { foodCostPercent } : {}),
    ...(grossMargin !== undefined ? { grossMargin } : {}),
    ...(recommendedSalePrice !== undefined ? { recommendedSalePrice } : {}),
  };
}

function costRecipeLine(
  line: RecipeIngredientLine,
  costsByProduct: Map<string, ProductCostSnapshot>,
): CostedRecipeLine {
  assertNonNegativeFinite(line.quantity.amount, `quantity.amount for ${line.id}`);

  const cost = costsByProduct.get(line.productId);
  if (!cost) {
    throw new Error(`Missing cost snapshot for product ${line.productId}`);
  }

  if (cost.unit !== line.quantity.unit) {
    throw new Error(
      `Cost unit mismatch for product ${line.productId}: expected ${line.quantity.unit}, got ${cost.unit}`,
    );
  }

  const effectiveYieldFactor = calculateEffectiveYieldFactor(line.processing);
  const extraWasteFactor = 1 + ((line.extraWastePercent ?? 0) / 100);
  assertPositiveFinite(extraWasteFactor, `extraWastePercent for ${line.id}`);

  const baseStockInputQuantity =
    line.quantityMode === "prepared_output"
      ? calculateRequiredInput(line.quantity.amount, line.processing)
      : line.quantity.amount;

  const stockInputQuantity = baseStockInputQuantity * extraWasteFactor;
  const preparedOutputQuantity =
    line.quantityMode === "prepared_output"
      ? line.quantity.amount
      : calculateProcessedQuantity(line.quantity.amount, line.processing);

  return {
    lineId: line.id,
    productId: line.productId,
    unit: line.quantity.unit,
    stockInputQuantity,
    preparedOutputQuantity,
    processingDeltaQuantity: stockInputQuantity - preparedOutputQuantity,
    effectiveYieldPercent: effectiveYieldFactor * 100,
    cost: {
      amount: stockInputQuantity * cost.costPerUnit.amount,
      currency: cost.costPerUnit.currency,
    },
    ...(line.productName !== undefined ? { productName: line.productName } : {}),
  };
}

function resolveCurrency(recipe: RecipeCard, lines: CostedRecipeLine[]): string {
  const currency = recipe.salePrice?.currency ?? lines[0]?.cost.currency ?? "TMT";

  for (const line of lines) {
    if (line.cost.currency !== currency) {
      throw new Error(`Mixed currencies are not supported: ${currency} and ${line.cost.currency}`);
    }
  }

  if (recipe.salePrice && recipe.salePrice.currency !== currency) {
    throw new Error(`Sale price currency ${recipe.salePrice.currency} does not match ${currency}`);
  }

  return currency;
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
}
