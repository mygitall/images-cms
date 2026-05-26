<?php
/**
 * Auth API — 与 images20 共用同一个 MySQL 用户表
 * 登录 / 注册 / 登出 / 当前用户
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

$action = $_GET['action'] ?? '';

// ---- 频率限制 ----
if (in_array($action, ['login', 'register'])) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $cacheFile = sys_get_temp_dir() . '/rate_gpt_' . md5($ip . $action);
    $now = time();
    $attempts = @json_decode(@file_get_contents($cacheFile), true) ?: ['ts' => 0, 'count' => 0];
    if ($now - $attempts['ts'] < 30 && $attempts['count'] >= 5) {
        http_response_code(429);
        die(json_encode(['error' => '操作太频繁，请30秒后再试'], JSON_UNESCAPED_UNICODE));
    }
    if ($now - $attempts['ts'] >= 30) { $attempts = ['ts' => $now, 'count' => 1]; }
    else { $attempts['count']++; }
    @file_put_contents($cacheFile, json_encode($attempts));
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function jsonOut($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ========== 注册 ==========
if ($action === 'register') {
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';

    if (strlen($username) < 2 || strlen($username) > 50) jsonOut(['error' => '用户名 2-50 位'], 400);
    if (strlen($password) < 4) jsonOut(['error' => '密码至少 4 位'], 400);

    // 检查是否禁止注册
    $config = @(require __DIR__ . '/../images20/config.php');
    $features = $config['features'] ?? [];
    if (!empty($features['disable_register'])) {
        jsonOut(['error' => '暂不开放注册'], 403);
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
    $stmt->execute([$username]);
    if ($stmt->fetch()) jsonOut(['error' => '用户名已存在'], 409);

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $pdo->prepare('INSERT INTO users (username, password) VALUES (?, ?)')->execute([$username, $hash]);

    $_SESSION['user'] = ['id' => (int)$pdo->lastInsertId(), 'username' => $username, 'role' => 'user'];
    jsonOut(buildUserResponse($_SESSION['user']));
}

// ========== 登录 ==========
if ($action === 'login') {
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';

    $stmt = $pdo->prepare('SELECT * FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user) jsonOut(['error' => '用户名不存在: ' . $username], 401);
    if (!password_verify($password, $user['password'])) jsonOut(['error' => '密码错误'], 401);

    $_SESSION['user'] = ['id' => (int)$user['id'], 'username' => $user['username'], 'role' => $user['role'] ?? 'user'];
    jsonOut(buildUserResponse($_SESSION['user']));
}

// ========== 登出 ==========
if ($action === 'logout') {
    unset($_SESSION['user']);
    session_destroy();
    jsonOut(['ok' => true]);
}

// ========== 当前用户（/api/me 兼容） ==========
// 支持两种调用方式：?action=me 或 /api/me.php 独立文件
if ($action === 'me' || $action === '') {
    $user = $_SESSION['user'] ?? null;
    if (!$user) jsonOut(['ok' => true, 'user' => null]);
    jsonOut(['ok' => true, 'user' => buildUserResponse($user)]);
}

jsonOut(['error' => '未知 action: ' . $action], 400);

// ========== 构建用户响应（与 GPT-Image2 前端格式一致） ==========
function buildUserResponse($user) {
    global $pdo;
    $uid = (int)$user['id'];

    // 读取完整用户数据
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$uid]);
    $row = $stmt->fetch();

    $balance = floatval($row['balance'] ?? 0);
    $freeUsed = intval($row['free_used'] ?? 0);
    $isSuperAdmin = ($row['role'] ?? '') === 'admin';

    // 统计生图使用量（从 gen_images 表）
    $totalGenerations = 0;
    $totalGenerationCredits = 0;
    try {
        $stmt2 = $pdo->prepare('SELECT COUNT(*) FROM gen_images WHERE user_id = ?');
        $stmt2->execute([$uid]);
        $totalGenerations = (int)$stmt2->fetchColumn();

        $stmt3 = $pdo->prepare("SELECT COALESCE(SUM(ABS(amount)), 0) FROM balance_logs WHERE user_id = ? AND type = 'deduct'");
        $stmt3->execute([$uid]);
        $totalGenerationCredits = floatval($stmt3->fetchColumn());
    } catch (\Throwable $e) {}

    // 最近生图记录
    $recentTransactions = [];
    try {
        $stmt4 = $pdo->prepare("SELECT id, amount, type, reason, created_at FROM balance_logs WHERE user_id = ? AND type = 'generation' ORDER BY created_at DESC LIMIT 20");
        $stmt4->execute([$uid]);
        $recentTransactions = array_map(function ($t) {
            return [
                'id' => (int)$t['id'],
                'amount' => floatval($t['amount']),
                'type' => $t['type'],
                'source' => $t['reason'] ?? '',
                'metadata' => [],
                'caseId' => null,
                'createdAt' => $t['created_at']
            ];
        }, $stmt4->fetchAll());
    } catch (\Throwable $e) {}

    return [
        'id' => $uid,
        'email' => $row['username'] ?? '',
        'fullName' => $row['username'] ?? '',
        'avatarUrl' => '',
        'creditBalance' => $balance,
        'freeUsed' => (bool)$freeUsed,
        'isSuperAdmin' => $isSuperAdmin,
        'role' => $row['role'] ?? 'user',
        'membership' => [
            'isActive' => false,
            'planId' => '',
            'status' => 'inactive',
            'currentPeriodEnd' => null
        ],
        'usage' => [
            'totalGenerations' => $totalGenerations,
            'totalGenerationCredits' => $totalGenerationCredits,
            'purchasedCredits' => 0
        ],
        'recentTransactions' => $recentTransactions
    ];
}
