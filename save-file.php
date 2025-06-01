<?php
/**
 * 保存文件PHP脚本
 * 
 * 用于保存数据到服务器文件系统
 * 接收POST请求，包含data和filename参数
 */

// 设置错误报告
ini_set('display_errors', 1);
error_reporting(E_ALL);

// 设置响应头为JSON
header('Content-Type: application/json');

// 允许跨域请求
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

// 处理OPTIONS请求（预检请求）
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 记录请求信息到日志
$logFile = 'save-file-log.txt';
file_put_contents($logFile, date('Y-m-d H:i:s') . " - 收到请求: " . $_SERVER['REQUEST_METHOD'] . "\n", FILE_APPEND);

// 检查请求方法
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    file_put_contents($logFile, date('Y-m-d H:i:s') . " - 错误: 不支持的请求方法 " . $_SERVER['REQUEST_METHOD'] . "\n", FILE_APPEND);
    echo json_encode([
        'success' => false,
        'message' => '只支持POST请求'
    ]);
    exit;
}

// 记录POST数据
file_put_contents($logFile, date('Y-m-d H:i:s') . " - POST数据: " . print_r($_POST, true) . "\n", FILE_APPEND);

// 检查必要参数
if (!isset($_POST['data']) || !isset($_POST['filename'])) {
    file_put_contents($logFile, date('Y-m-d H:i:s') . " - 错误: 缺少必要参数\n", FILE_APPEND);
    echo json_encode([
        'success' => false,
        'message' => '缺少必要参数'
    ]);
    exit;
}

// 获取参数
$data = $_POST['data'];
$filename = $_POST['filename'];

// 记录参数
file_put_contents($logFile, date('Y-m-d H:i:s') . " - 文件名: $filename\n", FILE_APPEND);

// 安全检查：确保文件名不包含危险路径
$filename = str_replace('..', '', $filename);
$filename = ltrim($filename, '/');

// 确保目标目录存在
$dir = dirname($filename);
if (!file_exists($dir)) {
    if (!mkdir($dir, 0777, true)) {
        file_put_contents($logFile, date('Y-m-d H:i:s') . " - 错误: 无法创建目录 $dir\n", FILE_APPEND);
        echo json_encode([
            'success' => false,
            'message' => "无法创建目录: $dir"
        ]);
        exit;
    }
}

// 写入文件
if (file_put_contents($filename, $data) !== false) {
    file_put_contents($logFile, date('Y-m-d H:i:s') . " - 成功: 文件已保存到 $filename\n", FILE_APPEND);
    echo json_encode([
        'success' => true,
        'message' => '文件保存成功',
        'filepath' => $filename
    ]);
} else {
    file_put_contents($logFile, date('Y-m-d H:i:s') . " - 错误: 文件写入失败 $filename\n", FILE_APPEND);
    echo json_encode([
        'success' => false,
        'message' => '文件写入失败'
    ]);
}
?> 