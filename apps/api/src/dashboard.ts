export function renderDashboard(): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TAGAM Accounting Demo</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fb;
      --panel: #ffffff;
      --ink: #172033;
      --muted: #667085;
      --line: #d7dde8;
      --teal: #0f766e;
      --blue: #2563eb;
      --amber: #b45309;
      --red: #b91c1c;
      --green-soft: #ddf7ef;
      --blue-soft: #e8f0ff;
      --amber-soft: #fff4db;
      --red-soft: #ffe4e6;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    main {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px;
    }

    header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      padding: 12px 0 22px;
      border-bottom: 1px solid var(--line);
    }

    h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.15;
    }

    h2 {
      margin: 0 0 12px;
      font-size: 18px;
    }

    p {
      margin: 6px 0 0;
      color: var(--muted);
      line-height: 1.45;
    }

    a {
      color: var(--blue);
      text-decoration: none;
    }

    .status {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 5px 10px;
      border-radius: 8px;
      background: var(--green-soft);
      color: var(--teal);
      font-weight: 700;
      white-space: nowrap;
    }

    .grid {
      display: grid;
      gap: 16px;
      margin-top: 18px;
    }

    .metrics {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .two {
      grid-template-columns: minmax(0, 1.1fr) minmax(360px, .9fr);
      align-items: start;
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 1px 2px rgba(23, 32, 51, .04);
    }

    .metric .label {
      color: var(--muted);
      font-size: 13px;
    }

    .metric .value {
      margin-top: 6px;
      font-size: 28px;
      font-weight: 800;
    }

    .metric:nth-child(1) {
      border-top: 4px solid var(--teal);
    }

    .metric:nth-child(2) {
      border-top: 4px solid var(--blue);
    }

    .metric:nth-child(3) {
      border-top: 4px solid var(--amber);
    }

    .metric:nth-child(4) {
      border-top: 4px solid var(--red);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    th,
    td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }

    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .02em;
      background: #f9fafc;
    }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .pill {
      display: inline-flex;
      min-height: 28px;
      align-items: center;
      padding: 4px 8px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      background: var(--blue-soft);
      color: var(--blue);
    }

    .pill.warn {
      background: var(--amber-soft);
      color: var(--amber);
    }

    .pill.bad {
      background: var(--red-soft);
      color: var(--red);
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin: 12px 0 16px;
    }

    .stat {
      min-width: 0;
      border-top: 3px solid var(--line);
      padding-top: 10px;
    }

    .stat span {
      display: block;
      color: var(--muted);
      font-size: 12px;
    }

    .stat strong {
      display: block;
      margin-top: 5px;
      font-size: 20px;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    .muted {
      color: var(--muted);
    }

    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .links a {
      min-height: 32px;
      padding: 7px 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #f9fafc;
      color: var(--ink);
      font-size: 13px;
    }

    .error {
      border-color: #fecdd3;
      background: #fff1f2;
      color: var(--red);
    }

    @media (max-width: 900px) {
      main {
        padding: 16px;
      }

      header,
      .two {
        grid-template-columns: 1fr;
      }

      header {
        display: grid;
      }

      .metrics,
      .stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 560px) {
      h1 {
        font-size: 24px;
      }

      .metrics,
      .stats {
        grid-template-columns: 1fr;
      }

      th,
      td {
        padding: 8px 6px;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>TAGAM Accounting Demo</h1>
        <p id="subtitle">Склад, техкарты, ужарка и себестоимость для ресторанного KMRS.</p>
      </div>
      <div id="status" class="status">Загрузка</div>
    </header>

    <section class="grid metrics" id="metrics"></section>

    <section class="grid two">
      <div class="card">
        <h2>Себестоимость блюда</h2>
        <div id="recipe"></div>
      </div>

      <div class="card">
        <h2>Остатки</h2>
        <div id="inventory"></div>
      </div>
    </section>

    <section class="card" style="margin-top:16px">
      <h2>Списание продажи из KMRS</h2>
      <div id="writeoff"></div>
    </section>

    <section class="card" style="margin-top:16px">
      <h2>API</h2>
      <p>Демо-данные открыты без авторизации. Боевой модуль позже должен получить права доступа от KMRS.</p>
      <div class="links" id="links"></div>
    </section>
  </main>

  <script>
    const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
    const qty = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 });

    function text(value) {
      return value === null || value === undefined ? "" : String(value);
    }

    function cell(value, className = "") {
      const td = document.createElement("td");
      td.className = className;
      td.textContent = text(value);
      return td;
    }

    function table(headers, rows) {
      const tableEl = document.createElement("table");
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      for (const header of headers) {
        const th = document.createElement("th");
        th.textContent = header;
        tr.appendChild(th);
      }
      thead.appendChild(tr);
      tableEl.appendChild(thead);
      const tbody = document.createElement("tbody");
      for (const row of rows) {
        const bodyRow = document.createElement("tr");
        for (const item of row) {
          bodyRow.appendChild(typeof item === "string" ? cell(item) : item);
        }
        tbody.appendChild(bodyRow);
      }
      tableEl.appendChild(tbody);
      return tableEl;
    }

    async function fetchJson(url, options = undefined) {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(url + " -> " + response.status);
      }
      return response.json();
    }

    function renderMetrics(summary) {
      const metrics = document.getElementById("metrics");
      metrics.replaceChildren();
      const items = [
        ["Продукты", summary.health.products],
        ["Активные техкарты", summary.health.activeRecipes],
        ["Складские позиции", summary.health.inventoryRows],
        ["Связи с KMRS", summary.health.linkedKmrsItems],
      ];
      for (const [label, value] of items) {
        const el = document.createElement("div");
        el.className = "card metric";
        el.innerHTML = '<div class="label"></div><div class="value"></div>';
        el.querySelector(".label").textContent = label;
        el.querySelector(".value").textContent = value;
        metrics.appendChild(el);
      }
    }

    function stat(label, value) {
      const el = document.createElement("div");
      el.className = "stat";
      el.innerHTML = '<span></span><strong></strong>';
      el.querySelector("span").textContent = label;
      el.querySelector("strong").textContent = value;
      return el;
    }

    function renderRecipe(recipe) {
      const root = document.getElementById("recipe");
      root.replaceChildren();

      const title = document.createElement("div");
      const statusClass = recipe.foodCostPercent > Number(recipe.targetFoodCostPercent) ? "pill warn" : "pill";
      title.innerHTML = '<strong></strong> <span></span><p></p>';
      title.querySelector("strong").textContent = recipe.recipeName;
      title.querySelector("span").className = statusClass;
      title.querySelector("span").textContent = recipe.costingStatus === "complete" ? "Расчет полный" : "Не хватает данных";
      title.querySelector("p").textContent = "Версия " + recipe.versionCode + ", выход " + qty.format(Number(recipe.yieldQuantity)) + " " + recipe.yieldUnitCode;
      root.appendChild(title);

      const kpis = document.createElement("div");
      kpis.className = "stats";
      kpis.appendChild(stat("Себестоимость", money.format(recipe.totalCost) + " " + recipe.currency));
      kpis.appendChild(stat("Food cost", money.format(recipe.foodCostPercent) + "%"));
      kpis.appendChild(stat("Цена в меню", money.format(Number(recipe.menuPrice)) + " " + recipe.currency));
      kpis.appendChild(stat("Рекоменд. цена", money.format(recipe.recommendedMenuPrice) + " " + recipe.currency));
      root.appendChild(kpis);

      const rows = recipe.lines.map((line) => {
        const status = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = line.costStatus === "ok" ? "pill" : "pill bad";
        badge.textContent = line.costStatus === "ok" ? "ok" : line.costStatus;
        status.appendChild(badge);
        return [
          line.productName,
          qty.format(line.stockInputQuantity) + " " + line.unitCode,
          qty.format(line.preparedOutputQuantity) + " " + line.unitCode,
          money.format(line.lineCost) + " " + (line.currency || recipe.currency),
          status,
        ];
      });
      root.appendChild(table(["Продукт", "Со склада", "После обработки", "Стоимость", "Статус"], rows));
    }

    function renderInventory(rows, currency) {
      const root = document.getElementById("inventory");
      root.replaceChildren();
      const body = rows.map((row) => [
        row.productName,
        qty.format(Number(row.quantityOnHand)),
        money.format(Number(row.inventoryValue)) + " " + (row.currency || currency),
      ]);
      root.appendChild(table(["Продукт", "Кол-во", "Сумма"], body));
    }

    function renderWriteoff(writeoff) {
      const root = document.getElementById("writeoff");
      root.replaceChildren();

      const kpis = document.createElement("div");
      kpis.className = "stats";
      kpis.appendChild(stat("Сумма продажи", money.format(writeoff.totals.saleTotal) + " " + writeoff.totals.currency));
      kpis.appendChild(stat("Себестоимость", money.format(writeoff.totals.theoreticalCost) + " " + writeoff.totals.currency));
      kpis.appendChild(stat("Food cost", money.format(writeoff.totals.foodCostPercent) + "%"));
      kpis.appendChild(stat("Маржа", money.format(writeoff.totals.grossMargin) + " " + writeoff.totals.currency));
      root.appendChild(kpis);

      const note = document.createElement("p");
      note.textContent = "Превью: 2 x Classic Burger. Остатки не изменяются до commit-writeoff.";
      root.appendChild(note);

      const rows = writeoff.requirements.map((item) => {
        const status = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = item.availabilityStatus === "ok" ? "pill" : "pill bad";
        badge.textContent = item.availabilityStatus === "ok" ? "хватает" : "дефицит";
        status.appendChild(badge);
        return [
          item.productName,
          qty.format(item.quantity) + " " + item.unitCode,
          money.format(item.estimatedCost) + " " + item.currency,
          qty.format(item.availableQuantity) + " " + item.unitCode,
          status,
        ];
      });
      root.appendChild(table(["Продукт", "Списание", "Себестоимость", "На складе", "Статус"], rows));
    }

    function renderLinks(summary) {
      const root = document.getElementById("links");
      const org = encodeURIComponent(summary.organization.id);
      const recipe = encodeURIComponent(summary.activeRecipeVersionId);
      const links = [
        ["/health", "health"],
        ["/v1/demo", "demo"],
        ["/v1/catalog?organizationId=" + org, "catalog"],
        ["/v1/products?organizationId=" + org, "products"],
        ["/v1/inventory/summary?organizationId=" + org, "inventory"],
        ["/v1/recipes/" + recipe + "?organizationId=" + org, "recipe cost"],
        ["/v1/kmrs/sync-runs?organizationId=" + org, "sync runs"],
      ];
      root.replaceChildren();
      for (const [href, label] of links) {
        const a = document.createElement("a");
        a.href = href;
        a.textContent = label;
        root.appendChild(a);
      }
    }

    async function boot() {
      const status = document.getElementById("status");
      try {
        const demo = await fetchJson("/v1/demo");
        const summary = demo.data;
        document.getElementById("subtitle").textContent = summary.organization.name + " / " + summary.primaryLocation.name;
        renderMetrics(summary);
        renderLinks(summary);

        const org = encodeURIComponent(summary.organization.id);
        const recipeId = encodeURIComponent(summary.activeRecipeVersionId);
        const writeoffBody = {
          organizationId: summary.organization.id,
          locationId: summary.primaryLocation.id,
          kmrsOrderId: "demo-preview-order",
          lines: [
            {
              kmrsItemId: "demo-classic-burger",
              quantity: 2,
              salePrice: 45,
              currency: summary.organization.defaultCurrency,
            },
          ],
        };
        const [recipe, inventory, writeoff] = await Promise.all([
          fetchJson("/v1/recipes/" + recipeId + "?organizationId=" + org),
          fetchJson("/v1/inventory/summary?organizationId=" + org),
          fetchJson("/v1/kmrs/orders/preview-writeoff", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(writeoffBody),
          }),
        ]);
        renderRecipe(recipe.data);
        renderInventory(inventory.data, summary.organization.defaultCurrency);
        renderWriteoff(writeoff.data);
        status.textContent = "Online";
      } catch (error) {
        status.textContent = "Ошибка";
        status.className = "status error";
        document.getElementById("recipe").textContent = error.message;
      }
    }

    boot();
  </script>
</body>
</html>`;
}
