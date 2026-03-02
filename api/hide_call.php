<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php'; // 👈 aquí están tus claves

header('Content-Type: application/json; charset=utf-8');

// ===== CORS =====
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, X-Session-Token");
header("Access-Control-Allow-Methods: POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

// ===== Leer JSON =====
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json']);
    exit;
}

$user_llamametu_id = $data['user_llamametu_id'] ?? null;
$call_id           = $data['call_id'] ?? null;

if (!$user_llamametu_id || !$call_id) {
    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => 'missing_params',
        'required' => ['user_llamametu_id', 'call_id']
    ]);
    exit;
}

// ===== Construir URL Cloud Function =====
// Tu versión llamaba: PARSE_SERVER_URL . '/functions/api_hide_call'
// En Back4App muchas veces el endpoint correcto es: .../parse/functions/...
/*$base = rtrim(PARSE_SERVER_URL, '/');
if (!preg_match('~/parse$~', $base)) {
    $base .= '/parse';
}
$url = $base . '/api_hide_call';*/

$url = rtrim((string)PARSE_SERVER_URL, '/') . '/api_hide_call';

// ===== Preparar request a Parse =====
$payload = json_encode([
    'user_llamametu_id' => $user_llamametu_id,
    'call_id' => $call_id
]);

$headers = [
    'Content-Type: application/json',
    'X-Parse-Application-Id: ' . PARSE_APP_ID
];

// Si usas REST key
if (defined('PARSE_REST_KEY') && PARSE_REST_KEY) {
    $headers[] = 'X-Parse-REST-API-Key: ' . PARSE_REST_KEY;
}

// Si quieres usar Master Key (server-side seguro)
if (defined('PARSE_MASTER_KEY') && PARSE_MASTER_KEY) {
    $headers[] = 'X-Parse-Master-Key: ' . PARSE_MASTER_KEY;
}

// Si prefieres sesión del usuario:
$sessionToken = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? null;
if ($sessionToken) {
    $headers[] = 'X-Parse-Session-Token: ' . $sessionToken;
}

// ===== cURL =====
$ch = curl_init($url);

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_TIMEOUT => 15
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error    = curl_error($ch);

curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode([
        'ok' => false,
        'error' => 'parse_unreachable',
        'detail' => $error
    ]);
    exit;
}

$parsed = json_decode($response, true);

// Parse normalmente devuelve { result: {...} }
$result = $parsed['result'] ?? $parsed;

if ($httpCode >= 200 && $httpCode < 300) {
    echo json_encode($result);
    exit;
}

// Error de Parse
http_response_code($httpCode ?: 500);
echo json_encode([
    'ok' => false,
    'error' => $parsed['error'] ?? ($parsed['message'] ?? 'parse_error'),
    'code' => $parsed['code'] ?? null,
    'url'=>$url,
    'payload'=>$payload,
]);
exit;