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
            $_ENV[$key] = $val;
            // putenv 可能被禁用，仅设置 $_ENV
            @putenv("{$key}={$val}");
        }
    }
}

// 自动加载（首次引入时）
load_env();

// ---- CORS ----
function cors_headers() {
    // 本地开发域名（自动放行）
    $localOrigins = [
        'http://localhost:3000', 'http://localhost:5173',
        'http://localhost:8080', 'http://localhost',
    ];

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    // 本地开发 → 放行
    if (in_array($origin, $localOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    }
    // 同源请求（无 Origin 头）→ 放行
    elseif (empty($origin)) {
        header('Access-Control-Allow-Origin: *');
    }
    // 生产环境：检查是否匹配 APP_URL 或当前 Host
    else {
        $appUrl = $_ENV['APP_URL'] ?? '';
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $originHost = parse_url($origin, PHP_URL_HOST) ?? '';

        // 匹配 APP_URL 或当前服务器 Host
        if (
            ($appUrl && strpos($appUrl, $originHost) !== false) ||
            ($host && $originHost === $host)
        ) {
            header('Access-Control-Allow-Origin: ' . $origin);
        } else {
            // 未知来源：仍然回显（API 是公开的），但记录日志
            header('Access-Control-Allow-Origin: ' . $origin);
        }
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
