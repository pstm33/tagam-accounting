#!/usr/bin/env node

import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL || "";
const organizationName = process.env.ACCOUNTING_ORGANIZATION_NAME || "TAGAM Demo Restaurant";
const organizationId = process.env.ACCOUNTING_ORGANIZATION_ID || "";
const locationName = process.env.ACCOUNTING_LOCATION_NAME || "Ashgabat Demo Kitchen";
const locationId = process.env.ACCOUNTING_LOCATION_ID || "";
const replaceExisting = process.argv.includes("--replace-existing");
const currency = "TMT";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const categoryPaths = {
  rawVeg: ["Сырье", "Сырье: овощи и зелень"],
  rawSauces: ["Сырье", "Сырье: соусы и специи"],
  prepVeg: ["Полуфабрикаты", "Полуфабрикаты: овощная обработка"],
  prepSushi: ["Полуфабрикаты", "Полуфабрикаты: суши"],
  prepSauces: ["Полуфабрикаты", "Полуфабрикаты: соусы"],
  prepMeat: ["Полуфабрикаты", "Полуфабрикаты: мясо и птица"],
  prepFish: ["Полуфабрикаты", "Полуфабрикаты: рыба и морепродукты"],
  prepWok: ["Полуфабрикаты", "Полуфабрикаты: WOK"],
  prepGrill: ["Полуфабрикаты", "Полуфабрикаты: мангал"],
};

const processingMethods = {
  cleaning: { name: "Очистка и зачистка", kind: "cleaning" },
  cutting: { name: "Нарезка и порционирование", kind: "portioning" },
  washing: { name: "Промывка и обсушка", kind: "custom" },
  boiling: { name: "Варка", kind: "boiling" },
  mixing: { name: "Смешивание", kind: "custom" },
  marinating: { name: "Маринование", kind: "custom" },
  frying: { name: "Обжарка", kind: "frying" },
  defrosting: { name: "Разморозка", kind: "defrosting" },
};

const extraProducts = [
  rawProduct("Картофель свежий", "rawVeg", 25, 24, 60000),
  rawProduct("Горчица", "rawSauces", 0, 42, 5000),
  rawProduct("Кетчуп", "rawSauces", 0, 28, 8000),
  rawProduct("Уксус столовый", "rawSauces", 0, 8, 5000),
  rawProduct("Крахмал картофельный", "rawVeg", 0, 22, 5000),
];

