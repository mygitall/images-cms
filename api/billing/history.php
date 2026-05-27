<?php
require_once __DIR__ . '/../_lib/helpers.php';
cors_headers();
json_out(['ok' => true, 'transactions' => []]);
