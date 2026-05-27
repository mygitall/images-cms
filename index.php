<?php
// 入口检测：未安装时跳转到安装向导
if (!file_exists(__DIR__ . '/install/install.lock')) {
    header('Location: /install/');
    exit;
}
// 已安装，输出前端 SPA
readfile(__DIR__ . '/dist/index.html');
