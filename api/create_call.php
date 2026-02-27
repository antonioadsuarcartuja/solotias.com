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
// ASTERISK NOTIFY-CALL
// ==========================
// IMPORTANTE:
// - Esta URL debe ser accesible desde ESTE servidor (donde corre create_call.php).
// - Si este servidor NO es el mismo que Asterisk, abre en AWS el puerto 80 SOLO para la IP pública de este servidor.
$ASTERISK_NOTIFY_URL = "http://46.137.62.42/notify-call.php";
$ASTERISK_NOTIFY_TOKEN = "7f8a93Kx29LmQp2025SecureNotify";

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

$user_llamametu_id = isset($_SESSION['user_llamametu_id'])
  ? trim((string)$_SESSION['user_llamametu_id'])
  : '';

// ==========================
// ENVIAR SMS (vía Parse Cloud)
// ==========================
// Tu PARSE_SERVER_URL ya incluye /functions/
$cloudUrl = rtrim((string)PARSE_SERVER_URL, '/') . '/api_solotias_send_sms';

$payload = json_encode([
  'user_llamametu_id' => $user_llamametu_id,
  'advertisement_id' => $advertisement_id,
  'advertisement_destination_id' => $advertisement_id,
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
// LANZAR LLAMADA EN ASTERISK (server-to-server)
// ==========================
// Parse (tu ejemplo real) devuelve el número aquí: smsCloud.result.phone
// En create_call.php lo recibimos como $cloudJson['result']['phone']
$asteriskCall = null;

$phoneFromParse = '';
if (is_array($cloudJson)) {
  $phoneFromParse = (string)($cloudJson['result']['phone'] ?? $cloudJson['phone'] ?? '');
}

// Normalizar: dejar solo dígitos (quitamos +, espacios, etc.)
$phoneDigits = preg_replace('/\D+/', '', $phoneFromParse);

// Si hay teléfono, llamamos a Asterisk.
// OJO: si Asterisk no es accesible (SG/firewall), aquí verás timeout/error en $asteriskCall.
if ($phoneDigits !== '') {
  $notifyPayload = json_encode([
    'phone' => $phoneDigits,
    'token' => $ASTERISK_NOTIFY_TOKEN
  ], JSON_UNESCAPED_UNICODE);

  $ch2 = curl_init($ASTERISK_NOTIFY_URL);
  curl_setopt_array($ch2, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_CONNECTTIMEOUT => 4,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
      'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => $notifyPayload,
  ]);

  $notifyRes = curl_exec($ch2);
  $notifyHttp = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
  $notifyErr = curl_error($ch2);
  curl_close($ch2);

  $asteriskCall = [
    'httpCode'  => $notifyHttp,
    'error'     => $notifyErr ?: null,
    'response'  => $notifyRes
  ];
} else {
  $asteriskCall = [
    'skipped' => true,
    'reason'  => 'Parse no devolvió phone (result.phone)'
  ];
}

// ==========================
// RESPUESTA FINAL
// ==========================
// RECOMENDACIÓN: no devuelvas el phone al cliente.
// Ahora mismo cloudJson incluye el phone; si quieres ocultarlo, coméntame y lo limpiamos.
echo json_encode([
  'appId' => $appId,
  'callId' => $callId,
  'channel' => $channel,
  'callerUid' => $callerUid,
  'callerToken' => $callerToken,
  'expireAt' => $privilegeExpire,
  'inviteUrl' => $inviteUrl,
 // 'smsCloud' => $cloudJson ?? $cloudResult,

  // Debug: te permite ver si Asterisk aceptó la llamada.
  // Cuando confirmes que funciona, lo puedes quitar o dejar solo 'httpCode'.
  //'asteriskCall' => $asteriskCall
], JSON_UNESCAPED_UNICODE);