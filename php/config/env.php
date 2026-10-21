<?php
declare(strict_types=1);

/**
 * Carga variables desde php/config/.env o desde el entorno del servidor.
 * En Hostinger: copia .env.example a .env y rellena DATABASE_URL / JWT_SECRET.
 */
function bc_load_env(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $candidates = [
        __DIR__ . '/.env',
        dirname(__DIR__) . '/.env',
        dirname(__DIR__, 2) . '/.env',
    ];
    foreach ($candidates as $file) {
        if (!is_readable($file)) {
            continue;
        }
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$k, $v] = explode('=', $line, 2);
            $k = trim($k);
            $v = trim($v);
            if (
                (str_starts_with($v, '"') && str_ends_with($v, '"')) ||
                (str_starts_with($v, "'") && str_ends_with($v, "'"))
            ) {
                $v = substr($v, 1, -1);
            }
            if (getenv($k) === false) {
                putenv("$k=$v");
                $_ENV[$k] = $v;
            }
        }
        break;
    }
}

function bc_env(string $key, ?string $default = null): ?string
{
    bc_load_env();
    $v = $_ENV[$key] ?? getenv($key);
    if ($v === false || $v === null || $v === '') {
        return $default;
    }
    return (string) $v;
}

function bc_config(): array
{
    return [
        'database_url' => bc_env('DATABASE_URL'),
        'jwt_secret' => bc_env('JWT_SECRET', 'cambia-este-secreto-en-hostinger'),
        'cacao_per_mxn' => (int) (bc_env('CACAO_PER_MXN', '10') ?? '10'),
        'app_name' => bc_env('APP_NAME', 'Banco Cacao'),
    ];
}
