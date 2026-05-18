#!/usr/bin/env node

const defaultBaseUrl = "https://demo-accounting.tagam.delivery";
const baseUrl = (process.env.ACCOUNTING_BASE_URL || defaultBaseUrl).replace(/\/$/, "");
const username = process.env.ACCOUNTING_USERNAME || "admin";
const password = process.env.ACCOUNTING_PASSWORD || "";
const apiKey = process.env.ACCOUNTING_API_KEY || "";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const activateSeededRecipes = args.has("--activate");
const appendToNonEmptyRecipes = args.has("--append");

const P = {
  beef: "Говядина сырая",
  burgerBox: "Бургер-бокс",
  burgerBun: "Булочка для бургера",
  cheddar: "Сыр чеддер",
  burgerSauce: "Фирменный соус для бургера",
  salmon: "Филе лосося",
  sushiRice: "Рис для суши сырой",
  nori: "Лист нори",
  riceVinegar: "Рисовый уксус",
  sugar: "Сахар",
  salt: "Соль",
  creamCheese: "Сливочный сыр",
  cucumber: "Огурец",
  avocado: "Авокадо",
  tuna: "Филе тунца",
  eel: "Угорь унаги",
  shrimp: "Креветка очищенная",
  crab: "Крабовый микс",
  masago: "Икра масаго",
  sesame: "Кунжут",
  mayo: "Майонез",
  sriracha: "Соус шрирача",
  sesameOil: "Кунжутное масло",
  tempuraFlour: "Мука темпура",
  panko: "Панировочные сухари панко",
  egg: "Яйцо",
  flour: "Мука пшеничная",
  yeast: "Дрожжи сухие",
  oil: "Масло растительное",
  tomatoPuree: "Томатное пюре",
  mozzarella: "Сыр моцарелла",
  pepperoni: "Пепперони",
  ham: "Ветчина",
  pineapple: "Ананас",
  mushrooms: "Шампиньоны",
  bellPepper: "Перец болгарский",
  onion: "Лук репчатый",
  tomato: "Помидор",
  lettuce: "Лист салата",
  pickles: "Маринованные огурцы",
  blackBun: "Черная булочка для бургера",
  veganPatty: "Веганская котлета",
  potatoFries: "Картофель фри",
  chicken: "Филе курицы",
  chickenDrumstick: "Голень куриная",
  chickenWings: "Крылья куриные",
  lamb: "Мякоть баранины",
  lambRibs: "Ребра бараньи",
  veal: "Телятина",
  mussels: "Мидии",
  squid: "Кольца кальмара",
  wokVeg: "Овощная смесь WOK",
  eggNoodles: "Лапша яичная",
  udon: "Лапша удон",
  riceNoodles: "Лапша рисовая",
  soy: "Соевый соус",
  teriyaki: "Соус терияки",
  oyster: "Устричный соус",
  sweetChili: "Сладкий чили соус",
  miso: "Паста мисо",
  dashi: "Даши порошок",
  wakame: "Вакаме",
  tofu: "Тофу",
  tomYum: "Паста том ям",
  coconutMilk: "Кокосовое молоко",
  lime: "Лайм",
  lemongrass: "Лемонграсс",
  chili: "Перец чили",
  cilantro: "Кинза",
  fishSauce: "Рыбный соус",
  ginger: "Имбирь",
  garlic: "Чеснок",
  carrot: "Морковь",
  cabbage: "Капуста",
  saladGreens: "Салатный микс",
  caesarSauce: "Соус цезарь",
  parmesan: "Сыр пармезан",
  croutons: "Сухарики",
  feta: "Сыр фета",
  blueCheese: "Голубой сыр",
  pear: "Груша",
  eggplant: "Баклажан",
  zucchini: "Кабачок",
  corn: "Кукуруза",
  basil: "Базилик",
  spices: "Смесь специй",
  pizzaBox: "Пицца-бокс",
  sushiBox: "Суши-бокс",
  wokBox: "WOK-бокс",
};

const R = {
  sushiRice: "Рис для суши",
  plainRice: "Рис отварной",
  spicySauce: "Спайси соус",
  tempuraBatter: "Кляр темпура",
  bakedRollSauce: "Соус для запекания роллов",
  pizzaDough: "Тесто для пиццы",
  pizzaSauce: "Соус для пиццы",
  wokSauce: "WOK соус",
  misoBase: "Основа мисо супа",
  tomYumBase: "Основа том ям",
  chickenBroth: "Куриный бульон",
  grillMarinade: "Маринад для мангала",
};

const categoryPaths = {
  fish: ["Сырье", "Сырье: рыба и морепродукты"],
  meat: ["Сырье", "Сырье: мясо"],
  poultry: ["Сырье", "Сырье: птица"],
  veg: ["Сырье", "Сырье: овощи и зелень"],
  fruit: ["Сырье", "Сырье: фрукты"],
  dairy: ["Сырье", "Сырье: молочные продукты"],
  grocery: ["Сырье", "Сырье: бакалея"],
  sauces: ["Сырье", "Сырье: соусы и специи"],
  prepSushi: ["Полуфабрикаты", "Полуфабрикаты: суши"],
  prepSauces: ["Полуфабрикаты", "Полуфабрикаты: соусы"],
  prepPizza: ["Полуфабрикаты", "Полуфабрикаты: пицца"],
  prepWok: ["Полуфабрикаты", "Полуфабрикаты: WOK"],
  prepSoup: ["Полуфабрикаты", "Полуфабрикаты: суповые основы"],
  prepGrill: ["Полуфабрикаты", "Полуфабрикаты: мангал"],
  packaging: ["Упаковка", "Упаковка: доставка"],
};

