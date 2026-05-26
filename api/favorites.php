<?php
/**
 * Favorites API — 用户案例收藏
 * GET    /api/favorites        → 获取收藏列表
 * POST   /api/favorites        → 添加收藏  { caseId }
 * DELETE /api/favorites?caseId= → 取消收藏
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function jsonOut($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$user = $_SESSION['user'] ?? null;
if (!$user) {
    jsonOut(['ok' => false, 'error' => 'AUTH_REQUIRED', 'loginRequired' => true], 401);
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

    jsonOut([
        'ok' => true,
        'favorites' => $favorites,
        'caseIds' => array_column($favorites, 'caseId')
    ]);
}

// ========== POST — 添加收藏 ==========
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $caseId = (int)($input['caseId'] ?? $input['case_id'] ?? 0);

    if ($caseId <= 0) jsonOut(['ok' => false, 'error' => 'INVALID_CASE'], 400);

    // upsert（重复添加不报错）
    $pdo->prepare(
        'INSERT INTO case_favorites (user_id, case_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE created_at = NOW()'
    )->execute([$uid, $caseId]);

    $id = (int)$pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT id, case_id, created_at FROM case_favorites WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    jsonOut([
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

    if ($caseId <= 0) jsonOut(['ok' => false, 'error' => 'INVALID_CASE'], 400);

    $stmt = $pdo->prepare('DELETE FROM case_favorites WHERE user_id = ? AND case_id = ?');
    $stmt->execute([$uid, $caseId]);

    jsonOut(['ok' => true, 'caseId' => $caseId]);
}

jsonOut(['ok' => false, 'error' => 'METHOD_NOT_ALLOWED'], 405);
