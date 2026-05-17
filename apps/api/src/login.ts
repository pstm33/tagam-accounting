export function renderLogin(): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Вход - TAGAM Accounting</title>
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
      --red: #b91c1c;
      --red-soft: #fff1f2;
      --shadow: 0 1px 2px rgba(24, 32, 51, .05);
    }

    * {
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    main {
      width: min(420px, calc(100vw - 32px));
    }

    h1 {
      margin: 0;
      font-size: 28px;
      line-height: 1.15;
    }

    p {
      margin: 8px 0 0;
      color: var(--muted);
      line-height: 1.45;
    }

    form {
      display: grid;
      gap: 14px;
      margin-top: 22px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: var(--shadow);
    }

    label {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
    }

    input,
    button {
      min-height: 40px;
      border: 1px solid var(--line-strong);
      border-radius: 8px;
      font: inherit;
    }

    input {
      width: 100%;
      padding: 8px 10px;
      background: #fff;
      color: var(--ink);
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-color: var(--teal);
      background: var(--teal);
      color: #fff;
      font-weight: 800;
      cursor: pointer;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: .6;
    }

    .error {
      display: none;
      min-height: 36px;
      align-items: center;
      padding: 8px 10px;
      border: 1px solid #fecdd3;
      border-radius: 8px;
      background: var(--red-soft);
      color: var(--red);
      font-size: 14px;
    }

    .error.visible {
      display: flex;
    }
  </style>
</head>
<body>
  <main>
    <h1>TAGAM Accounting</h1>
    <p>Вход в модуль склада, техкарт и KMRS меню.</p>

    <form id="login-form">
      <label>Логин
        <input id="username" name="username" autocomplete="username" autofocus>
      </label>

      <label>Пароль
        <input id="password" name="password" type="password" autocomplete="current-password">
      </label>

      <div id="error" class="error">Неверный логин или пароль.</div>
      <button id="submit" type="submit">Войти</button>
    </form>
  </main>

  <script>
    const form = document.getElementById("login-form");
    const error = document.getElementById("error");
    const submit = document.getElementById("submit");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      error.className = "error";
      submit.disabled = true;

      try {
        const response = await fetch("/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            username: document.getElementById("username").value,
            password: document.getElementById("password").value
          })
        });

        if (!response.ok) {
          throw new Error("login failed");
        }

        window.location.href = "/";
      } catch (_error) {
        error.className = "error visible";
      } finally {
        submit.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
