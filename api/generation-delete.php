<?php
/**
 * Soft-delete a generation record
 * POST /api/generation-delete  { id: 123 }
 */

require_once __DIR__ . '/_lib/helpers.php';
require_once __DIR__ . '/../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

cors_headers();

$user = $_SESSION['user'] ?? null;
if (!$user) {
    json_out(['ok' => false, 'error' => 'AUTH_REQUIRED'], 401);
}

$uid = (int)$user['id'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$recordId = (int)($input['id'] ?? 0);

if ($recordId <= 0) {
    json_out(['ok' => false, 'error' => 'INVALID_ID'], 400);
}

// 只能删除自己的记录
$stmt = $pdo->prepare('UPDATE gen_images SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL');
$stmt->execute([$recordId, $uid]);

if ($stmt->rowCount() > 0) {
    json_out(['ok' => true]);
} else {
    json_out(['ok' => false, 'error' => '记录不存在或已删除'], 404);
}