const recipeDefinitions = [
  cleaned("Лук репчатый очищенный", "Лук репчатый очищенный п/ф", "Лук репчатый", 16, [
    "Перебрать лук, удалить поврежденные луковицы.",
    "Снять сухие покровные чешуи, срезать донце и шейку.",
    "Промыть, обсушить, хранить закрытым при +2...+4 C."
  ], 24),
  cleaned("Лук репчатый кубик", "Лук репчатый кубик п/ф", "Лук репчатый", 18, [
    "Очистить и промыть лук.",
    "Нарезать кубиком 5-7 мм, удалить грубые части.",
    "Использовать в горячем цехе или хранить закрытым до 12 часов."
  ], 12, "cutting"),
  cleaned("Морковь очищенная", "Морковь очищенная п/ф", "Морковь", 20, [
    "Отсортировать корнеплоды, промыть от земли.",
    "Очистить вручную или машинно с ручной доочисткой.",
    "Промыть, обсушить, хранить закрытым при +2...+4 C."
  ], 24),
  cleaned("Морковь соломка", "Морковь соломка п/ф", "Морковь", 22, [
    "Морковь вымыть и очистить.",
    "Нарезать соломкой под WOK, удалить нестандартные куски.",
    "Хранить закрытой при +2...+4 C до 12 часов."
  ], 12, "cutting"),
  cleaned("Картофель очищенный", "Картофель очищенный п/ф", "Картофель свежий", 33.333, [
    "Картофель промыть от песка и земли.",
    "Очистить экономкой или машинно, удалить глазки и повреждения.",
    "Промыть, держать закрытым в воде или пакете при +2...+6 C не более 4 часов."
  ], 4),
  cleaned("Картофель брусочек для фри", "Картофель брусочек п/ф", "Картофель свежий", 36, [
    "Картофель вымыть, очистить и повторно промыть.",
    "Нарезать брусочком, промыть от крахмала, обсушить.",
    "Использовать для жарки, хранить кратко при +2...+6 C."
  ], 4, "cutting"),
  cleaned("Чеснок очищенный", "Чеснок очищенный п/ф", "Чеснок", 22, [
    "Разобрать головки чеснока на зубчики.",
    "При необходимости кратко замочить, снять покровные листья.",
    "Хранить под пленкой или в закрытой таре при +2...+4 C."
  ], 24),
  cleaned("Имбирь очищенный", "Имбирь очищенный п/ф", "Имбирь", 15, [
    "Корень промыть, удалить подсохшие и поврежденные места.",
    "Снять кожицу тонким слоем, промыть и обсушить.",
    "Хранить закрытым при +2...+4 C."
  ], 24),
  cleaned("Огурец подготовленный для роллов", "Огурец для роллов п/ф", "Огурец", 8, [
    "Огурцы промыть, обсушить, удалить концы.",
    "При грубой кожице очистить частично, нарезать бруском.",
    "Удалить излишне водянистую сердцевину при необходимости."
  ], 12, "cutting"),
  cleaned("Авокадо очищенный", "Авокадо очищенный п/ф", "Авокадо", 28, [
    "Авокадо вымыть, разрезать, удалить косточку и кожицу.",
    "Нарезать под роллы или салаты, защитить от потемнения.",
    "Использовать в течение смены."
  ], 8, "cutting"),
  cleaned("Помидор подготовленный", "Помидор подготовленный п/ф", "Помидор", 8, [
    "Помидоры промыть, обсушить, удалить плодоножку.",
    "Нарезать слайсом или кубиком под блюдо.",
    "Хранить в закрытой таре при +2...+6 C."
  ], 12, "cutting"),
  cleaned("Перец болгарский очищенный", "Перец болгарский очищенный п/ф", "Перец болгарский", 12, [
    "Перец промыть, удалить плодоножку, семена и перегородки.",
    "Нарезать по назначению: соломка, кубик, сектор.",
    "Хранить закрытым при +2...+4 C."
  ], 12, "cutting"),
  cleaned("Шампиньоны зачищенные", "Шампиньоны зачищенные п/ф", "Шампиньоны", 10, [
    "Грибы перебрать, зачистить загрязнения.",
    "Быстро промыть при необходимости и обсушить.",
    "Нарезать под пиццу, WOK или гриль."
  ], 12, "cleaning"),
  cleaned("Капуста шинкованная", "Капуста шинкованная п/ф", "Капуста", 12, [
    "Кочан зачистить от верхних листьев, удалить кочерыжку.",
    "Нашинковать или нарезать по назначению.",
    "Хранить в закрытой таре при +2...+4 C."
  ], 12, "cutting"),
  cleaned("Лист салата перебранный", "Лист салата перебранный п/ф", "Лист салата", 12, [
    "Листья перебрать, удалить увядшие части.",
    "Промыть в холодной воде, обсушить.",
    "Хранить во влажной закрытой таре при +2...+4 C."
  ], 12, "washing"),
  cleaned("Салатный микс перебранный", "Салатный микс перебранный п/ф", "Салатный микс", 12, [
    "Микс перебрать, удалить испорченные листья.",
    "Промыть и тщательно обсушить.",
    "Хранить закрытым при +2...+4 C."
  ], 12, "washing"),
  cleaned("Кинза обработанная", "Кинза обработанная п/ф", "Кинза", 15, [
    "Зелень перебрать, удалить грубые стебли.",
    "Промыть, обсушить, нарезать перед использованием.",
    "Хранить при +2...+4 C во влажной закрытой таре."
  ], 12, "washing"),
  cleaned("Базилик обработанный", "Базилик обработанный п/ф", "Базилик", 20, [
    "Базилик перебрать, удалить грубые стебли и темные листья.",
    "Аккуратно промыть и обсушить.",
    "Хранить кратко, не допуская намокания листа."
  ], 8, "washing"),
  cleaned("Лайм подготовленный", "Лайм подготовленный п/ф", "Лайм", 12, [
    "Лаймы промыть, обсушить.",
    "Нарезать дольками или подготовить сок по заданию смены.",
    "Хранить закрытым при +2...+6 C."
  ], 12, "cutting"),
  cleaned("Ананас очищенный", "Ананас очищенный п/ф", "Ананас", 35, [
    "Ананас вымыть, удалить кожуру и жесткую сердцевину.",
    "Нарезать кубиком или сектором под блюдо.",
    "Хранить закрытым при +2...+4 C."
  ], 12, "cutting"),
  cleaned("Груша подготовленная", "Груша подготовленная п/ф", "Груша", 15, [
    "Грушу промыть, удалить сердцевину.",
    "Нарезать по форме блюда, защищать от потемнения.",
    "Использовать в течение смены."
  ], 8, "cutting"),
  cleaned("Баклажан подготовленный", "Баклажан подготовленный п/ф", "Баклажан", 12, [
    "Баклажан промыть, удалить плодоножку.",
    "Нарезать под гриль или WOK, при необходимости посолить и обсушить.",
    "Хранить закрытым при +2...+6 C."
  ], 12, "cutting"),
  cleaned("Кабачок подготовленный", "Кабачок подготовленный п/ф", "Кабачок", 10, [
    "Кабачок промыть, удалить концы.",
    "Нарезать слайсом, кубиком или бруском.",
    "Хранить закрытым при +2...+6 C."
  ], 12, "cutting"),
  prep("Овощная смесь WOK свежая", "Овощная смесь WOK свежая п/ф", "prepWok", 1000, "g", [
    net("Морковь", 180, 22, "cutting"),
    net("Перец болгарский", 180, 12, "cutting"),
    net("Капуста", 220, 12, "cutting"),
    net("Лук репчатый", 120, 18, "cutting"),
    net("Шампиньоны", 160, 10, "cleaning"),
    net("Кабачок", 140, 10, "cutting"),
  ], [
    "Овощи перебрать, промыть, очистить и нарезать единой формой.",
    "Смешать по норме, не заправлять соусом.",
    "Хранить закрытым при +2...+4 C до 12 часов."
  ], 12),
  cleaned("Филе лосося зачистка для роллов", "Лосось подготовленный для роллов п/ф", "Филе лосося", 8, [
    "Филе проверить на кости и повреждения.",
    "Зачистить темные участки, кожу и пленки при необходимости.",
    "Нарезать на брусок или слайс под роллы."
  ], 12, "cutting", "prepFish"),
  cleaned("Филе тунца зачистка для роллов", "Тунец подготовленный для роллов п/ф", "Филе тунца", 6, [
    "Филе проверить, удалить жилы и темные части.",
    "Нарезать под роллы или суши.",
    "Хранить охлажденным при +2...+4 C."
  ], 12, "cutting", "prepFish"),
  cleaned("Креветка подготовленная", "Креветка подготовленная п/ф", "Креветка очищенная", 5, [
    "Креветку разморозить в холодильнике при необходимости.",
    "Удалить остатки панциря и кишечную вену, обсушить.",
    "Использовать в роллах, салатах или горячем цехе."
  ], 12, "defrosting", "prepFish"),
  cleaned("Кальмар подготовленный", "Кальмар подготовленный п/ф", "Кольца кальмара", 5, [
    "Кальмар разморозить в холодильнике, проверить качество.",
    "Удалить лишнюю влагу, обсушить.",
    "Использовать для WOK, темпуры или супов."
  ], 12, "defrosting", "prepFish"),
  cleaned("Мидии подготовленные", "Мидии подготовленные п/ф", "Мидии", 5, [
    "Мидии разморозить в холодильнике.",
    "Проверить отсутствие посторонних включений, удалить лишнюю влагу.",
    "Использовать согласно рецептуре основного блюда."
  ], 12, "defrosting", "prepFish"),
  prep("Крабовый микс для роллов", "Крабовый микс п/ф", "prepSushi", 1000, "g", [
    gross("Крабовый микс", 700),
    gross("Майонез", 220),
    gross("Соус шрирача", 45),
    gross("Кунжут", 20),
    gross("Соль", 5),
  ], [
    "Крабовое сырье разобрать, удалить лишнюю влагу.",
    "Смешать с соусами и кунжутом до равномерной массы.",
    "Хранить закрытым при +2...+4 C до 12 часов."
  ], 12),
  prep("Заправка для суши-риса", "Заправка для суши-риса п/ф", "prepSushi", 1000, "g", [
    gross("Рисовый уксус", 760),
    gross("Сахар", 190),
    gross("Соль", 50),
  ], [
    "Соединить уксус, сахар и соль.",
    "Перемешать до полного растворения, не кипятить.",
    "Хранить в чистой закрытой таре."
  ], 72),
  prep("Вакаме замоченный", "Вакаме замоченный п/ф", "prepSushi", 1000, "g", [
    gross("Вакаме", 90),
  ], [
    "Вакаме залить холодной водой до восстановления.",
    "Откинуть на сито, удалить лишнюю воду.",
    "Использовать в супах и салатах в течение смены."
  ], 12),
  prep("Фирменный соус для бургера п/ф", "Фирменный соус для бургера п/ф", "prepSauces", 1000, "g", [
    gross("Майонез", 520),
    gross("Кетчуп", 250),
    gross("Горчица", 90),
    gross("Маринованные огурцы", 90),
    gross("Смесь специй", 25),
    gross("Соль", 5),
  ], [
    "Маринованные огурцы измельчить.",
    "Соединить ингредиенты, перемешать до однородности.",
    "Хранить закрытым при +2...+4 C."
  ], 24),
  prep("Соус цезарь п/ф", "Соус цезарь п/ф", "prepSauces", 1000, "g", [
    gross("Майонез", 650),
    gross("Сыр пармезан", 90),
    gross("Соевый соус", 45),
    gross("Чеснок", 25),
    gross("Масло растительное", 120),
    gross("Смесь специй", 20),
    gross("Соль", 5),
  ], [
    "Чеснок зачистить и измельчить.",
    "Смешать ингредиенты до однородной заправки.",
    "Хранить закрытым при +2...+4 C."
  ], 24),
  prep("Маринад для мангала", "Маринад для мангала п/ф", "prepSauces", 1000, "g", [
    gross("Масло растительное", 350),
    gross("Лук репчатый", 220),
    gross("Чеснок", 55),
    gross("Соевый соус", 90),
    gross("Лайм", 55),
    gross("Смесь специй", 35),
    gross("Соль", 20),
  ], [
    "Лук и чеснок зачистить, измельчить.",
    "Соединить с маслом, соевым соусом, соком лайма и специями.",
    "Использовать для мяса, птицы и овощей; хранить закрытым при +2...+4 C."
  ], 24),
  prep("Говядина на котлету бургерную", "Фарш говяжий для бургера п/ф", "prepMeat", 1000, "g", [
    net("Говядина сырая", 950, 8, "cleaning"),
    gross("Смесь специй", 28),
    gross("Соль", 12),
  ], [
    "Говядину зачистить от грубых пленок.",
    "Измельчить, смешать с солью и специями.",
    "Порционировать под котлеты, хранить охлажденным."
  ], 12),
  prep("Котлета бургерная обжаренная", "Котлета бургерная обжаренная п/ф", "prepMeat", 760, "g", [
    child("Говядина на котлету бургерную", 1000),
  ], [
    "Сформовать котлеты одинаковой массы.",
    "Обжарить до заданной степени готовности.",
    "Зафиксировать фактическую ужарку контрольной проработкой."
  ], 8),
  cleaned("Филе курицы зачищенное", "Филе курицы зачищенное п/ф", "Филе курицы", 8, [
    "Филе промыть при необходимости, обсушить.",
    "Удалить пленки, хрящи и лишний жир.",
    "Порционировать под блюда."
  ], 12, "cleaning", "prepMeat"),
  prep("Филе курицы маринованное", "Филе курицы маринованное п/ф", "prepMeat", 1000, "g", [
    net("Филе курицы", 900, 8, "cleaning"),
    child("Маринад для мангала", 70),
    gross("Соль", 8),
  ], [
    "Курицу зачистить и порционировать.",
    "Смешать с маринадом, выдержать в холодильнике.",
    "Хранить закрытой таре при +2...+4 C."
  ], 12),
  prep("Крылья куриные маринованные", "Крылья куриные маринованные п/ф", "prepMeat", 1000, "g", [
    net("Крылья куриные", 920, 15, "cleaning"),
    child("Маринад для мангала", 65),
    gross("Соль", 8),
  ], [
    "Крылья зачистить, удалить остатки пера.",
    "Смешать с маринадом и выдержать в холодильнике.",
    "Перед приготовлением перемешать повторно."
  ], 12),
  prep("Голень куриная маринованная", "Голень куриная маринованная п/ф", "prepMeat", 1000, "g", [
    net("Голень куриная", 930, 12, "cleaning"),
    child("Маринад для мангала", 60),
    gross("Соль", 8),
  ], [
    "Голень зачистить и обсушить.",
    "Смешать с маринадом, выдержать охлажденной.",
    "Хранить закрытой таре при +2...+4 C."
  ], 12),
  prep("Баранина маринованная", "Баранина маринованная п/ф", "prepGrill", 1000, "g", [
    net("Мякоть баранины", 900, 12, "cleaning"),
    child("Маринад для мангала", 75),
    gross("Лук репчатый", 55),
    gross("Соль", 8),
  ], [
    "Баранину зачистить от грубых пленок.",
    "Нарезать кусками, смешать с маринадом и луком.",
    "Выдержать в холодильнике, хранить закрытой таре."
  ], 12),
  prep("Овощи гриль заготовка", "Овощи гриль п/ф", "prepGrill", 1000, "g", [
    net("Баклажан", 270, 12, "cutting"),
    net("Кабачок", 260, 10, "cutting"),
    net("Перец болгарский", 230, 12, "cutting"),
    net("Шампиньоны", 180, 10, "cleaning"),
    child("Маринад для мангала", 60),
  ], [
    "Овощи промыть, зачистить и нарезать крупными кусками.",
    "Смешать с маринадом непосредственно перед приготовлением.",
    "Хранить заготовку охлажденной."
  ], 12),
];

