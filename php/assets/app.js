const TOKEN_KEY = 'banco-cacao-php-token';
const app = document.getElementById('app');

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data.error === 'string' ? data.error : 'Error de red';
    throw new Error(msg);
  }
  return data;
}

function el(html) {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

async function showLogin() {
  app.innerHTML = '';
  const box = el(`
    <div class="login-box card">
      <div style="text-align:center">
        <div style="font-size:3rem">🍫</div>
        <h1 style="margin:0.4rem 0">Banco Cacao</h1>
        <p class="muted">PHP · Hostinger · depósitos MXN → cacao → canje</p>
      </div>
      <div class="tabs">
        <button type="button" class="active" data-mode="login">Entrar</button>
        <button type="button" data-mode="register">Registrarse</button>
      </div>
      <form id="auth-form">
        <div id="name-field" style="display:none">
          <label>Nombre<input name="name" autocomplete="name" /></label>
        </div>
        <label>Correo<input name="email" type="email" value="cliente@bancocacao.local" required /></label>
        <label>Contraseña<input name="password" type="password" value="cacao123" required /></label>
        <div id="role-field" style="display:none">
          <label>Rol
            <select name="role">
              <option value="CLIENT">Cliente</option>
              <option value="SELLER">Vendedor</option>
            </select>
          </label>
        </div>
        <div id="auth-msg"></div>
        <button type="submit">Iniciar sesión</button>
      </form>
    </div>
  `);
  app.appendChild(box);

  let mode = 'login';
  box.querySelectorAll('.tabs button').forEach((b) => {
    b.addEventListener('click', () => {
      mode = b.dataset.mode;
      box.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
      box.querySelector('#name-field').style.display = mode === 'register' ? 'block' : 'none';
      box.querySelector('#role-field').style.display = mode === 'register' ? 'block' : 'none';
      box.querySelector('button[type=submit]').textContent =
        mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta';
    });
  });

  box.querySelector('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const msg = box.querySelector('#auth-msg');
    msg.innerHTML = '';
    try {
      const body = {
        email: fd.get('email'),
        password: fd.get('password'),
      };
      if (mode === 'register') {
        body.name = fd.get('name');
        body.role = fd.get('role');
      }
      const data = await api(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setToken(data.token);
      await showDashboard();
    } catch (err) {
      msg.innerHTML = `<div class="msg err">${err.message}</div>`;
    }
  });
}

async function showDashboard() {
  app.innerHTML = '<div class="wrap muted">Cargando…</div>';
  try {
    const me = await api('/api/auth/me');
    const [balance, products, ledger] = await Promise.all([
      api('/api/wallet/balance'),
      api('/api/products'),
      api('/api/wallet/ledger'),
    ]);
    renderDashboard(me.user, balance, products.products, ledger.entries);
  } catch (err) {
    setToken(null);
    await showLogin();
  }
}

function renderDashboard(user, balance, products, entries) {
  app.innerHTML = '';
  const root = el(`
    <div class="wrap">
      <div class="row" style="margin-bottom:1.25rem">
        <div>
          <div class="muted" style="letter-spacing:.15em;text-transform:uppercase;font-size:.75rem;color:#d97706">Banco Cacao PHP</div>
          <h1 style="margin:.25rem 0">Hola, ${escapeHtml(user.name)}</h1>
          <div class="muted">${escapeHtml(user.email)} · ${escapeHtml(user.role)}</div>
        </div>
        <button type="button" class="ghost" id="logout" style="width:auto">Cerrar sesión</button>
      </div>
      <div id="flash"></div>
      <div class="grid grid-2" style="margin-bottom:1rem">
        <section class="card balance" aria-label="Saldo de cacao">
          <div class="muted">Saldo disponible</div>
          <h2>🍫 <span id="bal">${Number(balance.cacaoBalance).toLocaleString('es-MX')}</span> <span style="font-size:1rem;font-weight:600;color:#fde68a">cacao</span></h2>
          <div class="muted">Tasa: 1 MXN = ${balance.cacaoPerMxn} cacao</div>
        </section>
        <section class="card">
          <div class="muted">Acciones</div>
          <ol class="muted" style="margin:.5rem 0 0 1rem;line-height:1.6">
            <li>Depositar MXN → cacao</li>
            <li>Transferir cacao</li>
            <li>Canjear productos</li>
          </ol>
        </section>
      </div>
      <div class="grid grid-2">
        <form class="card" id="deposit-form">
          <h3 style="margin-top:0">Depositar (simulado)</h3>
          <label>Monto MXN<input name="amountMxn" type="number" min="1" value="50" required /></label>
          <button type="submit">Convertir a cacao</button>
        </form>
        <form class="card" id="transfer-form">
          <h3 style="margin-top:0">Transferir cacao</h3>
          <label>Correo destino<input name="toEmail" type="email" value="vendedor@bancocacao.local" required /></label>
          <label>Cantidad cacao<input name="amountCacao" type="number" min="1" value="10" required /></label>
          <button type="submit" class="ghost">Enviar</button>
        </form>
      </div>
      <section style="margin-top:1.5rem" aria-label="Catálogo de canje">
        <h2>Catálogo canjeable</h2>
        <div class="grid grid-3" id="catalog"></div>
      </section>
      <section style="margin-top:1.5rem" aria-label="Historial">
        <h2>Movimientos</h2>
        <div class="card" style="padding:0;overflow:auto">
          <table>
            <thead><tr><th>Tipo</th><th>Cacao</th><th>Detalle</th><th>Fecha</th></tr></thead>
            <tbody id="ledger-body"></tbody>
          </table>
        </div>
      </section>
    </div>
  `);
  app.appendChild(root);

  const catalog = root.querySelector('#catalog');
  products.forEach((p) => {
    const card = el(`
      <article class="card">
        <div class="row">
          <strong>${escapeHtml(p.name)}</strong>
          <span class="badge">🍫 ${p.cacaoPrice}</span>
        </div>
        <p class="muted">${escapeHtml(p.description)}</p>
        <div class="muted">Stock: ${p.stock}${p.seller ? ' · ' + escapeHtml(p.seller.name) : ''}</div>
        <button type="button" data-id="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>Canjear</button>
      </article>
    `);
    card.querySelector('button').addEventListener('click', async () => {
      try {
        const data = await api('/api/products/redeem', {
          method: 'POST',
          body: JSON.stringify({ productId: p.id, quantity: 1 }),
        });
        flash(`Canje exitoso · −${data.redemption.cacaoPaid} cacao`, true);
        await showDashboard();
      } catch (err) {
        flash(err.message, false);
      }
    });
    catalog.appendChild(card);
  });
  if (!products.length) {
    catalog.innerHTML = '<div class="card muted">No hay productos.</div>';
  }

  const tbody = root.querySelector('#ledger-body');
  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="muted" style="text-align:center">Sin movimientos</td></tr>';
  } else {
    entries.forEach((e) => {
      tbody.appendChild(
        el(`<tr>
          <td><code>${escapeHtml(e.type)}</code></td>
          <td>${e.amountCacao}</td>
          <td>${escapeHtml(e.note || '')}</td>
          <td class="muted">${new Date(e.createdAt).toLocaleString('es-MX')}</td>
        </tr>`),
      );
    });
  }

  root.querySelector('#logout').onclick = () => {
    setToken(null);
    showLogin();
  };

  root.querySelector('#deposit-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await api('/api/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({ amountMxn: Number(fd.get('amountMxn')) }),
      });
      flash(`+${data.cacaoCredited} cacao acreditados`, true);
      await showDashboard();
    } catch (err) {
      flash(err.message, false);
    }
  };

  root.querySelector('#transfer-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await api('/api/wallet/transfer', {
        method: 'POST',
        body: JSON.stringify({
          toEmail: fd.get('toEmail'),
          amountCacao: Number(fd.get('amountCacao')),
        }),
      });
      flash(`Transferiste ${data.sent} cacao`, true);
      await showDashboard();
    } catch (err) {
      flash(err.message, false);
    }
  };
}

function flash(text, ok) {
  const n = document.getElementById('flash');
  if (n) n.innerHTML = `<div class="msg ${ok ? 'ok' : 'err'}" role="status">${escapeHtml(text)}</div>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

(async function boot() {
  if (getToken()) await showDashboard();
  else await showLogin();
})();
