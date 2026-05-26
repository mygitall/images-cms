<?php
/**
 * Admin Users API — 用户列表（仅管理员）
 * 完全打通 images20：共用 users / gen_images / balance_logs / api_logs / login_logs 表
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

header('Content-Type: application/json; charset=utf-8');

$user = $_SESSION['user'] ?? null;
if (!$user || ($user['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'FORBIDDEN', 'loginRequired' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

// 一次性查所有用户，避免循环 N+1 查询
$users = $pdo->query('SELECT id, username, role, balance, daily_limit, total_limit, created_at FROM users ORDER BY id DESC')->fetchAll();

// 批量取统计数据
$userIds = array_column($users, 'id');
if (empty($userIds)) { echo json_encode(['ok' => true, 'users' => []]); exit; }

$idList = implode(',', array_map('intval', $userIds));

// 生图量（gen_images）
$genCounts = [];
$genQuery = $pdo->query("SELECT user_id, COUNT(*) AS cnt FROM gen_images WHERE user_id IN ({$idList}) GROUP BY user_id");
foreach ($genQuery as $r) { $genCounts[(int)$r['user_id']] = (int)$r['cnt']; }

// API 调用量（api_logs — images20 核心数据）
$apiCounts = [];
$apiQuery = $pdo->query("SELECT user_id, COUNT(*) AS cnt FROM api_logs WHERE user_id IN ({$idList}) GROUP BY user_id");
foreach ($apiQuery as $r) { $apiCounts[(int)$r['user_id']] = (int)$r['cnt']; }

// 积分消耗
$spentCredits = [];
$spentQuery = $pdo->query("SELECT user_id, COALESCE(SUM(ABS(amount)),0) AS spent FROM balance_logs WHERE user_id IN ({$idList}) AND type = 'deduct' GROUP BY user_id");
foreach ($spentQuery as $r) { $spentCredits[(int)$r['user_id']] = (float)$r['spent']; }

// 购买/充值积分
$purchased = [];
$purchQuery = $pdo->query("SELECT user_id, COALESCE(SUM(amount),0) AS amt FROM balance_logs WHERE user_id IN ({$idList}) AND type IN ('purchase','topup','grant','membership_grant','adjustment') AND amount > 0 GROUP BY user_id");
foreach ($purchQuery as $r) { $purchased[(int)$r['user_id']] = (float)$r['amt']; }

// 最近生图
$lastGen = [];
$lastQuery = $pdo->query("SELECT user_id, MAX(created_at) AS last FROM balance_logs WHERE user_id IN ({$idList}) AND type = 'generation' GROUP BY user_id");
foreach ($lastQuery as $r) { $lastGen[(int)$r['user_id']] = $r['last']; }

$result = array_map(function ($row) use ($genCounts, $apiCounts, $spentCredits, $purchased, $lastGen) {
    $uid = (int)$row['id'];
    return [
        'id' => $uid,
        'email' => $row['username'],
        'fullName' => $row['username'],
        'avatarUrl' => '',
        'role' => $row['role'] ?? 'user',
        'creditBalance' => (float)$row['balance'],
        'freeUsed' => false,
        'membership' => ['isActive' => false, 'planId' => '', 'status' => 'inactive', 'currentPeriodEnd' => null],
        'usage' => [
            'totalGenerations' => $genCounts[$uid] ?? 0,
            'totalGenerationCredits' => $spentCredits[$uid] ?? 0,
            'purchasedCredits' => $purchased[$uid] ?? 0,
            'apiCalls' => $apiCounts[$uid] ?? 0,
            'lastGenerationCaseId' => null,
            'lastGenerationAt' => $lastGen[$uid] ?? null
        ],
        'dailyLimit' => (int)($row['daily_limit'] ?? 0),
        'totalLimit' => (int)($row['total_limit'] ?? 0),
        'createdAt' => $row['created_at']
    ];
}, $users);

echo json_encode(['ok' => true, 'users' => $result], JSON_UNESCAPED_UNICODE);
