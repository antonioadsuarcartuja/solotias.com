<?php
require_once __DIR__ . "/config.php";
header('Content-Type: application/json; charset=utf-8');

// Endpoint compat: el dualcall se lanza en dualcall_create.php.
// Lo dejamos para no tocar el frontend ahora.
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

$call_request_id = '';
if (is_array($body)) {
  $call_request_id = trim((string)($body['call_request_id'] ?? ''));
}

if ($call_request_id === '') {
  http_response_code(400);
  echo json_encode([
    'ok' => false,
    'error' => 'call_request_id es obligatorio'
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

echo json_encode([
  'ok' => true,
  'note' => 'dualcall already started in dualcall_create.php',
  'call_request_id' => $call_request_id
], JSON_UNESCAPED_UNICODE);