const productDefinitions = [
  product(P.beef, "g", "raw", "meat", 8),
  product(P.burgerBox, "pcs", "packaging", "packaging", 0),
  product(P.burgerBun, "pcs", "raw", "grocery", 0),
  product(P.cheddar, "g", "raw", "dairy", 0),
  product(P.burgerSauce, "g", "raw", "sauces", 0),
  product(P.salmon, "g", "raw", "fish", 8),
  product(P.sushiRice, "g", "raw", "grocery", 1),
  product(P.nori, "pcs", "raw", "grocery", 0),
  product(P.riceVinegar, "g", "raw", "sauces", 0),
  product(P.sugar, "g", "raw", "grocery", 0),
  product(P.salt, "g", "raw", "sauces", 0),
  product(P.creamCheese, "g", "raw", "dairy", 0),
  product(P.cucumber, "g", "raw", "veg", 8),
  product(P.avocado, "g", "raw", "fruit", 18),
  product(P.tuna, "g", "raw", "fish", 6),
  product(P.eel, "g", "prepared", "fish", 2),
  product(P.shrimp, "g", "raw", "fish", 5),
  product(P.crab, "g", "raw", "fish", 2),
  product(P.masago, "g", "raw", "fish", 0),
  product(P.sesame, "g", "raw", "grocery", 0),
  product(P.mayo, "g", "raw", "sauces", 0),
  product(P.sriracha, "g", "raw", "sauces", 0),
  product(P.sesameOil, "g", "raw", "sauces", 0),
  product(P.tempuraFlour, "g", "raw", "grocery", 0),
  product(P.panko, "g", "raw", "grocery", 0),
  product(P.egg, "g", "raw", "grocery", 0),
  product(P.flour, "g", "raw", "grocery", 0),
  product(P.yeast, "g", "raw", "grocery", 0),
  product(P.oil, "g", "raw", "grocery", 0),
  product(P.tomatoPuree, "g", "raw", "sauces", 0),
  product(P.mozzarella, "g", "raw", "dairy", 0),
  product(P.pepperoni, "g", "raw", "meat", 0),
  product(P.ham, "g", "raw", "meat", 0),
  product(P.pineapple, "g", "raw", "fruit", 12),
  product(P.mushrooms, "g", "raw", "veg", 10),
  product(P.bellPepper, "g", "raw", "veg", 12),
  product(P.onion, "g", "raw", "veg", 10),
  product(P.tomato, "g", "raw", "veg", 8),
  product(P.lettuce, "g", "raw", "veg", 12),
  product(P.pickles, "g", "raw", "veg", 0),
  product(P.blackBun, "pcs", "raw", "grocery", 0),
  product(P.veganPatty, "g", "prepared", "prepGrill", 0),
  product(P.potatoFries, "g", "raw", "veg", 8),
  product(P.chicken, "g", "raw", "poultry", 8),
  product(P.chickenDrumstick, "g", "raw", "poultry", 12),
  product(P.chickenWings, "g", "raw", "poultry", 15),
  product(P.lamb, "g", "raw", "meat", 12),
  product(P.lambRibs, "g", "raw", "meat", 18),
  product(P.veal, "g", "raw", "meat", 10),
  product(P.mussels, "g", "raw", "fish", 5),
  product(P.squid, "g", "raw", "fish", 5),
  product(P.wokVeg, "g", "prepared", "prepWok", 0),
  product(P.eggNoodles, "g", "raw", "grocery", 0),
  product(P.udon, "g", "raw", "grocery", 0),
  product(P.riceNoodles, "g", "raw", "grocery", 0),
  product(P.soy, "g", "raw", "sauces", 0),
  product(P.teriyaki, "g", "raw", "sauces", 0),
  product(P.oyster, "g", "raw", "sauces", 0),
  product(P.sweetChili, "g", "raw", "sauces", 0),
  product(P.miso, "g", "raw", "sauces", 0),
  product(P.dashi, "g", "raw", "sauces", 0),
  product(P.wakame, "g", "raw", "grocery", 0),
  product(P.tofu, "g", "raw", "grocery", 0),
  product(P.tomYum, "g", "raw", "sauces", 0),
  product(P.coconutMilk, "g", "raw", "grocery", 0),
  product(P.lime, "g", "raw", "fruit", 12),
  product(P.lemongrass, "g", "raw", "veg", 25),
  product(P.chili, "g", "raw", "veg", 8),
  product(P.cilantro, "g", "raw", "veg", 15),
  product(P.fishSauce, "g", "raw", "sauces", 0),
  product(P.ginger, "g", "raw", "veg", 15),
  product(P.garlic, "g", "raw", "veg", 10),
  product(P.carrot, "g", "raw", "veg", 10),
  product(P.cabbage, "g", "raw", "veg", 8),
  product(P.saladGreens, "g", "raw", "veg", 12),
  product(P.caesarSauce, "g", "raw", "sauces", 0),
  product(P.parmesan, "g", "raw", "dairy", 0),
  product(P.croutons, "g", "raw", "grocery", 0),
  product(P.feta, "g", "raw", "dairy", 0),
  product(P.blueCheese, "g", "raw", "dairy", 0),
  product(P.pear, "g", "raw", "fruit", 15),
  product(P.eggplant, "g", "raw", "veg", 12),
  product(P.zucchini, "g", "raw", "veg", 10),
  product(P.corn, "g", "raw", "veg", 0),
  product(P.basil, "g", "raw", "veg", 20),
  product(P.spices, "g", "raw", "sauces", 0),
  product(P.pizzaBox, "pcs", "packaging", "packaging", 0),
  product(P.sushiBox, "pcs", "packaging", "packaging", 0),
  product(P.wokBox, "pcs", "packaging", "packaging", 0),
];

