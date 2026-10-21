<?php
declare(strict_types=1);

// Uso: php -S 127.0.0.1:8080 router.php
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$file = __DIR__ . $uri;

if ($uri !== '/' && is_file($file)) {
    return false; // servir estático
}

if (str_starts_with($uri, '/api')) {
    require __DIR__ . '/api/index.php';
    return true;
}

require __DIR__ . '/index.html';
return true;
