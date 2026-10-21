<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/http.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../config/env.php';

bc_cors();
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (preg_match('#(/api(?:/.*)?)$#', $path, $m)) {
    $path = $m[1];
}
$path = rtrim($path, '/') ?: '/';
if ($path === '/api') {
    $path = '/api/health';
}
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $pdo = bc_pdo();
    route($pdo, $method, $path);
} catch (Throwable $e) {
    error_log('[banco-cacao] ' . $e->getMessage());
    bc_json(['error' => 'Error interno', 'detail' => $e->getMessage()], 500);
}

function route(PDO $pdo, string $method, string $path): void
{
    if ($method === 'GET' && ($path === '/api/health' || $path === '/api')) {
        bc_json([
            'ok' => true,
            'service' => 'banco-cacao-php',
            'cacaoPerMxn' => bc_config()['cacao_per_mxn'],
            'message' => 'Depósitos MXN → cacao → canje (PHP/Hostinger)',
        ]);
    }

    if ($method === 'POST' && $path === '/api/auth/register') {
        handle_register($pdo);
    }
    if ($method === 'POST' && $path === '/api/auth/login') {
        handle_login($pdo);
    }
    if ($method === 'GET' && $path === '/api/auth/me') {
        handle_me($pdo);
    }
    if ($method === 'GET' && $path === '/api/wallet/balance') {
        handle_balance($pdo);
    }
    if ($method === 'GET' && $path === '/api/wallet/ledger') {
        handle_ledger($pdo);
    }
    if ($method === 'POST' && $path === '/api/wallet/deposit') {
        handle_deposit($pdo);
    }
    if ($method === 'POST' && $path === '/api/wallet/transfer') {
        handle_transfer($pdo);
    }
    if ($method === 'GET' && $path === '/api/products') {
        handle_products_list($pdo);
    }
    if ($method === 'POST' && $path === '/api/products') {
        handle_products_create($pdo);
    }
    if ($method === 'POST' && $path === '/api/products/redeem') {
        handle_redeem($pdo);
    }

    bc_json(['error' => 'Ruta no encontrada', 'path' => $path], 404);
}

