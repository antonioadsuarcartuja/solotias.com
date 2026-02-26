<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';



$raw = file_get_contents('php://input');
$body = json_decode($raw, true) ?: [];

// ✅ NUEVO: el user id se lee SIEMPRE desde sesión (server-side), no desde JS/body
$user_llamametu_id = (isset($_SESSION['user_llamametu_id']) ? trim((string)$_SESSION['user_llamametu_id']) : ($body['user_llamametu_id']??''));

$channel = (string)($body['channel'] ?? '');
$caller_uid = (int)($body['caller_uid'] ?? 0);
$event_at_iso = (string)($body['event_at_iso'] ?? '');
$event_at_ms  = (int)($body['event_at_ms'] ?? 0);
$leave_reason = (string)($body['leave_reason'] ?? ''); // opcional: "manual" | "remote_left" | "unload"



if ($channel === '' || $caller_uid <= 0) {
  http_response_code(400);
  echo json_encode(['error' => 'channel y caller_uid son obligatorios'], JSON_UNESCAPED_UNICODE);
  exit;
}

// Llamar Parse Cloud: api_agora_leave_channel
$cloudUrl = rtrim((string)PARSE_SERVER_URL, '/') . '/api_agora_leave_channel';

$payload = json_encode([
  'user_llamametu_id' => $user_llamametu_id,
  'channel' => $channel,
  'caller_uid' => $caller_uid,

  // extra (para guardar fecha exacta)
  'event_at_iso' => $event_at_iso,
  'event_at_ms'  => $event_at_ms,
  'leave_reason' => $leave_reason,
], JSON_UNESCAPED_UNICODE);

$ch = curl_init($cloudUrl);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 12,
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

$res = curl_exec($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($res === false || $http >= 400) {
  http_response_code(500);
  echo json_encode([
    'error' => 'No se pudo llamar a api_agora_leave_channel',
    'httpCode' => $http,
    'details' => $err,
    'cloudResponse' => $res
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

echo $res;

