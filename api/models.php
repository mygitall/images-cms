<?php
/**
 * Public Models API — 返回当前活跃 API 的可用模型列表
 */

require_once __DIR__ . '/_lib/helpers.php';

cors_headers();

$configFile = __DIR__ . '/../images20/config.php';
if (!file_exists($configFile)) {
    json_out(['ok' => true, 'models' => []]);
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

json_out(['ok' => true, 'models' => $models]);
