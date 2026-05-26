<?php
/**
 * Generation History API — 返回当前用户的生图历史
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

echo json_encode([
    'ok'      => true,
    'history' => $history,
    'total'   => count($history)
], JSON_UNESCAPED_UNICODE);
