<?php
// /api/me — 与 auth.php?action=me 功能相同，兼容 Vercel 路由格式
$_GET['action'] = 'me';
require __DIR__ . '/auth.php';