const prepRecipes = [
  {
    name: R.sushiRice,
    recipeType: "prep_item",
    yieldQuantity: 1000,
    yieldUnit: "g",
    lines: [
      gross(P.sushiRice, 420),
      gross(P.riceVinegar, 70),
      gross(P.sugar, 28),
      gross(P.salt, 7),
    ],
    note: "Стартовая карта заготовки: рис для суши. Вода не учитывается в себестоимости; выход нужно проверить после пробной варки.",
  },
  {
    name: R.plainRice,
    recipeType: "prep_item",
    yieldQuantity: 1000,
    yieldUnit: "g",
    lines: [gross(P.sushiRice, 430), gross(P.salt, 5)],
    note: "Стартовая карта заготовки: отварной рис для WOK и жареного риса. Вода не учитывается в себестоимости.",
  },
  {
    name: R.spicySauce,
    recipeType: "prep_item",
    yieldQuantity: 1000,
    yieldUnit: "g",
    lines: [gross(P.mayo, 720), gross(P.sriracha, 180), gross(P.sesameOil, 35), gross(P.sugar, 25), gross(P.salt, 8)],
    note: "Стартовая карта заготовки: спайси-соус на основе майонеза.",
  },
  {
    name: R.tempuraBatter,
    recipeType: "prep_item",
    yieldQuantity: 1000,
    yieldUnit: "g",
    lines: [gross(P.tempuraFlour, 650), gross(P.egg, 120), gross(P.salt, 8)],
    note: "Стартовая карта заготовки: кляр темпура. Вода и лед не учитываются в себестоимости.",
  },
  {
    name: R.bakedRollSauce,
    recipeType: "prep_item",
    yieldQuantity: 1000,
    yieldUnit: "g",
    lines: [gross(P.mayo, 550), gross(P.creamCheese, 260), gross(P.masago, 90), gross(P.sweetChili, 90), gross(P.salt, 5)],
    note: "Стартовая карта заготовки: соус-шапка для запеченных роллов.",
  },
  {
    name: R.pizzaDough,
    recipeType: "prep_item",
    yieldQuantity: 1000,
    yieldUnit: "g",
    lines: [gross(P.flour, 625), gross(P.oil, 35), gross(P.sugar, 10), gross(P.salt, 13), gross(P.yeast, 8)],
    note: "Стартовая карта заготовки: тесто для пиццы. Вода не учитывается в себестоимости.",
  },
  {
    name: R.pizzaSauce,
    recipeType: "prep_item",
    yieldQuantity: 1000,
    yieldUnit: "g",
    lines: [gross(P.tomatoPuree, 900), gross(P.oil, 35), gross(P.garlic, 20), gross(P.sugar, 15), gross(P.salt, 10), gross(P.basil, 8)],
    note: "Стартовая карта заготовки: томатный соус для пиццы.",
  },
  {
    name: R.wokSauce,
    recipeType: "prep_item",
    yieldQuantity: 1000,
    yieldUnit: "g",
    lines: [gross(P.soy, 420), gross(P.teriyaki, 260), gross(P.oyster, 170), gross(P.sesameOil, 55), gross(P.ginger, 35), gross(P.garlic, 30), gross(P.sugar, 25)],
    note: "Стартовая карта заготовки: универсальный соус WOK.",
  },
  {
    name: R.misoBase,
    recipeType: "prep_item",
    yieldQuantity: 1000,
    yieldUnit: "g",
    lines: [gross(P.miso, 135), gross(P.dashi, 25), gross(P.soy, 35), gross(P.wakame, 18)],
    note: "Стартовая карта заготовки: концентрированная основа мисо-супа. Вода добавляется при отдаче и не учитывается в себестоимости.",
  },
  {
    name: R.tomYumBase,
    recipeType: "prep_item",
    yieldQuantity: 1000,
    yieldUnit: "g",
    lines: [gross(P.tomYum, 180), gross(P.coconutMilk, 360), gross(P.lime, 55), gross(P.lemongrass, 45), gross(P.fishSauce, 45), gross(P.chili, 18), gross(P.ginger, 25)],
    note: "Стартовая карта заготовки: концентрированная основа том ям.",
  },
  {
    name: R.chickenBroth,
    recipeType: "prep_item",
    yieldQuantity: 1000,
    yieldUnit: "g",
    lines: [net(P.chicken, 280, 8), net(P.onion, 80, 10), net(P.carrot, 80, 10), gross(P.salt, 8), gross(P.spices, 4)],
    note: "Стартовая карта заготовки: базовый куриный бульон. Вода не учитывается в себестоимости.",
  },
  {
    name: R.grillMarinade,
    recipeType: "prep_item",
    yieldQuantity: 1000,
    yieldUnit: "g",
    lines: [gross(P.oil, 350), gross(P.onion, 220), gross(P.garlic, 55), gross(P.soy, 90), gross(P.lime, 55), gross(P.spices, 35), gross(P.salt, 20)],
    note: "Стартовая карта заготовки: базовый маринад для мангала.",
  },
];

