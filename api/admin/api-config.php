<?php
/**
 * API Config — 管理员切换 API Profile
 * GET  → 返回当前配置（隐藏 Key）
 * POST → 切换 active profile
 */

require_once __DIR__ . '/../_lib/helpers.php';
require_once __DIR__ . '/../../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

cors_headers();

$user = $_SESSION['user'] ?? null;
if (!$user || ($user['role'] ?? '') !== 'admin') {
    json_out(['ok' => false, 'error' => 'FORBIDDEN'], 403);
}

$configFile = __DIR__ . '/../../images20/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $config = require $configFile;
    $active = $config['active'] ?? 'default';
    $profiles = [];
    foreach ($config['profiles'] ?? [] as $name => $p) {
        $key = $p['api_key'] ?? '';
        $url = $p['base_url'] ?? '';
        $profiles[] = [
            'name'    => $name,
            'api_key' => substr($key, 0, 8) . '***' . substr($key, -4),
            'base_url'=> $url,
            'isActive'=> $name === $active
        ];
    }

    // 快速检测当前 API 是否可用 + 拉取模型列表
    $currentProfile = $config['profiles'][$active] ?? [];
    $apiStatus = 'unknown';
    $models = [];
    if (!empty($currentProfile['api_key']) && !empty($currentProfile['base_url'])) {
        $baseUrl = rtrim(str_replace(' ', '', $currentProfile['base_url']), ' /');
        $baseUrl = preg_replace('{/v1.*$}', '', $baseUrl);
        $apiKey = trim($currentProfile['api_key']);

        // 检测生图接口
        $ch = curl_init($baseUrl . '/v1/images/generations');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['model'=>'gpt-image-2','prompt'=>'ping','n'=>1,'size'=>'256x256','quality'=>'low','format'=>'jpeg']),
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json']
        ]);
        curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($code >= 200 && $code < 300) $apiStatus = 'ok';
        elseif ($code === 429) $apiStatus = 'busy';
        elseif ($code === 401 || $code === 403) $apiStatus = 'invalid';
        elseif ($err) $apiStatus = 'timeout';
        else $apiStatus = "http_{$code}";

        // 拉取模型列表
        $ch2 = curl_init($baseUrl . '/v1/models');
        curl_setopt_array($ch2, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey]
        ]);
        $resp2 = curl_exec($ch2);
        $code2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
        curl_close($ch2);
        if ($code2 >= 200 && $code2 < 300) {
            $data2 = json_decode($resp2, true);
            $rawModels = $data2['data'] ?? $data2['models'] ?? [];
            $models = array_map(fn($m) => $m['id'] ?? $m, $rawModels);
            sort($models);
        }
    }

    json_out([
        'ok'        => true,
        'active'    => $active,
        'apiStatus' => $apiStatus,
        'models'    => $models,
        'profiles'  => $profiles
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    $config = require $configFile;

    // 编辑 profile（更新 api_key / base_url）
    if (isset($input['editProfile'])) {
        $profileName = trim($input['editProfile']);
        if (!isset($config['profiles'][$profileName])) {
            json_out(['ok' => false, 'error' => 'Profile 不存在: ' . $profileName], 400);
        }
        if (isset($input['api_key']) && $input['api_key'] !== '') {
            $config['profiles'][$profileName]['api_key'] = trim($input['api_key']);
        }
        if (isset($input['base_url']) && $input['base_url'] !== '') {
            $config['profiles'][$profileName]['base_url'] = trim($input['base_url']);
        }
        $php = "<?php\nreturn " . var_export($config, true) . ";\n";
        file_put_contents($configFile, $php);
        json_out(['ok' => true]);
    }

    // 新增 profile
    if (isset($input['addProfile'])) {
        $profileName = trim($input['addProfile']);
        $apiKey = trim($input['api_key'] ?? '');
        $baseUrl = trim($input['base_url'] ?? '');
        if (!$profileName || !$apiKey || !$baseUrl) {
            json_out(['ok' => false, 'error' => '名称/Key/URL 均不能为空'], 400);
        }
        if (isset($config['profiles'][$profileName])) {
            json_out(['ok' => false, 'error' => 'Profile 已存在: ' . $profileName], 409);
        }
        $config['profiles'][$profileName] = ['api_key' => $apiKey, 'base_url' => $baseUrl];
        $php = "<?php\nreturn " . var_export($config, true) . ";\n";
        file_put_contents($configFile, $php);
        json_out(['ok' => true, 'added' => $profileName]);
    }

    // 删除 profile
    if (isset($input['deleteProfile'])) {
        $profileName = trim($input['deleteProfile']);
        if ($profileName === 'default') {
            json_out(['ok' => false, 'error' => '不能删除 default profile'], 400);
        }
        if (!isset($config['profiles'][$profileName])) {
            json_out(['ok' => false, 'error' => 'Profile 不存在'], 404);
        }
        unset($config['profiles'][$profileName]);
        if ($config['active'] === $profileName) $config['active'] = 'default';
        $php = "<?php\nreturn " . var_export($config, true) . ";\n";
        file_put_contents($configFile, $php);
        json_out(['ok' => true, 'deleted' => $profileName]);
    }

    // 切换 active
    $newActive = trim($input['active'] ?? '');
    if (!$newActive) {
        json_out(['ok' => false, 'error' => '缺少 profile 名称'], 400);
    }
    if (!isset($config['profiles'][$newActive])) {
        json_out(['ok' => false, 'error' => 'Profile 不存在: ' . $newActive], 400);
    }
    $config['active'] = $newActive;
    $php = "<?php\nreturn " . var_export($config, true) . ";\n";
    file_put_contents($configFile, $php);
    json_out(['ok' => true, 'active' => $newActive]);
}

json_out(['ok' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
