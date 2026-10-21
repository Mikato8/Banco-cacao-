<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/env.php';

function bc_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $url = bc_config()['database_url'] ?? null;
    if (!$url) {
        throw new RuntimeException('DATABASE_URL no configurada');
    }

    $parts = parse_url($url);
    if ($parts === false || empty($parts['host'])) {
        throw new RuntimeException('DATABASE_URL inválida');
    }

    $db = isset($parts['path']) ? ltrim($parts['path'], '/') : 'neondb';
    $user = $parts['user'] ?? '';
    $pass = $parts['pass'] ?? '';
    $host = $parts['host'];
    $port = $parts['port'] ?? 5432;

    $query = [];
    if (!empty($parts['query'])) {
        parse_str($parts['query'], $query);
    }
    // channel_binding a veces cuelga el cliente PHP; Neon acepta sslmode=require solo.
    $sslmode = $query['sslmode'] ?? 'require';
    if ($sslmode === '' || $sslmode === 'prefer') {
        $sslmode = 'require';
    }

    // Neon pooler + SSL
    $dsn = sprintf(
        'pgsql:host=%s;port=%d;dbname=%s;sslmode=%s;connect_timeout=10',
        $host,
        (int) $port,
        $db,
        $sslmode
    );

    // URL-decode password (parse_url ya lo decodifica; por si viene raw)
    $pass = rawurldecode(urlencode($pass)); // noop-safe identity if already decoded

    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 10,
    ]);

    return $pdo;
}