function product(name, unit, productType, categoryKey, waste) {
  return {
    name,
    unit,
    productType,
    categoryPath: categoryPaths[categoryKey],
    inventoryPolicy: productType === "service" ? "not_tracked" : "tracked",
    defaultWastePercent: waste,
  };
}

function gross(name, quantity, unit = "g", note) {
  return { kind: "product", name, quantity, unit, quantityMode: "stock_input", extraWastePercent: 0, note };
}

function net(name, quantity, waste = 0, unit = "g", note) {
  return { kind: "product", name, quantity, unit, quantityMode: "prepared_output", extraWastePercent: waste, note };
}

function child(name, quantity, unit = "g", note) {
  return { kind: "recipe", name, quantity, unit, quantityMode: "prepared_output", extraWastePercent: 0, note };
}

class ApiClient {
  #cookie = "";

  constructor(base) {
    this.base = base;
  }

  async login() {
    if (apiKey) {
      return;
    }
    if (!password) {
      throw new Error("Set ACCOUNTING_PASSWORD or ACCOUNTING_API_KEY before running this seed.");
    }

    const response = await fetch(`${this.base}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status} ${await response.text()}`);
    }

    const setCookie =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()[0]
        : response.headers.get("set-cookie");
    this.#cookie = setCookie?.split(";")[0] ?? "";

