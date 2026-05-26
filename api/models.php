<?php
/**
 * Public Models API — 返回当前活跃 API 的可用模型列表
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? '*'));

$configFile = __DIR__ . '/../images20/config.php';
if (!file_exists($configFile)) {
    echo json_encode(['ok' => true, 'models' => []]);
    exit;
}

$config = require $configFile;
$active = $config['active'] ?? 'default';
$profile = $config['profiles'][$active] ?? [];

$apiKey = trim($profile['api_key'] ?? '');
$baseUrl = rtrim(str_replace(' ', '', $profile['base_url'] ?? ''), ' /');
$baseUrl = preg_replace('{/v1.*$}', '', $baseUrl);

$models = [];
if ($apiKey && $baseUrl) {
    $ch = curl_init($baseUrl . '/v1/models');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 4,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey]
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code >= 200 && $code < 300) {
        $data = json_decode($resp, true);
        $rawModels = $data['data'] ?? $data['models'] ?? [];
        $models = array_values(array_unique(array_map(fn($m) => is_string($m) ? $m : ($m['id'] ?? ''), $rawModels)));
        $models = array_filter($models);
        sort($models);
    }
}

echo json_encode(['ok' => true, 'models' => $models], JSON_UNESCAPED_UNICODE);