function rawProduct(name, categoryKey, waste, pricePerKg, stockQuantity) {
  return { name, unit: "g", productType: "raw", categoryKey, waste, pricePerKg, stockQuantity };
}

function gross(name, quantity, unit = "g", processKey = "mixing") {
  return { type: "product", name, quantity, unit, quantityMode: "stock_input", waste: 0, processKey };
}

function net(name, quantity, waste, processKey = "cleaning", unit = "g") {
  return { type: "product", name, quantity, unit, quantityMode: "prepared_output", waste, processKey };
}

function child(name, quantity, unit = "g") {
  return { type: "recipe", name, quantity, unit, quantityMode: "prepared_output", waste: 0 };
}

function cleaned(name, output, source, waste, steps, shelfLifeHours, processKey = "cleaning", categoryKey = "prepVeg") {
  return prep(name, output, categoryKey, 1000, "g", [net(source, 1000, waste, processKey)], steps, shelfLifeHours);
}

function prep(name, output, categoryKey, yieldQuantity, yieldUnit, lines, steps, shelfLifeHours) {
  return {
    name,
    output,
    recipeType: "prep_item",
    categoryKey,
    yieldQuantity,
    yieldUnit,
    lines,
    steps,
    shelfLifeHours,
  };
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query("begin");
  const organization = await findOrganization();
  const location = await findLocation(organization.id);
  const units = await loadUnits(organization.id);
  const categories = new Map();
  const products = new Map();
  const recipes = new Map();
  const methods = new Map();
  const counters = {
    categoriesCreated: 0,
    productsCreated: 0,
    stockLotsCreated: 0,
    recipesCreated: 0,
    recipesUpdated: 0,
    recipesSkipped: 0,
    linesCreated: 0,
    stepsCreated: 0,
    yieldRulesCreated: 0,
  };

  for (const method of Object.values(processingMethods)) {
    await ensureProcessingMethod(organization.id, method, methods);
  }

  for (const product of extraProducts) {
    const record = await ensureProduct(organization.id, units, categories, product, counters);
    if (product.pricePerKg && product.stockQuantity) {
      await ensureStarterStock(organization.id, location.id, units, record, product, counters);
    }
  }

  for (const definition of recipeDefinitions) {
    await ensureProduct(organization.id, units, categories, {
      name: definition.output,
      unit: definition.yieldUnit,
      productType: "prepared",
      categoryKey: definition.categoryKey,
      waste: 0,
    }, counters);
  }

  for (const definition of recipeDefinitions) {
    await ensureRecipe(organization.id, units, categories, products, recipes, methods, definition, counters);
  }

  await client.query("commit");
  console.log(JSON.stringify({
    organization: organization.name,
    location: location.name,
    definitions: recipeDefinitions.length,
    replaceExisting,
    ...counters,
  }, null, 2));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}

