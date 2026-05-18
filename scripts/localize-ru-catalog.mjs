#!/usr/bin/env node

import { Client } from "pg";

const organizationName = process.env.ACCOUNTING_ORGANIZATION_NAME || "TAGAM Demo Restaurant";
const organizationId = process.env.ACCOUNTING_ORGANIZATION_ID || "";
const databaseUrl = process.env.DATABASE_URL || "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const productRenames = [
  ["Avocado", "Авокадо"],
  ["Basil", "Базилик"],
  ["Beef raw", "Говядина сырая"],
  ["Bell pepper", "Перец болгарский"],
  ["Black burger bun", "Черная булочка для бургера"],
  ["Blue cheese", "Голубой сыр"],
  ["Burger box", "Бургер-бокс"],
  ["Burger bun", "Булочка для бургера"],
  ["Cabbage", "Капуста"],
  ["Caesar sauce", "Соус цезарь"],
  ["Carrot", "Морковь"],
  ["Cheddar cheese", "Сыр чеддер"],
  ["Chicken drumstick", "Голень куриная"],
  ["Chicken fillet", "Филе курицы"],
  ["Chicken wings", "Крылья куриные"],
  ["Chili pepper", "Перец чили"],
  ["Cilantro", "Кинза"],
  ["Coconut milk", "Кокосовое молоко"],
  ["Corn", "Кукуруза"],
  ["Crab mix", "Крабовый микс"],
  ["Cream cheese", "Сливочный сыр"],
  ["Croutons", "Сухарики"],
  ["Cucumber", "Огурец"],
  ["Dashi powder", "Даши порошок"],
  ["Dry yeast", "Дрожжи сухие"],
  ["Eel unagi", "Угорь унаги"],
  ["Egg", "Яйцо"],
  ["Egg noodles", "Лапша яичная"],
  ["Eggplant", "Баклажан"],
  ["Feta cheese", "Сыр фета"],
  ["Fish sauce", "Рыбный соус"],
  ["Garlic", "Чеснок"],
  ["Ginger", "Имбирь"],
  ["Ham", "Ветчина"],
  ["House burger sauce", "Фирменный соус для бургера"],
  ["Lamb meat", "Мякоть баранины"],
  ["Lamb ribs", "Ребра бараньи"],
  ["Lemongrass", "Лемонграсс"],
  ["Lettuce", "Лист салата"],
  ["Lime", "Лайм"],
  ["Masago", "Икра масаго"],
  ["Mayonnaise", "Майонез"],
  ["Miso paste", "Паста мисо"],
  ["Mixed vegetables WOK", "Овощная смесь WOK"],
  ["Mozzarella", "Сыр моцарелла"],
  ["Mushrooms", "Шампиньоны"],
  ["Mussels", "Мидии"],
  ["Nori sheet", "Лист нори"],
  ["Onion", "Лук репчатый"],
  ["Oyster sauce", "Устричный соус"],
  ["Panko breadcrumbs", "Панировочные сухари панко"],
  ["Parmesan", "Сыр пармезан"],
  ["Pear", "Груша"],
  ["Pepperoni", "Пепперони"],
  ["Pickles", "Маринованные огурцы"],
  ["Pineapple", "Ананас"],
  ["Pizza box", "Пицца-бокс"],
  ["Potato fries", "Картофель фри"],
  ["Rice noodles", "Лапша рисовая"],
  ["Rice vinegar", "Рисовый уксус"],
  ["Salad greens", "Салатный микс"],
  ["Salmon fillet", "Филе лосося"],
  ["Salt", "Соль"],
  ["Sesame oil", "Кунжутное масло"],
  ["Sesame seed", "Кунжут"],
  ["Shrimp peeled", "Креветка очищенная"],
  ["Soy sauce", "Соевый соус"],
  ["Spices mix", "Смесь специй"],
  ["Squid rings", "Кольца кальмара"],
  ["Sriracha sauce", "Соус шрирача"],
  ["Sugar", "Сахар"],
  ["Sushi box", "Суши-бокс"],
  ["Sushi rice raw", "Рис для суши сырой"],
  ["Sweet chili sauce", "Сладкий чили соус"],
  ["Tempura flour", "Мука темпура"],
  ["Teriyaki sauce", "Соус терияки"],
  ["Tofu", "Тофу"],
  ["Tomato", "Помидор"],
  ["Tomato puree", "Томатное пюре"],
  ["Tom yum paste", "Паста том ям"],
  ["Tuna fillet", "Филе тунца"],
  ["Udon noodles", "Лапша удон"],
  ["Veal", "Телятина"],
  ["Vegan patty", "Веганская котлета"],
  ["Vegetable oil", "Масло растительное"],
  ["Wakame", "Вакаме"],
  ["Wheat flour", "Мука пшеничная"],
  ["WOK box", "WOK-бокс"],
  ["Zucchini", "Кабачок"],
];

