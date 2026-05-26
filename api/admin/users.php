<?php
/**
 * Admin Users API — 用户列表（仅管理员）
 * 完全打通 images20：共用 users / gen_images / balance_logs / api_logs / login_logs 表
 */

require_once __DIR__ . '/../_lib/helpers.php';
require_once __DIR__ . '/../../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

cors_headers();

$user = $_SESSION['user'] ?? null;
if (!$user || ($user['role'] ?? '') !== 'admin') {
    json_out(['ok' => false, 'error' => 'FORBIDDEN', 'loginRequired' => true], 403);
}

// 一次性查所有用户，避免循环 N+1 查询
$users = $pdo->query('SELECT id, username, role, balance, daily_limit, total_limit, created_at FROM users ORDER BY id DESC')->fetchAll();

// 批量取统计数据
$userIds = array_column($users, 'id');
if (empty($userIds)) { json_out(['ok' => true, 'users' => []]); }

$idList = implode(',', array_fill(0, count($userIds), '?'));

// 生图量（gen_images）
$genCounts = [];
$genQuery = $pdo->prepare("SELECT user_id, COUNT(*) AS cnt FROM gen_images WHERE user_id IN ({$idList}) GROUP BY user_id");
$genQuery->execute($userIds);
foreach ($genQuery as $r) { $genCounts[(int)$r['user_id']] = (int)$r['cnt']; }

// API 调用量（api_logs — images20 核心数据）
$apiCounts = [];
$apiQuery = $pdo->prepare("SELECT user_id, COUNT(*) AS cnt FROM api_logs WHERE user_id IN ({$idList}) GROUP BY user_id");
$apiQuery->execute($userIds);
foreach ($apiQuery as $r) { $apiCounts[(int)$r['user_id']] = (int)$r['cnt']; }

// 积分消耗
$spentCredits = [];
$spentQuery = $pdo->prepare("SELECT user_id, COALESCE(SUM(ABS(amount)),0) AS spent FROM balance_logs WHERE user_id IN ({$idList}) AND type = 'deduct' GROUP BY user_id");
$spentQuery->execute($userIds);
foreach ($spentQuery as $r) { $spentCredits[(int)$r['user_id']] = (float)$r['spent']; }

// 购买/充值积分
$purchased = [];
$purchQuery = $pdo->prepare("SELECT user_id, COALESCE(SUM(amount),0) AS amt FROM balance_logs WHERE user_id IN ({$idList}) AND type IN ('purchase','topup','grant','membership_grant','adjustment') AND amount > 0 GROUP BY user_id");
$purchQuery->execute($userIds);
foreach ($purchQuery as $r) { $purchased[(int)$r['user_id']] = (float)$r['amt']; }

// 最近生图
$lastGen = [];
$lastQuery = $pdo->prepare("SELECT user_id, MAX(created_at) AS last FROM balance_logs WHERE user_id IN ({$idList}) AND type = 'generation' GROUP BY user_id");
$lastQuery->execute($userIds);
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

json_out(['ok' => true, 'users' => $result]);