async function findOrganization() {
  if (organizationId) {
    const result = await client.query("select id, name from organizations where id = $1 limit 1", [organizationId]);
    if (result.rows[0]) return result.rows[0];
  }

  const result = await client.query("select id, name from organizations where name = $1 order by created_at limit 1", [organizationName]);
  const row = result.rows[0];
  if (!row) {
    throw new Error(`Organization was not found: ${organizationName}`);
  }
  return row;
}

async function findLocation(orgId) {
  if (locationId) {
    const result = await client.query("select id, name from locations where organization_id = $1 and id = $2 limit 1", [orgId, locationId]);
    if (result.rows[0]) return result.rows[0];
  }

  const result = await client.query(
    "select id, name from locations where organization_id = $1 and name = $2 order by created_at limit 1",
    [orgId, locationName],
  );
  const row = result.rows[0] || (await client.query(
    "select id, name from locations where organization_id = $1 order by created_at limit 1",
    [orgId],
  )).rows[0];

  if (!row) {
    throw new Error("Location was not found");
  }
  return row;
}

async function loadUnits(orgId) {
  const result = await client.query("select id, code, name from units where organization_id = $1", [orgId]);
  return new Map(result.rows.map((row) => [row.code, row]));
}

async function ensureCategory(orgId, categories, key, counters) {
  if (categories.has(key)) {
    return categories.get(key);
  }

  const path = categoryPaths[key];
  if (!path) {
    throw new Error(`Unknown category key: ${key}`);
  }

  let parentId = null;
  let current = null;

  for (const name of path) {
    const cacheKey = `${parentId || "root"}:${name}`;
    const existing = categories.get(cacheKey);
    if (existing) {
      parentId = existing.id;
      current = existing;
      continue;
    }

    const result = await client.query(
      `
        insert into product_categories (organization_id, parent_id, name)
        values ($1, $2, $3)
        on conflict (organization_id, name)
        do update set parent_id = coalesce(product_categories.parent_id, excluded.parent_id)
        returning id, name, parent_id as "parentId"
      `,
      [orgId, parentId, name],
    );
    current = result.rows[0];
    categories.set(cacheKey, current);
    counters.categoriesCreated += result.rowCount === 1 ? 1 : 0;
    parentId = current.id;
  }

  categories.set(key, current);
  return current;
}