    if (!this.#cookie) {
      throw new Error("Login succeeded but no session cookie was returned.");
    }
  }

  async get(path) {
    return this.request("GET", path);
  }

  async post(path, body) {
    return this.request("POST", path, body);
  }

  async patch(path, body) {
    return this.request("PATCH", path, body);
  }

  async request(method, path, body) {
    const headers = { accept: "application/json" };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }
    if (this.#cookie) {
      headers.cookie = this.#cookie;
    }

    const response = await fetch(`${this.base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const error = payload?.error ?? text;
      throw new Error(`${method} ${path} failed: ${response.status} ${error}`);
    }

    return payload;
  }
}

async function main() {
  const api = new ApiClient(baseUrl);
  await api.login();

  const demo = (await api.get("/v1/demo")).data;
  const organizationId = demo.organization.id;
  const locationId = demo.primaryLocation.id;
  const state = await loadState(api, organizationId, locationId);
  const counters = {
    categoriesCreated: 0,
    productsCreated: 0,
    prepRecipesCreated: 0,
    prepRecipeLinesAdded: 0,
    menuRecipesTouched: 0,
    menuRecipeLinesAdded: 0,
    recipesActivated: 0,
    skippedNonEmpty: 0,
  };

  for (const definition of productDefinitions) {
    await ensureProduct(api, state, organizationId, definition, counters);
  }

  for (const recipe of prepRecipes) {
    const version = await ensureRecipe(api, state, organizationId, recipe, counters);
    const detail = await recipeDetail(api, organizationId, version.recipeVersionId);
    if (detail.lines.length > 0 && !appendToNonEmptyRecipes) {
      counters.skippedNonEmpty += 1;
      continue;
    }

    await addLines(api, state, organizationId, version.recipeVersionId, recipe.lines, counters, "prep");
    await patchRecipe(api, organizationId, version.recipeVersionId, {
      instructions: recipe.note,
      targetFoodCostPercent: 32,
    });
  }

  if (!dryRun) {
    state.recipes = await listRecipes(api, organizationId);
    state.recipeByName = new Map(state.recipes.map((item) => [item.recipeName, item]));
  }

  const menuByRecipeVersionId = new Map(
    state.menuItems
      .filter((item) => item.activeRecipeVersionId)
      .map((item) => [item.activeRecipeVersionId, item]),
  );
  const menuByRecipeName = new Map();
  for (const item of state.menuItems) {
    if (item.recipeName && !menuByRecipeName.has(item.recipeName)) {
      menuByRecipeName.set(item.recipeName, item);
    }
    if (!menuByRecipeName.has(item.name)) {
      menuByRecipeName.set(item.name, item);
    }
  }

  const recipes = state.recipes.filter((recipe) => recipe.recipeType === "menu_item");
  const details = await mapLimit(recipes, 6, async (recipe) => {
    const detail = await recipeDetail(api, organizationId, recipe.recipeVersionId);
    return { recipe, detail };
  });

  for (const { recipe, detail } of details) {
    if (detail.lines.length > 0 && !appendToNonEmptyRecipes) {
      counters.skippedNonEmpty += 1;
      continue;
    }

    const menuItem = menuByRecipeVersionId.get(recipe.recipeVersionId) ?? menuByRecipeName.get(recipe.recipeName);
    const lines = menuRecipeLines(recipe.recipeName, menuItem);
    if (lines.length === 0) {
      continue;
    }

    await addLines(api, state, organizationId, recipe.recipeVersionId, lines, counters, "menu");
    counters.menuRecipesTouched += 1;

    const instructions = starterInstructions(menuItem);
    const patch = { instructions };
    if (activateSeededRecipes) {
      patch.status = "active";
    }
    await patchRecipe(api, organizationId, recipe.recipeVersionId, patch);
    if (activateSeededRecipes) {
      counters.recipesActivated += 1;
    }
  }

  console.log(JSON.stringify({ ok: true, baseUrl, dryRun, activateSeededRecipes, counters }, null, 2));
}

async function loadState(api, organizationId, locationId) {
  const [catalog, products, recipes, menuItems] = await Promise.all([
    api.get(`/v1/catalog?organizationId=${encodeURIComponent(organizationId)}`),
    api.get(`/v1/products?organizationId=${encodeURIComponent(organizationId)}&limit=500`),
    api.get(`/v1/recipes?organizationId=${encodeURIComponent(organizationId)}&limit=500`),
    api.get(
      `/v1/kmrs/menu-items?organizationId=${encodeURIComponent(organizationId)}&locationId=${encodeURIComponent(
        locationId,
      )}&limit=500`,
    ),
  ]);

  const data = catalog.data;
  return {
    organizationId,
    locationId,
    units: data.units,
    unitByCode: new Map(data.units.map((item) => [item.code, item])),
    categories: data.categories,
    categoryByName: new Map(data.categories.map((item) => [item.name, item])),
    products: products.data,
    productByName: new Map(products.data.map((item) => [item.name, item])),
    recipes: recipes.data,
    recipeByName: new Map(recipes.data.map((item) => [item.recipeName, item])),
    menuItems: menuItems.data,
  };
}

async function listRecipes(api, organizationId) {
  return (await api.get(`/v1/recipes?organizationId=${encodeURIComponent(organizationId)}&limit=500`)).data;
}

async function ensureCategory(api, state, organizationId, path, counters) {
  let parentId;
  for (const name of path) {
    const existing = state.categoryByName.get(name);
    if (existing) {
      parentId = existing.id;
      continue;
    }

    if (dryRun) {
      const fake = { id: `dry-${name}`, name, parentId: parentId ?? null };
      state.categoryByName.set(name, fake);
      parentId = fake.id;
      counters.categoriesCreated += 1;
      continue;
    }

    const created = (
      await api.post("/v1/product-categories", {
        organizationId,
        name,
        ...(parentId ? { parentId } : {}),
      })
    ).data;
    state.categories.push(created);
    state.categoryByName.set(created.name, created);
    parentId = created.id;
    counters.categoriesCreated += 1;
  }
  return parentId;
}

async function ensureProduct(api, state, organizationId, definition, counters) {
  const existing = state.productByName.get(definition.name);
  if (existing) {
    return existing;
  }

  const categoryId = await ensureCategory(api, state, organizationId, definition.categoryPath, counters);
  const unit = unitByCode(state, definition.unit);

  if (dryRun) {
    const fake = { id: `dry-product-${definition.name}`, name: definition.name, baseUnitId: unit.id };
    state.productByName.set(definition.name, fake);
    counters.productsCreated += 1;
    return fake;
  }

  const created = (
    await api.post("/v1/products", {
      organizationId,
      categoryId,
      baseUnitId: unit.id,
      name: definition.name,
      productType: definition.productType,
      inventoryPolicy: definition.inventoryPolicy,
      defaultWastePercent: definition.defaultWastePercent,
    })
  ).data;
  state.products.push(created);
  state.productByName.set(created.name, created);
  counters.productsCreated += 1;
  return created;
}

async function ensureRecipe(api, state, organizationId, definition, counters) {
  const existing = state.recipeByName.get(definition.name);
  if (existing) {
    return existing;
  }

  const unit = unitByCode(state, definition.yieldUnit);
  if (dryRun) {
    const fake = {
      recipeId: `dry-recipe-${definition.name}`,
      recipeVersionId: `dry-version-${definition.name}`,
      recipeName: definition.name,
      recipeType: definition.recipeType,
      yieldUnitId: unit.id,
    };
    state.recipeByName.set(definition.name, fake);
    counters.prepRecipesCreated += 1;
    return fake;
  }

  const created = (
    await api.post("/v1/recipes", {
      organizationId,
      name: definition.name,
      recipeType: definition.recipeType,
      yieldQuantity: definition.yieldQuantity,
      yieldUnitId: unit.id,
      targetFoodCostPercent: 32,
      currency: "TMT",
    })
  ).data;
  state.recipes.push(created);
  state.recipeByName.set(created.recipeName, created);
  counters.prepRecipesCreated += 1;
  return created;
}

async function recipeDetail(api, organizationId, recipeVersionId) {
  if (dryRun && String(recipeVersionId).startsWith("dry-version-")) {
    return { lines: [] };
  }

  return (await api.get(`/v1/recipes/${encodeURIComponent(recipeVersionId)}?organizationId=${encodeURIComponent(organizationId)}`)).data;
}

async function addLines(api, state, organizationId, recipeVersionId, lines, counters, bucket) {
  for (const line of mergeLines(lines)) {
    const body = {
      organizationId,
      quantity: roundQuantity(line.quantity),
      unitId: unitByCode(state, line.unit).id,
      quantityMode: line.quantityMode,
      extraWastePercent: line.extraWastePercent ?? 0,
      ...(line.note ? { note: line.note } : {}),
    };

    if (line.kind === "product") {
      const productRecord = state.productByName.get(line.name);
      if (!productRecord) {
        throw new Error(`Product ${line.name} was not created`);
      }
      body.ingredientProductId = productRecord.id;
    } else {
      const recipeRecord = state.recipeByName.get(line.name);
      if (!recipeRecord) {
        throw new Error(`Recipe ${line.name} was not created`);
      }
      body.childRecipeVersionId = recipeRecord.recipeVersionId;
    }

    if (!dryRun) {
      await api.post(`/v1/recipes/${encodeURIComponent(recipeVersionId)}/lines`, body);
    }

    if (bucket === "prep") {
      counters.prepRecipeLinesAdded += 1;
    } else {
      counters.menuRecipeLinesAdded += 1;
    }
  }
}

async function patchRecipe(api, organizationId, recipeVersionId, body) {
  if (dryRun) {
    return;
  }

  await api.patch(`/v1/recipes/${encodeURIComponent(recipeVersionId)}`, {
    organizationId,
    ...body,
  });
}

function unitByCode(state, code) {
  const unit = state.unitByCode.get(code);
  if (!unit) {
    throw new Error(`Missing unit ${code}`);
  }
  return unit;
}

function starterInstructions(menuItem) {
  const category = menuItem?.kmrsCategoryName ? ` KMRS category: ${menuItem.kmrsCategoryName}.` : "";
  return `Starter TTK draft generated from menu name and public average recipes.${category} Quantities, yields, and packaging must be checked by a technologist before production accounting.`;
}

function mergeLines(lines) {
  const map = new Map();
  for (const line of lines.filter((item) => item.quantity > 0)) {
    const key = `${line.kind}:${line.name}:${line.unit}:${line.quantityMode}:${line.extraWastePercent ?? 0}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += line.quantity;
      continue;
    }
    map.set(key, { ...line });
  }
  return [...map.values()];
}

