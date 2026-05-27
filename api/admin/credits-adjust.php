<?php
require_once __DIR__ . '/../_lib/helpers.php';
require_once __DIR__ . '/../../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();
cors_headers();

$user = $_SESSION['user'] ?? null;
if (!$user || ($user['role'] ?? '') !== 'admin') {
    json_out(['ok' => false, 'error' => 'FORBIDDEN'], 403);
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$targetUserId = (int)($input['userId'] ?? 0);
$amount = (float)($input['amount'] ?? 0);
$reason = trim($input['reason'] ?? '');

if ($targetUserId <= 0 || $amount == 0) {
    json_out(['ok' => false, 'error' => 'INVALID_PARAMS'], 400);
}

try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT balance FROM users WHERE id = ? FOR UPDATE');
    $stmt->execute([$targetUserId]);
    $row = $stmt->fetch();
    if (!$row) { $pdo->rollBack(); json_out(['ok' => false, 'error' => 'USER_NOT_FOUND'], 404); }

    $newBalance = max(0, (float)$row['balance'] + $amount);
    $pdo->prepare('UPDATE users SET balance = ? WHERE id = ?')->execute([$newBalance, $targetUserId]);
    $pdo->prepare('INSERT INTO balance_logs (user_id, amount, type, reason, balance_after) VALUES (?, ?, ?, ?, ?)')
        ->execute([$targetUserId, $amount, 'adjustment', $reason ?: '管理员调整', $newBalance]);
    $pdo->commit();
    json_out(['ok' => true, 'newBalance' => $newBalance]);
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_out(['ok' => false, 'error' => $e->getMessage()], 500);
}
