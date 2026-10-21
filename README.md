# Banco Cacao 🍫

Wallet **multiusuario** en **TypeScript** (Express + React) donde:

1. Los **depósitos en MXN** (simulados) se convierten en **símbolos cacao**
2. El cacao se **transfiere** entre usuarios
3. El cacao se **canjea** por productos del catálogo

> Producto **original**. No es un clon de Mercado Pago.  
> La investigación REA de la superficie pública de MP está en [`docs/rea/findings.md`](docs/rea/findings.md).

## Stack (un solo lenguaje: TypeScript)

| Capa | Tecnología |
|------|------------|
| API | Node.js, Express, Zod, JWT, bcrypt |
| DB | Prisma + Neon PostgreSQL (`@prisma/adapter-pg` + `pg`) |
| UI | React (Vite), Tailwind CSS v4, React Router |
| Auth | JWT Bearer (`Authorization: Bearer <token>`), roles `ADMIN` / `SELLER` / `CLIENT` |
| Tests | Node test runner (API e2e) + Playwright (UI e2e) |

## Arquitectura del sistema

```text
┌─────────────────────────────┐
│  client/  (React + Vite)    │
│  Dashboard · Login          │
│  CacaoBalanceCard           │
│  ProductCatalog             │
└──────────────┬──────────────┘
               │ HTTP /api/*  (proxy Vite → :4000)
               ▼
┌─────────────────────────────┐
│  server/  (Express)         │
│  createApp()                │
│  ┌─────────┐ ┌───────────┐  │
│  │ /auth   │ │ /wallet   │  │
│  │ /products│ │ JWT mw   │  │
│  └────┬────┘ └─────┬─────┘  │
│       └──────┬─────┘        │
│              ▼              │
│     Prisma Client           │
│     + adapter-pg + Pool     │
└──────────────┬──────────────┘
               │ SQL (TLS)
               ▼
┌─────────────────────────────┐
│  Neon PostgreSQL            │
│  User · Product             │
│  LedgerEntry · Redemption   │
└─────────────────────────────┘
```

### Monorepo

```text
Banco-cacao-/
├── client/                 # SPA React
│   └── src/
│       ├── components/     # CacaoBalanceCard, ProductCatalog
│       ├── pages/          # LoginPage, DashboardPage
│       └── lib/            # api.ts, auth.tsx
├── server/
│   ├── prisma/             # schema.prisma, seed.ts
│   ├── src/
│   │   ├── app.ts          # factory Express (tests + runtime)
│   │   ├── index.ts        # listen(PORT)
│   │   ├── middleware/     # JWT requireAuth / requireRoles
│   │   └── routes/         # auth, wallet, products
│   └── tests/e2e/          # depósito + canje API
├── e2e/                    # Playwright UI
├── docs/rea/               # hallazgos REA
└── playwright.config.ts
```

### Capas y responsabilidades

| Capa | Responsabilidad |
|------|-----------------|
| **UI** | Auth de sesión (token en `localStorage`), saldo, depósito simulado, transferencias, catálogo y canje |
| **API** | Validación Zod, autorización JWT/roles, reglas de negocio y transacciones Prisma |
| **Dominio cacao** | `cacaoBalance` en `User`; movimientos append-only en `LedgerEntry`; canjes en `Redemption` |
| **Datos** | Neon PostgreSQL; pool SSL vía `pg` (el schema engine nativo de Prisma puede fallar con `P1001` en algunos hosts) |

### Flujo de valor

```text
MXN (depósito mock)  ×  CACAO_PER_MXN (default 10)
        ↓
   saldo cacao 🍫  (User.cacaoBalance)
        ↓
  transferencias P2P  /  canje de productos
        ↓
   LedgerEntry (DEPOSIT | TRANSFER_* | REDEEM | ADJUST)
   + Redemption (si canje)
```

### Modelo de datos (resumen)

| Entidad | Campos clave |
|---------|----------------|
| **User** | `email`, `passwordHash`, `role`, `cacaoBalance` |
| **Product** | `name`, `cacaoPrice`, `stock`, `active`, `sellerId?` |
| **LedgerEntry** | `type`, `amountCacao`, `amountMxn?`, `fromUserId?`, `toUserId?`, `meta?` |
| **Redemption** | `userId`, `productId`, `cacaoPaid`, `quantity`, `ledgerId` |

### Seguridad

