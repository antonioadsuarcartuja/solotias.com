<?php
/**
 * SoloTIAS - Proxy Cloud Function (Back4App/Parse)
 *
 * Endpoint: POST /api/calls.php
 * Body JSON:
 *  - user_llamametu_id (string)  [required]
 *  - page (int)                 [optional, default 1]
 *
 * Lee claves de /api/config.php (NO poner aquí).
 * Llama a Parse Cloud Function: api_solotias_get_calls
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(["ok" => false, "error" => "method_not_allowed"]);
  exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) $payload = [];

$user_llamametu_id = isset($payload['user_llamametu_id']) ? trim((string)$payload['user_llamametu_id']) : '';
$page = isset($payload['page']) ? (int)$payload['page'] : 1;
if ($page < 1) $page = 1;

if ($user_llamametu_id === '') {
  http_response_code(400);
  echo json_encode(["ok" => false, "error" => "missing_user_llamametu_id"]);
  exit;
}

// Cargar config (claves)
$cfgFile = __DIR__ . '/config.php';
if (!file_exists($cfgFile)) {
  http_response_code(500);
  echo json_encode(["ok" => false, "error" => "missing_config"]);
  exit;
}
require_once $cfgFile;

// Soportamos constants o variables comunes
$appId = defined('PARSE_APP_ID') ? PARSE_APP_ID : (defined('APP_ID') ? APP_ID : ($parse_app_id ?? $APP_ID ?? null));
$restKey = defined('PARSE_REST_KEY') ? PARSE_REST_KEY : (defined('REST_API_KEY') ? REST_API_KEY : ($parse_rest_key ?? $REST_API_KEY ?? $REST_KEY ?? null));
$serverUrl = defined('PARSE_SERVER_URL') ? PARSE_SERVER_URL : ($parse_server_url ?? $PARSE_SERVER_URL ?? null);

if (!$appId || !$restKey || !$serverUrl) {
  http_response_code(500);
  echo json_encode(["ok" => false, "error" => "config_incomplete"]);
  exit;
}

$serverUrl = rtrim($serverUrl, '/');
$fnName = 'api_solotias_get_calls';
$endpoint = $serverUrl . '/functions/' . $fnName;

$params = [
  'user_llamametu_id' => $user_llamametu_id,
  'page' => $page,
];

$ch = curl_init($endpoint);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    'X-Parse-Application-Id: ' . $appId,
    'X-Parse-REST-API-Key: ' . $restKey,
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS => json_encode($params),
  CURLOPT_TIMEOUT => 20,
]);

$out = curl_exec($ch);
$http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($out === false) {
  http_response_code(502);
  echo json_encode(["ok" => false, "error" => "proxy_curl_error", "detail" => $err]);
  exit;
}

// Parse Cloud devuelve { result: {...} }
$decoded = json_decode($out, true);
if (!is_array($decoded)) {
  http_response_code(502);
  echo json_encode(["ok" => false, "error" => "proxy_bad_json", "http" => $http]);
  exit;
}

if ($http < 200 || $http >= 300) {
  http_response_code(502);
  echo json_encode([
    "ok" => false,
    "error" => "proxy_upstream_error",
    "http" => $http,
    "upstream" => $decoded,
  ]);
  exit;
}

$result = $decoded['result'] ?? $decoded;

// devolvemos tal cual el result (para que frontend use ok/page/calls)
echo json_encode($result);
