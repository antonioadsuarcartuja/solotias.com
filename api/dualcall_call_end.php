<?php
// ===============================
// dualcall_call_end.php
// - Endpoint para Asterisk
// - Acepta POST x-www-form-urlencoded O JSON
// - Llama a ParseCloud: api_solotias_call_end
// - Devuelve "OK" (texto plano)
// ===============================

header('Content-Type: text/plain; charset=utf-8');

$EXPECTED_TOKEN = "7f8a93Kx29LmQp2025SecureNotify";

require_once __DIR__ . '/config.php';

function get_body() {
  $raw = file_get_contents('php://input');
  $json = json_decode($raw, true);
  if (!is_array($json)) $json = [];
  return $json;
}

$body = get_body();

$token = (string)($_POST['token'] ?? $body['token'] ?? '');
if (!hash_equals($EXPECTED_TOKEN, $token)) {
  http_response_code(401);
  echo "ERR_TOKEN";
  exit;
}

$call_id = trim((string)($_POST['call_id'] ?? $body['call_id'] ?? ''));
$timespent = (int)($_POST['timespent'] ?? $body['timespent'] ?? 0);

if ($call_id === '') {
  http_response_code(400);
  echo "ERR_PARAMS";
  exit;
}

if (!defined('PARSE_APP_ID') || !defined('PARSE_REST_KEY') || !defined('PARSE_SERVER_URL')) {
  http_response_code(500);
  echo "ERR_PARSE_CONFIG";
  exit;
}

$cloudUrl = rtrim((string)PARSE_SERVER_URL, '/') . '/api_solotias_call_end';

$payload = json_encode([
  'call_id' => $call_id,
  'timespent' => $timespent,
], JSON_UNESCAPED_UNICODE);

$ch = curl_init($cloudUrl);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 15,
  CURLOPT_CONNECTTIMEOUT => 6,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    'Content-Type: application/json',
    'X-Parse-Application-Id: ' . PARSE_APP_ID,
    'X-Parse-REST-API-Key: ' . PARSE_REST_KEY,
  ],
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_SSL_VERIFYPEER => true,
  CURLOPT_SSL_VERIFYHOST => 2,
]);

$result = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($result === false || $httpCode >= 400) {
  http_response_code(502);
  echo "ERR_CLOUD";
  exit;
}

$data = json_decode($result, true);
$response = $data['result'] ?? $data;

if (!is_array($response) || empty($response['ok'])) {
  http_response_code(502);
  echo "ERR_BAD_RESPONSE";
  exit;
}

echo "OK";