- Contraseñas con **bcrypt** (cost 10).
- JWT firmado con `JWT_SECRET`, expira en **7 días**.
- Rutas de wallet y canje requieren `Authorization: Bearer <token>`.
- Alta de productos limitada a `ADMIN` y `SELLER`.
- CORS restringido a `CLIENT_ORIGIN`.
- Depósitos son **simulados** (sin pasarela de pago real).

### Variables de entorno

| Variable | Default | Uso |
|----------|---------|-----|
| `DATABASE_URL` | — | Neon pooler `postgresql://…?sslmode=require` |
| `JWT_SECRET` | dev fallback | Firma de tokens |
| `PORT` | `4000` | Puerto API |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS |
| `CACAO_PER_MXN` | `10` | Tasa MXN → cacao |
| `VITE_API_PROXY` | `http://localhost:4000` | Proxy dev del cliente |

## Inicio rápido

```bash
cp .env.example .env
npm run setup
npm run dev
```

- UI: http://localhost:5173  
- API: http://localhost:4000/api/health  

### Usuarios demo

| Correo | Contraseña | Rol |
|--------|------------|-----|
| `admin@bancocacao.local` | `cacao123` | ADMIN |
| `vendedor@bancocacao.local` | `cacao123` | SELLER |
| `cliente@bancocacao.local` | `cacao123` | CLIENT |

## API endpoints

Base URL local: `http://localhost:4000`  
Content-Type: `application/json`  
Auth: header `Authorization: Bearer <jwt>` donde se indique **Auth**.

### Resumen

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/health` | No | Healthcheck y tasa cacao |
| POST | `/api/auth/register` | No | Alta de usuario + JWT |
| POST | `/api/auth/login` | No | Login + JWT |
| GET | `/api/auth/me` | Sí | Perfil y saldo actual |
| GET | `/api/wallet/balance` | Sí | Saldo cacao + tasa |
| GET | `/api/wallet/ledger` | Sí | Últimos 100 movimientos |
| POST | `/api/wallet/deposit` | Sí | MXN → cacao (mock) |
| POST | `/api/wallet/transfer` | Sí | Transferir cacao por email |
| GET | `/api/products` | No | Catálogo activo |
| POST | `/api/products` | Sí (SELLER/ADMIN) | Crear producto |
| POST | `/api/products/redeem` | Sí | Canjear producto con cacao |

---

### `GET /api/health`

**Respuesta 200**
```json
{
  "ok": true,
  "service": "banco-cacao",
  "cacaoPerMxn": 10,
  "message": "Depósitos MXN → símbolos cacao → canje de productos"
}
```

---

### Auth — `/api/auth`

#### `POST /api/auth/register`

**Body**
```json
{
  "email": "nuevo@ejemplo.com",
  "name": "Nombre",
  "password": "minimo6",
  "role": "CLIENT"
}
```

| Campo | Reglas |
|-------|--------|
| `email` | email válido |
| `name` | 2–80 chars |
| `password` | 6–100 chars |
| `role` | opcional: `CLIENT` (default) o `SELLER` |

**201** `{ "token": "<jwt>", "user": { id, email, name, role, cacaoBalance, createdAt } }`  
**400** validación · **409** correo ya registrado

#### `POST /api/auth/login`

**Body** `{ "email": "...", "password": "..." }`  

**200** `{ "token", "user" }` · **401** credenciales inválidas

#### `GET /api/auth/me` — Auth

**200** `{ "user": { id, email, name, role, cacaoBalance, createdAt } }`  
**401** sin token / token inválido · **404** usuario no encontrado

---

### Wallet — `/api/wallet` (todas Auth)

#### `GET /api/wallet/balance`

**200**
```json
{
  "cacaoBalance": 150,
  "cacaoPerMxn": 10,
  "symbol": "🍫",
  "unit": "cacao"
}
```

#### `GET /api/wallet/ledger`

**200** `{ "entries": [ /* hasta 100, más recientes primero */ ] }`  

Cada entry puede incluir `fromUser`, `toUser` y `redemption.product`.

#### `POST /api/wallet/deposit`

Convierte MXN simulados a cacao: `cacao = floor(amountMxn * CACAO_PER_MXN)`.

**Body**
```json
{ "amountMxn": 25, "note": "opcional" }
```

**201**
```json
{
  "cacaoCredited": 250,
  "amountMxn": 25,
  "cacaoBalance": 300,
  "entry": { "id": "...", "type": "DEPOSIT", "amountCacao": 250 }
}
```

**400** validación / monto demasiado bajo

#### `POST /api/wallet/transfer`

**Body**
```json
{
  "toEmail": "vendedor@bancocacao.local",
  "amountCacao": 10,
  "note": "opcional"
}
```

**201** `{ "cacaoBalance": 140, "sent": 10, "to": { "email", "name" } }`  
**400** saldo insuficiente / auto-transferencia · **404** destinatario inexistente  

Efecto: dos filas de ledger (`TRANSFER_OUT` + `TRANSFER_IN`).

---

### Products — `/api/products`

#### `GET /api/products` — público

**200**
```json
{
  "products": [
    {
      "id": "...",
      "name": "Bebida de cacao ceremonial",
      "description": "...",
      "cacaoPrice": 25,
      "stock": 40,
      "active": true,
      "seller": { "id": "...", "name": "Vendedor Maya" }
    }
  ]
}
```

Orden: `cacaoPrice` ascendente. Solo `active: true`.

#### `POST /api/products` — Auth + rol `SELLER` o `ADMIN`

**Body**
```json
{
  "name": "Nuevo producto",
  "description": "Detalle",
  "cacaoPrice": 40,
  "stock": 10
}
```

**201** `{ "product": { ... } }`  
Si el actor es `SELLER`, se asigna `sellerId` al usuario actual.  
**403** rol no autorizado

#### `POST /api/products/redeem` — Auth

Canje atómico: descuenta cacao al comprador, baja stock, acredita cacao al vendedor (si hay `sellerId`), crea `LedgerEntry` tipo `REDEEM` + `Redemption`.

**Body**
```json
{ "productId": "...", "quantity": 1 }
```

| Campo | Reglas |
|-------|--------|
| `productId` | string no vacío |
| `quantity` | entero 1–50 (default 1) |

**201**
```json
{
  "cacaoBalance": 275,
  "redemption": {
    "id": "...",
    "cacaoPaid": 25,
    "quantity": 1,
    "product": { "name": "...", "cacaoPrice": 25 }
  },
  "entry": { "type": "REDEEM", "amountCacao": 25 }
}
```

| Código | Error típico |
|--------|----------------|
| 400 | Stock insuficiente / saldo de cacao insuficiente / validación |
| 404 | Producto no disponible / usuario no encontrado |

---

### Errores comunes

Formato habitual: `{ "error": "mensaje" }` o `{ "error": { /* flatten Zod */ } }`.

| HTTP | Significado |
|------|-------------|
| 400 | Body inválido o regla de negocio |
| 401 | Falta o falla JWT |
| 403 | Rol insuficiente |
| 404 | Recurso no encontrado |
| 409 | Conflicto (email duplicado) |
| 500 | Error interno |

### Ejemplo curl (depósito)

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"cliente@bancocacao.local","password":"cacao123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl -s -X POST http://localhost:4000/api/wallet/deposit \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"amountMxn":10}'
```