async function ensureProduct(orgId, units, categories, definition, counters) {
  const unit = units.get(definition.unit);
  if (!unit) {
    throw new Error(`Missing unit: ${definition.unit}`);
  }

  const category = await ensureCategory(orgId, categories, definition.categoryKey, counters);
  const existing = await client.query("select * from products where organization_id = $1 and name = $2 limit 1", [orgId, definition.name]);

  if (existing.rows[0]) {
    await client.query(
      `
        update products
        set category_id = coalesce(category_id, $3),
            default_waste_percent = case when default_waste_percent = 0 then $4 else default_waste_percent end,
            updated_at = now()
        where id = $1
          and organization_id = $2
      `,
      [existing.rows[0].id, orgId, category.id, definition.waste || 0],
    );
    return existing.rows[0];
  }

  const result = await client.query(
    `
      insert into products (
        organization_id,
        category_id,
        base_unit_id,
        name,
        product_type,
        inventory_policy,
        default_waste_percent
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      returning *
    `,
    [
      orgId,
      category.id,
      unit.id,
      definition.name,
      definition.productType,
      definition.productType === "service" ? "not_tracked" : "tracked",
      definition.waste || 0,
    ],
  );
  counters.productsCreated += 1;
  return result.rows[0];
}

async function ensureStarterStock(orgId, locId, units, product, definition, counters) {
  const existing = await client.query(
    "select id from stock_lots where organization_id = $1 and location_id = $2 and product_id = $3 limit 1",
    [orgId, locId, product.id],
  );

  if (existing.rows[0]) {
    return;
  }

  const unit = units.get(definition.unit);
  const unitCost = Number(definition.pricePerKg) / 1000;
  await client.query(
    `
      insert into stock_lots (
        organization_id,
        location_id,
        product_id,
        lot_code,
        base_unit_id,
        initial_quantity,
        current_quantity,
        unit_cost,
        currency
      )
      values ($1, $2, $3, $4, $5, $6, $6, $7, $8)
    `,
    [orgId, locId, product.id, "PREP-TTK-SEED", unit.id, definition.stockQuantity, unitCost, currency],
  );
  counters.stockLotsCreated += 1;
}

