<?php
/**
 * Generate Image API — 代理生图请求到 images20 配置的 API
 * 完全共用 images20 的用户余额、gen_images 表、API Key
 */

require_once __DIR__ . '/_lib/helpers.php';
require_once __DIR__ . '/../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

cors_headers();

$maxPromptLength = 6000;

// ---- 登录检查 ----
$user = $_SESSION['user'] ?? null;
if (!$user) {
    json_out(['ok' => false, 'error' => 'AUTH_REQUIRED', 'loginRequired' => true], 401);
}

// ---- 读取用户数据 ----
$uid = (int)$user['id'];
$stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
$stmt->execute([$uid]);
$row = $stmt->fetch();
if (!$row) json_out(['ok' => false, 'error' => 'USER_NOT_FOUND'], 404);

$balance = (float)$row['balance'];
$role = $row['role'] ?? 'user';
$isAdmin = ($role === 'admin');
$freeUsed = false; // 检查是否有过免费生图

// 查是否已使用免费额度
$freeCheck = $pdo->prepare("SELECT COUNT(*) FROM gen_images WHERE user_id = ?");
$freeCheck->execute([$uid]);
$freeCheck = $freeCheck->fetchColumn();
if ($freeCheck > 0) $freeUsed = true;

// ---- 读取请求 ----
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$prompt = trim($input['prompt'] ?? '');
$caseId = (int)($input['caseId'] ?? 0);
$referenceImages = $input['referenceImages'] ?? [];

if (!$prompt || strlen($prompt) > $maxPromptLength) {
    json_out(['ok' => false, 'error' => 'INVALID_PROMPT'], 400);
}

// ---- 余额检查 ----
$creditAmount = 0;
if ($isAdmin) {
    // 管理员每次消耗 1 积分
    if ($balance < 1) json_out(['ok' => false, 'error' => 'CREDITS_REQUIRED'], 402);
    $creditAmount = 1;
} elseif ($freeUsed) {
    // 已用免费额度，消耗积分
    if ($balance < 1) json_out(['ok' => false, 'error' => 'CREDITS_REQUIRED'], 402);
    $creditAmount = 1;
}
// else: 免费生成，不扣积分

// ---- 加载 images20 API 配置（尝试所有可用 profile） ----
$config = require __DIR__ . '/../images20/config.php';
$active = $config['active'] ?? 'default';
$profiles = $config['profiles'] ?? [];

// 当前活跃 profile 排最前面，其余按顺序
$orderedProfiles = [];
if (isset($profiles[$active])) $orderedProfiles[] = $profiles[$active];
foreach ($profiles as $name => $p) {
    if ($name !== $active) $orderedProfiles[] = $p;
}

function cleanBaseUrl($url) {
    $url = trim($url);
    $url = preg_replace('{/v1/images/generations.*$}', '', $url);
    $url = preg_replace('{/v1.*$}', '', $url);
    return rtrim($url, ' /');
}

if (empty($orderedProfiles)) {
    json_out(['ok' => false, 'error' => 'SERVER_NOT_CONFIGURED'], 500);
}

// ---- 调用生图 API（逐个尝试 profile） ----
ignore_user_abort(true);
set_time_limit(180);

if (!empty($referenceImages)) {
    // 用 chat/completions 多模态格式
    $content = [['type' => 'text', 'text' => $prompt]];
    foreach ($referenceImages as $ref) {
        $content[] = ['type' => 'image_url', 'image_url' => ['url' => $ref]];
    }

    $requestPayload = [
        'model' => 'gpt-image-2',
        'messages' => [['role' => 'user', 'content' => $content]],
        'n' => 1,
        'size' => '1024x1024'
    ];

    $useChatEndpoint = true;
    // 去掉 prompt 长度限制，多模态格式不需要
    $maxPromptLength = 999999;
} else {
    $requestPayload = [
        'model' => 'gpt-image-2',
        'prompt' => $prompt,
        'n' => 1,
        'size' => '1024x1024'
    ];
    $useChatEndpoint = false;
}

$requestBody = json_encode($requestPayload);

