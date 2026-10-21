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
| DB | Prisma + SQLite local (o Neon PostgreSQL) |
| UI | React (Vite), Tailwind CSS v4, React Router |
| Roles | `ADMIN`, `SELLER`, `CLIENT` |

## Flujo de valor

```text
MXN (depósito mock)  ×  CACAO_PER_MXN (default 10)
        ↓
   saldo cacao 🍫
        ↓
  transferencias / canje de productos
        ↓
   ledger append-only
```

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

## API principal

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Alta multiusuario |
| POST | `/api/auth/login` | JWT |
| GET | `/api/auth/me` | Perfil + saldo |
| POST | `/api/wallet/deposit` | MXN → cacao |
| POST | `/api/wallet/transfer` | Transferir cacao |
| GET | `/api/wallet/ledger` | Movimientos |
| GET | `/api/products` | Catálogo |
| POST | `/api/products/redeem` | Canjear con cacao |
| POST | `/api/products` | Crear producto (SELLER/ADMIN) |

## Neon PostgreSQL

El proyecto está configurado para **Neon** (`provider = "postgresql"`).

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
- En este entorno el **schema engine** nativo de Prisma devolvía `P1001` contra Neon,
  aunque `node-pg` sí conectaba. Por eso el runtime usa `@prisma/adapter-pg` y
  `db:push` aplica el SQL generado vía `scripts/apply-sql.mjs`.
- No pegues la URL con contraseña en issues, chats ni commits. Si se filtró, **rota**
  el password en el dashboard de Neon.

## REA

Se usó **Reverse Engineer Anything** (`capture_browser_scenario`) contra la home pública de Mercado Pago. Resultado observado: **HTTP 403** / empty-state (anti-bot). No se accedió a sesión autenticada ni a APIs privadas. Detalle y evidence IDs: `docs/rea/findings.md`.

## Licencia

Uso educativo / prototipo. No afiliado a Mercado Libre ni Mercado Pago.
