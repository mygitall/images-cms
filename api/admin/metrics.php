<?php
/**
 * Admin Metrics API — 数据看板（仅管理员）
 * 完全打通 images20：gen_images + api_logs + balance_logs
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
$rangeNewUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE created_at >= '{$startStr}' AND created_at <= '{$endStrFull}'")->fetchColumn();

$totalGenImages = (int)$pdo->query("SELECT COUNT(*) FROM gen_images")->fetchColumn();
$rangeGenImages = (int)$pdo->query("SELECT COUNT(*) FROM gen_images WHERE created_at >= '{$startStr}' AND created_at <= '{$endStrFull}'")->fetchColumn();

// API 调用（images20 核心数据）
$totalApiCalls = (int)$pdo->query("SELECT COUNT(*) FROM api_logs")->fetchColumn();
$rangeApiCalls = (int)$pdo->query("SELECT COUNT(*) FROM api_logs WHERE created_at >= '{$startStr}' AND created_at <= '{$endStrFull}'")->fetchColumn();
$succeededApiCalls = (int)$pdo->query("SELECT COUNT(*) FROM api_logs WHERE status = 'success'")->fetchColumn();
$failedApiCalls = (int)$pdo->query("SELECT COUNT(*) FROM api_logs WHERE status = 'error'")->fetchColumn();
$rangeSucceededApi = (int)$pdo->query("SELECT COUNT(*) FROM api_logs WHERE status = 'success' AND created_at >= '{$startStr}' AND created_at <= '{$endStrFull}'")->fetchColumn();

// 积分
$totalCreditsConsumed = (float)$pdo->query("SELECT COALESCE(SUM(ABS(amount)),0) FROM balance_logs WHERE type = 'deduct'")->fetchColumn();
$rangeCreditsConsumed = (float)$pdo->query("SELECT COALESCE(SUM(ABS(amount)),0) FROM balance_logs WHERE type = 'deduct' AND created_at >= '{$startStr}' AND created_at <= '{$endStrFull}'")->fetchColumn();
$totalCreditBalance = (float)$pdo->query("SELECT COALESCE(SUM(balance),0) FROM users")->fetchColumn();
$totalPurchasedCredits = (float)$pdo->query("SELECT COALESCE(SUM(amount),0) FROM balance_logs WHERE amount > 0")->fetchColumn();

// ---- 每日趋势（同时统计 gen_images + api_logs + 注册） ----
$daily = [];
$period = new DatePeriod($startDate, new DateInterval('P1D'), (clone $endDate)->modify('+1 day'));
foreach ($period as $date) {
    $d = $date->format('Y-m-d');
    $daily[] = [
        'date' => $d,
        'generations'     => (int)$pdo->query("SELECT COUNT(*) FROM gen_images WHERE DATE(created_at) = '{$d}'")->fetchColumn(),
        'apiCalls'        => (int)$pdo->query("SELECT COUNT(*) FROM api_logs WHERE DATE(created_at) = '{$d}'")->fetchColumn(),
        'registrations'   => (int)$pdo->query("SELECT COUNT(*) FROM users WHERE DATE(created_at) = '{$d}'")->fetchColumn(),
        'creditsConsumed' => (float)$pdo->query("SELECT COALESCE(SUM(ABS(amount)),0) FROM balance_logs WHERE type = 'deduct' AND DATE(created_at) = '{$d}'")->fetchColumn()
    ];
}

echo json_encode([
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
], JSON_UNESCAPED_UNICODE);