const recipeRenames = [
  ["Classic Burger", "Классический бургер"],
  ["Sushi rice prep", "Рис для суши"],
  ["Темпура кляр", "Кляр темпура"],
  ["Пицца тесто", "Тесто для пиццы"],
];

const processingRenames = [
  ["Beef trimming", "Зачистка говядины"],
  ["Flat-top frying", "Жарка на плите"],
];

const prepInstructions = [
  ["Рис для суши", "Стартовая карта заготовки: рис для суши. Вода не учитывается в себестоимости; выход нужно проверить после пробной варки."],
  ["Рис отварной", "Стартовая карта заготовки: отварной рис для WOK и жареного риса. Вода не учитывается в себестоимости."],
  ["Спайси соус", "Стартовая карта заготовки: спайси-соус на основе майонеза."],
  ["Кляр темпура", "Стартовая карта заготовки: кляр темпура. Вода и лед не учитываются в себестоимости."],
  ["Соус для запекания роллов", "Стартовая карта заготовки: соус-шапка для запеченных роллов."],
  ["Тесто для пиццы", "Стартовая карта заготовки: тесто для пиццы. Вода не учитывается в себестоимости."],
  ["Соус для пиццы", "Стартовая карта заготовки: томатный соус для пиццы."],
  ["WOK соус", "Стартовая карта заготовки: универсальный соус WOK."],
  ["Основа мисо супа", "Стартовая карта заготовки: концентрированная основа мисо-супа. Вода добавляется при отдаче и не учитывается в себестоимости."],
  ["Основа том ям", "Стартовая карта заготовки: концентрированная основа том ям."],
  ["Куриный бульон", "Стартовая карта заготовки: базовый куриный бульон. Вода не учитывается в себестоимости."],
  ["Маринад для мангала", "Стартовая карта заготовки: базовый маринад для мангала."],
];

const categoryMoves = [
  ["Bakery", "Сырье: бакалея"],
  ["Dairy", "Сырье: молочные продукты"],
  ["Fish", "Сырье: рыба и морепродукты"],
  ["Meat", "Сырье: мясо"],
  ["Packaging", "Упаковка: доставка"],
  ["Sauces", "Сырье: соусы и специи"],
];

const unitNames = {
  g: "грамм",
  kg: "килограмм",
  ml: "миллилитр",
  l: "литр",
  pcs: "штука",
};

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query("begin");
  const orgId = organizationId || (await findOrganizationId());
  const counters = {
    products: await renameRows("products", orgId, productRenames),
    recipes: await renameRows("recipes", orgId, recipeRenames),
    processingMethods: await renameRows("processing_methods", orgId, processingRenames),
    units: await updateUnitNames(orgId),
    categoryProductsMoved: 0,
    categoriesDeleted: 0,
    categoriesRenamed: 0,
    instructionsLocalized: await localizeInstructions(orgId),
    prepInstructionsLocalized: await localizePrepInstructions(orgId),
  };

  for (const [from, to] of categoryMoves) {
    const result = await moveOrRenameCategory(orgId, from, to);
    counters.categoryProductsMoved += result.productsMoved;
    counters.categoriesDeleted += result.deleted;
    counters.categoriesRenamed += result.renamed;
  }

  await client.query("commit");
  console.log(JSON.stringify({ ok: true, organizationId: orgId, counters }, null, 2));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}

