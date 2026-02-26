<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require_once __DIR__ . '/config.php';



if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(["ok" => false, "error" => "method_not_allowed"]);
  exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) $payload = [];

// ✅ NUEVO: el user id se obtiene exclusivamente desde sesión
$user_llamametu_id = isset($_SESSION['user_llamametu_id'])
  ? trim((string)$_SESSION['user_llamametu_id'])
  : '';

$page = isset($payload['page']) ? (int)$payload['page'] : 1;
if ($page < 1) $page = 1;

// ✅ NUEVO: si no hay sesión válida → 401
if ($user_llamametu_id === '') {
  http_response_code(401);
  echo json_encode(["ok" => false, "error" => "session_required",'get'=>$_GET]);
  exit;
}

// ================================
// Llamada a Parse Cloud
// ================================

$cloudUrl = rtrim((string)PARSE_SERVER_URL, '/') . '/api_solotias_get_calls';

$bodyToParse = json_encode([
  "user_llamametu_id" => $user_llamametu_id,
  "page" => $page
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
  CURLOPT_POSTFIELDS => $bodyToParse,
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
    "ok" => false,
    "error" => "parse_call_failed",
    "httpCode" => $http,
    "details" => $err,
    "cloudResponse" => $res
  ]);
  exit;
}

echo $res;
