# Banco Cacao — PHP (Hostinger)

Versión **PHP 8+** lista para hosting compartido Hostinger + **Neon PostgreSQL**.

## Qué incluye

- Auth JWT (register / login / me)
- Depósito MXN → cacao
- Transferencias
- Catálogo y canje de productos
- SPA estática (`index.html` + `assets/`)

## Subir a Hostinger

1. En hPanel → **Administrador de archivos** (o FTP), entra a `public_html` del dominio.
2. Sube **todo el contenido** de esta carpeta `php/` (no la carpeta padre del monorepo):
   - `index.html`, `.htaccess`, `assets/`, `api/`, `lib/`, `config/`, `sql/`
3. Copia `config/.env.example` → `config/.env` y pega tu `DATABASE_URL` de Neon y un `JWT_SECRET` fuerte.
4. Asegura **PHP 8.1+** y extensión **pdo_pgsql** (o `pgsql`) en hPanel → PHP Configuration.
5. Si las tablas aún no existen, ejecuta `sql/schema.sql` en Neon SQL Editor (si ya usaste el backend Node, las tablas ya están).
6. Abre `https://tudominio.com/`

### Demo (si hiciste seed Node)

| Correo | Contraseña |
|--------|------------|
| `cliente@bancocacao.local` | `cacao123` |

## Estructura en el servidor

```text
public_html/
├── .htaccess
├── index.html
├── assets/
│   ├── app.css
│   └── app.js
├── api/
│   └── index.php          ← /api/*
├── config/
│   ├── env.php
│   └── .env               ← secretos (no público vía rewrite)
├── lib/
│   ├── auth.php
│   ├── db.php
│   └── http.php
└── sql/
    └── schema.sql
```

## API

Misma forma que el backend Node:

- `GET /api/health`
- `POST /api/auth/login|register`
- `GET /api/auth/me`
- `GET|POST /api/wallet/*`
- `GET|POST /api/products*`

## Local (opcional)

```bash
cd php
# config/.env con DATABASE_URL
php -S 127.0.0.1:8080
# abrir http://127.0.0.1:8080
```

> El router embebido de PHP no aplica `.htaccess`. Usa:
> `php -S 127.0.0.1:8080 router.php` (ver `router.php`).