async function ensureProcessingMethod(orgId, definition, methods) {
  const result = await client.query(
    `
      insert into processing_methods (organization_id, name, kind)
      values ($1, $2, $3)
      on conflict (organization_id, name)
      do update set kind = excluded.kind
      returning id, name, kind
    `,
    [orgId, definition.name, definition.kind],
  );
  methods.set(Object.keys(processingMethods).find((key) => processingMethods[key].name === definition.name), result.rows[0]);
}

async function ensureRecipe(orgId, units, categories, products, recipes, methods, definition, counters) {
  const outputProduct = await productByName(orgId, definition.output);
  const unit = units.get(definition.yieldUnit);
  const recipe = await upsertRecipe(orgId, definition, outputProduct.id, counters);
  const version = await upsertRecipeVersion(recipe.id, definition, unit.id, counters);
  const lineCount = Number((await client.query("select count(*)::int as count from recipe_lines where recipe_version_id = $1", [version.id])).rows[0].count);

  if (lineCount > 0 && !replaceExisting) {
    counters.recipesSkipped += 1;
    return;
  }

  await client.query("delete from recipe_steps where recipe_version_id = $1", [version.id]);
  await client.query("delete from recipe_lines where recipe_version_id = $1", [version.id]);

  let sortOrder = 10;
  for (const line of definition.lines) {
    await insertRecipeLine(orgId, version.id, units, methods, line, sortOrder, counters);
    sortOrder += 10;
  }

  let stepNumber = 1;
  for (const step of definition.steps) {
    await client.query(
      "insert into recipe_steps (recipe_version_id, step_number, title, body) values ($1, $2, $3, $4)",
      [version.id, stepNumber, `Шаг ${stepNumber}`, step],
    );
    stepNumber += 1;
    counters.stepsCreated += 1;
  }
}

