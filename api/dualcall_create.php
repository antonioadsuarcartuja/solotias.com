<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';

if (!defined('PARSE_APP_ID') || !defined('PARSE_REST_KEY') || !defined('PARSE_SERVER_URL')) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Faltan constantes en config.php'
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

// ==========================
// VALIDAR ENTRADA
// ==========================
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

$user_llamametu_id = trim((string)($body['user_llamametu_id'] ?? ''));
$advertisement_destination_id = trim((string)($body['advertisement_destination_id'] ?? ''));

if ($user_llamametu_id === '' || $advertisement_destination_id === '') {
  http_response_code(400);
  echo json_encode([
    'error' => 'user_llamametu_id y advertisement_destination_id son obligatorios'
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

// ==========================
// LLAMADA A PARSE CLOUD
// api_solotias_create_call_request
// ==========================
$cloudUrl = rtrim((string)PARSE_SERVER_URL, '/') . '/api_solotias_create_call_request';

$payload = json_encode([
  'user_llamametu_id' => $user_llamametu_id,
  'advertisement_destination_id' => $advertisement_destination_id
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
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($result === false || $httpCode >= 400) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Error llamando a ParseCloud api_solotias_create_call_request',
    'httpCode' => $httpCode,
    'details' => $error,
    'cloudResponse' => $result
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

$data = json_decode($result, true);

// Parse Cloud normalmente devuelve dentro de "result"
$response = $data['result'] ?? $data;

// Esperamos:
// {
//   coins_origin: 170,
//   max_duration: 17,
//   call_request_id: "hUZ86PsLob",
//   phone_origin: "+34620894427",
//   phone_destination: "+34659573178"
// }

$call_request_id = $response['call_request_id'] ?? null;
$phone_origin = preg_replace('/\D+/', '', $response['phone_origin'] ?? '');
$phone_destination = preg_replace('/\D+/', '', $response['phone_destination'] ?? '');
$max_duration = (int)($response['max_duration'] ?? 0);

if (!$call_request_id || !$phone_origin || !$phone_destination || !$max_duration) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Respuesta incompleta de ParseCloud',
    'response' => $response
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

// ==========================
// LANZAR DUALCALL EN ASTERISK
// ==========================

$ASTERISK_DUALCALL_URL = "http://46.137.62.42/notify-dualcall.php";
$ASTERISK_NOTIFY_TOKEN = "7f8a93Kx29LmQp2025SecureNotify";

$notifyPayload = json_encode([
  'token' => $ASTERISK_NOTIFY_TOKEN,
  'phone_origin' => $phone_origin,
  'phone_destination' => $phone_destination,
  'max_duration' => $max_duration,
  'call_request_id' => $call_request_id
], JSON_UNESCAPED_UNICODE);

$ch2 = curl_init($ASTERISK_DUALCALL_URL);
curl_setopt_array($ch2, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 10,
  CURLOPT_CONNECTTIMEOUT => 5,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    'Content-Type: application/json'
  ],
  CURLOPT_POSTFIELDS => $notifyPayload,
]);

$asteriskRes = curl_exec($ch2);
$asteriskHttp = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
$asteriskErr = curl_error($ch2);
curl_close($ch2);

if ($asteriskRes === false || $asteriskHttp >= 400) {
  http_response_code(500);
  echo json_encode([
    'error' => 'Error lanzando dualcall en Asterisk',
    'httpCode' => $asteriskHttp,
    'details' => $asteriskErr
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

// ==========================
// RESPUESTA AL FRONT
// ==========================
echo json_encode([
  'ok' => true,
  'call_request_id' => $call_request_id,
  'max_duration' => $max_duration
], JSON_UNESCAPED_UNICODE);
