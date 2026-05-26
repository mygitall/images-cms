<?php
/**
 * Admin Credits Adjust API — 管理员调整用户积分
 */

require_once __DIR__ . '/../_lib/helpers.php';
require_once __DIR__ . '/../../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

cors_headers();

$user = $_SESSION['user'] ?? null;
if (!$user || ($user['role'] ?? '') !== 'admin') {
    json_out(['ok' => false, 'error' => 'FORBIDDEN'], 403);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['ok' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$userId = (int)($input['userId'] ?? 0);
$amount = (float)($input['amount'] ?? 0);
$reason = trim($input['reason'] ?? '');

if ($userId <= 0 || $amount == 0) {
    json_out(['ok' => false, 'error' => 'INVALID_PARAMS'], 400);
}

$pdo->beginTransaction();
try {
    $pdo->prepare('UPDATE users SET balance = balance + ? WHERE id = ?')->execute([$amount, $userId]);
    $stmt = $pdo->prepare("SELECT balance FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $newBalance = (float)$stmt->fetchColumn();

    $type = $amount > 0 ? 'adjustment' : 'deduct';
    $pdo->prepare('INSERT INTO balance_logs (user_id, amount, type, reason, balance_after) VALUES (?, ?, ?, ?, ?)')
        ->execute([$userId, $amount, $type, $reason ?: '管理员调整', $newBalance]);

    $pdo->commit();
    json_out(['ok' => true, 'newBalance' => $newBalance]);
} catch (\Throwable $e) {
    $pdo->rollBack();
    json_out(['ok' => false, 'error' => $e->getMessage()], 500);
}