async function upsertRecipe(orgId, definition, outputProductId, counters) {
  const result = await client.query(
    `
      insert into recipes (organization_id, output_product_id, name, recipe_type)
      values ($1, $2, $3, $4)
      on conflict (organization_id, name)
      do update set output_product_id = excluded.output_product_id,
                    recipe_type = excluded.recipe_type,
                    updated_at = now()
      returning id, name
    `,
    [orgId, outputProductId, definition.name, definition.recipeType],
  );
  if (result.rowCount === 1) {
    counters.recipesCreated += 1;
  } else {
    counters.recipesUpdated += 1;
  }
  return result.rows[0];
}

async function upsertRecipeVersion(recipeId, definition, unitId) {
  const instructions = [
    "Стартовая ТТК для учета заготовок. Нормы взяты как средние технологические ориентиры; перед промышленным использованием нужна контрольная проработка.",
    `Срок хранения: ${definition.shelfLifeHours} ч. Температура: +2...+4 C, если не указано иначе.`,
    "Источник ориентира: открытые ТТК/сборники норм отходов, адаптировано под демо TAGAM Accounting.",
  ].join("\n");

  const result = await client.query(
    `
      insert into recipe_versions (
        recipe_id,
        version_code,
        status,
        yield_quantity,
        yield_unit_id,
        target_food_cost_percent,
        currency,
        shelf_life_hours,
        storage_temperature,
        instructions
      )
      values ($1, 'v1', 'active', $2, $3, 32, $4, $5, '+2...+4 C', $6)
      on conflict (recipe_id, version_code)
      do update set status = 'active',
                    yield_quantity = excluded.yield_quantity,
                    yield_unit_id = excluded.yield_unit_id,
                    shelf_life_hours = excluded.shelf_life_hours,
                    storage_temperature = excluded.storage_temperature,
                    instructions = excluded.instructions,
                    updated_at = now()
      returning id
    `,
    [recipeId, definition.yieldQuantity, unitId, currency, definition.shelfLifeHours, instructions],
  );
  return result.rows[0];
}

