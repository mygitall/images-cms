<?php
/**
 * Billing Plans API — MAMP 静态模式（无 Stripe）
 * 返回空计划列表，让前端显示「支付未配置」
 */

require_once __DIR__ . '/../_lib/helpers.php';
require_once __DIR__ . '/../../images20/db.php';
if (session_status() === PHP_SESSION_NONE) session_start();

json_out([
    'ok' => true,
    'plans' => [],
    'packs' => [],
    'checkoutAvailable' => false
]);
