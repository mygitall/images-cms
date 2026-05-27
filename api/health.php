<?php
/**
 * 健康检查 — 部署后访问此 URL 验证配置是否完整
 * GET /api/health.php
 */
require_once __DIR__ . '/_lib/helpers.php';

cors_headers();

$checks = [];
$allOk = true;

// 1. PHP 版本
$checks['php_version'] = [
    'ok' => true,
    'value' => PHP_VERSION,
];

// 2. 必需扩展
$requiredExt = ['pdo_mysql', 'curl', 'mbstring', 'json'];
foreach ($requiredExt as $ext) {
    $loaded = extension_loaded($ext);
    $checks['ext_' . $ext] = ['ok' => $loaded, 'value' => $loaded ? 'loaded' : 'MISSING'];
    if (!$loaded) $allOk = false;
}

// 3. .env 文件
$envFile = __DIR__ . '/../.env';
$checks['env_file'] = ['ok' => file_exists($envFile), 'value' => file_exists($envFile) ? 'found' : 'NOT FOUND'];

// 4. 数据库连接
try {
    require_once __DIR__ . '/../images20/db.php';
    $pdo->query('SELECT 1');
    $checks['database'] = ['ok' => true, 'value' => 'connected'];
} catch (\Throwable $e) {
    $checks['database'] = ['ok' => false, 'value' => $e->getMessage()];
    $allOk = false;
}

// 5. API Key 配置
$config = require __DIR__ . '/../images20/config.php';
$apiKey = $config['profiles']['default']['api_key'] ?? '';
$hasApiKey = !empty($apiKey) && $apiKey !== 'sk-your-api-key-here';
$checks['api_key'] = [
    'ok' => $hasApiKey,
    'value' => $hasApiKey ? 'configured' : 'NOT SET (still placeholder)',
];
if (!$hasApiKey) $allOk = false;

// 6. API Base URL
$baseUrl = $config['profiles']['default']['base_url'] ?? '';
$checks['api_base_url'] = ['ok' => !empty($baseUrl), 'value' => $baseUrl ?: 'NOT SET'];

// 7. 上传目录可写性
$uploadsDir = __DIR__ . '/../uploads';
if (!is_dir($uploadsDir)) @mkdir($uploadsDir, 0755, true);
$checks['uploads_writable'] = [
    'ok' => is_writable($uploadsDir),
    'value' => is_writable($uploadsDir) ? 'writable' : 'NOT WRITABLE — chmod 755 uploads/',
];
if (!is_writable($uploadsDir)) $allOk = false;

// 8. CORS / 站点 URL
$checks['app_url'] = [
    'ok' => true,
    'value' => $_ENV['APP_URL'] ?? 'not set (CORS will auto-match Host header)',
];

json_out([
    'ok'      => $allOk,
    'status'  => $allOk ? 'healthy' : 'degraded',
    'message' => $allOk ? '一切正常，站点可运行' : '部分配置缺失，请检查下方详情',
    'checks'  => $checks,
]);
