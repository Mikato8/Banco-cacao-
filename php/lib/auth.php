<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/env.php';

function bc_b64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function bc_b64url_decode(string $data): string
{
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return (string) base64_decode(strtr($data, '-_', '+/'), true);
}

function bc_jwt_sign(array $payload, int $ttlSeconds = 604800): string
{
    $secret = bc_config()['jwt_secret'];
    $header = ['typ' => 'JWT', 'alg' => 'HS256'];
    $payload['iat'] = time();
    $payload['exp'] = time() + $ttlSeconds;
    $h = bc_b64url_encode(json_encode($header, JSON_THROW_ON_ERROR));
    $p = bc_b64url_encode(json_encode($payload, JSON_THROW_ON_ERROR));
    $sig = bc_b64url_encode(hash_hmac('sha256', "$h.$p", $secret, true));
    return "$h.$p.$sig";
}

function bc_jwt_verify(string $token): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }
    [$h, $p, $s] = $parts;
    $secret = bc_config()['jwt_secret'];
    $expected = bc_b64url_encode(hash_hmac('sha256', "$h.$p", $secret, true));
    if (!hash_equals($expected, $s)) {
        return null;
    }
    try {
        $payload = json_decode(bc_b64url_decode($p), true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable) {
        return null;
    }
    if (!is_array($payload) || ($payload['exp'] ?? 0) < time()) {
        return null;
    }
    return $payload;
}

function bc_bearer_user(): ?array
{
    $header = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';
    if (!preg_match('/^Bearer\s+(\S+)$/i', $header, $m)) {
        return null;
    }
    $payload = bc_jwt_verify($m[1]);
    if (!$payload || empty($payload['sub'])) {
        return null;
    }
    return $payload;
}

function bc_public_user(array $row): array
{
    return [
        'id' => $row['id'],
        'email' => $row['email'],
        'name' => $row['name'],
        'role' => $row['role'],
        'cacaoBalance' => (int) $row['cacao_balance'],
        'createdAt' => $row['created_at'],
    ];
}
