<?php
/**
 * Admin Credits Adjust API — 管理员调整用户积分
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

header('Content-Type: application/json; charset=utf-8');

$user = $_SESSION['user'] ?? null;
if (!$user || ($user['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'FORBIDDEN'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'METHOD_NOT_ALLOWED'], JSON_UNESCAPED_UNICODE);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$userId = (int)($input['userId'] ?? 0);
$amount = (float)($input['amount'] ?? 0);
$reason = trim($input['reason'] ?? '');

if ($userId <= 0 || $amount == 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'INVALID_PARAMS'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo->beginTransaction();
try {
    $pdo->prepare('UPDATE users SET balance = balance + ? WHERE id = ?')->execute([$amount, $userId]);
    $newBalance = (float)$pdo->query("SELECT balance FROM users WHERE id = {$userId}")->fetchColumn();

    $type = $amount > 0 ? 'adjustment' : 'deduct';
    $pdo->prepare('INSERT INTO balance_logs (user_id, amount, type, reason, balance_after) VALUES (?, ?, ?, ?, ?)')
        ->execute([$userId, $amount, $type, $reason ?: '管理员调整', $newBalance]);

    $pdo->commit();
    echo json_encode(['ok' => true, 'newBalance' => $newBalance], JSON_UNESCAPED_UNICODE);
} catch (\Throwable $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
