<?php
/**
 * 公共辅助函数 — 所有 API 文件统一引入
 * 提供：.env 加载、CORS 处理、JSON 输出、错误配置
 */

// ---- 错误配置 ----
error_reporting(E_ALL);
ini_set('display_errors', 0);

// ---- 加载 .env ----
function load_env($rootDir = null) {
    if ($rootDir === null) {
        $rootDir = __DIR__ . '/../..';
    }
    $envFile = $rootDir . '/.env';
    if (!file_exists($envFile)) return;

    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $eq = strpos($line, '=');
        if ($eq === false) continue;
        $key = trim(substr($line, 0, $eq));
        $val = trim(substr($line, $eq + 1));
        if (!array_key_exists($key, $_ENV)) {
            putenv("{$key}={$val}");
            $_ENV[$key] = $val;
        }
    }
}

// 自动加载（首次引入时）
load_env();

// ---- CORS ----
function cors_headers() {
    $allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://localhost',
        'https://gpt-image2.canghe.ai',
    ];

    // 从 .env 读取额外允许的域名
    $envOrigin = $_ENV['APP_URL'] ?? '';
    if ($envOrigin && !in_array($envOrigin, $allowedOrigins, true)) {
        $allowedOrigins[] = $envOrigin;
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    // 如果是允许的域名，回显该域名；否则回显第一个允许的域名
    if (in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    } else {
        header('Access-Control-Allow-Origin: ' . $allowedOrigins[0]);
    }

    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    // OPTIONS 预检请求直接返回
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ---- JSON 输出 ----
function json_out($data, $code = 200) {
    if (!headers_sent()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
