<?php
// api/agora_token.php
header('Content-Type: application/json; charset=utf-8');

// (Opcional) CORS si tu front está en otro dominio
// header('Access-Control-Allow-Origin: https://TU-DOMINIO.COM');

require_once __DIR__ . '/../agora/src/RtcTokenBuilder2.php'; // ajusta ruta

$appId = getenv('AGORA_APP_ID') ?: '7a5fc3e6ddIIIIOOIUOIUIOIO';
$appCertificate = getenv('AGORA_APP_CERTIFICATE') ?: 'e9973d6b694aKJHKJHKJGKJHKJH';

$channel = isset($_GET['channel']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['channel']) : '';
$uid = isset($_GET['uid']) ? intval($_GET['uid']) : 0;

// Validaciones mínimas
if ($channel === '' || $uid <= 0) {
  http_response_code(400);
  echo json_encode(['error' => 'channel y uid son obligatorios'], JSON_UNESCAPED_UNICODE);
  exit;
}

// Expiración (segundos)
$expireSeconds = 3600;
$now = time();
$privilegeExpire = $now + $expireSeconds;

// Role: PUBLISHER para 1:1 (ambos publican audio/video)
$role = RtcTokenBuilder2::ROLE_PUBLISHER;

// Token RTC
$token = RtcTokenBuilder2::buildTokenWithUid(
  $appId,
  $appCertificate,
  $channel,
  $uid,
  $role,
  $privilegeExpire
);

echo json_encode([
  'appId' => $appId,
  'channel' => $channel,
  'uid' => $uid,
  'token' => $token,
  'expireAt' => $privilegeExpire
], JSON_UNESCAPED_UNICODE);
