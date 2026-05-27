<?php
/**
 * Generation History API — 返回当前用户的生图历史
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
$offset = max(0, (int)($_GET['offset'] ?? 0));
$limit = 20;

// 查询真实总数
$totalStmt = $pdo->prepare('SELECT COUNT(*) FROM gen_images WHERE user_id = ? AND deleted_at IS NULL');
$totalStmt->execute([$uid]);
$totalCount = (int)$totalStmt->fetchColumn();

$stmt = $pdo->prepare(
    'SELECT id, filename, prompt, model, aspect, resolution, created_at FROM gen_images WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?'
);
$stmt->bindValue(1, $uid, PDO::PARAM_INT);
$stmt->bindValue(2, $limit + 1, PDO::PARAM_INT);
$stmt->bindValue(3, $offset, PDO::PARAM_INT);
$stmt->execute();
$rows = $stmt->fetchAll();

$hasMore = count($rows) > $limit;
if ($hasMore) array_pop($rows);

$username = $user['username'];

$history = array_map(function ($row) use ($username) {
    $imageUrl = '';
    $imagePath = __DIR__ . '/../uploads/' . $username . '/' . $row['filename'];
    if (file_exists($imagePath)) {
        $imageUrl = '/uploads/' . $username . '/' . $row['filename'];
    }

    return [
        'id'        => (int)$row['id'],
        'imageUrl'  => $imageUrl,
        'prompt'    => mb_substr($row['prompt'], 0, 120) . (mb_strlen($row['prompt']) > 120 ? '...' : ''),
        'fullPrompt'=> $row['prompt'],
        'model'     => $row['model'],
        'aspect'    => $row['aspect'],
        'resolution'=> $row['resolution'],
        'createdAt' => $row['created_at']
    ];
}, $rows);

json_out([
    'ok'      => true,
    'history' => $history,
    'total'   => $totalCount,
    'hasMore' => $hasMore
]);