async function findOrganizationId() {
  const result = await client.query(
    "select id from organizations where name = $1 order by created_at desc limit 1",
    [organizationName],
  );
  const id = result.rows[0]?.id;

  if (!id) {
    throw new Error(`Organization was not found: ${organizationName}`);
  }

  return id;
}

async function renameRows(table, orgId, rows) {
  let changed = 0;
  const setClause = table === "products" || table === "recipes" ? "name = $3, updated_at = now()" : "name = $3";

  for (const [oldName, newName] of rows) {
    const result = await client.query(
      `
        update ${table}
        set ${setClause}
        where organization_id = $1
          and name = $2
          and not exists (
            select 1
            from ${table} existing
            where existing.organization_id = $1
              and existing.name = $3
          )
      `,
      [orgId, oldName, newName],
    );
    changed += result.rowCount ?? 0;
  }

  return changed;
}

async function updateUnitNames(orgId) {
  let changed = 0;

  for (const [code, name] of Object.entries(unitNames)) {
    const result = await client.query(
      "update units set name = $3 where organization_id = $1 and code = $2 and name <> $3",
      [orgId, code, name],
    );
    changed += result.rowCount ?? 0;
  }

  return changed;
}

async function moveOrRenameCategory(orgId, oldName, targetName) {
  const oldCategory = await categoryByName(orgId, oldName);

  if (!oldCategory) {
    return { productsMoved: 0, deleted: 0, renamed: 0 };
  }

  const targetCategory = await categoryByName(orgId, targetName);

  if (!targetCategory) {
    const renamed = await client.query(
      "update product_categories set name = $3 where organization_id = $1 and id = $2",
      [orgId, oldCategory.id, targetName],
    );
    return { productsMoved: 0, deleted: 0, renamed: renamed.rowCount ?? 0 };
  }

  const moved = await client.query(
    "update products set category_id = $3 where organization_id = $1 and category_id = $2",
    [orgId, oldCategory.id, targetCategory.id],
  );
  const deleted = await client.query(
    `
      delete from product_categories category
      where category.organization_id = $1
        and category.id = $2
        and not exists (select 1 from products p where p.category_id = category.id)
        and not exists (select 1 from product_categories child where child.parent_id = category.id)
    `,
    [orgId, oldCategory.id],
  );

  return {
    productsMoved: moved.rowCount ?? 0,
    deleted: deleted.rowCount ?? 0,
    renamed: 0,
  };
}

async function categoryByName(orgId, name) {
  const result = await client.query(
    "select id from product_categories where organization_id = $1 and name = $2 limit 1",
    [orgId, name],
  );
  return result.rows[0] ?? null;
}

async function localizeInstructions(orgId) {
  const result = await client.query(
    `
      update recipe_versions rv
      set instructions = case
        when rv.instructions like 'Starter TTK draft generated from menu name and public average recipes.%'
          then 'Стартовый черновик ТТК создан по названию блюда и средним открытым рецептурам. Количество, выходы, потери и упаковку нужно проверить технологом перед рабочим учетом.'
        when rv.instructions like 'Starter prep card:%'
          then replace(rv.instructions, 'Starter prep card:', 'Стартовая карта заготовки:')
        when rv.instructions = 'Demo classic burger recipe.'
          then 'Демо-техкарта классического бургера.'
        else rv.instructions
      end
      from recipes r
      where r.id = rv.recipe_id
        and r.organization_id = $1
        and rv.instructions is not null
        and (
          rv.instructions like 'Starter TTK draft generated from menu name and public average recipes.%'
          or rv.instructions like 'Starter prep card:%'
          or rv.instructions = 'Demo classic burger recipe.'
        )
    `,
    [orgId],
  );

  return result.rowCount ?? 0;
}

async function localizePrepInstructions(orgId) {
  let changed = 0;

  for (const [recipeName, instruction] of prepInstructions) {
    const result = await client.query(
      `
        update recipe_versions rv
        set instructions = $3
        from recipes r
        where r.id = rv.recipe_id
          and r.organization_id = $1
          and r.name = $2
          and coalesce(rv.instructions, '') <> $3
      `,
      [orgId, recipeName, instruction],
    );
    changed += result.rowCount ?? 0;
  }

  return changed;
}