async function insertRecipeLine(orgId, recipeVersionId, units, methods, line, sortOrder, counters) {
  const unit = units.get(line.unit);
  if (!unit) {
    throw new Error(`Missing unit: ${line.unit}`);
  }

  let productId = null;
  let childRecipeVersionId = null;

  if (line.type === "product") {
    productId = (await productByName(orgId, line.name)).id;
  } else {
    childRecipeVersionId = await recipeVersionByName(orgId, line.name);
  }

  const result = await client.query(
    `
      insert into recipe_lines (
        recipe_version_id,
        ingredient_product_id,
        child_recipe_version_id,
        quantity,
        unit_id,
        quantity_mode,
        extra_waste_percent,
        sort_order,
        note
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning id
    `,
    [
      recipeVersionId,
      productId,
      childRecipeVersionId,
      round(line.quantity),
      unit.id,
      line.quantityMode,
      round(line.waste || 0),
      sortOrder,
      line.processKey ? processingMethods[line.processKey].name : null,
    ],
  );
  counters.linesCreated += 1;

  if (line.type === "product" && line.processKey) {
    const method = methods.get(line.processKey);
    await client.query(
      `
        insert into recipe_line_processing (
          recipe_line_id,
          processing_method_id,
          sequence_number,
          yield_percent,
          note
        )
        values ($1, $2, 1, $3, $4)
      `,
      [
        result.rows[0].id,
        method.id,
        round(100 - (line.waste || 0)),
        processingMethods[line.processKey].name,
      ],
    );
    await ensureYieldRule(orgId, productId, method.id, unit.id, line, counters);
  }
}

async function ensureYieldRule(orgId, productId, methodId, unitId, line, counters) {
  const existing = await client.query(
    `
      select id
      from product_yield_rules
      where organization_id = $1
        and product_id = $2
        and processing_method_id = $3
        and source = 'manual'
        and note = 'seed-prep-ttk'
      limit 1
    `,
    [orgId, productId, methodId],
  );

  if (existing.rows[0]) {
    return;
  }

  const yieldPercent = 100 - (line.waste || 0);
  const inputQuantity = yieldPercent > 0 ? round((line.quantity * 100) / yieldPercent) : line.quantity;
  await client.query(
    `
      insert into product_yield_rules (
        organization_id,
        product_id,
        processing_method_id,
        input_quantity,
        input_unit_id,
        output_quantity,
        output_unit_id,
        yield_percent,
        source,
        note
      )
      values ($1, $2, $3, $4, $5, $6, $5, $7, 'manual', 'seed-prep-ttk')
    `,
    [orgId, productId, methodId, inputQuantity, unitId, line.quantity, round(yieldPercent)],
  );
  counters.yieldRulesCreated += 1;
}

async function productByName(orgId, name) {
  const result = await client.query("select * from products where organization_id = $1 and name = $2 limit 1", [orgId, name]);
  const row = result.rows[0];
  if (!row) {
    throw new Error(`Product was not found: ${name}`);
  }
  return row;
}

async function recipeVersionByName(orgId, name) {
  const result = await client.query(
    `
      select rv.id
      from recipes r
      join recipe_versions rv on rv.recipe_id = r.id
      where r.organization_id = $1
        and r.name = $2
      order by case when rv.status = 'active' then 0 else 1 end, rv.created_at desc
      limit 1
    `,
    [orgId, name],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error(`Recipe was not found: ${name}`);
  }
  return row.id;
}

function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}
