<?php
// ============================================================
//  GPT-Image2 Gallery 安装向导
//  删除 install/install.lock 即可重新安装
// ============================================================

$lockFile = __DIR__ . '/install.lock';
$envFile  = __DIR__ . '/../.env';
$step     = (int)($_POST['step'] ?? $_GET['step'] ?? 1);

// 已安装则提示
if (file_exists($lockFile) && $step < 99) {
    $step = 99;
}

// ---- 处理安装 ----
$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $step === 4) {
    $dbHost = $_POST['db_host'] ?? 'localhost';
    $dbPort = $_POST['db_port'] ?? '3306';
    $dbName = $_POST['db_name'] ?? '';
    $dbUser = $_POST['db_user'] ?? '';
    $dbPass = $_POST['db_pass'] ?? '';
    $apiKey = $_POST['api_key'] ?? '';
    $apiUrl = $_POST['api_url'] ?? 'https://api.tokln.com/';
    $appUrl = $_POST['app_url'] ?? '';
    $adminUser = trim($_POST['admin_user'] ?? '');
    $adminPass = $_POST['admin_pass'] ?? '';

    if (!$dbName || !$dbUser || !$apiKey || !$adminUser || !$adminPass) {
        $error = '请填写所有必填字段';
    } elseif ($apiKey === 'sk-your-api-key-here' || strlen($apiKey) < 10) {
        $error = '请填写有效的 API Key（不以 sk- 开头或不合法）';
    } elseif (strlen($adminPass) < 4) {
        $error = '管理员密码至少4位';
    } else {
        try {
            // 1. 测试数据库连接
            $pdo = new PDO(
                "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4",
                $dbUser, $dbPass,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );

            // 2. 写入 .env
            $env = "# GPT-Image2 Gallery 配置\n";
            $env .= "DB_HOST={$dbHost}\nDB_PORT={$dbPort}\nDB_NAME={$dbName}\n";
            $env .= "DB_USER={$dbUser}\nDB_PASS={$dbPass}\n\n";
            $env .= "API_KEY={$apiKey}\nAPI_BASE_URL={$apiUrl}\n\n";
            $env .= "APP_URL={$appUrl}\n";
            file_put_contents($envFile, $env);

            // 3. 创建数据表
            $pdo->exec("
              CREATE TABLE IF NOT EXISTS `users` (
                `id` INT AUTO_INCREMENT PRIMARY KEY, `username` VARCHAR(50) NOT NULL UNIQUE,
                `password` VARCHAR(255) NOT NULL, `role` VARCHAR(10) DEFAULT 'user',
                `balance` DECIMAL(10,2) DEFAULT 0.00, `free_used` TINYINT(1) DEFAULT 0,
                `notes` VARCHAR(500) DEFAULT '', `daily_limit` INT DEFAULT 0,
                `total_limit` INT DEFAULT 0, `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            $pdo->exec("
              CREATE TABLE IF NOT EXISTS `gen_images` (
                `id` INT AUTO_INCREMENT PRIMARY KEY, `user_id` INT NOT NULL,
                `filename` VARCHAR(255) DEFAULT '', `prompt` TEXT, `model` VARCHAR(50) DEFAULT '',
                `aspect` VARCHAR(20) DEFAULT '', `resolution` VARCHAR(20) DEFAULT '',
                `deleted_at` DATETIME DEFAULT NULL, `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX `idx_guser` (`user_id`)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            $pdo->exec("
              CREATE TABLE IF NOT EXISTS `api_logs` (
                `id` INT AUTO_INCREMENT PRIMARY KEY, `user_id` INT, `endpoint` VARCHAR(100) DEFAULT '',
                `method` VARCHAR(10) DEFAULT '', `status` VARCHAR(10) DEFAULT '',
                `http_code` INT DEFAULT 0, `duration_ms` INT DEFAULT 0, `error_msg` TEXT,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            $pdo->exec("
              CREATE TABLE IF NOT EXISTS `login_logs` (
                `id` INT AUTO_INCREMENT PRIMARY KEY, `user_id` INT, `ip` VARCHAR(45) DEFAULT '',
                `success` TINYINT(1) DEFAULT 0, `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            $pdo->exec("
              CREATE TABLE IF NOT EXISTS `balance_logs` (
                `id` INT AUTO_INCREMENT PRIMARY KEY, `user_id` INT NOT NULL,
                `amount` DECIMAL(10,2) NOT NULL, `type` VARCHAR(20) DEFAULT 'deduct',
                `reason` VARCHAR(255) DEFAULT '', `balance_after` DECIMAL(10,2) DEFAULT 0,
                `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX `idx_user` (`user_id`)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            $pdo->exec("
              CREATE TABLE IF NOT EXISTS `case_favorites` (
                `id` INT AUTO_INCREMENT PRIMARY KEY, `user_id` INT NOT NULL,
                `case_id` INT NOT NULL, `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY `uk_user_case` (`user_id`, `case_id`)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            $pdo->exec("
              CREATE TABLE IF NOT EXISTS `page_visits` (
                `id` INT AUTO_INCREMENT PRIMARY KEY, `page` VARCHAR(50) DEFAULT 'index',
                `ip` VARCHAR(45) DEFAULT '', `visit_date` DATE NOT NULL,
                `visit_count` INT DEFAULT 1, `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY `uk_page_date_ip` (`page`, `visit_date`, `ip`)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            $pdo->exec("
              CREATE TABLE IF NOT EXISTS admin_audit (
                id INT AUTO_INCREMENT PRIMARY KEY, admin_id INT,
                action VARCHAR(50), target_type VARCHAR(30), target_id INT,
                detail TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");

            // 4. 创建管理员
            $hash = password_hash($adminPass, PASSWORD_BCRYPT);
            $pdo->prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
                ->execute([$adminUser, $hash, 'admin']);

            // 5. 写入安装锁
            file_put_contents($lockFile, date('Y-m-d H:i:s'));

            $success = '安装成功！';
            $step = 99;
        } catch (\Throwable $e) {
            $error = $e->getMessage();
        }
    }
}

// ---- 环境检测 ----
$checks = [
    'PHP 版本' => ['ok' => version_compare(PHP_VERSION, '8.0', '>='), 'val' => PHP_VERSION],
    'PDO MySQL' => ['ok' => extension_loaded('pdo_mysql'), 'val' => extension_loaded('pdo_mysql') ? '已安装' : '未安装'],
    'CURL'     => ['ok' => extension_loaded('curl'), 'val' => extension_loaded('curl') ? '已安装' : '未安装'],
    'MBstring' => ['ok' => extension_loaded('mbstring'), 'val' => extension_loaded('mbstring') ? '已安装' : '未安装'],
    'JSON'     => ['ok' => extension_loaded('json'), 'val' => extension_loaded('json') ? '已安装' : '未安装'],
    'OpenSSL'  => ['ok' => extension_loaded('openssl'), 'val' => extension_loaded('openssl') ? '已安装' : '未安装'],
];

// 目录可写检测
$uploadsDir = __DIR__ . '/../uploads';
$envWritable = is_writable(__DIR__ . '/..') || !file_exists($envFile) || is_writable($envFile);
$uploadsWritable = is_dir($uploadsDir) ? is_writable($uploadsDir) : is_writable(__DIR__ . '/..');
?><!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GPT-Image2 Gallery — 安装向导</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#060914; color:#eef5ff; font:14px/1.6 Inter,system-ui,sans-serif; min-height:100vh; display:grid; place-items:center; padding:24px; }
.wizard { width:min(600px,100%); background:rgba(9,15,32,0.88); border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:32px; box-shadow:0 24px 80px rgba(0,0,0,0.4); }
.wizard h1 { font-size:24px; margin-bottom:4px; }
.wizard h1 span { color:#42e6ff; }
.wizard .sub { color:#8899aa; margin-bottom:24px; }
.steps { display:flex; gap:8px; margin-bottom:24px; }
.step-dot { flex:1; height:4px; border-radius:2px; background:rgba(255,255,255,0.1); }
.step-dot.on { background:#42e6ff; }
.step-dot.done { background:#78ffb9; }
label { display:block; margin-bottom:14px; }
label span { display:block; color:#8899aa; font-size:12px; font-weight:700; text-transform:uppercase; margin-bottom:4px; }
input { width:100%; height:42px; border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:0 12px; background:rgba(3,7,15,0.7); color:#fff; font:inherit; outline:none; }
input:focus { border-color:rgba(66,230,255,0.5); }
.row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.btn { display:inline-flex; align-items:center; justify-content:center; width:100%; height:46px; border:1px solid rgba(120,255,185,0.34); border-radius:8px; background:rgba(120,255,185,0.1); color:#d8ffe4; font-weight:800; font-size:15px; cursor:pointer; margin-top:8px; }
.btn:hover { background:rgba(120,255,185,0.18); }
.msg { margin-top:12px; border-radius:8px; padding:10px 14px; font-weight:700; font-size:13px; }
.msg.error { border:1px solid rgba(255,112,112,0.26); background:rgba(255,112,112,0.08); color:#ffc7c7; }
.msg.success { border:1px solid rgba(120,255,185,0.28); background:rgba(120,255,185,0.08); color:#c8ffb8; }
.chk { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-bottom:16px; }
.chk-item { display:flex; align-items:center; gap:8px; font-size:13px; padding:8px 10px; border-radius:6px; background:rgba(255,255,255,0.03); }
.chk-dot { width:8px; height:8px; border-radius:50%; }
.chk-dot.ok { background:#4ade80; }
.chk-dot.fail { background:#f87171; }
.reinstall { text-align:center; margin-top:16px; }
.reinstall a { color:#f87171; font-size:13px; }
.back-link { display:block; text-align:center; margin-top:20px; }
.back-link a { color:#42e6ff; font-size:13px; text-decoration:none; }
</style>
</head>
<body>
<div class="wizard">
<?php if ($step === 99 && !$success): ?>
  <h1>已安装 <span>GPT-Image2 Gallery</span></h1>
  <p class="sub">安装锁已存在，如需重新安装请删除 <code>install/install.lock</code> 文件</p>
  <div class="reinstall"><a href="../">前往网站首页</a></div>
  <div class="reinstall"><a href="?reset=1" onclick="return confirm('确定要删除安装锁并重新安装吗？')">删除锁并重新安装</a></div>
  <?php if ($_GET['reset'] ?? '') { unlink($lockFile); header('Location: ?step=1'); exit; } ?>

<?php elseif ($step === 99 && $success): ?>
  <h1>安装成功 <span>!</span></h1>
  <p class="sub">GPT-Image2 Gallery 已就绪</p>
  <div class="msg success">数据库已配置，管理员账号已创建，安装锁已写入</div>
  <div class="back-link"><a href="../">→ 进入网站首页</a></div>
  <div class="back-link"><a href="../api/health.php">→ 查看系统状态</a></div>
  <p style="margin-top:20px;color:#8899aa;font-size:12px;text-align:center">
    管理员：<?php echo htmlspecialchars($adminUser ?? ''); ?><br>
    重新安装：删除 <code>install/install.lock</code> 后刷新本页
  </p>

<?php else: ?>

  <h1>安装向导 <span>GPT-Image2</span></h1>
  <p class="sub"><?php echo $step === 3 ? '确认并完成安装' : ($step === 2 ? '填写数据库和 API 配置' : '环境检测'); ?></p>

  <div class="steps">
    <div class="step-dot <?php echo $step >= 1 ? 'done' : ''; ?>"></div>
    <div class="step-dot <?php echo $step >= 2 ? 'done' : ''; ?> <?php echo $step === 2 ? 'on' : ''; ?>"></div>
    <div class="step-dot <?php echo $step >= 3 ? '' : ''; ?> <?php echo $step >= 3 ? 'on' : ''; ?>"></div>
  </div>

  <?php if ($error): ?><div class="msg error"><?php echo htmlspecialchars($error); ?></div><?php endif; ?>

  <?php if ($step === 1): ?>
    <div class="chk">
      <?php foreach ($checks as $label => $check): ?>
      <div class="chk-item">
        <div class="chk-dot <?php echo $check['ok'] ? 'ok' : 'fail'; ?>"></div>
        <?php echo $label; ?> <small style="color:#8899aa"><?php echo $check['val']; ?></small>
      </div>
      <?php endforeach; ?>
      <div class="chk-item">
        <div class="chk-dot <?php echo $envWritable ? 'ok' : 'fail'; ?>"></div>
        目录可写 <small style="color:#8899aa"><?php echo $envWritable ? 'OK' : '不可写'; ?></small>
      </div>
    </div>
    <form method="post">
      <input type="hidden" name="step" value="2">
      <button class="btn" type="submit">下一步：填写配置</button>
    </form>

  <?php elseif ($step === 2): ?>
    <form method="post">
      <input type="hidden" name="step" value="3">
      <label><span>数据库主机</span><input name="db_host" value="localhost"></label>
      <div class="row">
        <label><span>端口</span><input name="db_port" value="3306"></label>
        <label><span>数据库名 *</span><input name="db_name" placeholder="必填" required></label>
      </div>
      <div class="row">
        <label><span>用户名 *</span><input name="db_user" placeholder="必填" required></label>
        <label><span>密码</span><input name="db_pass" type="password"></label>
      </div>
      <button class="btn" type="submit">下一步：账号与 API</button>
    </form>

  <?php elseif ($step === 3): ?>
    <form method="post">
      <input type="hidden" name="step" value="4">
      <input type="hidden" name="db_host" value="<?php echo htmlspecialchars($_POST['db_host']); ?>">
      <input type="hidden" name="db_port" value="<?php echo htmlspecialchars($_POST['db_port']); ?>">
      <input type="hidden" name="db_name" value="<?php echo htmlspecialchars($_POST['db_name']); ?>">
      <input type="hidden" name="db_user" value="<?php echo htmlspecialchars($_POST['db_user']); ?>">
      <input type="hidden" name="db_pass" value="<?php echo htmlspecialchars($_POST['db_pass']); ?>">

      <label><span>API Key *</span><input name="api_key" placeholder="sk-..." required></label>
      <label><span>API 地址</span><input name="api_url" value="https://api.tokln.com/"></label>
      <label><span>网站域名</span><input name="app_url" placeholder="https://你的域名"></label>
      <hr style="border-color:rgba(255,255,255,0.08);margin:16px 0">
      <h2 style="font-size:16px;margin-bottom:12px">管理员账号</h2>
      <div class="row">
        <label><span>用户名 *</span><input name="admin_user" placeholder="必填" required></label>
        <label><span>密码 *（至少4位）</span><input name="admin_pass" type="password" placeholder="必填" required></label>
      </div>
      <button class="btn" type="submit">确认安装</button>
    </form>
  <?php endif; ?>

  <form method="get" style="margin-top:12px;text-align:center">
    <?php if ($step > 1 && $step < 99): ?><button class="btn" style="background:transparent;color:#8899aa" type="submit" name="step" value="<?php echo $step - 1; ?>">← 上一步</button><?php endif; ?>
  </form>

<?php endif; ?>
</div>
</body>
</html>