function roundQuantity(value) {
  return Math.round(value * 1000) / 1000;
}

function menuRecipeLines(recipeName, menuItem) {
  const lower = recipeName.toLowerCase();
  const category = (menuItem?.kmrsCategoryName ?? "").toLowerCase();

  if (isSushi(lower, category)) {
    return sushiLines(recipeName, category);
  }
  if (isPizza(lower, category)) {
    return pizzaLines(lower);
  }
  if (lower.includes("бургер")) {
    return burgerLines(lower);
  }
  if (isSoup(lower, category)) {
    return soupLines(lower);
  }
  if (isWok(lower, category)) {
    return wokLines(lower);
  }
  if (isGrill(lower, category)) {
    return grillLines(lower);
  }
  if (isSalad(lower, category)) {
    return saladLines(lower);
  }
  if (isSnack(lower, category)) {
    return snackLines(lower);
  }

  return genericLines(lower);
}

function isSushi(lower, category) {
  return (
    category.includes("филадельф") ||
    category.includes("калифор") ||
    category.includes("ролл") ||
    category.includes("гункан") ||
    category.includes("маки") ||
    category.includes("сеты") ||
    lower.includes("ролл") ||
    lower.includes("гункан") ||
    lower.includes("маки") ||
    lower.includes("сет ") ||
    lower.startsWith("сет") ||
    lower.includes("суши")
  );
}

function isPizza(lower, category) {
  return category.includes("пицц") || lower.includes("пицц") || ["гавайская", "маргарита", "пепперони"].some((item) => lower.includes(item));
}

function isSoup(lower, category) {
  return category.includes("суп") || lower.includes("суп") || lower.includes("том ям");
}

function isWok(lower, category) {
  return category.includes("wok") || category.includes("вок") || lower.includes("жареная лапша") || lower.includes("жареный рис") || lower.includes("wok");
}

function isGrill(lower, category) {
  return category.includes("мангал") || lower.includes("шашлык") || lower.includes("гриль") || lower.includes("голень") || lower.includes("крылыш");
}

function isSalad(lower, category) {
  return category.includes("салат") || lower.includes("салат");
}

function isSnack(lower, category) {
  return category.includes("снек") || lower.includes("фри") || lower.includes("картофель") || lower.includes("наггет");
}

