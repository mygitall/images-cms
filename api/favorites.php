<?php
/**
 * Favorites API — 用户案例收藏
 * GET    /api/favorites        → 获取收藏列表
 * POST   /api/favorites        → 添加收藏  { caseId }
 * DELETE /api/favorites?caseId= → 取消收藏
 */

require_once __DIR__ . '/_lib/helpers.php';
require_once __DIR__ . '/../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

cors_headers();

$user = $_SESSION['user'] ?? null;
if (!$user) {
    json_out(['ok' => false, 'error' => 'AUTH_REQUIRED', 'loginRequired' => true], 401);
}

$uid = (int)$user['id'];
$method = $_SERVER['REQUEST_METHOD'];

// ========== GET — 获取收藏列表 ==========
if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT id, case_id, created_at FROM case_favorites WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$uid]);
    $rows = $stmt->fetchAll();

    $favorites = array_map(function ($row) {
        return [
            'id' => (int)$row['id'],
            'caseId' => (int)$row['case_id'],
            'createdAt' => $row['created_at']
        ];
    }, $rows);

    json_out([
        'ok' => true,
        'favorites' => $favorites,
        'caseIds' => array_column($favorites, 'caseId')
    ]);
}

// ========== POST — 添加收藏 ==========
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $caseId = (int)($input['caseId'] ?? $input['case_id'] ?? 0);

    if ($caseId <= 0) json_out(['ok' => false, 'error' => 'INVALID_CASE'], 400);

    // upsert（重复添加不报错）
    $pdo->prepare(
        'INSERT INTO case_favorites (user_id, case_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE created_at = NOW()'
    )->execute([$uid, $caseId]);

    $id = (int)$pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT id, case_id, created_at FROM case_favorites WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    json_out([
        'ok' => true,
        'favorite' => [
            'id' => (int)$row['id'],
            'caseId' => (int)$row['case_id'],
            'createdAt' => $row['created_at']
        ]
    ]);
}

// ========== DELETE — 取消收藏 ==========
if ($method === 'DELETE') {
    $caseId = (int)($_GET['caseId'] ?? $_GET['case_id'] ?? 0);

    if ($caseId <= 0) json_out(['ok' => false, 'error' => 'INVALID_CASE'], 400);

    $stmt = $pdo->prepare('DELETE FROM case_favorites WHERE user_id = ? AND case_id = ?');
    $stmt->execute([$uid, $caseId]);

    json_out(['ok' => true, 'caseId' => $caseId]);
}

json_out(['ok' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
