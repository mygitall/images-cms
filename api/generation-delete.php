<?php
/**
 * Soft-delete a generation record
 * POST /api/generation-delete  { id: 123 }
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

header('Content-Type: application/json; charset=utf-8');

$user = $_SESSION['user'] ?? null;
if (!$user) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'AUTH_REQUIRED'], JSON_UNESCAPED_UNICODE);
    exit;
}

$uid = (int)$user['id'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$recordId = (int)($input['id'] ?? 0);

if ($recordId <= 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'INVALID_ID'], JSON_UNESCAPED_UNICODE);
    exit;
}

// 只能删除自己的记录
$stmt = $pdo->prepare('UPDATE gen_images SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL');
$stmt->execute([$recordId, $uid]);

if ($stmt->rowCount() > 0) {
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
} else {
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => '记录不存在或已删除'], JSON_UNESCAPED_UNICODE);
}