function sushiLines(recipeName, category) {
  const lower = recipeName.toLowerCase();
  if (category.includes("сеты") || lower.startsWith("сет") || lower.includes(" сет")) {
    const pieces = Number(lower.match(/(\d{2})/)?.[1] ?? 24);
    return [
      child(R.sushiRice, pieces * 18),
      gross(P.nori, Math.max(2, Math.ceil(pieces / 8)), "pcs"),
      net(P.salmon, pieces * 5, 5),
      net(P.tuna, pieces * 3, 5),
      net(P.shrimp, pieces * 3, 5),
      gross(P.creamCheese, pieces * 4),
      net(P.cucumber, pieces * 2, 8),
      gross(P.sesame, pieces * 0.6),
      gross(P.sushiBox, 1, "pcs"),
    ];
  }

  if (category.includes("гункан") || lower.includes("гункан")) {
    return [
      child(R.sushiRice, 50),
      gross(P.nori, 0.35, "pcs"),
      ...proteinLines(lower, 34),
      ...(lower.includes("грин") ? [net(P.avocado, 25, 18)] : []),
      ...(lower.includes("инь") || lower.includes("ян") ? [net(P.salmon, 18, 5), net(P.tuna, 18, 5)] : []),
      child(R.spicySauce, 12),
      gross(P.sushiBox, 1, "pcs"),
    ];
  }

  if (category.includes("маки") || lower.includes("маки")) {
    const filling = proteinLines(lower, 42);
    return [
      child(R.sushiRice, 115),
      gross(P.nori, 0.5, "pcs"),
      ...(filling.length > 0 ? filling : [net(P.cucumber, 45, 8)]),
      gross(P.sushiBox, 1, "pcs"),
    ];
  }

  const base = [child(R.sushiRice, 155), gross(P.nori, 1, "pcs")];
  if (category.includes("темпура") || lower.includes("темпура")) {
    return [...base, ...proteinLines(lower, 52), gross(P.creamCheese, 28), net(P.cucumber, 22, 8), child(R.tempuraBatter, 45), gross(P.panko, 20), gross(P.oil, 10), gross(P.sushiBox, 1, "pcs")];
  }
  if (category.includes("запеч") || lower.includes("запеч")) {
    return [...base, ...proteinLines(lower, 48), gross(P.creamCheese, 30), net(P.cucumber, 20, 8), child(R.bakedRollSauce, 38), gross(P.sushiBox, 1, "pcs")];
  }
  if (category.includes("филадельф") || lower.includes("филадельф")) {
    return [...base, net(P.salmon, 75, 5), gross(P.creamCheese, 45), net(P.cucumber, 20, 8), gross(P.sushiBox, 1, "pcs")];
  }
  if (category.includes("калифор") || lower.includes("калифор")) {
    return [...base, net(P.crab, 48, 2), net(P.avocado, 32, 18), net(P.cucumber, 20, 8), gross(P.masago, 18), gross(P.sushiBox, 1, "pcs")];
  }
  if (category.includes("дракон") || lower.includes("дракон")) {
    return [...base, ...(proteinLines(lower, 48).length ? proteinLines(lower, 48) : [net(P.eel, 55, 2)]), net(P.avocado, 32, 18), gross(P.creamCheese, 28), gross(P.teriyaki, 15), gross(P.sesame, 3), gross(P.sushiBox, 1, "pcs")];
  }
  if (category.includes("спайс") || lower.includes("спайс")) {
    return [...base, ...proteinLines(lower, 52), net(P.cucumber, 20, 8), child(R.spicySauce, 26), gross(P.sushiBox, 1, "pcs")];
  }
  if (category.includes("футомаки") || lower.includes("футомаки")) {
    return [...base, ...proteinLines(lower, 55), gross(P.creamCheese, 30), net(P.cucumber, 25, 8), net(P.avocado, 25, 18), gross(P.sushiBox, 1, "pcs")];
  }

  return [...base, ...proteinLines(lower, 50), gross(P.creamCheese, 28), net(P.cucumber, 20, 8), gross(P.sushiBox, 1, "pcs")];
}

function proteinLines(lower, quantity) {
  const lines = [];
  if (lower.includes("лосос") || lower.includes("сакура")) lines.push(net(P.salmon, quantity, 5));
  if (lower.includes("тунц")) lines.push(net(P.tuna, quantity, 5));
  if (lower.includes("угр")) lines.push(net(P.eel, quantity, 2));
  if (lower.includes("кревет")) lines.push(net(P.shrimp, quantity, 5));
  if (lower.includes("краб")) lines.push(net(P.crab, quantity, 2));
  if (lower.includes("куриц") || lower.includes("чикен")) lines.push(net(P.chicken, quantity, 8));
  if (lower.includes("мид")) lines.push(net(P.mussels, quantity, 5));
  if (lower.includes("морепр")) {
    lines.push(net(P.shrimp, quantity * 0.45, 5), net(P.mussels, quantity * 0.3, 5), net(P.squid, quantity * 0.25, 5));
  }
  return lines;
}

function pizzaLines(lower) {
  const lines = [child(R.pizzaDough, 250), child(R.pizzaSauce, 60), gross(P.mozzarella, lower.includes("груша") ? 85 : 120), gross(P.pizzaBox, 1, "pcs")];
  if (lower.includes("пеппер") || lower.includes("мяс")) lines.push(gross(P.pepperoni, 60));
  if (lower.includes("гавай")) lines.push(gross(P.ham, 70), net(P.pineapple, 60, 12));
  if (lower.includes("куриц") || lower.includes("чикен")) lines.push(net(P.chicken, 85, 8));
  if (lower.includes("гриб")) lines.push(net(P.mushrooms, 55, 10));
  if (lower.includes("вегет") || lower.includes("овощ")) lines.push(net(P.mushrooms, 45, 10), net(P.bellPepper, 45, 12), net(P.onion, 25, 10), net(P.tomato, 45, 8));
  if (lower.includes("груша")) lines.push(net(P.pear, 75, 15), gross(P.blueCheese, 45));
  if (lower.includes("маргар") || lower === "маргарита") lines.push(net(P.tomato, 45, 8), gross(P.basil, 5));
  return lines;
}

function burgerLines(lower) {
  const lines = [
    gross(lower.includes("блэк") ? P.blackBun : P.burgerBun, 1, "pcs"),
    gross(P.burgerSauce, 25),
    net(P.lettuce, 15, 12),
    net(P.tomato, 30, 8),
    net(P.onion, 10, 10),
    gross(P.pickles, 15),
    gross(P.burgerBox, 1, "pcs"),
  ];

  if (lower.includes("веган")) {
    lines.push(net(P.veganPatty, 110, 0));
  } else if (lower.includes("чикен") || lower.includes("куриц")) {
    lines.push(net(P.chicken, 135, 8));
  } else {
    lines.push(net(P.beef, lower.includes("xxl") ? 220 : 155, 18));
  }
  if (lower.includes("чиз") || lower.includes("сыр") || !lower.includes("веган")) {
    lines.push(gross(P.cheddar, lower.includes("xxl") ? 35 : 25));
  }
  if (lower.includes("овощ")) {
    lines.push(net(P.eggplant, 25, 12), net(P.zucchini, 25, 10), net(P.bellPepper, 20, 12));
  }
  return lines;
}