function require_user(PDO $pdo): array
{
    $tokenUser = bc_bearer_user();
    if (!$tokenUser) {
        bc_json(['error' => 'No autenticado'], 401);
    }
    $stmt = $pdo->prepare('SELECT * FROM "User" WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $tokenUser['sub']]);
    $row = $stmt->fetch();
    if (!$row) {
        bc_json(['error' => 'Usuario no encontrado'], 404);
    }
    // normalizar claves
    return [
        'id' => $row['id'],
        'email' => $row['email'],
        'name' => $row['name'],
        'role' => $row['role'],
        'passwordHash' => $row['passwordHash'],
        'cacao_balance' => (int) $row['cacaoBalance'],
        'created_at' => $row['createdAt'],
    ];
}

function handle_register(PDO $pdo): void
{
    $body = bc_read_json();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $name = trim((string) ($body['name'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    $role = strtoupper((string) ($body['role'] ?? 'CLIENT'));
    if ($role !== 'SELLER') {
        $role = 'CLIENT';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($name) < 2 || strlen($password) < 6) {
        bc_json(['error' => 'Datos de registro inválidos'], 400);
    }
    $exists = $pdo->prepare('SELECT id FROM "User" WHERE email = :e');
    $exists->execute(['e' => $email]);
    if ($exists->fetch()) {
        bc_json(['error' => 'El correo ya está registrado'], 409);
    }
    $id = 'php_' . bc_cuid();
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    $pdo->prepare(
        'INSERT INTO "User" (id, email, name, "passwordHash", role, "cacaoBalance", "createdAt", "updatedAt")
         VALUES (:id, :email, :name, :hash, :role, 0, :c, :u)'
    )->execute([
        'id' => $id,
        'email' => $email,
        'name' => $name,
        'hash' => $hash,
        'role' => $role,
        'c' => $now,
        'u' => $now,
    ]);
    $user = [
        'id' => $id,
        'email' => $email,
        'name' => $name,
        'role' => $role,
        'cacao_balance' => 0,
        'created_at' => $now,
    ];
    $token = bc_jwt_sign(['sub' => $id, 'email' => $email, 'role' => $role]);
    bc_json(['token' => $token, 'user' => bc_public_user($user)], 201);
}

function handle_login(PDO $pdo): void
{
    $body = bc_read_json();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');
    $stmt = $pdo->prepare('SELECT * FROM "User" WHERE email = :e LIMIT 1');
    $stmt->execute(['e' => $email]);
    $row = $stmt->fetch();
    if (!$row || !password_verify($password, $row['passwordHash'])) {
        bc_json(['error' => 'Credenciales inválidas'], 401);
    }
    $user = [
        'id' => $row['id'],
        'email' => $row['email'],
        'name' => $row['name'],
        'role' => $row['role'],
        'cacao_balance' => (int) $row['cacaoBalance'],
        'created_at' => $row['createdAt'],
    ];
    $token = bc_jwt_sign(['sub' => $user['id'], 'email' => $user['email'], 'role' => $user['role']]);
    bc_json(['token' => $token, 'user' => bc_public_user($user)]);
}

function handle_me(PDO $pdo): void
{
    $user = require_user($pdo);
    bc_json(['user' => bc_public_user($user)]);
}

function handle_balance(PDO $pdo): void
{
    $user = require_user($pdo);
    bc_json([
        'cacaoBalance' => $user['cacao_balance'],
        'cacaoPerMxn' => bc_config()['cacao_per_mxn'],
        'symbol' => '🍫',
        'unit' => 'cacao',
    ]);
}

function handle_ledger(PDO $pdo): void
{
    $user = require_user($pdo);
    $stmt = $pdo->prepare(
        'SELECT l.*, 
            fu.name AS from_name, fu.email AS from_email,
            tu.name AS to_name, tu.email AS to_email
         FROM "LedgerEntry" l
         LEFT JOIN "User" fu ON fu.id = l."fromUserId"
         LEFT JOIN "User" tu ON tu.id = l."toUserId"
         WHERE l."fromUserId" = :id OR l."toUserId" = :id
         ORDER BY l."createdAt" DESC
         LIMIT 100'
    );
    $stmt->execute(['id' => $user['id']]);
    $entries = [];
    foreach ($stmt->fetchAll() as $r) {
        $entries[] = [
            'id' => $r['id'],
            'type' => $r['type'],
            'amountCacao' => (int) $r['amountCacao'],
            'amountMxn' => $r['amountMxn'] !== null ? (int) $r['amountMxn'] : null,
            'note' => $r['note'],
            'createdAt' => $r['createdAt'],
            'fromUser' => $r['from_email'] ? ['name' => $r['from_name'], 'email' => $r['from_email']] : null,
            'toUser' => $r['to_email'] ? ['name' => $r['to_name'], 'email' => $r['to_email']] : null,
        ];
    }
    bc_json(['entries' => $entries]);
}

function handle_deposit(PDO $pdo): void
{
    $user = require_user($pdo);
    $body = bc_read_json();
    $amountMxn = (float) ($body['amountMxn'] ?? 0);
    if ($amountMxn <= 0 || $amountMxn > 1_000_000) {
        bc_json(['error' => 'Monto inválido'], 400);
    }
    $rate = bc_config()['cacao_per_mxn'];
    $cacao = (int) floor($amountMxn * $rate);
    if ($cacao < 1) {
        bc_json(['error' => 'Monto demasiado bajo para generar cacao'], 400);
    }
    $note = trim((string) ($body['note'] ?? '')) ?: sprintf('Depósito %s MXN → %d cacao', $amountMxn, $cacao);
    $entryId = 'led_' . bc_cuid();
    $now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');

    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE "User" SET "cacaoBalance" = "cacaoBalance" + :c, "updatedAt" = :u WHERE id = :id')
            ->execute(['c' => $cacao, 'u' => $now, 'id' => $user['id']]);
        $pdo->prepare(
            'INSERT INTO "LedgerEntry" (id, type, "amountCacao", "amountMxn", note, meta, "createdAt", "toUserId")
             VALUES (:id, \'DEPOSIT\', :c, :m, :n, :meta, :t, :to)'
        )->execute([
            'id' => $entryId,
            'c' => $cacao,
            'm' => (int) round($amountMxn),
            'n' => $note,
            'meta' => json_encode(['provider' => 'php-mock-deposit', 'rate' => $rate], JSON_THROW_ON_ERROR),
            't' => $now,
            'to' => $user['id'],
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $bal = $pdo->prepare('SELECT "cacaoBalance" FROM "User" WHERE id = :id');
    $bal->execute(['id' => $user['id']]);
    $balance = (int) $bal->fetchColumn();

    bc_json([
        'cacaoCredited' => $cacao,
        'amountMxn' => $amountMxn,
        'cacaoBalance' => $balance,
        'entry' => ['id' => $entryId, 'type' => 'DEPOSIT', 'amountCacao' => $cacao],
    ], 201);
}

function handle_transfer(PDO $pdo): void
{
    $user = require_user($pdo);
    $body = bc_read_json();
    $toEmail = strtolower(trim((string) ($body['toEmail'] ?? '')));
    $amount = (int) ($body['amountCacao'] ?? 0);
    $note = trim((string) ($body['note'] ?? ''));
    if ($amount < 1 || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        bc_json(['error' => 'Datos de transferencia inválidos'], 400);
    }
    if (strcasecmp($toEmail, $user['email']) === 0) {
        bc_json(['error' => 'No puedes transferirte a ti mismo'], 400);
    }

    $pdo->beginTransaction();
    try {
        $fromStmt = $pdo->prepare('SELECT * FROM "User" WHERE id = :id FOR UPDATE');
        $fromStmt->execute(['id' => $user['id']]);
        $from = $fromStmt->fetch();
        $toStmt = $pdo->prepare('SELECT * FROM "User" WHERE email = :e FOR UPDATE');
        $toStmt->execute(['e' => $toEmail]);
        $to = $toStmt->fetch();
        if (!$from || !$to) {
            $pdo->rollBack();
            bc_json(['error' => 'Destinatario no encontrado'], 404);
        }
        if ((int) $from['cacaoBalance'] < $amount) {
            $pdo->rollBack();
            bc_json(['error' => 'Saldo de cacao insuficiente'], 400);
        }
        $now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
        $pdo->prepare('UPDATE "User" SET "cacaoBalance" = "cacaoBalance" - :a, "updatedAt" = :u WHERE id = :id')
            ->execute(['a' => $amount, 'u' => $now, 'id' => $from['id']]);
        $pdo->prepare('UPDATE "User" SET "cacaoBalance" = "cacaoBalance" + :a, "updatedAt" = :u WHERE id = :id')
            ->execute(['a' => $amount, 'u' => $now, 'id' => $to['id']]);

        $outNote = $note !== '' ? $note : ('Transferencia a ' . $to['email']);
        $inNote = $note !== '' ? $note : ('Transferencia de ' . $from['email']);
        $pdo->prepare(
            'INSERT INTO "LedgerEntry" (id, type, "amountCacao", note, "createdAt", "fromUserId", "toUserId")
             VALUES (:id, \'TRANSFER_OUT\', :a, :n, :t, :f, :to)'
        )->execute([
            'id' => 'led_' . bc_cuid(), 'a' => $amount, 'n' => $outNote, 't' => $now,
            'f' => $from['id'], 'to' => $to['id'],
        ]);
        $pdo->prepare(
            'INSERT INTO "LedgerEntry" (id, type, "amountCacao", note, "createdAt", "fromUserId", "toUserId")
             VALUES (:id, \'TRANSFER_IN\', :a, :n, :t, :f, :to)'
        )->execute([
            'id' => 'led_' . bc_cuid(), 'a' => $amount, 'n' => $inNote, 't' => $now,
            'f' => $from['id'], 'to' => $to['id'],
        ]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    $bal = $pdo->prepare('SELECT "cacaoBalance" FROM "User" WHERE id = :id');
    $bal->execute(['id' => $user['id']]);
    bc_json([
        'cacaoBalance' => (int) $bal->fetchColumn(),
        'sent' => $amount,
        'to' => ['email' => $toEmail, 'name' => $to['name'] ?? ''],
    ], 201);
}

function handle_products_list(PDO $pdo): void
{
    $stmt = $pdo->query(
        'SELECT p.*, u.id AS seller_id, u.name AS seller_name
         FROM "Product" p
         LEFT JOIN "User" u ON u.id = p."sellerId"
         WHERE p.active = TRUE
         ORDER BY p."cacaoPrice" ASC'
    );
    $products = [];
    foreach ($stmt->fetchAll() as $r) {
        $products[] = [
            'id' => $r['id'],
            'name' => $r['name'],
            'description' => $r['description'],
            'cacaoPrice' => (int) $r['cacaoPrice'],
            'stock' => (int) $r['stock'],
            'active' => (bool) $r['active'],
            'seller' => $r['seller_id'] ? ['id' => $r['seller_id'], 'name' => $r['seller_name']] : null,
        ];
    }
    bc_json(['products' => $products]);
}

function handle_products_create(PDO $pdo): void
{
    $user = require_user($pdo);
    if (!in_array($user['role'], ['ADMIN', 'SELLER'], true)) {
        bc_json(['error' => 'Sin permiso'], 403);
    }
    $body = bc_read_json();
    $name = trim((string) ($body['name'] ?? ''));
    $description = trim((string) ($body['description'] ?? ''));
    $price = (int) ($body['cacaoPrice'] ?? 0);
    $stock = (int) ($body['stock'] ?? 0);
    if (strlen($name) < 2 || strlen($description) < 2 || $price < 1 || $stock < 0) {
        bc_json(['error' => 'Datos de producto inválidos'], 400);
    }
    $id = 'prd_' . bc_cuid();
    $now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
    $sellerId = $user['role'] === 'SELLER' ? $user['id'] : null;
    $pdo->prepare(
        'INSERT INTO "Product" (id, name, description, "cacaoPrice", stock, active, "sellerId", "createdAt", "updatedAt")
         VALUES (:id, :n, :d, :p, :s, TRUE, :seller, :c, :u)'
    )->execute([
        'id' => $id, 'n' => $name, 'd' => $description, 'p' => $price, 's' => $stock,
        'seller' => $sellerId, 'c' => $now, 'u' => $now,
    ]);
    bc_json([
        'product' => [
            'id' => $id,
            'name' => $name,
            'description' => $description,
            'cacaoPrice' => $price,
            'stock' => $stock,
            'active' => true,
        ],
    ], 201);
}

function handle_redeem(PDO $pdo): void
{
    $user = require_user($pdo);
    $body = bc_read_json();
    $productId = (string) ($body['productId'] ?? '');
    $qty = (int) ($body['quantity'] ?? 1);
    if ($productId === '' || $qty < 1 || $qty > 50) {
        bc_json(['error' => 'Datos de canje inválidos'], 400);
    }

    $pdo->beginTransaction();
    try {
        $pStmt = $pdo->prepare('SELECT * FROM "Product" WHERE id = :id FOR UPDATE');
        $pStmt->execute(['id' => $productId]);
        $product = $pStmt->fetch();
        if (!$product || !($product['active'] === true || $product['active'] === 't' || $product['active'] === 1 || $product['active'] === '1')) {
            $pdo->rollBack();
            bc_json(['error' => 'Producto no disponible'], 404);
        }
        if ((int) $product['stock'] < $qty) {
            $pdo->rollBack();
            bc_json(['error' => 'Stock insuficiente'], 400);
        }
        $total = (int) $product['cacaoPrice'] * $qty;

        $uStmt = $pdo->prepare('SELECT * FROM "User" WHERE id = :id FOR UPDATE');
        $uStmt->execute(['id' => $user['id']]);
        $u = $uStmt->fetch();
        if (!$u) {
            $pdo->rollBack();
            bc_json(['error' => 'Usuario no encontrado'], 404);
        }
        if ((int) $u['cacaoBalance'] < $total) {
            $pdo->rollBack();
            bc_json(['error' => 'Saldo de cacao insuficiente'], 400);
        }

        $now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
        $pdo->prepare('UPDATE "User" SET "cacaoBalance" = "cacaoBalance" - :t, "updatedAt" = :u WHERE id = :id')
            ->execute(['t' => $total, 'u' => $now, 'id' => $u['id']]);
        $pdo->prepare('UPDATE "Product" SET stock = stock - :q, "updatedAt" = :u WHERE id = :id')
            ->execute(['q' => $qty, 'u' => $now, 'id' => $product['id']]);

        if (!empty($product['sellerId'])) {
            $pdo->prepare('UPDATE "User" SET "cacaoBalance" = "cacaoBalance" + :t, "updatedAt" = :u WHERE id = :id')
                ->execute(['t' => $total, 'u' => $now, 'id' => $product['sellerId']]);
        }

        $ledgerId = 'led_' . bc_cuid();
        $pdo->prepare(
            'INSERT INTO "LedgerEntry" (id, type, "amountCacao", note, meta, "createdAt", "fromUserId", "toUserId")
             VALUES (:id, \'REDEEM\', :a, :n, :m, :t, :f, :to)'
        )->execute([
            'id' => $ledgerId,
            'a' => $total,
            'n' => sprintf('Canje: %d× %s', $qty, $product['name']),
            'm' => json_encode(['productId' => $product['id'], 'quantity' => $qty], JSON_THROW_ON_ERROR),
            't' => $now,
            'f' => $u['id'],
            'to' => $product['sellerId'] ?: null,
        ]);

        $redId = 'red_' . bc_cuid();
        $pdo->prepare(
            'INSERT INTO "Redemption" (id, "userId", "productId", "cacaoPaid", quantity, "createdAt", "ledgerId")
             VALUES (:id, :u, :p, :c, :q, :t, :l)'
        )->execute([
            'id' => $redId, 'u' => $u['id'], 'p' => $product['id'], 'c' => $total, 'q' => $qty, 't' => $now, 'l' => $ledgerId,
        ]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    $bal = $pdo->prepare('SELECT "cacaoBalance" FROM "User" WHERE id = :id');
    $bal->execute(['id' => $user['id']]);

    bc_json([
        'cacaoBalance' => (int) $bal->fetchColumn(),
        'redemption' => [
            'id' => $redId,
            'cacaoPaid' => $total,
            'quantity' => $qty,
            'productId' => $product['id'],
            'product' => [
                'name' => $product['name'],
                'cacaoPrice' => (int) $product['cacaoPrice'],
            ],
        ],
        'entry' => ['type' => 'REDEEM', 'amountCacao' => $total],
    ], 201);
}