// ---- DEBUG ----
@file_put_contents(__DIR__ . '/../uploads/debug_request.json',
    json_encode(['time' => date('Y-m-d H:i:s'), 'has_refs' => !empty($referenceImages), 'ref_count' => count($referenceImages), 'chat_format' => $useChatEndpoint, 'keys' => array_keys($requestPayload)], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
);

$response = null;
$httpCode = 0;
$curlError = '';
$usedProfile = '';

$maxRetries = 2;
foreach ($orderedProfiles as $profile) {
    $apiKey = trim($profile['api_key'] ?? '');
    $baseUrl = cleanBaseUrl($profile['base_url'] ?? '');
    if (empty($apiKey) || empty($baseUrl)) continue;

    $apiUrl = $baseUrl . (!empty($useChatEndpoint) ? '/v1/chat/completions' : '/v1/images/generations');

    for ($retry = 0; $retry <= $maxRetries; $retry++) {
        $ch = curl_init($apiUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 90,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $requestBody,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
                'Accept: application/json'
            ]
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        $usedProfile = $baseUrl;
        // DEBUG：记录 API 响应
        @file_put_contents(__DIR__ . '/../uploads/debug_response.json',
            json_encode(['time' => date('Y-m-d H:i:s'), 'http_code' => $httpCode, 'curl_error' => $curlError, 'body' => $response], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
        );
        curl_close($ch);

        // 成功则跳出
        if ($httpCode >= 200 && $httpCode < 300 && !$curlError) break 2;

        // 超时则重试，其他错误停止
        if (!$curlError || $retry >= $maxRetries) break 2;
    }
}

// ---- 记录 API 日志 ----
try {
    $logStmt = $pdo->prepare('INSERT INTO api_logs (user_id, endpoint, method, status, http_code, duration_ms, error_msg) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $logStmt->execute([
        $uid,
        !empty($useChatEndpoint) ? '/v1/chat/completions' : '/v1/images/generations',
        'POST',
        $httpCode >= 200 && $httpCode < 300 ? 'success' : 'error',
        $httpCode,
        0,
        $curlError ?: null
    ]);
} catch (\Throwable $e) {}

// ---- 处理响应 ----
if ($curlError || !$response) {
    $reason = $curlError ?: '无响应';
    json_out(['ok' => false, 'error' => 'UPSTREAM_BUSY', 'message' => $reason], 502);
}

$payload = json_decode($response, true);
if (!is_array($payload)) {
    json_out(['ok' => false, 'error' => 'GENERATION_FAILED', 'message' => "API returned non-JSON response (HTTP {$httpCode})"], 502);
}

// 解析响应：兼容 images API (data[].b64_json) 和 chat API (choices[].message.content)
$b64 = '';
$imageUrl = '';
if (!empty($payload['data'][0]['b64_json'])) {
    $b64 = $payload['data'][0]['b64_json'];
} elseif (!empty($payload['data'][0]['url'])) {
    $imageUrl = $payload['data'][0]['url'];
} elseif (!empty($payload['choices'][0]['message']['content'])) {
    foreach ($payload['choices'][0]['message']['content'] as $part) {
        if (($part['type'] ?? '') === 'image_url' && !empty($part['image_url']['url'])) {
            $imageUrl = $part['image_url']['url'];
            break;
        }
    }
}

if ($httpCode === 401 || $httpCode === 403) {
    $errorMsg = $payload['error']['message'] ?? '无效的 API Key';
    json_out(['ok' => false, 'error' => 'API_KEY_INVALID', 'message' => $errorMsg], 502);
}

// 如果 API 返回 URL 而不是 base64，下载图片并转 base64
if (!$b64 && $imageUrl) {
    $ch2 = curl_init($imageUrl);
    curl_setopt_array($ch2, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_FOLLOWLOCATION => true
    ]);
    $imageBytes = curl_exec($ch2);
    $imgCode = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
    curl_close($ch2);
    if ($imgCode === 200 && $imageBytes) {
        $b64 = base64_encode($imageBytes);
    }
}

if ($httpCode < 200 || $httpCode >= 300 || !$b64) {
    $errorMsg = $payload['error']['message'] ?? $payload['message'] ?? "API returned {$httpCode}";
    json_out(['ok' => false, 'error' => 'GENERATION_FAILED', 'message' => $errorMsg], 502);
}

// ---- 扣积分 + 记录生图 ----
$username = $row['username'];
$uploadsDir = __DIR__ . '/../uploads/' . $username;
$imageFilename = 'gen_' . time() . '_' . $uid . '.jpg';

$pdo->beginTransaction();
try {
    if ($creditAmount > 0) {
        $newBalance = $balance - $creditAmount;
        $pdo->prepare('UPDATE users SET balance = ? WHERE id = ?')->execute([$newBalance, $uid]);
        $reason = $caseId > 0 ? "案例 #{$caseId} 生图" : '模板生图';
        $pdo->prepare('INSERT INTO balance_logs (user_id, amount, type, reason, balance_after) VALUES (?, ?, ?, ?, ?)')
            ->execute([$uid, -$creditAmount, 'generation', $reason, $newBalance]);
        $balance = $newBalance;
    }

    $pdo->prepare('INSERT INTO gen_images (user_id, filename, prompt, model, aspect, resolution) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$uid, $imageFilename, $prompt, 'gpt-image-2', '1:1', '1k']);

    $pdo->commit();

    // 事务成功后才写入文件，避免回滚产生孤儿文件
    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0755, true);
    $imageData = base64_decode($b64);
    file_put_contents($uploadsDir . '/' . $imageFilename, $imageData);
} catch (\Throwable $e) {
    $pdo->rollBack();
}

// ---- 返回结果 ----
$image = 'data:image/jpeg;base64,' . $b64;

// 更新后的用户数据
$updatedUser = [
    'id' => $uid,
    'email' => $row['username'],
    'fullName' => $row['username'],
    'avatarUrl' => '',
    'creditBalance' => $balance,
    'freeUsed' => $freeUsed || $creditAmount > 0,
    'isSuperAdmin' => $isAdmin,
    'role' => $role,
    'membership' => ['isActive' => false, 'planId' => '', 'status' => 'inactive', 'currentPeriodEnd' => null],
    'usage' => [
        'totalGenerations' => (int)$freeCheck + 1,
        'totalGenerationCredits' => (function() use ($pdo, $uid) {
            $stmt = $pdo->prepare("SELECT COALESCE(SUM(ABS(amount)),0) FROM balance_logs WHERE user_id = ? AND type = 'generation'");
            $stmt->execute([$uid]);
            return (float)$stmt->fetchColumn();
        })(),
        'purchasedCredits' => 0,
        'apiCalls' => (function() use ($pdo, $uid) {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM api_logs WHERE user_id = ?");
            $stmt->execute([$uid]);
            return (int)$stmt->fetchColumn();
        })(),
    ],
    'recentTransactions' => []
];

json_out([
    'ok'    => true,
    'image' => $image,
    'user'  => $updatedUser
]);