function soupLines(lower) {
  if (lower.includes("мисо")) {
    return [child(R.misoBase, 280), ...proteinLines(lower, 55), gross(P.tofu, 35), gross(P.wakame, 4)];
  }
  if (lower.includes("том ям")) {
    return [child(R.tomYumBase, 330), ...(proteinLines(lower, 70).length ? proteinLines(lower, 70) : [net(P.shrimp, 70, 5)]), net(P.mushrooms, 45, 10), gross(P.cilantro, 3), net(P.lime, 10, 12)];
  }
  return [child(R.chickenBroth, 320), ...(proteinLines(lower, 70).length ? proteinLines(lower, 70) : []), net(P.carrot, 30, 10), net(P.onion, 25, 10), gross(P.spices, 3)];
}

function wokLines(lower) {
  const base = lower.includes("рис") ? [child(R.plainRice, 220), gross(P.egg, 45)] : [gross(lower.includes("удон") ? P.udon : P.eggNoodles, 200)];
  const protein = lower.includes("овощ") ? [] : proteinForHotLine(lower, 95);
  return [...base, child(R.wokSauce, 45), gross(P.wokVeg, 90), ...protein, gross(P.wokBox, 1, "pcs")];
}

function grillLines(lower) {
  const lines = [child(R.grillMarinade, 25), net(P.onion, 35, 10), gross(P.spices, 4)];
  if (lower.includes("рёб") || lower.includes("реб")) lines.push(net(P.lambRibs, 280, 18));
  else if (lower.includes("баран")) lines.push(net(P.lamb, 230, 12));
  else if (lower.includes("голень")) lines.push(net(P.chickenDrumstick, 260, 12));
  else if (lower.includes("крыл")) lines.push(net(P.chickenWings, 320, 15));
  else if (lower.includes("кур")) lines.push(net(P.chicken, 220, 8));
  else if (lower.includes("баклаж")) lines.push(net(P.eggplant, 190, 12));
  else if (lower.includes("перец")) lines.push(net(P.bellPepper, 170, 12));
  else if (lower.includes("кабач") || lower.includes("цукини")) lines.push(net(P.zucchini, 180, 10));
  else if (lower.includes("гриб")) lines.push(net(P.mushrooms, 170, 10));
  else lines.push(net(P.beef, 230, 18));
  return lines;
}

function saladLines(lower) {
  const lines = [net(P.saladGreens, 60, 12), net(P.cucumber, 40, 8), net(P.tomato, 45, 8)];
  if (lower.includes("цез")) lines.push(net(P.chicken, 85, 8), gross(P.caesarSauce, 35), gross(P.parmesan, 12), gross(P.croutons, 18));
  else if (lower.includes("гречес")) lines.push(gross(P.feta, 45), net(P.bellPepper, 35, 12), gross(P.oil, 12));
  else if (lower.includes("краб")) lines.push(net(P.crab, 70, 2), gross(P.mayo, 25), gross(P.corn, 25));
  else if (lower.includes("кревет")) lines.push(net(P.shrimp, 75, 5), gross(P.caesarSauce, 30));
  else if (lower.includes("лосос")) lines.push(net(P.salmon, 65, 5), gross(P.creamCheese, 20));
  else lines.push(gross(P.oil, 12), gross(P.spices, 2));
  return lines;
}

function snackLines(lower) {
  if (lower.includes("крыл")) {
    return [net(P.chickenWings, 320, 15), child(R.grillMarinade, 20), gross(P.sweetChili, 25), gross(P.burgerBox, 1, "pcs")];
  }
  if (lower.includes("сыр")) {
    return [gross(P.mozzarella, 120), gross(P.panko, 35), gross(P.egg, 35), gross(P.oil, 12), gross(P.burgerBox, 1, "pcs")];
  }
  return [net(P.potatoFries, 160, 8), gross(P.oil, 12), gross(P.salt, 2), gross(P.burgerBox, 1, "pcs")];
}

function genericLines(lower) {
  const protein = proteinForHotLine(lower, 100);
  if (protein.length > 0) {
    return [...protein, net(P.onion, 25, 10), gross(P.spices, 4)];
  }
  if (lower.includes("баклаж")) return [net(P.eggplant, 180, 12), child(R.grillMarinade, 18)];
  if (lower.includes("перец")) return [net(P.bellPepper, 160, 12), child(R.grillMarinade, 18)];
  if (lower.includes("овощ")) return [net(P.eggplant, 60, 12), net(P.zucchini, 60, 10), net(P.bellPepper, 60, 12), child(R.grillMarinade, 18)];
  return [gross(P.spices, 3)];
}

function proteinForHotLine(lower, quantity) {
  const lines = [];
  if (lower.includes("кревет")) lines.push(net(P.shrimp, quantity, 5));
  if (lower.includes("морепр")) lines.push(net(P.shrimp, quantity * 0.45, 5), net(P.mussels, quantity * 0.3, 5), net(P.squid, quantity * 0.25, 5));
  if (lower.includes("куриц") || lower.includes("чикен")) lines.push(net(P.chicken, quantity, 8));
  if (lower.includes("теля")) lines.push(net(P.veal, quantity, 10));
  if (lower.includes("говяд") || lower.includes("биф")) lines.push(net(P.beef, quantity, 18));
  if (lower.includes("лосос")) lines.push(net(P.salmon, quantity, 5));
  if (lower.includes("тунц")) lines.push(net(P.tuna, quantity, 5));
  return lines;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
