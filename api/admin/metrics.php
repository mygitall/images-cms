<?php
/**
 * Admin Metrics API — 数据看板（仅管理员）
 * 完全打通 images20：gen_images + api_logs + balance_logs
 */

require_once __DIR__ . '/../_lib/helpers.php';
require_once __DIR__ . '/../../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

cors_headers();

$user = $_SESSION['user'] ?? null;
if (!$user || ($user['role'] ?? '') !== 'admin') {
    json_out(['ok' => false, 'error' => 'FORBIDDEN', 'loginRequired' => true], 403);
}

$range = $_GET['range'] ?? '7d';
$now = new DateTime();

switch ($range) {
    case 'today':  $startDate = (clone $now)->modify('-1 day'); break;
    case '7d':     $startDate = (clone $now)->modify('-7 days'); break;
    case '30d':    $startDate = (clone $now)->modify('-30 days'); break;
    case '90d':    $startDate = (clone $now)->modify('-90 days'); break;
    case 'custom':
        $customStart = $_GET['start'] ?? date('Y-m-d', strtotime('-30 days'));
        $customEnd   = $_GET['end'] ?? date('Y-m-d');
        $startDate = new DateTime($customStart);
        $endDate   = new DateTime($customEnd);
        break;
    default: $startDate = (clone $now)->modify('-7 days'); break;
}

if ($range === 'custom') {
    $startStr = $startDate->format('Y-m-d');
    $endStr = $endDate->format('Y-m-d');
} else {
    $endDate = $now;
    $startStr = $startDate->format('Y-m-d');
    $endStr = $endDate->format('Y-m-d');
}

$endStrFull = $endStr . ' 23:59:59';

// ---- 总量 ----
$totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
$stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at <= ?");
$stmt->execute([$startStr, $endStrFull]);
$rangeNewUsers = (int)$stmt->fetchColumn();

$totalGenImages = (int)$pdo->query("SELECT COUNT(*) FROM gen_images")->fetchColumn();
$stmt = $pdo->prepare("SELECT COUNT(*) FROM gen_images WHERE created_at >= ? AND created_at <= ?");
$stmt->execute([$startStr, $endStrFull]);
$rangeGenImages = (int)$stmt->fetchColumn();

// API 调用（images20 核心数据）
$totalApiCalls = (int)$pdo->query("SELECT COUNT(*) FROM api_logs")->fetchColumn();
$stmt = $pdo->prepare("SELECT COUNT(*) FROM api_logs WHERE created_at >= ? AND created_at <= ?");
$stmt->execute([$startStr, $endStrFull]);
$rangeApiCalls = (int)$stmt->fetchColumn();
$succeededApiCalls = (int)$pdo->query("SELECT COUNT(*) FROM api_logs WHERE status = 'success'")->fetchColumn();
$failedApiCalls = (int)$pdo->query("SELECT COUNT(*) FROM api_logs WHERE status = 'error'")->fetchColumn();
$stmt = $pdo->prepare("SELECT COUNT(*) FROM api_logs WHERE status = 'success' AND created_at >= ? AND created_at <= ?");
$stmt->execute([$startStr, $endStrFull]);
$rangeSucceededApi = (int)$stmt->fetchColumn();

// 积分
$totalCreditsConsumed = (float)$pdo->query("SELECT COALESCE(SUM(ABS(amount)),0) FROM balance_logs WHERE type = 'deduct'")->fetchColumn();
$stmt = $pdo->prepare("SELECT COALESCE(SUM(ABS(amount)),0) FROM balance_logs WHERE type = 'deduct' AND created_at >= ? AND created_at <= ?");
$stmt->execute([$startStr, $endStrFull]);
$rangeCreditsConsumed = (float)$stmt->fetchColumn();
$totalCreditBalance = (float)$pdo->query("SELECT COALESCE(SUM(balance),0) FROM users")->fetchColumn();
$totalPurchasedCredits = (float)$pdo->query("SELECT COALESCE(SUM(amount),0) FROM balance_logs WHERE amount > 0")->fetchColumn();

// ---- 每日趋势（同时统计 gen_images + api_logs + 注册） ----
$daily = [];
$period = new DatePeriod($startDate, new DateInterval('P1D'), (clone $endDate)->modify('+1 day'));
foreach ($period as $date) {
    $d = $date->format('Y-m-d');
    $genStmt = $pdo->prepare("SELECT COUNT(*) FROM gen_images WHERE DATE(created_at) = ?");
    $genStmt->execute([$d]);
    $apiStmt = $pdo->prepare("SELECT COUNT(*) FROM api_logs WHERE DATE(created_at) = ?");
    $apiStmt->execute([$d]);
    $regStmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE DATE(created_at) = ?");
    $regStmt->execute([$d]);
    $credStmt = $pdo->prepare("SELECT COALESCE(SUM(ABS(amount)),0) FROM balance_logs WHERE type = 'deduct' AND DATE(created_at) = ?");
    $credStmt->execute([$d]);
    $daily[] = [
        'date' => $d,
        'generations'     => (int)$genStmt->fetchColumn(),
        'apiCalls'        => (int)$apiStmt->fetchColumn(),
        'registrations'   => (int)$regStmt->fetchColumn(),
        'creditsConsumed' => (float)$credStmt->fetchColumn()
    ];
}

json_out([
    'ok' => true,
    'range' => ['startDate' => $startStr, 'endDate' => $endStr],
    'traffic' => [
        'configured' => false,
        'error' => false,
        'totals' => [],
        'daily' => [],
        'topPages' => [],
        'channels' => [],
        'countries' => []
    ],
    'business' => [
        'totals' => [
            'registeredUsers'       => $totalUsers,
            'totalUsers'            => $totalUsers,
            'activeMemberships'     => 0,
            'activeMembers'         => 0,
            'totalGenerations'      => $totalGenImages,
            'succeededGenerations'  => $totalGenImages,
            'failedGenerations'     => 0,
            'pendingGenerations'    => 0,
            'totalApiCalls'         => $totalApiCalls,
            'succeededApiCalls'     => $succeededApiCalls,
            'failedApiCalls'        => $failedApiCalls,
            'totalCreditsConsumed'  => $totalCreditsConsumed,
            'totalCreditBalance'    => $totalCreditBalance,
            'purchasedCredits'      => $totalPurchasedCredits,
            'membershipCredits'     => 0,
            'totalGenerationCredits'=> $totalCreditsConsumed
        ],
        'range' => [
            'newRegistrations'          => $rangeNewUsers,
            'rangeUsers'                => $rangeNewUsers,
            'newMembers'                => 0,
            'rangeMemberships'          => 0,
            'generations'               => $rangeGenImages,
            'rangeGenerations'          => $rangeGenImages,
            'apiCalls'                  => $rangeApiCalls,
            'rangeApiCalls'             => $rangeApiCalls,
            'succeededApiCalls'         => $rangeSucceededApi,
            'rangeSucceededApiCalls'    => $rangeSucceededApi,
            'succeededGenerations'      => $rangeGenImages,
            'rangeSucceededGenerations' => $rangeGenImages,
            'creditsConsumed'           => $rangeCreditsConsumed,
            'rangeGenerationCredits'    => $rangeCreditsConsumed
        ],
        'daily' => $daily
    ]
]);
