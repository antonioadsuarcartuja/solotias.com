<?php
header('Content-Type: application/json; charset=utf-8');

// ==========================
// CONFIG PARSE / BACK4APP
// ==========================
require_once __DIR__ . '/config.php';

if (!defined('PARSE_APP_ID') || !defined('PARSE_REST_KEY') || !defined('PARSE_SERVER_URL')) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Faltan constantes en api/config.php (PARSE_APP_ID / PARSE_REST_KEY / PARSE_SERVER_URL)'
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

// ==========================
// CLAVES AGORA (TEMPORALMENTE AQUÍ)
// ==========================
$appId = "7a5fc3e6dd6847babca324129c881cbc";
$appCertificate = "e9973d6b694a412baf82e47acf0b1d9c";

// ==========================
// VALIDAR ENTRADA
// ==========================
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

$advertisement_id = '';
if (is_array($body)) {
  $advertisement_id = trim((string)($body['advertisement_id'] ?? ''));
}

if ($advertisement_id === '') {
  http_response_code(400);
  echo json_encode(['error' => 'advertisement_id es obligatorio'], JSON_UNESCAPED_UNICODE);
  exit;
}

// ==========================
// GENERAR CALL (Agora)
// ==========================
require_once __DIR__ . '/../agora/src/RtcTokenBuilder2.php';

$callId = bin2hex(random_bytes(8));
$channel = 'call_' . $callId;

$expireSeconds = 3600;
$privilegeExpire = time() + $expireSeconds;

$callerUid = 1;
$role = RtcTokenBuilder2::ROLE_PUBLISHER;

$callerToken = RtcTokenBuilder2::buildTokenWithUid(
  $appId,
  $appCertificate,
  $channel,
  $callerUid,
  $role,
  $privilegeExpire
);

$inviteUrl = 'https://solotias.com/?call=' . urlencode($callId);

// ==========================
// ENVIAR SMS (vía Parse Cloud)
// ==========================
// Tu PARSE_SERVER_URL ya incluye /functions/
$cloudUrl = rtrim((string)PARSE_SERVER_URL, '/') . '/api_solotias_send_sms';

$payload = json_encode([
  'advertisement_id' => $advertisement_id,
  'message'          => 'Tienes una videollamada: ' . $inviteUrl,
  'channel'          => $channel,
  'caller_uid'       => $callerUid
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

$cloudResult = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($cloudResult === false || $httpCode >= 400) {
  http_response_code(500);
  echo json_encode([
    'error' => 'No se pudo enviar el SMS (Parse Cloud)',
    'httpCode' => $httpCode,
    'details' => $curlError,
    'cloudResponse' => $cloudResult
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

$cloudJson = json_decode($cloudResult, true);

// ==========================
// RESPUESTA FINAL
// ==========================
echo json_encode([
  'appId' => $appId,
  'callId' => $callId,
  'channel' => $channel,
  'callerUid' => $callerUid,
  'callerToken' => $callerToken,
  'expireAt' => $privilegeExpire,
  'inviteUrl' => $inviteUrl,
  'smsCloud' => $cloudJson ?? $cloudResult
], JSON_UNESCAPED_UNICODE);
