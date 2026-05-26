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

$stmt = $pdo->prepare(
    'SELECT id, filename, prompt, model, aspect, resolution, created_at FROM gen_images WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50'
);
$stmt->execute([$uid]);
$rows = $stmt->fetchAll();

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
    'total'   => count($history)
]);
