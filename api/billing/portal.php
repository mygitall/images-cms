<?php
require_once __DIR__ . '/../_lib/helpers.php';
cors_headers();
json_out(['ok' => false, 'error' => 'BILLING_NOT_CONFIGURED'], 503);