## Neon PostgreSQL

El proyecto usa **Neon** (`provider = "postgresql"`).

1. Copia la connection string del **pooler** al `.env` local (nunca la subas a git):
   ```env
   DATABASE_URL="postgresql://...@ep-xxx-pooler....neon.tech/neondb?sslmode=require"
   ```
2. Aplica schema + seed:
   ```bash
   npm run db:push
   npm run db:seed
   ```

Notas técnicas:
- En algunos entornos el **schema engine** nativo de Prisma devuelve `P1001` contra Neon,
  aunque `node-pg` conecta. El runtime usa `@prisma/adapter-pg` y
  `db:push` aplica SQL generado vía `server/scripts/apply-sql.mjs`.
- No pegues la URL con contraseña en issues, chats ni commits. Si se filtró, **rota**
  el password en el dashboard de Neon.

## Tests E2E

```bash
# API: depósito + canje + rechazo por saldo insuficiente
npm run test:e2e:api

# UI (Playwright): login → depósito → canje en el dashboard
npm run test:e2e:ui

# Ambos
npm run test:e2e
```

Los tests de API levantan Express en un puerto efímero contra Neon.
Los de UI arrancan API (`4010`) + Vite (`5174`) vía `playwright.config.ts`.

## REA

Se usó **Reverse Engineer Anything** (`capture_browser_scenario`) contra la home pública de Mercado Pago. Resultado observado: **HTTP 403** / empty-state (anti-bot). No se accedió a sesión autenticada ni a APIs privadas. Detalle y evidence IDs: `docs/rea/findings.md`.

## Licencia

Uso educativo / prototipo. No afiliado a Mercado Libre ni Mercado Pago.
