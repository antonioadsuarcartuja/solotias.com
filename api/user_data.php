<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'method_not_allowed']);
  exit;
}

// ✅ OJO: si está en /api, config también en /api
require_once __DIR__ . '/config.php';

if (!defined('PARSE_APP_ID') || !defined('PARSE_REST_KEY') || !defined('PARSE_SERVER_URL')) {
  http_response_code(500);
  echo json_encode(['error' => 'missing_parse_config']);
  exit;
}

// ✅ Validación fuerte (tu caso típico: PARSE_SERVER_URL vacío)
$serverUrl = trim((string)PARSE_SERVER_URL);
if ($serverUrl === '' || !preg_match('#^https?://#i', $serverUrl)) {
  http_response_code(500);
  echo json_encode(['error' => 'invalid_parse_server_url', 'value' => $serverUrl]);
  exit;
}

$raw = file_get_contents('php://input') ?: '';
$payload = json_decode($raw, true);

if (!is_array($payload)) {
  http_response_code(400);
  echo json_encode(['error' => 'invalid_json']);
  exit;
}

$userId = trim((string)($payload['user_llamametu_id'] ?? ''));
if ($userId === '') {
  http_response_code(400);
  echo json_encode(['error' => 'missing_user_llamametu_id']);
  exit;
}

$fnUrl = rtrim($serverUrl, '/') . '/api_user_data';

$header = [
    'X-Parse-Application-Id: ' . PARSE_APP_ID,
    'X-Parse-REST-API-Key: '   . PARSE_REST_KEY,
    'Content-Type: application/json',
  ];

$ch = curl_init($fnUrl);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST           => true,
  CURLOPT_HTTPHEADER     => $header,
  CURLOPT_POSTFIELDS     => json_encode(['user_llamametu_id' => $userId], JSON_UNESCAPED_UNICODE),
  CURLOPT_TIMEOUT        => 20,
  CURLOPT_CONNECTTIMEOUT => 10,
]);

$response = curl_exec($ch);
$errno    = curl_errno($ch);
$error    = curl_error($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false) {
  http_response_code(502);
  echo json_encode([
    'error'   => 'parse_network_error',
    'detail'  => $error,
    'errno'   => $errno,
    'fnUrl'   => $fnUrl,
    'httpCode'=> $httpCode,
  ]);
  exit;
}

$data = json_decode($response, true);
if (!is_array($data)) {
  http_response_code(502);
  echo json_encode([
    'error' => 'parse_invalid_json',
    'raw'   => mb_substr($response, 0, 500),
    'httpCode' => $httpCode,
  ]);
  exit;
}

if (isset($data['error'])) {
  http_response_code(502);
  echo json_encode(['error' => 'parse_error', 'detail' => $data, 'httpCode' => $httpCode,'prueba'=>1]);
  exit;
}

$result = (isset($data['result']) && is_array($data['result'])) ? $data['result'] : $data;

echo json_encode([
  'objectId'       => $result['objectId'] ?? null,
  'virtual_number' => $result['virtual_number'] ?? null,
  'phone'          => $result['phone'] ?? null,
  'coins'          => $result['coins'] ?? null,
], JSON_UNESCAPED_UNICODE);
