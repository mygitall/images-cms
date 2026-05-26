<?php
/**
 * Billing Plans API — MAMP 静态模式（无 Stripe）
 * 返回空计划列表，让前端显示「支付未配置」
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/../../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

header('Content-Type: application/json; charset=utf-8');

echo json_encode([
    'ok' => true,
    'plans' => [],
    'packs' => [],
    'checkoutAvailable' => false
], JSON_UNESCAPED_UNICODE);
