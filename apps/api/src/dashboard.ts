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
      --bg: #f6f7f9;
      --panel: #ffffff;
      --ink: #182033;
      --muted: #667085;
      --line: #d8dee8;
      --line-strong: #bcc6d6;
      --teal: #0f766e;
      --blue: #2563eb;
      --amber: #b45309;
      --red: #b91c1c;
      --green: #15803d;
      --green-soft: #ddf7ef;
      --blue-soft: #e8f0ff;
      --amber-soft: #fff4db;
      --red-soft: #ffe4e6;
      --shadow: 0 1px 2px rgba(24, 32, 51, .05);
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

    body.detail-open {
      overflow: hidden;
    }

    main {
      max-width: 1220px;
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

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .location-switch {
      min-width: 260px;
      max-width: 360px;
      color: var(--muted);
    }

    .location-switch select {
      min-height: 32px;
    }

    .module-nav {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      gap: 8px;
      margin: 14px 0 0;
      padding: 10px 0;
      overflow-x: auto;
      background: var(--bg);
      border-bottom: 1px solid var(--line);
    }

    .module-tab {
      border-color: transparent;
      background: transparent;
      color: var(--muted);
      min-height: 34px;
    }

    .module-tab.active {
      border-color: var(--teal);
      background: var(--green-soft);
      color: var(--teal);
    }

    .module-view[hidden] {
      display: none !important;
    }

    h1 {
      margin: 0;
      font-size: 30px;
      line-height: 1.15;
    }

    h2 {
      margin: 0;
      font-size: 18px;
    }

    h3 {
      margin: 0 0 10px;
      font-size: 15px;
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

    button,
    input,
    select,
    textarea {
      min-height: 36px;
      border: 1px solid var(--line-strong);
      border-radius: 8px;
      background: #fff;
      color: var(--ink);
      font: inherit;
    }

    input,
    select,
    textarea {
      width: 100%;
      padding: 7px 10px;
    }

    textarea {
      min-height: 76px;
      resize: vertical;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 7px 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }

    button.primary {
      border-color: var(--teal);
      background: var(--teal);
      color: #fff;
    }

    button.secondary {
      border-color: var(--blue);
      background: var(--blue);
      color: #fff;
    }

    button.ghost {
      background: #f9fafc;
    }

    button.danger {
      border-color: #fecdd3;
      background: #fff1f2;
      color: var(--red);
    }

    button:disabled {
      cursor: not-allowed;
      opacity: .55;
    }

    label {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }

    .status {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 5px 10px;
      border-radius: 8px;
      background: var(--green-soft);
      color: var(--teal);
      font-weight: 800;
      white-space: nowrap;
    }

    .status.error {
      border: 1px solid #fecdd3;
      background: #fff1f2;
      color: var(--red);
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
      grid-template-columns: minmax(0, 1.05fr) minmax(360px, .95fr);
      align-items: start;
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      box-shadow: var(--shadow);
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 14px;
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

    .toolbar {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(150px, .75fr) minmax(180px, .8fr) auto auto;
      gap: 10px;
      align-items: end;
      margin-bottom: 14px;
    }

    .subtoolbar {
      display: grid;
      grid-template-columns: minmax(220px, .9fr) minmax(160px, .55fr) minmax(160px, .55fr) 1fr;
      gap: 10px;
      align-items: end;
      margin: 12px 0;
    }

    .table-wrap {
      width: 100%;
      max-height: calc(100vh - 280px);
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      min-width: 760px;
    }

    th,
    td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }

    tr:last-child td {
      border-bottom: 0;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 2;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .02em;
      background: #f9fafc;
    }

    .category-row td {
      background: #eef3f8;
      color: var(--ink);
      font-weight: 800;
      text-transform: none;
    }

    .category-row small {
      margin-left: 8px;
      color: var(--muted);
      font-weight: 700;
    }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .item-name {
      min-width: 220px;
      font-weight: 800;
    }

    .item-name small,
    .small {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 500;
      overflow-wrap: anywhere;
    }

    .pill {
      display: inline-flex;
      min-height: 28px;
      align-items: center;
      padding: 4px 8px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 800;
      background: var(--blue-soft);
      color: var(--blue);
      white-space: nowrap;
    }

    .pill.ok {
      background: var(--green-soft);
      color: var(--green);
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

    .connections {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 12px;
    }

    .connection-row {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      background: #fbfcfe;
    }

    .connection-row strong {
      display: block;
      overflow-wrap: anywhere;
    }

    .muted {
      color: var(--muted);
    }

    .notice {
      min-height: 38px;
      display: flex;
      align-items: center;
      padding: 8px 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfcfe;
      color: var(--muted);
    }

    .notice.error {
      border-color: #fecdd3;
      background: #fff1f2;
      color: var(--red);
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

    .actions {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
      min-width: 190px;
    }

    .recipe-select {
      min-width: 230px;
    }

    .recipe-editor {
      margin: 0;
    }

    .editor-panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfcfe;
      padding: 14px;
    }

    .detail-shell {
      position: fixed;
      inset: 0;
      z-index: 30;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      padding: 24px;
    }

    .detail-shell[hidden] {
      display: none !important;
    }

    .detail-backdrop {
      position: absolute;
      inset: 0;
      min-height: 0;
      width: 100%;
      border: 0;
      border-radius: 0;
      background: rgba(24, 32, 51, .42);
      cursor: pointer;
    }

    .detail-panel {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      width: min(1180px, 100%);
      max-height: calc(100vh - 48px);
      margin: auto;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: 0 24px 60px rgba(24, 32, 51, .25);
    }

    .detail-panel-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      background: #fff;
    }

    .detail-panel-head h2 {
      margin-top: 4px;
    }

    .detail-body {
      min-height: 0;
      overflow: auto;
      padding: 16px;
      background: #f9fafc;
    }

    .detail-body .table-wrap {
      max-height: none;
    }

    .editor-head,
    .editor-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .editor-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin: 12px 0;
      align-items: end;
    }

    .editor-grid.wide {
      grid-template-columns: .75fr 1.25fr 1.25fr .6fr .55fr .8fr .55fr auto;
    }

    .recipe-form,
    .product-form,
    .category-form,
    .supplier-form,
    .receipt-form,
    .receipt-line-form {
      display: grid;
      gap: 10px;
      align-items: end;
      margin-bottom: 12px;
    }

    .recipe-form {
      grid-template-columns: 1.2fr .8fr 1fr .5fr .6fr .6fr .6fr auto;
    }

    .product-form {
      grid-template-columns: 1.3fr .8fr .9fr .75fr .85fr .55fr auto;
    }

    .category-form {
      grid-template-columns: 1fr 1fr auto 1fr;
    }

    .supplier-form {
      grid-template-columns: 1fr 1fr 1fr auto;
    }

    .receipt-form {
      grid-template-columns: 1fr .75fr .75fr .55fr;
    }

    .receipt-line-form {
      grid-template-columns: 1.2fr .55fr .55fr .65fr auto;
    }

    .module-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 16px;
      align-items: start;
    }

    @media (max-width: 1100px) {
      .toolbar,
      .subtoolbar {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .connections {
        grid-template-columns: 1fr;
      }

      .editor-grid,
      .editor-grid.wide,
      .recipe-form,
      .product-form,
      .category-form,
      .supplier-form,
      .receipt-form,
      .receipt-line-form,
      .module-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
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

      .header-actions {
        justify-content: space-between;
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
      .stats,
      .toolbar,
      .subtoolbar,
      .editor-grid,
      .editor-grid.wide,
      .recipe-form,
      .product-form,
      .category-form,
      .supplier-form,
      .receipt-form,
      .receipt-line-form,
      .module-grid {
        grid-template-columns: 1fr;
      }

      th,
      td {
        padding: 8px 6px;
      }

      .detail-shell {
        padding: 8px;
      }

      .detail-panel {
        max-height: calc(100vh - 16px);
      }

      .detail-panel-head {
        align-items: flex-start;
      }

      .actions {
        justify-content: flex-start;
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
      <div class="header-actions">
        <label class="location-switch">Заведение
          <select id="global-location"></select>
        </label>
        <button class="ghost" id="logout" type="button">Выйти</button>
        <div id="status" class="status">Загрузка</div>
      </div>
    </header>

    <nav class="module-nav" id="module-nav" aria-label="Разделы учета">
      <button class="module-tab active" type="button" data-module="overview">Обзор</button>
      <button class="module-tab" type="button" data-module="directories">Справочники</button>
      <button class="module-tab" type="button" data-module="recipes">Техкарты</button>
      <button class="module-tab" type="button" data-module="purchases">Закупки</button>
      <button class="module-tab" type="button" data-module="kmrs">KMRS</button>
      <button class="module-tab" type="button" data-module="writeoffs">Списания</button>
      <button class="module-tab" type="button" data-module="api">API</button>
    </nav>

    <section class="module-view" data-module-view="overview">
    <section class="grid metrics" id="metrics"></section>

    <section class="grid two">
      <div class="card">
        <div class="section-head">
          <h2>Себестоимость блюда</h2>
          <span class="pill" id="recipe-badge">Расчет</span>
        </div>
        <div id="recipe"></div>
      </div>

      <div class="card">
        <div class="section-head">
          <h2>Остатки</h2>
          <span class="pill ok" id="inventory-badge">Склад</span>
        </div>
        <div id="inventory"></div>
      </div>
    </section>
    </section>

    <section class="card module-view" data-module-view="directories" hidden>
      <div class="section-head">
        <h2>Продукты</h2>
        <span class="pill ok" id="products-badge">Справочник</span>
      </div>

      <div class="category-form">
        <label>Новая категория
          <input id="category-name" autocomplete="off" placeholder="Название категории">
        </label>
        <label>Родитель
          <select id="category-parent"></select>
        </label>
        <button class="ghost" id="add-category" type="button">Создать</button>
        <div id="category-message" class="notice">Готово.</div>
      </div>

      <div class="product-form">
        <label>Название
          <input id="product-name" autocomplete="off" placeholder="Название продукта">
        </label>
        <label>Ед.
          <select id="product-unit"></select>
        </label>
        <label>Категория
          <select id="product-category"></select>
        </label>
        <label>Тип
          <select id="product-type">
            <option value="raw">сырье</option>
            <option value="prepared">полуфабрикат</option>
            <option value="packaging">упаковка</option>
            <option value="bar_item">бар</option>
            <option value="supply">хозтовар</option>
          </select>
        </label>
        <label>Учет
          <select id="product-policy">
            <option value="tracked">склад</option>
            <option value="theoretical_only">только норма</option>
            <option value="not_tracked">без учета</option>
          </select>
        </label>
        <label>Потери %
          <input id="product-waste" type="number" min="0" step="0.001" value="0">
        </label>
        <button class="primary" id="add-product" type="button">Добавить</button>
      </div>

      <div class="subtoolbar">
        <label>Поиск
          <input id="product-search" autocomplete="off" placeholder="Название продукта">
        </label>
        <button class="ghost" id="refresh-products" type="button">Обновить</button>
        <div id="product-message" class="notice" style="grid-column: span 2">Готово.</div>
      </div>

      <div id="products-list"></div>
    </section>

    <section class="card module-view" data-module-view="recipes" hidden>
      <div class="section-head">
        <h2>Техкарты</h2>
        <span class="pill ok">Производство</span>
      </div>

      <div class="recipe-form">
        <label>Новая техкарта
          <input id="new-recipe-name" autocomplete="off" placeholder="Название">
        </label>
        <label>Тип
          <select id="new-recipe-type">
            <option value="menu_item">блюдо</option>
            <option value="prep_item">полуфабрикат</option>
            <option value="sub_recipe">вложенная</option>
            <option value="bar_item">бар</option>
          </select>
        </label>
        <label>Учетный продукт
          <select id="new-recipe-output-product"></select>
        </label>
        <label>Выход
          <input id="new-recipe-yield" type="number" min="0.001" step="0.001" value="1">
        </label>
        <label>Ед.
          <select id="new-recipe-yield-unit"></select>
        </label>
        <label>Цена
          <input id="new-recipe-price" type="number" min="0" step="0.001">
        </label>
        <label>Food cost %
          <input id="new-recipe-target" type="number" min="0.001" step="0.001" value="32">
        </label>
        <button class="primary" id="add-recipe" type="button">Создать</button>
      </div>
      <div id="recipe-message" class="notice" style="margin-bottom:12px">Можно создать блюдо, полуфабрикат или вложенную заготовку.</div>
      <div class="subtoolbar">
        <label>Поиск техкарты
          <input id="recipe-search" autocomplete="off" placeholder="Блюдо, полуфабрикат, заготовка">
        </label>
        <button class="ghost" id="refresh-recipes" type="button">Обновить</button>
        <div id="recipe-list-message" class="notice" style="grid-column: span 2">Техкарты сгруппированы по типу.</div>
      </div>
      <div id="recipes-list"></div>
    </section>

    <section class="card module-view" data-module-view="purchases" hidden>
      <div class="section-head">
        <h2>Закупки и накладные</h2>
        <span class="pill ok" id="purchases-badge">Закупки</span>
      </div>

      <div class="supplier-form">
        <label>Новый поставщик
          <input id="supplier-name" autocomplete="off" placeholder="Название поставщика">
        </label>
        <label>Телефон
          <input id="supplier-phone" autocomplete="off" placeholder="+993...">
        </label>
        <label>Условия
          <input id="supplier-terms" autocomplete="off" placeholder="оплата, доставка, отсрочка">
        </label>
        <button class="ghost" id="add-supplier" type="button">Создать</button>
      </div>
      <div id="supplier-message" class="notice" style="margin-bottom:12px">Готово.</div>

      <div class="receipt-form">
        <label>Поставщик
          <select id="receipt-supplier"></select>
        </label>
        <label>Дата прихода
          <input id="receipt-date" type="date">
        </label>
        <label>Накладная
          <input id="receipt-number" autocomplete="off" placeholder="№ документа">
        </label>
        <label>Счет
          <input id="receipt-invoice" autocomplete="off" placeholder="№ счета">
        </label>
      </div>

      <div class="receipt-line-form">
        <label>Продукт
          <select id="receipt-product"></select>
        </label>
        <label>Кол-во
          <input id="receipt-quantity" type="number" min="0.001" step="0.001" value="1">
        </label>
        <label>Ед.
          <select id="receipt-unit"></select>
        </label>
        <label>Цена
          <input id="receipt-price" type="number" min="0" step="0.001" value="0">
        </label>
        <button class="ghost" id="add-receipt-line" type="button">Добавить строку</button>
      </div>

      <div id="receipt-message" class="notice" style="margin-bottom:12px">Добавьте строки и сохраните приход.</div>
      <div id="receipt-draft"></div>
      <div class="actions" style="justify-content:flex-start;margin:12px 0">
        <button class="primary" id="save-receipt" type="button">Сохранить накладную</button>
        <button class="ghost" id="clear-receipt" type="button">Очистить</button>
      </div>
      <div id="purchasing-overview"></div>
    </section>

    <section class="card module-view" data-module-view="kmrs" hidden>
      <div class="section-head">
        <h2>KMRS синхронизация</h2>
        <span class="pill warn" id="kmrs-badge">KMRS</span>
      </div>

      <div class="toolbar">
        <label>Заведение
          <select id="kmrs-location"></select>
        </label>
        <label>Slug KMRS
          <input id="kmrs-slug" autocomplete="off" value="7sky">
        </label>
        <label>База KMRS
          <input id="kmrs-base-url" autocomplete="off" value="https://tagam.delivery">
        </label>
        <button class="ghost" id="save-key" type="button">Сохранить</button>
        <button class="secondary" id="import-menu" type="button">Импорт</button>
      </div>

      <div class="subtoolbar">
        <label>Поиск
          <input id="menu-search" autocomplete="off" placeholder="Название блюда">
        </label>
        <button class="ghost" id="refresh-kmrs" type="button">Обновить</button>
        <button class="primary" id="link-all-kmrs" type="button">Связать все</button>
        <div id="kmrs-message" class="notice">Данные KMRS загрузятся после входа в модуль.</div>
      </div>

      <div id="connections" class="connections"></div>
      <div id="kmrs-menu"></div>
    </section>

    <section class="card module-view" data-module-view="writeoffs" hidden>
      <div class="section-head">
        <h2>Списание продажи из KMRS</h2>
        <span class="pill ok">Preview</span>
      </div>
      <div id="writeoff"></div>
    </section>

    <section class="card module-view" data-module-view="api" hidden>
      <h2>API</h2>
      <div class="links" id="links"></div>
    </section>

    <div class="detail-shell" id="recipe-editor-shell" hidden>
      <button class="detail-backdrop" id="recipe-editor-backdrop" type="button" aria-label="Закрыть редактор"></button>
      <section class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="recipe-editor-heading">
        <div class="detail-panel-head">
          <div>
            <span class="pill ok">Техкарта</span>
            <h2 id="recipe-editor-heading">Редактор техкарты</h2>
          </div>
          <button class="ghost" id="close-recipe-editor" type="button">Закрыть</button>
        </div>
        <div id="recipe-editor" class="recipe-editor detail-body"></div>
      </section>
    </div>
  </main>

  <script>
    const DEFAULT_KMRS_BASE_URL = "https://tagam.delivery";
    const money = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
    const qty = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 });
    const dateTime = new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
    const state = {
      summary: null,
      locations: [],
      units: [],
      categories: [],
      products: [],
      recipes: [],
      kmrsItems: [],
      connections: [],
      selectedRecipeDetail: null,
      purchasing: { suppliers: [], receivingDocuments: [], invoiceDocuments: [], latestPrices: [] },
      purchaseDraftLines: [],
      restaurantSlug: localStorage.getItem("tagamAccountingRestaurantSlug") || "7sky",
      kmrsBaseUrl: normalizeKmrsBaseUrl(localStorage.getItem("tagamAccountingKmrsBaseUrl") || DEFAULT_KMRS_BASE_URL),
      selectedLocationId: localStorage.getItem("tagamAccountingLocationId") || "",
      activeModule: localStorage.getItem("tagamAccountingModule") || "overview",
      busy: false
    };

    function text(value) {
      return value === null || value === undefined ? "" : String(value);
    }

    function normalizeKmrsBaseUrl(value) {
      const raw = text(value).trim().replace(/\\/+$/, "");
      const candidate = /^https?:\\/\\//i.test(raw) ? raw : raw.includes(".") ? "https://" + raw : "";

      if (!candidate) {
        return DEFAULT_KMRS_BASE_URL;
      }

      try {
        new URL(candidate);
        return candidate.replace(/\\/+$/, "");
      } catch (error) {
        return DEFAULT_KMRS_BASE_URL;
      }
    }

    function cell(value, className) {
      const td = document.createElement("td");
      if (className) {
        td.className = className;
      }
      td.textContent = text(value);
      return td;
    }

    function table(headers, rows) {
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
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
      wrap.appendChild(tableEl);
      return wrap;
    }

    async function fetchJson(url, options) {
      const response = await fetch(url, options);
      const payload = await response.json().catch(function () { return null; });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = "/login";
        }
        const reason = payload && (payload.reason || payload.error);
        throw new Error(reason || url + " -> " + response.status);
      }

      return payload;
    }

    function authHeaders(extra) {
      return Object.assign({}, extra || {});
    }

    function currentLocationId() {
      const globalSelect = document.getElementById("global-location");
      const kmrsSelect = document.getElementById("kmrs-location");
      return (globalSelect && globalSelect.value) ||
        (kmrsSelect && kmrsSelect.value) ||
        state.selectedLocationId ||
        state.summary.primaryLocation.id;
    }

    function switchModule(module) {
      const target = document.querySelector('[data-module-view="' + module + '"]') ? module : "overview";
      state.activeModule = target;
      localStorage.setItem("tagamAccountingModule", target);

      for (const view of document.querySelectorAll("[data-module-view]")) {
        view.hidden = view.dataset.moduleView !== target;
      }

      for (const button of document.querySelectorAll("[data-module]")) {
        button.classList.toggle("active", button.dataset.module === target);
      }
    }

    function currentKmrsConnection() {
      const locationId = currentLocationId();
      const baseUrl = normalizeKmrsBaseUrl(state.kmrsBaseUrl);
      return state.connections.find(function (connection) {
        return connection.locationId === locationId &&
          connection.restaurantSlug === state.restaurantSlug &&
          normalizeKmrsBaseUrl(connection.baseUrl) === baseUrl;
      }) || state.connections.find(function (connection) {
        return connection.locationId === locationId;
      }) || state.connections[0] || null;
    }

    function recipeStatusLabel(status) {
      if (status === "draft") {
        return "черновик";
      }

      if (status === "archived") {
        return "архив";
      }

      return status;
    }

    function recipeLabel(version) {
      const suffix = version.status === "active" ? "" : " (" + recipeStatusLabel(version.status) + ")";
      return version.recipeName + " / " + version.versionCode + suffix;
    }

    function findSuggestedRecipe(item) {
      const itemName = text(item.name).trim().toLocaleLowerCase("ru-RU");
      return state.recipes.find(function (version) {
        return version.status === "active" && version.recipeName.trim().toLocaleLowerCase("ru-RU") === itemName;
      }) || state.recipes.find(function (version) {
        return version.recipeName.trim().toLocaleLowerCase("ru-RU") === itemName;
      }) || null;
    }

    function productById(id) {
      return state.products.find(function (product) { return product.id === id; }) || null;
    }

    function recipeByVersionId(id) {
      return state.recipes.find(function (recipe) { return recipe.recipeVersionId === id; }) || null;
    }

    function unitById(id) {
      return state.units.find(function (unit) { return unit.id === id; }) || null;
    }

    function unitByCodeValue(code) {
      return state.units.find(function (unit) { return unit.code === code; }) || null;
    }

    function unitCodeLabel(code) {
      const labels = {
        g: "\u0433",
        kg: "\u043a\u0433",
        ml: "\u043c\u043b",
        l: "\u043b",
        pcs: "\u0448\u0442",
        dish: "\u0431\u043b\u044e\u0434\u043e"
      };
      return labels[code] || code;
    }

    function unitOptionLabel(unit) {
      return unitCodeLabel(unit.code) + " - " + unit.name;
    }

    function categoryById(id) {
      return state.categories.find(function (category) { return category.id === id; }) || null;
    }

    function categoryPath(categoryId) {
      const parts = [];
      const seen = new Set();
      let category = categoryById(categoryId);

      while (category && !seen.has(category.id)) {
        seen.add(category.id);
        parts.unshift(category.name);
        category = categoryById(category.parentId);
      }

      return parts.length > 0 ? parts.join(" / ") : "Без категории";
    }

    function sortedCategories() {
      return state.categories.slice().sort(function (left, right) {
        return categoryPath(left.id).localeCompare(categoryPath(right.id), "ru-RU");
      });
    }

    function productTypeLabel(value) {
      const labels = {
        raw: "сырье",
        prepared: "полуфабрикат",
        menu_item: "блюдо",
        bar_item: "бар",
        packaging: "упаковка",
        supply: "хозтовар",
        service: "услуга"
      };
      return labels[value] || value;
    }

    function inventoryPolicyLabel(value) {
      const labels = {
        tracked: "склад",
        theoretical_only: "только норма",
        not_tracked: "без учета"
      };
      return labels[value] || value;
    }

    function recipeTypeLabel(value) {
      const labels = {
        menu_item: "блюдо",
        sub_recipe: "вложенная",
        prep_item: "полуфабрикат",
        bar_item: "бар",
        pour: "розлив",
        modifier_delta: "модификатор"
      };
      return labels[value] || value;
    }

    function productWastePercent(product) {
      return Number(product && product.defaultWastePercent ? product.defaultWastePercent : 0);
    }

    function moneyOrDash(value, currency) {
      return value === null || value === undefined ? "—" : money.format(value) + " " + currency;
    }

    function dateOrDash(value) {
      if (!value) {
        return "—";
      }

      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? text(value) : dateTime.format(date);
    }

    function percentOrDash(value) {
      return value === null || value === undefined ? "—" : money.format(value) + "%";
    }

    function fillSelect(select, items, getLabel) {
      select.replaceChildren();
      for (const item of items) {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = getLabel(item);
        select.appendChild(option);
      }
    }

    function kmrsCategoryKey(item) {
      return item.kmrsCategoryId || "без категории";
    }

    function kmrsCategoryLabel(item) {
      const name = text(item.kmrsCategoryName).trim();
      const id = text(item.kmrsCategoryId).trim();

      if (name && id) {
        return name + " (категория " + id + ")";
      }

      if (name) {
        return name;
      }

      return id ? "Категория " + id : "Без категории";
    }

    function applyKmrsConnectionScope(connection) {
      if (!connection) {
        state.kmrsBaseUrl = normalizeKmrsBaseUrl(state.kmrsBaseUrl);
        localStorage.setItem("tagamAccountingKmrsBaseUrl", state.kmrsBaseUrl);
        return;
      }

      const nextSlug = text(connection.restaurantSlug || state.restaurantSlug).trim() || state.restaurantSlug;
      const nextBaseUrl = normalizeKmrsBaseUrl(connection.baseUrl || state.kmrsBaseUrl);
      state.restaurantSlug = nextSlug;
      state.kmrsBaseUrl = nextBaseUrl;
      localStorage.setItem("tagamAccountingRestaurantSlug", state.restaurantSlug);
      localStorage.setItem("tagamAccountingKmrsBaseUrl", state.kmrsBaseUrl);
      renderKmrsControls();
    }

    function setNotice(message, isError) {
      const el = document.getElementById("kmrs-message");
      el.textContent = message;
      el.className = isError ? "notice error" : "notice";
    }

    function setKmrsBadge(label, className) {
      const badge = document.getElementById("kmrs-badge");
      badge.textContent = label;
      badge.className = "pill " + (className || "");
    }

    function setBusy(value) {
      state.busy = value;
      for (const id of [
        "save-key",
        "import-menu",
        "refresh-kmrs",
        "link-all-kmrs",
        "add-recipe",
        "add-product",
        "add-category",
        "refresh-products",
        "refresh-recipes",
        "add-supplier",
        "add-receipt-line",
        "save-receipt",
        "clear-receipt"
      ]) {
        const button = document.getElementById(id);
        if (button) {
          button.disabled = value;
        }
      }
      for (const id of ["editor-save", "editor-activate", "editor-add-line"]) {
        const button = document.getElementById(id);

        if (button) {
          button.disabled = value;
        }
      }
      for (const button of document.querySelectorAll("[data-action]")) {
        if (value) {
          button.disabled = true;
        } else if (button.dataset.action === "edit") {
          const select = button.closest("tr").querySelector("select");
          button.disabled = !select || !select.value;
        } else {
          button.disabled = false;
        }
      }
    }

    function stat(label, value) {
      const el = document.createElement("div");
      el.className = "stat";
      el.innerHTML = "<span></span><strong></strong>";
      el.querySelector("span").textContent = label;
      el.querySelector("strong").textContent = value;
      return el;
    }

    function renderMetrics(summary) {
      const metrics = document.getElementById("metrics");
      metrics.replaceChildren();
      const items = [
        ["Продукты", summary.health.products],
        ["Активные техкарты", summary.health.activeRecipes],
        ["Складские позиции", summary.health.inventoryRows],
        ["Связи с KMRS", summary.health.linkedKmrsItems]
      ];
      for (const item of items) {
        const el = document.createElement("div");
        el.className = "card metric";
        el.innerHTML = '<div class="label"></div><div class="value"></div>';
        el.querySelector(".label").textContent = item[0];
        el.querySelector(".value").textContent = item[1];
        metrics.appendChild(el);
      }
    }

    function renderRecipe(recipe) {
      const root = document.getElementById("recipe");
      root.replaceChildren();

      const title = document.createElement("div");
      const complete = recipe.costingStatus === "complete";
      document.getElementById("recipe-badge").className = complete ? "pill ok" : "pill warn";
      document.getElementById("recipe-badge").textContent = complete ? "Полный расчет" : "Есть пробелы";
      title.innerHTML = "<strong></strong><p></p>";
      title.querySelector("strong").textContent = recipe.recipeName;
      title.querySelector("p").textContent = "Версия " + recipe.versionCode + ", выход " + qty.format(Number(recipe.yieldQuantity)) + " " + unitCodeLabel(recipe.yieldUnitCode);
      root.appendChild(title);

      const kpis = document.createElement("div");
      kpis.className = "stats";
      kpis.appendChild(stat("Зал", moneyOrDash(recipe.dineInTotalCost ?? recipe.totalCost, recipe.currency)));
      kpis.appendChild(stat("Доставка", moneyOrDash(recipe.deliveryTotalCost, recipe.currency)));
      kpis.appendChild(stat("Упаковка", moneyOrDash(recipe.deliveryPackagingCost, recipe.currency)));
      kpis.appendChild(stat("Цена в меню", money.format(Number(recipe.menuPrice || 0)) + " " + recipe.currency));
      root.appendChild(kpis);

      const rows = recipe.lines.map(function (line) {
        const status = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = line.costStatus === "ok" ? "pill ok" : "pill bad";
        badge.textContent = line.costStatus === "ok" ? "ok" : line.costStatus;
        status.appendChild(badge);
        const productName = line.productName + (line.fulfillmentMode === "delivery_packaging" ? " · доставка" : "");
        return [
          productName,
          qty.format(line.stockInputQuantity) + " " + unitCodeLabel(line.unitCode),
          qty.format(line.preparedOutputQuantity) + " " + unitCodeLabel(line.unitCode),
          money.format(line.lineCost || 0) + " " + (line.currency || recipe.currency),
          status
        ];
      });
      root.appendChild(table(["Продукт", "Со склада", "После обработки", "Стоимость", "Статус"], rows));
    }

    function renderInventory(rows, currency) {
      const root = document.getElementById("inventory");
      root.replaceChildren();
      const body = rows.map(function (row) {
        return [
          row.productName,
          qty.format(Number(row.quantityOnHand)),
          money.format(Number(row.inventoryValue)) + " " + (row.currency || currency)
        ];
      });
      root.appendChild(table(["Продукт", "Кол-во", "Сумма"], body));
    }

    function renderProductControls() {
      fillSelect(document.getElementById("product-unit"), state.units, function (unit) {
        return unitOptionLabel(unit);
      });

      const categorySelect = document.getElementById("product-category");
      categorySelect.replaceChildren();
      const parentSelect = document.getElementById("category-parent");
      parentSelect.replaceChildren();
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Без категории";
      categorySelect.appendChild(empty);
      const root = document.createElement("option");
      root.value = "";
      root.textContent = "Корень";
      parentSelect.appendChild(root);
      for (const category of sortedCategories()) {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = categoryPath(category.id);
        categorySelect.appendChild(option);
        parentSelect.appendChild(option.cloneNode(true));
      }
    }

    function renderRecipeCreateControls() {
      fillSelect(document.getElementById("new-recipe-yield-unit"), state.units, function (unit) {
        return unitCodeLabel(unit.code);
      });
      syncNewRecipeYieldUnit();
      const outputSelect = document.getElementById("new-recipe-output-product");
      outputSelect.replaceChildren();
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Не связан";
      outputSelect.appendChild(empty);
      for (const product of state.products) {
        const option = document.createElement("option");
        option.value = product.id;
        option.textContent = product.name + " · " + productTypeLabel(product.productType);
        outputSelect.appendChild(option);
      }
    }

    function renderRecipesList() {
      const root = document.getElementById("recipes-list");
      const message = document.getElementById("recipe-list-message");

      if (!root || !message) {
        return;
      }

      const search = document.getElementById("recipe-search").value.trim().toLowerCase();
      const filtered = state.recipes.filter(function (recipe) {
        const outputProduct = productById(recipe.outputProductId);
        return !search ||
          recipe.recipeName.toLowerCase().includes(search) ||
          recipeTypeLabel(recipe.recipeType).toLowerCase().includes(search) ||
          (outputProduct && outputProduct.name.toLowerCase().includes(search));
      });
      const grouped = new Map();

      for (const recipe of filtered) {
        const key = recipe.recipeType;
        const group = grouped.get(key) || {
          label: recipeTypeLabel(recipe.recipeType),
          items: []
        };
        group.items.push(recipe);
        grouped.set(key, group);
      }

      const rows = [];

      for (const group of grouped.values()) {
        const categoryCell = document.createElement("td");
        categoryCell.colSpan = 6;
        categoryCell.innerHTML = "<span></span><small></small>";
        categoryCell.querySelector("span").textContent = group.label;
        categoryCell.querySelector("small").textContent = group.items.length + " техкарт";
        rows.push([categoryCell]);

        for (const recipe of group.items) {
          const outputProduct = productById(recipe.outputProductId);
          const status = document.createElement("td");
          const badge = document.createElement("span");
          badge.className = recipe.status === "active" ? "pill ok" : recipe.status === "draft" ? "pill warn" : "pill bad";
          badge.textContent = recipeStatusLabel(recipe.status);
          status.appendChild(badge);

          const action = document.createElement("td");
          const button = document.createElement("button");
          button.className = "ghost";
          button.type = "button";
          button.textContent = "Открыть";
          button.dataset.action = "open-recipe";
          button.dataset.id = recipe.recipeVersionId;
          action.appendChild(button);

          rows.push([
            recipe.recipeName,
            recipe.versionCode,
            outputProduct ? outputProduct.name : "—",
            qty.format(Number(recipe.yieldQuantity)) + " " + unitCodeLabel((unitById(recipe.yieldUnitId) || {}).code || ""),
            status,
            action
          ]);
        }
      }

      root.replaceChildren();
      message.textContent = "Показано " + filtered.length + " из " + state.recipes.length + " техкарт.";

      if (filtered.length === 0) {
        root.appendChild(noticeNode("Техкарты не найдены."));
        return;
      }

      root.appendChild(table(["Техкарта", "Версия", "Выходной продукт", "Выход", "Статус", ""], rows));
      for (const row of root.querySelectorAll("tbody tr")) {
        if (row.children.length === 1) {
          row.className = "category-row";
        }
      }
    }

    function setSupplierMessage(message, isError) {
      const el = document.getElementById("supplier-message");
      el.textContent = message;
      el.className = isError ? "notice error" : "notice";
    }

    function setReceiptMessage(message, isError) {
      const el = document.getElementById("receipt-message");
      el.textContent = message;
      el.className = isError ? "notice error" : "notice";
    }

    function purchasingPanel(title, child) {
      const box = document.createElement("div");
      box.className = "editor-panel";
      const heading = document.createElement("h3");
      heading.textContent = title;
      box.appendChild(heading);
      box.appendChild(child);
      return box;
    }

    function renderPurchaseControls() {
      const supplierSelect = document.getElementById("receipt-supplier");
      supplierSelect.replaceChildren();

      if (state.purchasing.suppliers.length === 0) {
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "Сначала добавьте поставщика";
        supplierSelect.appendChild(empty);
      } else {
        for (const supplier of state.purchasing.suppliers) {
          const option = document.createElement("option");
          option.value = supplier.id;
          option.textContent = supplier.name;
          supplierSelect.appendChild(option);
        }
      }

      const productSelect = document.getElementById("receipt-product");
      productSelect.replaceChildren();
      for (const product of state.products) {
        const option = document.createElement("option");
        option.value = product.id;
        option.textContent = product.name + " · " + productTypeLabel(product.productType);
        productSelect.appendChild(option);
      }

      fillSelect(document.getElementById("receipt-unit"), state.units, function (unit) {
        return unitCodeLabel(unit.code);
      });

      const dateInput = document.getElementById("receipt-date");
      if (!dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
      }

      syncReceiptProductUnit();
    }

    function syncReceiptProductUnit() {
      const product = productById(document.getElementById("receipt-product").value);

      if (product) {
        document.getElementById("receipt-unit").value = product.baseUnitId;
      }
    }

    function renderReceiptDraft() {
      const root = document.getElementById("receipt-draft");
      root.replaceChildren();

      if (state.purchaseDraftLines.length === 0) {
        const empty = document.createElement("div");
        empty.className = "notice";
        empty.textContent = "В черновике пока нет строк.";
        root.appendChild(empty);
        return;
      }

      const rows = state.purchaseDraftLines.map(function (line, index) {
        const action = document.createElement("td");
        const button = document.createElement("button");
        button.className = "danger";
        button.type = "button";
        button.textContent = "Удалить";
        button.dataset.action = "remove-receipt-line";
        button.dataset.index = String(index);
        action.appendChild(button);

        return [
          line.productName,
          qty.format(line.quantity) + " " + unitCodeLabel(line.unitCode),
          money.format(line.unitPrice) + " " + state.summary.organization.defaultCurrency,
          money.format(line.quantity * line.unitPrice) + " " + state.summary.organization.defaultCurrency,
          action
        ];
      });

      root.appendChild(table(["Продукт", "Кол-во", "Цена", "Сумма", ""], rows));
    }

    function renderPurchasing() {
      const root = document.getElementById("purchasing-overview");
      const data = state.purchasing;
      const currency = state.summary.organization.defaultCurrency;
      root.replaceChildren();
      document.getElementById("purchases-badge").textContent = data.receivingDocuments.length + " приходов";

      const stats = document.createElement("div");
      stats.className = "stats";
      const latestTotal = data.latestPrices.reduce(function (sum, item) {
        return sum + Number(item.unitPrice || 0);
      }, 0);
      stats.appendChild(stat("Поставщики", data.suppliers.length));
      stats.appendChild(stat("Приходы", data.receivingDocuments.length));
      stats.appendChild(stat("Счета", data.invoiceDocuments.length));
      stats.appendChild(stat("Средняя цена", data.latestPrices.length ? money.format(latestTotal / data.latestPrices.length) + " " + currency : "—"));
      root.appendChild(stats);

      const grid = document.createElement("div");
      grid.className = "module-grid";

      const supplierRows = data.suppliers.map(function (supplier) {
        return [
          supplier.name,
          supplier.phone || "—",
          supplier.paymentTerms || "—"
        ];
      });
      grid.appendChild(purchasingPanel(
        "Поставщики",
        supplierRows.length ? table(["Название", "Телефон", "Условия"], supplierRows) : noticeNode("Поставщиков пока нет.")
      ));

      const receivingRows = data.receivingDocuments.map(function (doc) {
        return [
          doc.documentNumber || "—",
          doc.supplierName || "—",
          dateOrDash(doc.receivedAt),
          String(doc.lineCount || 0),
          moneyOrDash(doc.totalCost, doc.currency || currency)
        ];
      });
      grid.appendChild(purchasingPanel(
        "Приходные накладные",
        receivingRows.length ? table(["Накладная", "Поставщик", "Дата", "Строк", "Сумма"], receivingRows) : noticeNode("Приходов пока нет.")
      ));

      const invoiceRows = data.invoiceDocuments.map(function (doc) {
        return [
          doc.invoiceNumber || "—",
          doc.supplierName || "—",
          dateOrDash(doc.invoiceDate),
          doc.status,
          moneyOrDash(doc.total, doc.currency || currency)
        ];
      });
      grid.appendChild(purchasingPanel(
        "Счета",
        invoiceRows.length ? table(["Счет", "Поставщик", "Дата", "Статус", "Сумма"], invoiceRows) : noticeNode("Счетов пока нет.")
      ));

      const priceRows = data.latestPrices.map(function (price) {
        return [
          price.productName,
          price.supplierName || "—",
          money.format(Number(price.unitPrice || 0)) + " " + price.currency + " / " + unitCodeLabel(price.unitCode),
          dateOrDash(price.observedAt)
        ];
      });
      grid.appendChild(purchasingPanel(
        "Последние закупочные цены",
        priceRows.length ? table(["Продукт", "Поставщик", "Цена", "Дата"], priceRows) : noticeNode("Истории цен пока нет.")
      ));

      root.appendChild(grid);
    }

    function noticeNode(message) {
      const el = document.createElement("div");
      el.className = "notice";
      el.textContent = message;
      return el;
    }

    async function refreshPurchasing() {
      const org = encodeURIComponent(state.summary.organization.id);
      const location = encodeURIComponent(currentLocationId());
      const response = await fetchJson("/v1/purchasing/overview?organizationId=" + org + "&locationId=" + location + "&limit=100");
      state.purchasing = response.data;
      renderPurchaseControls();
      renderReceiptDraft();
      renderPurchasing();
    }

    async function createSupplierFromForm() {
      const nameInput = document.getElementById("supplier-name");
      const phoneInput = document.getElementById("supplier-phone");
      const termsInput = document.getElementById("supplier-terms");
      const name = nameInput.value.trim();

      if (!name) {
        setSupplierMessage("Введите название поставщика.", true);
        return;
      }

      setBusy(true);

      try {
        await fetchJson("/v1/suppliers", {
          method: "POST",
          headers: authHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({
            organizationId: state.summary.organization.id,
            name,
            phone: phoneInput.value.trim(),
            paymentTerms: termsInput.value.trim()
          })
        });
        nameInput.value = "";
        phoneInput.value = "";
        termsInput.value = "";
        await refreshPurchasing();
        setSupplierMessage("Поставщик создан.", false);
      } catch (error) {
        setSupplierMessage(error.message, true);
      } finally {
        setBusy(false);
      }
    }

    function addReceiptLineFromForm() {
      const product = productById(document.getElementById("receipt-product").value);
      const unit = unitById(document.getElementById("receipt-unit").value);
      const quantityValue = Number(document.getElementById("receipt-quantity").value);
      const priceValue = Number(document.getElementById("receipt-price").value);

      if (!product || !unit) {
        setReceiptMessage("Выберите продукт и единицу.", true);
        return;
      }

      if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
        setReceiptMessage("Количество должно быть больше нуля.", true);
        return;
      }

      if (!Number.isFinite(priceValue) || priceValue < 0) {
        setReceiptMessage("Цена должна быть нулем или больше.", true);
        return;
      }

      state.purchaseDraftLines.push({
        productId: product.id,
        productName: product.name,
        quantity: quantityValue,
        unitId: unit.id,
        unitCode: unit.code,
        unitPrice: priceValue
      });
      renderReceiptDraft();
      setReceiptMessage("Строка добавлена в черновик.", false);
    }

    async function saveReceiptFromForm() {
      if (state.purchaseDraftLines.length === 0) {
        setReceiptMessage("Добавьте хотя бы одну строку накладной.", true);
        return;
      }

      const supplierId = document.getElementById("receipt-supplier").value;
      if (!supplierId) {
        setReceiptMessage("Выберите поставщика.", true);
        return;
      }

      setBusy(true);

      try {
        const dateValue = document.getElementById("receipt-date").value;
        const payload = {
          organizationId: state.summary.organization.id,
          locationId: currentLocationId(),
          supplierId,
          documentNumber: document.getElementById("receipt-number").value.trim(),
          invoiceNumber: document.getElementById("receipt-invoice").value.trim(),
          receivedAt: dateValue || undefined,
          invoiceDate: dateValue || undefined,
          currency: state.summary.organization.defaultCurrency,
          lines: state.purchaseDraftLines.map(function (line) {
            return {
              productId: line.productId,
              quantity: line.quantity,
              unitId: line.unitId,
              unitPrice: line.unitPrice
            };
          })
        };
        const response = await fetchJson("/v1/purchasing/receipts", {
          method: "POST",
          headers: authHeaders({ "content-type": "application/json" }),
          body: JSON.stringify(payload)
        });
        state.purchaseDraftLines = [];
        document.getElementById("receipt-number").value = "";
        document.getElementById("receipt-invoice").value = "";
        renderReceiptDraft();
        await refreshPurchasing();
        await refreshProducts();
        const org = encodeURIComponent(state.summary.organization.id);
        const inventory = await fetchJson("/v1/inventory/summary?organizationId=" + org);
        renderInventory(inventory.data, state.summary.organization.defaultCurrency);
        setReceiptMessage("Накладная сохранена: " + response.data.documentNumber + ", сумма " + money.format(response.data.total) + " " + response.data.currency + ".", false);
      } catch (error) {
        setReceiptMessage(error.message, true);
      } finally {
        setBusy(false);
      }
    }

    function clearReceiptDraft() {
      state.purchaseDraftLines = [];
      renderReceiptDraft();
      setReceiptMessage("Черновик очищен.", false);
    }

    function syncNewRecipeYieldUnit() {
      const typeSelect = document.getElementById("new-recipe-type");
      const unitSelect = document.getElementById("new-recipe-yield-unit");

      if (!typeSelect || !unitSelect) {
        return;
      }

      const preferredCode = typeSelect.value === "menu_item"
        ? "dish"
        : typeSelect.value === "prep_item" || typeSelect.value === "sub_recipe"
          ? "g"
          : "pcs";
      const unit = unitByCodeValue(preferredCode) || state.units[0] || null;

      if (unit) {
        unitSelect.value = unit.id;
      }
    }

    function renderProducts() {
      const root = document.getElementById("products-list");
      const badge = document.getElementById("products-badge");
      const search = document.getElementById("product-search").value.trim().toLowerCase();
      const products = state.products.filter(function (product) {
        return !search ||
          product.name.toLowerCase().includes(search) ||
          text(product.sku).toLowerCase().includes(search);
      });
      root.replaceChildren();
      badge.textContent = state.products.length + " продуктов";

      if (products.length === 0) {
        const empty = document.createElement("div");
        empty.className = "notice";
        empty.textContent = "Продукты не найдены.";
        root.appendChild(empty);
        return;
      }

      const rows = products.map(function (product) {
        const unit = unitById(product.baseUnitId);
        const category = categoryById(product.categoryId);
        return [
          product.name,
          unit ? unitCodeLabel(unit.code) : "—",
          category ? categoryPath(category.id) : "Без категории",
          productTypeLabel(product.productType),
          inventoryPolicyLabel(product.inventoryPolicy),
          money.format(productWastePercent(product)) + "%"
        ];
      });

      root.appendChild(table(["Продукт", "Ед.", "Категория", "Тип", "Учет", "Потери"], rows));
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

      const rows = writeoff.requirements.map(function (item) {
        const status = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = item.availabilityStatus === "ok" ? "pill ok" : "pill bad";
        badge.textContent = item.availabilityStatus === "ok" ? "хватает" : "дефицит";
        status.appendChild(badge);
        return [
          item.productName,
          qty.format(item.quantity) + " " + unitCodeLabel(item.unitCode),
          money.format(item.estimatedCost) + " " + item.currency,
          qty.format(item.availableQuantity) + " " + unitCodeLabel(item.unitCode),
          status
        ];
      });
      root.appendChild(table(["Продукт", "Списание", "Себестоимость", "На складе", "Статус"], rows));
    }

    function renderLinks(summary) {
      const root = document.getElementById("links");
      const org = encodeURIComponent(summary.organization.id);
      const recipe = encodeURIComponent(summary.activeRecipeVersionId);
      const location = encodeURIComponent(summary.primaryLocation.id);
      const links = [
        ["/health", "health"],
        ["/v1/demo", "demo"],
        ["/v1/catalog?organizationId=" + org, "catalog"],
        ["/v1/products?organizationId=" + org, "products"],
        ["/v1/inventory/summary?organizationId=" + org, "inventory"],
        ["/v1/purchasing/overview?organizationId=" + org + "&locationId=" + location, "purchasing"],
        ["/v1/recipes/" + recipe + "?organizationId=" + org, "recipe cost"],
        ["/v1/kmrs/connections?organizationId=" + org + "&locationId=" + location, "kmrs connections"],
        ["/v1/kmrs/menu-items?organizationId=" + org + "&locationId=" + location, "kmrs menu"]
      ];
      root.replaceChildren();
      for (const item of links) {
        const a = document.createElement("a");
        a.href = item[0];
        a.textContent = item[1];
        root.appendChild(a);
      }
    }

    function renderKmrsControls() {
      state.kmrsBaseUrl = normalizeKmrsBaseUrl(state.kmrsBaseUrl);
      localStorage.setItem("tagamAccountingKmrsBaseUrl", state.kmrsBaseUrl);
      document.getElementById("kmrs-slug").value = state.restaurantSlug;
      document.getElementById("kmrs-base-url").value = state.kmrsBaseUrl;
      const selectedLocation = state.selectedLocationId || state.summary.primaryLocation.id;

      for (const select of [document.getElementById("global-location"), document.getElementById("kmrs-location")]) {
        select.replaceChildren();

        for (const location of state.locations) {
          const option = document.createElement("option");
          option.value = location.id;
          option.textContent = location.name + (location.kmrsMerchantId ? " / KMRS " + location.kmrsMerchantId : "");
          select.appendChild(option);
        }

        select.value = selectedLocation;
      }
    }

    function renderConnections() {
      const root = document.getElementById("connections");
      root.replaceChildren();

      for (const connection of state.connections.slice(0, 3)) {
        const row = document.createElement("div");
        row.className = "connection-row";
        row.innerHTML = '<strong></strong><span class="small"></span><span class="small"></span>';
        row.querySelector("strong").textContent = connection.restaurantSlug || connection.kmrsMerchantId || "KMRS";
        row.querySelectorAll("span")[0].textContent = connection.locationName || "Локация";
        row.querySelectorAll("span")[1].textContent = connection.importedMenuItems + " позиций, связей " + connection.linkedMenuItems;
        root.appendChild(row);
      }
    }

    function renderKmrsMenu() {
      const root = document.getElementById("kmrs-menu");
      root.replaceChildren();
      const search = document.getElementById("menu-search").value.trim().toLowerCase();
      const items = state.kmrsItems.filter(function (item) {
        return !search || item.name.toLowerCase().includes(search) || String(item.kmrsItemId).toLowerCase().includes(search);
      });

      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "notice";
        empty.textContent = "Импортированных блюд пока нет.";
        root.appendChild(empty);
        renderConnections();
        return;
      }

      const grouped = new Map();

      for (const item of items) {
        const key = kmrsCategoryKey(item);
        const group = grouped.get(key) || {
          label: kmrsCategoryLabel(item),
          items: []
        };
        group.items.push(item);
        grouped.set(key, group);
      }

      const rows = [];

      for (const group of grouped.values()) {
        const categoryCell = document.createElement("td");
        categoryCell.colSpan = 6;
        categoryCell.innerHTML = "<span></span><small></small>";
        categoryCell.querySelector("span").textContent = group.label;
        categoryCell.querySelector("small").textContent = group.items.length + " блюд";
        rows.push([categoryCell]);

        for (const item of group.items) {
        const name = document.createElement("td");
        name.className = "item-name";
        const title = document.createElement("div");
        title.textContent = item.name;
        const meta = document.createElement("small");
        meta.textContent = "KMRS " + item.kmrsItemId + (item.kmrsCategoryId ? " / категория " + item.kmrsCategoryId : "");
        name.appendChild(title);
        name.appendChild(meta);

        const availability = document.createElement("td");
        const availabilityBadge = document.createElement("span");
        availabilityBadge.className = item.isAvailable === false ? "pill bad" : "pill ok";
        availabilityBadge.textContent = item.isAvailable === false ? "стоп" : "активно";
        availability.appendChild(availabilityBadge);

        const linked = document.createElement("td");
        const linkBadge = document.createElement("span");
        linkBadge.className = item.activeRecipeVersionId ? "pill ok" : "pill warn";
        linkBadge.textContent = item.activeRecipeVersionId ? "связано" : "нет связи";
        linked.appendChild(linkBadge);
        if (item.recipeName) {
          const small = document.createElement("small");
          small.textContent = item.recipeName + (item.recipeVersionCode ? " / " + item.recipeVersionCode : "");
          linked.appendChild(small);
        }

        const recipe = document.createElement("td");
        const select = document.createElement("select");
        select.className = "recipe-select";
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "Выбрать техкарту";
        select.appendChild(emptyOption);
        for (const version of state.recipes) {
          const option = document.createElement("option");
          option.value = version.recipeVersionId;
          option.textContent = recipeLabel(version);
          select.appendChild(option);
        }
        const suggestedRecipe = findSuggestedRecipe(item);
        select.value = item.activeRecipeVersionId || (suggestedRecipe ? suggestedRecipe.recipeVersionId : "");
        recipe.appendChild(select);

        const actions = document.createElement("td");
        const wrap = document.createElement("div");
        wrap.className = "actions";
        const linkButton = document.createElement("button");
        linkButton.className = "primary";
        linkButton.type = "button";
        linkButton.textContent = "Связать";
        linkButton.dataset.action = "link";
        linkButton.dataset.id = item.id;
        wrap.appendChild(linkButton);

        const editButton = document.createElement("button");
        editButton.className = "ghost";
        editButton.type = "button";
        editButton.textContent = "Открыть";
        editButton.dataset.action = "edit";
        editButton.disabled = !select.value;
        wrap.appendChild(editButton);
        select.addEventListener("change", function () {
          editButton.disabled = state.busy || !select.value;
        });

        const unlinkButton = document.createElement("button");
        unlinkButton.className = "danger";
        unlinkButton.type = "button";
        unlinkButton.textContent = "Снять";
        unlinkButton.dataset.action = "unlink";
        unlinkButton.dataset.id = item.id;
        unlinkButton.disabled = !item.activeRecipeVersionId;
        wrap.appendChild(unlinkButton);
        actions.appendChild(wrap);

        rows.push([
          name,
          money.format(Number(item.price || 0)) + " " + (item.currency || state.summary.organization.defaultCurrency),
          availability,
          linked,
          recipe,
          actions
        ]);
        }
      }

      root.appendChild(table(["Блюдо KMRS", "Цена", "Статус", "Техкарта", "Привязка", ""], rows));
      for (const row of root.querySelectorAll("tbody tr")) {
        if (row.children.length === 1) {
          row.className = "category-row";
        }
      }
      renderConnections();
    }

    function renderRecipeEditor() {
      const root = document.getElementById("recipe-editor");
      const shell = document.getElementById("recipe-editor-shell");
      const detail = state.selectedRecipeDetail;
      root.replaceChildren();

      if (!detail) {
        shell.hidden = true;
        document.body.classList.remove("detail-open");
        return;
      }

      shell.hidden = false;
      document.body.classList.add("detail-open");
      document.getElementById("recipe-editor-heading").textContent = detail.recipeName + " / " + detail.versionCode;

      const panel = document.createElement("div");
      panel.className = "editor-panel";
      panel.innerHTML = [
        '<div class="editor-head">',
        '  <div><h3 id="editor-title"></h3><p id="editor-subtitle"></p></div>',
        '  <span class="pill" id="editor-status"></span>',
        '</div>',
        '<div class="stats" id="editor-stats"></div>',
        '<div class="editor-grid">',
        '  <label>Выход<input id="editor-yield" type="number" min="0.001" step="0.001"></label>',
        '  <label>Ед. выхода<select id="editor-yield-unit"></select></label>',
        '  <label>Цена меню<input id="editor-price" type="number" min="0" step="0.001"></label>',
        '  <label>Цель food cost %<input id="editor-target-food-cost" type="number" min="0.001" step="0.001"></label>',
        '</div>',
        '<label>Инструкции / заметки<textarea id="editor-instructions"></textarea></label>',
        '<div class="editor-actions" style="margin-top:12px">',
        '  <div></div>',
        '  <div class="actions">',
        '    <button class="ghost" id="editor-save" type="button">Сохранить</button>',
        '    <button class="primary" id="editor-activate" type="button">Активировать</button>',
        '  </div>',
        '</div>',
        '<h3 style="margin-top:16px">Состав</h3>',
        '<div id="editor-lines"></div>',
        '<div class="editor-grid wide">',
        '  <label>Тип строки<select id="editor-line-kind"><option value="product">продукт</option><option value="recipe">техкарта</option></select></label>',
        '  <label id="editor-line-product-label">Продукт<select id="editor-line-product"></select></label>',
        '  <label id="editor-line-recipe-label">Техкарта<select id="editor-line-recipe"></select></label>',
        '  <label>Кол-во<input id="editor-line-quantity" type="number" min="0.001" step="0.001" value="1"></label>',
        '  <label>Ед.<select id="editor-line-unit"></select></label>',
        '  <label>Режим<select id="editor-line-mode"><option value="stock_input">со склада</option><option value="prepared_output">после обработки</option></select></label>',
        '  <label>Потери %<input id="editor-line-waste" type="number" min="0" step="0.001" value="0"></label>',
        '  <button class="secondary" id="editor-add-line" type="button">Добавить</button>',
        '</div>',
        '<div id="editor-message" class="notice">Черновик можно наполнять составом и активировать после проверки.</div>'
      ].join("");
      root.appendChild(panel);

      document.getElementById("editor-title").textContent = detail.recipeName + " / " + detail.versionCode;
      document.getElementById("editor-subtitle").textContent = "Выход " + qty.format(Number(detail.yieldQuantity)) + " " + unitCodeLabel(detail.yieldUnitCode);
      document.getElementById("editor-status").textContent = recipeStatusLabel(detail.status);
      document.getElementById("editor-status").className = detail.status === "active" ? "pill ok" : "pill warn";
      document.getElementById("editor-yield").value = Number(detail.yieldQuantity);
      document.getElementById("editor-price").value = detail.menuPrice === null ? "" : Number(detail.menuPrice);
      document.getElementById("editor-target-food-cost").value = detail.targetFoodCostPercent === null ? "" : Number(detail.targetFoodCostPercent);
      document.getElementById("editor-instructions").value = detail.instructions || "";

      fillSelect(document.getElementById("editor-yield-unit"), state.units, function (unit) {
        return unitOptionLabel(unit);
      });
      document.getElementById("editor-yield-unit").value = detail.yieldUnitId;
      fillSelect(document.getElementById("editor-line-product"), state.products, function (product) {
        return product.name;
      });
      fillSelect(document.getElementById("editor-line-recipe"), state.recipes.filter(function (recipe) {
        return recipe.recipeVersionId !== detail.recipeVersionId;
      }), function (recipe) {
        return recipeLabel(recipe) + " · " + recipeTypeLabel(recipe.recipeType);
      });
      fillSelect(document.getElementById("editor-line-unit"), state.units, function (unit) {
        return unitCodeLabel(unit.code);
      });
      const firstProduct = state.products[0] || null;
      if (firstProduct) {
        document.getElementById("editor-line-unit").value = firstProduct.baseUnitId;
        document.getElementById("editor-line-waste").value = productWastePercent(firstProduct);
      }

      document.getElementById("editor-stats").replaceChildren(
        stat("Себестоимость", moneyOrDash(detail.totalCost, detail.currency)),
        stat("Food cost", percentOrDash(detail.foodCostPercent)),
        stat("Маржа", moneyOrDash(detail.grossMargin, detail.currency)),
        stat("Рекоменд. цена", moneyOrDash(detail.recommendedMenuPrice, detail.currency))
      );

      renderRecipeEditorLines(detail);

      syncEditorLineKind();
      document.getElementById("editor-line-kind").addEventListener("change", syncEditorLineKind);
      document.getElementById("editor-line-product").addEventListener("change", function (event) {
        const product = productById(event.target.value);
        if (product) {
          document.getElementById("editor-line-unit").value = product.baseUnitId;
          document.getElementById("editor-line-waste").value = productWastePercent(product);
        }
      });
      document.getElementById("editor-line-recipe").addEventListener("change", function (event) {
        const recipe = recipeByVersionId(event.target.value);
        if (recipe) {
          document.getElementById("editor-line-unit").value = recipe.yieldUnitId;
          document.getElementById("editor-line-waste").value = 0;
        }
      });
      document.getElementById("editor-save").addEventListener("click", saveRecipeEditorHeader);
      document.getElementById("editor-activate").addEventListener("click", activateRecipeEditor);
      document.getElementById("editor-add-line").addEventListener("click", addRecipeEditorLine);
      document.getElementById("editor-lines").addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action='delete-line']");

        if (button) {
          deleteRecipeEditorLine(button.dataset.id);
        }
      });
      root.scrollTop = 0;
    }

    function closeRecipeEditor() {
      state.selectedRecipeDetail = null;
      renderRecipeEditor();
    }

    function syncEditorLineKind() {
      const kind = document.getElementById("editor-line-kind").value;
      const productLabel = document.getElementById("editor-line-product-label");
      const recipeLabelEl = document.getElementById("editor-line-recipe-label");
      productLabel.style.display = kind === "product" ? "grid" : "none";
      recipeLabelEl.style.display = kind === "recipe" ? "grid" : "none";

      if (kind === "recipe") {
        const recipe = recipeByVersionId(document.getElementById("editor-line-recipe").value);
        if (recipe) {
          document.getElementById("editor-line-unit").value = recipe.yieldUnitId;
          document.getElementById("editor-line-waste").value = 0;
        }
        return;
      }

      const product = productById(document.getElementById("editor-line-product").value);
      if (product) {
        document.getElementById("editor-line-unit").value = product.baseUnitId;
        document.getElementById("editor-line-waste").value = productWastePercent(product);
      }
    }

    function renderRecipeEditorLines(detail) {
      const root = document.getElementById("editor-lines");
      root.replaceChildren();

      if (detail.lines.length === 0) {
        const empty = document.createElement("div");
        empty.className = "notice";
        empty.textContent = "Состав пока пустой. Добавьте продукты ниже.";
        root.appendChild(empty);
        return;
      }

      const rows = detail.lines.map(function (line) {
        const action = document.createElement("td");
        const button = document.createElement("button");
        button.className = "danger";
        button.type = "button";
        button.textContent = "Удалить";
        button.dataset.action = "delete-line";
        button.dataset.id = line.recipeLineId;
        action.appendChild(button);
        const title = line.lineKind === "recipe"
          ? "↳ " + line.productName + (line.childRecipeVersionCode ? " / " + line.childRecipeVersionCode : "")
          : line.productName;
        const displayTitle = title + (line.fulfillmentMode === "delivery_packaging" ? " · доставка" : "");
        return [
          displayTitle,
          qty.format(Number(line.quantity)) + " " + unitCodeLabel(line.unitCode),
          line.quantityMode === "prepared_output" ? "после обработки" : "со склада",
          money.format(Number(line.extraWastePercent)) + "%",
          line.costStatus === "ok" ? "ok" : line.costStatus,
          moneyOrDash(line.lineCost, line.currency || detail.currency),
          action
        ];
      });
      root.appendChild(table(["Состав", "Кол-во", "Режим", "Потери", "Статус", "Стоимость", ""], rows));
    }

    async function openRecipeEditor(recipeVersionId) {
      if (!recipeVersionId) {
        setNotice("Выберите техкарту.", true);
        return;
      }

      setBusy(true);

      try {
        const org = encodeURIComponent(state.summary.organization.id);
        const location = encodeURIComponent(currentLocationId());
        const detail = await fetchJson("/v1/recipes/" + encodeURIComponent(recipeVersionId) + "?organizationId=" + org + "&locationId=" + location);
        state.selectedRecipeDetail = detail.data;
        renderRecipeEditor();
      } catch (error) {
        setNotice(error.message, true);
      } finally {
        setBusy(false);
      }
    }

    async function reloadRecipeEditor() {
      if (!state.selectedRecipeDetail) {
        return;
      }

      await openRecipeEditor(state.selectedRecipeDetail.recipeVersionId);
    }

    async function saveRecipeEditorHeader() {
      const detail = state.selectedRecipeDetail;

      if (!detail) {
        return;
      }

      setBusy(true);

      try {
        await fetchJson("/v1/recipes/" + encodeURIComponent(detail.recipeVersionId), {
          method: "PATCH",
          headers: authHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({
            organizationId: state.summary.organization.id,
            yieldQuantity: Number(document.getElementById("editor-yield").value),
            yieldUnitId: document.getElementById("editor-yield-unit").value,
            menuPrice: optionalNumber(document.getElementById("editor-price").value),
            targetFoodCostPercent: optionalNumber(document.getElementById("editor-target-food-cost").value),
            currency: detail.currency || state.summary.organization.defaultCurrency,
            instructions: document.getElementById("editor-instructions").value
          })
        });
        await reloadRecipeEditor();
        await refreshRecipes();
        document.getElementById("editor-message").textContent = "Шапка техкарты сохранена.";
      } catch (error) {
        document.getElementById("editor-message").textContent = error.message;
        document.getElementById("editor-message").className = "notice error";
      } finally {
        setBusy(false);
      }
    }

    async function activateRecipeEditor() {
      const detail = state.selectedRecipeDetail;

      if (!detail) {
        return;
      }

      setBusy(true);

      try {
        await fetchJson("/v1/recipes/" + encodeURIComponent(detail.recipeVersionId), {
          method: "PATCH",
          headers: authHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({
            organizationId: state.summary.organization.id,
            status: "active"
          })
        });
        await reloadRecipeEditor();
        await refreshRecipes();
        await refreshKmrs();
        document.getElementById("editor-message").textContent = "Техкарта активирована.";
      } catch (error) {
        document.getElementById("editor-message").textContent = error.message;
        document.getElementById("editor-message").className = "notice error";
      } finally {
        setBusy(false);
      }
    }

    async function addRecipeEditorLine() {
      const detail = state.selectedRecipeDetail;

      if (!detail) {
        return;
      }

      setBusy(true);

      try {
        const kind = document.getElementById("editor-line-kind").value;
        const linePayload = {
          organizationId: state.summary.organization.id,
          quantity: Number(document.getElementById("editor-line-quantity").value),
          unitId: document.getElementById("editor-line-unit").value,
          quantityMode: document.getElementById("editor-line-mode").value,
          extraWastePercent: optionalNumber(document.getElementById("editor-line-waste").value) || 0
        };
        if (kind === "recipe") {
          linePayload.childRecipeVersionId = document.getElementById("editor-line-recipe").value;
        } else {
          linePayload.ingredientProductId = document.getElementById("editor-line-product").value;
        }
        await fetchJson("/v1/recipes/" + encodeURIComponent(detail.recipeVersionId) + "/lines", {
          method: "POST",
          headers: authHeaders({ "content-type": "application/json" }),
          body: JSON.stringify(linePayload)
        });
        await reloadRecipeEditor();
        document.getElementById("editor-message").textContent = "Строка состава добавлена.";
      } catch (error) {
        document.getElementById("editor-message").textContent = error.message;
        document.getElementById("editor-message").className = "notice error";
      } finally {
        setBusy(false);
      }
    }

    async function deleteRecipeEditorLine(recipeLineId) {
      const detail = state.selectedRecipeDetail;

      if (!detail) {
        return;
      }

      setBusy(true);

      try {
        const org = encodeURIComponent(state.summary.organization.id);
        await fetchJson("/v1/recipes/" + encodeURIComponent(detail.recipeVersionId) + "/lines/" + encodeURIComponent(recipeLineId) + "?organizationId=" + org, {
          method: "DELETE",
          headers: authHeaders()
        });
        await reloadRecipeEditor();
        document.getElementById("editor-message").textContent = "Строка состава удалена.";
      } catch (error) {
        document.getElementById("editor-message").textContent = error.message;
        document.getElementById("editor-message").className = "notice error";
      } finally {
        setBusy(false);
      }
    }

    function optionalNumber(value) {
      const trimmed = text(value).trim();
      return trimmed ? Number(trimmed) : undefined;
    }

    function setProductMessage(message, isError) {
      const el = document.getElementById("product-message");
      el.textContent = message;
      el.className = isError ? "notice error" : "notice";
    }

    function setCategoryMessage(message, isError) {
      const el = document.getElementById("category-message");
      el.textContent = message;
      el.className = isError ? "notice error" : "notice";
    }

    function setRecipeMessage(message, isError) {
      const el = document.getElementById("recipe-message");
      el.textContent = message;
      el.className = isError ? "notice error" : "notice";
    }

    function syncRecipeEditorProductOptions(preferredProductId) {
      const productSelect = document.getElementById("editor-line-product");
      const unitSelect = document.getElementById("editor-line-unit");

      if (!productSelect || !unitSelect) {
        return;
      }

      fillSelect(productSelect, state.products, function (product) {
        return product.name;
      });
      const preferred = productById(preferredProductId) || state.products[0] || null;

      if (!preferred) {
        return;
      }

      productSelect.value = preferred.id;
      unitSelect.value = preferred.baseUnitId;
      document.getElementById("editor-line-waste").value = productWastePercent(preferred);
    }

    async function refreshProducts() {
      const org = encodeURIComponent(state.summary.organization.id);
      const result = await fetchJson("/v1/products?organizationId=" + org + "&limit=500");
      state.products = result.data;
      renderProducts();
      renderRecipeCreateControls();
      syncRecipeEditorProductOptions(document.getElementById("editor-line-product")?.value);
    }

    async function createProductFromForm() {
      const nameInput = document.getElementById("product-name");
      const name = nameInput.value.trim();

      if (!name) {
        setProductMessage("Введите название продукта.", true);
        nameInput.focus();
        return;
      }

      setBusy(true);

      try {
        const payload = {
          organizationId: state.summary.organization.id,
          name: name,
          baseUnitId: document.getElementById("product-unit").value,
          categoryId: document.getElementById("product-category").value || undefined,
          productType: document.getElementById("product-type").value,
          inventoryPolicy: document.getElementById("product-policy").value,
          defaultWastePercent: optionalNumber(document.getElementById("product-waste").value) || 0
        };
        const response = await fetchJson("/v1/products", {
          method: "POST",
          headers: authHeaders({ "content-type": "application/json" }),
          body: JSON.stringify(payload)
        });
        await refreshProducts();
        syncRecipeEditorProductOptions(response.data.id);
        nameInput.value = "";
        document.getElementById("product-waste").value = "0";
        setProductMessage("Продукт добавлен: " + response.data.name + ".", false);
      } catch (error) {
        setProductMessage(error.message, true);
      } finally {
        setBusy(false);
      }
    }

    async function createCategoryFromForm() {
      const nameInput = document.getElementById("category-name");
      const name = nameInput.value.trim();

      if (!name) {
        setCategoryMessage("Введите название категории.", true);
        nameInput.focus();
        return;
      }

      setBusy(true);

      try {
        const response = await fetchJson("/v1/product-categories", {
          method: "POST",
          headers: authHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({
            organizationId: state.summary.organization.id,
            name: name,
            parentId: document.getElementById("category-parent").value || undefined
          })
        });
        state.categories.push(response.data);
        renderProductControls();
        renderProducts();
        document.getElementById("product-category").value = response.data.id;
        nameInput.value = "";
        setCategoryMessage("Категория создана: " + categoryPath(response.data.id) + ".", false);
      } catch (error) {
        setCategoryMessage(error.message, true);
      } finally {
        setBusy(false);
      }
    }

    async function createRecipeFromForm() {
      const nameInput = document.getElementById("new-recipe-name");
      const name = nameInput.value.trim();

      if (!name) {
        setRecipeMessage("Введите название техкарты.", true);
        nameInput.focus();
        return;
      }

      setBusy(true);

      try {
        const response = await fetchJson("/v1/recipes", {
          method: "POST",
          headers: authHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({
            organizationId: state.summary.organization.id,
            name: name,
            recipeType: document.getElementById("new-recipe-type").value,
            outputProductId: document.getElementById("new-recipe-output-product").value || undefined,
            yieldQuantity: Number(document.getElementById("new-recipe-yield").value),
            yieldUnitId: document.getElementById("new-recipe-yield-unit").value,
            menuPrice: optionalNumber(document.getElementById("new-recipe-price").value),
            targetFoodCostPercent: optionalNumber(document.getElementById("new-recipe-target").value),
            currency: state.summary.organization.defaultCurrency
          })
        });
        await refreshRecipes();
        renderKmrsMenu();
        nameInput.value = "";
        document.getElementById("new-recipe-price").value = "";
        setRecipeMessage("Техкарта создана: " + response.data.recipeName + " / " + response.data.versionCode + ".", false);
        await openRecipeEditor(response.data.recipeVersionId);
      } catch (error) {
        setRecipeMessage(error.message, true);
      } finally {
        setBusy(false);
      }
    }

    async function refreshKmrs() {
      setBusy(true);
      setNotice("Обновляю KMRS данные...", false);

      try {
        const org = encodeURIComponent(state.summary.organization.id);
        const location = encodeURIComponent(currentLocationId());
        const headers = authHeaders();
        const connections = await fetchJson("/v1/kmrs/connections?organizationId=" + org + "&locationId=" + location, { headers: headers });
        state.connections = connections.data;
        applyKmrsConnectionScope(currentKmrsConnection());
        const connection = currentKmrsConnection();
        const connectionQuery = connection ? "&kmrsConnectionId=" + encodeURIComponent(connection.id) : "";
        const menu = await fetchJson("/v1/kmrs/menu-items?organizationId=" + org + "&locationId=" + location + connectionQuery + "&limit=500", { headers: headers });
        state.kmrsItems = menu.data;
        setKmrsBadge(state.kmrsItems.length + " блюд", "ok");
        setNotice("Загружено " + state.kmrsItems.length + " блюд KMRS.", false);
        renderKmrsMenu();
      } catch (error) {
        setKmrsBadge("Ошибка", "bad");
        setNotice(error.message, true);
      } finally {
        setBusy(false);
      }
    }

    async function refreshRecipes() {
      const org = encodeURIComponent(state.summary.organization.id);
      const result = await fetchJson("/v1/recipes?organizationId=" + org + "&limit=500");
      state.recipes = result.data;
      renderRecipesList();
    }

    async function importMenu() {
      setBusy(true);
      setNotice("Импортирую меню из KMRS...", false);

      try {
        const slug = document.getElementById("kmrs-slug").value.trim();
        const baseUrl = normalizeKmrsBaseUrl(document.getElementById("kmrs-base-url").value);
        document.getElementById("kmrs-base-url").value = baseUrl;
        state.restaurantSlug = slug;
        state.kmrsBaseUrl = baseUrl;
        localStorage.setItem("tagamAccountingRestaurantSlug", slug);
        localStorage.setItem("tagamAccountingKmrsBaseUrl", baseUrl);
        const response = await fetchJson("/v1/kmrs/import/menu-from-kmrs", {
          method: "POST",
          headers: authHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({
            organizationId: state.summary.organization.id,
            locationId: currentLocationId(),
            baseUrl: baseUrl,
            restaurantSlug: slug,
            currencyCode: state.summary.organization.defaultCurrency
          })
        });
        await refreshRecipes();
        setNotice("Импортировано " + response.data.importedCount + " позиций, черновиков техкарт создано " + response.data.recipeDraftsCreated + ".", false);
        await refreshKmrs();
      } catch (error) {
        setKmrsBadge("Ошибка", "bad");
        setNotice(error.message, true);
      } finally {
        setBusy(false);
      }
    }

    async function linkMenuItem(button) {
      const row = button.closest("tr");
      const recipeVersionId = row.querySelector("select").value;

      if (!recipeVersionId) {
        setNotice("Выберите техкарту для связи.", true);
        return;
      }

      setBusy(true);

      try {
        await fetchJson("/v1/kmrs/menu-items/" + encodeURIComponent(button.dataset.id) + "/link", {
          method: "PUT",
          headers: authHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({
            organizationId: state.summary.organization.id,
            recipeVersionId: recipeVersionId
          })
        });
        setNotice("Связь с техкартой сохранена.", false);
        await refreshKmrs();
      } catch (error) {
        setNotice(error.message, true);
      } finally {
        setBusy(false);
      }
    }

    async function unlinkMenuItem(button) {
      setBusy(true);

      try {
        const org = encodeURIComponent(state.summary.organization.id);
        await fetchJson("/v1/kmrs/menu-items/" + encodeURIComponent(button.dataset.id) + "/link?organizationId=" + org, {
          method: "DELETE",
          headers: authHeaders()
        });
        setNotice("Связь снята.", false);
        await refreshKmrs();
      } catch (error) {
        setNotice(error.message, true);
      } finally {
        setBusy(false);
      }
    }

    async function linkAllSuggestedMenuItems() {
      setBusy(true);

      try {
        await refreshRecipes();
        const connection = currentKmrsConnection();

        if (!connection) {
          setNotice("Сначала загрузите подключение KMRS.", true);
          return;
        }

        setNotice("Связываю техкарты по совпадению названий...", false);
        const response = await fetchJson("/v1/kmrs/menu-items/link-suggested", {
          method: "POST",
          headers: authHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({
            organizationId: state.summary.organization.id,
            locationId: currentLocationId(),
            kmrsConnectionId: connection.id
          })
        });
        await refreshKmrs();
        const data = response.data;
        setNotice(
          "Связано " + data.linkedCount +
          ", уже было связано " + data.alreadyLinkedCount +
          ", без совпадающей техкарты " + data.skippedWithoutRecipeCount + ".",
          false
        );
      } catch (error) {
        setNotice(error.message, true);
      } finally {
        setBusy(false);
      }
    }

    function wireEvents() {
      const syncLocation = function (locationId) {
        state.selectedLocationId = locationId;
        localStorage.setItem("tagamAccountingLocationId", state.selectedLocationId);
        document.getElementById("global-location").value = state.selectedLocationId;
        document.getElementById("kmrs-location").value = state.selectedLocationId;
        refreshKmrs();
        refreshPurchasing().catch(function (error) {
          setReceiptMessage(error.message, true);
        });
      };

      document.getElementById("module-nav").addEventListener("click", function (event) {
        const button = event.target.closest("button[data-module]");

        if (button) {
          switchModule(button.dataset.module);
        }
      });
      document.getElementById("close-recipe-editor").addEventListener("click", closeRecipeEditor);
      document.getElementById("recipe-editor-backdrop").addEventListener("click", closeRecipeEditor);
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !document.getElementById("recipe-editor-shell").hidden) {
          closeRecipeEditor();
        }
      });
      document.getElementById("save-key").addEventListener("click", function () {
        state.restaurantSlug = document.getElementById("kmrs-slug").value.trim();
        state.kmrsBaseUrl = normalizeKmrsBaseUrl(document.getElementById("kmrs-base-url").value);
        document.getElementById("kmrs-base-url").value = state.kmrsBaseUrl;
        state.selectedLocationId = currentLocationId();
        localStorage.setItem("tagamAccountingRestaurantSlug", state.restaurantSlug);
        localStorage.setItem("tagamAccountingKmrsBaseUrl", state.kmrsBaseUrl);
        localStorage.setItem("tagamAccountingLocationId", state.selectedLocationId);
        setNotice("Настройки сохранены в браузере.", false);
        refreshKmrs();
      });
      document.getElementById("logout").addEventListener("click", async function () {
        await fetch("/logout", { method: "POST" }).catch(function () {});
        window.location.href = "/login";
      });
      document.getElementById("import-menu").addEventListener("click", importMenu);
      document.getElementById("refresh-kmrs").addEventListener("click", refreshKmrs);
      document.getElementById("link-all-kmrs").addEventListener("click", linkAllSuggestedMenuItems);
      document.getElementById("menu-search").addEventListener("input", renderKmrsMenu);
      document.getElementById("new-recipe-type").addEventListener("change", syncNewRecipeYieldUnit);
      document.getElementById("add-recipe").addEventListener("click", createRecipeFromForm);
      document.getElementById("refresh-recipes").addEventListener("click", async function () {
        setBusy(true);

        try {
          await refreshRecipes();
          renderKmrsMenu();
          setRecipeMessage("Список техкарт обновлен.", false);
        } catch (error) {
          setRecipeMessage(error.message, true);
        } finally {
          setBusy(false);
        }
      });
      document.getElementById("recipe-search").addEventListener("input", renderRecipesList);
      document.getElementById("recipes-list").addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action='open-recipe']");

        if (button) {
          openRecipeEditor(button.dataset.id);
        }
      });
      document.getElementById("add-category").addEventListener("click", createCategoryFromForm);
      document.getElementById("add-product").addEventListener("click", createProductFromForm);
      document.getElementById("add-supplier").addEventListener("click", createSupplierFromForm);
      document.getElementById("receipt-product").addEventListener("change", syncReceiptProductUnit);
      document.getElementById("add-receipt-line").addEventListener("click", addReceiptLineFromForm);
      document.getElementById("save-receipt").addEventListener("click", saveReceiptFromForm);
      document.getElementById("clear-receipt").addEventListener("click", clearReceiptDraft);
      document.getElementById("receipt-draft").addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action='remove-receipt-line']");

        if (!button) {
          return;
        }

        state.purchaseDraftLines.splice(Number(button.dataset.index), 1);
        renderReceiptDraft();
        setReceiptMessage("Строка удалена из черновика.", false);
      });
      document.getElementById("refresh-products").addEventListener("click", async function () {
        setBusy(true);

        try {
          await refreshProducts();
          setProductMessage("Справочник продуктов обновлен.", false);
        } catch (error) {
          setProductMessage(error.message, true);
        } finally {
          setBusy(false);
        }
      });
      document.getElementById("product-search").addEventListener("input", renderProducts);
      document.getElementById("global-location").addEventListener("change", function () {
        syncLocation(document.getElementById("global-location").value);
      });
      document.getElementById("kmrs-location").addEventListener("change", function () {
        syncLocation(document.getElementById("kmrs-location").value);
      });
      document.getElementById("kmrs-menu").addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action]");

        if (!button) {
          return;
        }

        if (button.dataset.action === "link") {
          linkMenuItem(button);
        } else if (button.dataset.action === "edit") {
          const recipeVersionId = button.closest("tr").querySelector("select").value;
          openRecipeEditor(recipeVersionId);
        } else if (button.dataset.action === "unlink") {
          unlinkMenuItem(button);
        }
      });
    }

    async function boot() {
      const status = document.getElementById("status");
      try {
        const demo = await fetchJson("/v1/demo");
        const summary = demo.data;
        state.summary = summary;
        document.getElementById("subtitle").textContent = summary.organization.name + " / " + summary.primaryLocation.name;
        renderMetrics(summary);
        renderLinks(summary);

        const org = encodeURIComponent(summary.organization.id);
        const recipeId = encodeURIComponent(summary.activeRecipeVersionId);
        const location = encodeURIComponent(state.selectedLocationId || summary.primaryLocation.id);
        const writeoffBody = {
          organizationId: summary.organization.id,
          locationId: summary.primaryLocation.id,
          kmrsOrderId: "demo-preview-order",
          fulfillmentType: "delivery",
          lines: [
            {
              kmrsItemId: "demo-classic-burger",
              quantity: 2,
              salePrice: 45,
              currency: summary.organization.defaultCurrency,
              fulfillmentType: "delivery"
            }
          ]
        };
        const result = await Promise.all([
          fetchJson("/v1/catalog?organizationId=" + org),
          fetchJson("/v1/products?organizationId=" + org + "&limit=500"),
          fetchJson("/v1/recipes?organizationId=" + org + "&limit=500"),
          fetchJson("/v1/recipes/" + recipeId + "?organizationId=" + org),
          fetchJson("/v1/inventory/summary?organizationId=" + org),
          fetchJson("/v1/purchasing/overview?organizationId=" + org + "&locationId=" + location + "&limit=100"),
          fetchJson("/v1/kmrs/orders/preview-writeoff", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(writeoffBody)
          })
        ]);
        state.locations = result[0].data.locations;
        state.units = result[0].data.units;
        state.categories = result[0].data.categories;
        state.products = result[1].data;
        state.recipes = result[2].data;
        state.purchasing = result[5].data;
        renderRecipe(result[3].data);
        renderInventory(result[4].data, summary.organization.defaultCurrency);
        renderWriteoff(result[6].data);
        renderProductControls();
        renderProducts();
        renderRecipeCreateControls();
        renderRecipesList();
        renderPurchaseControls();
        renderReceiptDraft();
        renderPurchasing();
        renderKmrsControls();
        wireEvents();
        switchModule(state.activeModule);
        renderKmrsMenu();
        status.textContent = "Online";
        refreshKmrs();
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
