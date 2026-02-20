<?php
// /api/ads.php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// ✅ Config (en servidor, NO visible al cliente)
const PARSE_SERVER   = 'https://parseapi.back4app.com'; // o tu Parse Server URL
const PARSE_APP_ID   = 'Iaaaaaaa';
const PARSE_REST_KEY = 'aaaaaaaa';

// Endpoint Cloud Function
const CF_PATH = '/functions/api_data_advertisments';

// Whitelist simple (evita abuso desde otros sitios si lo deseas)
$allowedHosts = ['solotias.com', 'www.solotias.com'];
$host = $_SERVER['HTTP_HOST'] ?? '';
if ($host && !in_array($host, $allowedHosts, true)) {
  http_response_code(403);
  echo json_encode(['ok' => false, 'error' => 'Forbidden host'], JSON_UNESCAPED_UNICODE);
  exit;
}

// Params con defaults (según tu spec)
$service     = $_GET['service'] ?? 'webs';
$gender      = $_GET['gender'] ?? 'female';
$web         = $_GET['web'] ?? 'solotias.com';
$province_id = $_GET['province_id'] ?? '';
$page        = isset($_GET['page'])  ? (int)$_GET['page']  : 1;
$limit       = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;

// Sanitización mínima
$page  = max(1, $page);
$limit = min(50, max(1, $limit)); // evita abusos
$service = in_array($service, ['webs', 'videollamadas'], true) ? $service : 'webs';
$gender  = in_array($gender,  ['female', 'male'], true) ? $gender : 'female';

// Construye payload POST (Parse Cloud Functions suelen ir por POST con JSON)
$payload = [
  'service' => $service,
  'gender'  => $gender,
  'web'     => $web,
  'page'    => $page,
  'limit'   => $limit,
];
if ($province_id !== '') $payload['province_id'] = $province_id;

// cURL
$ch = curl_init();
curl_setopt_array($ch, [
  CURLOPT_URL            => PARSE_SERVER . CF_PATH,
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT        => 15,
  CURLOPT_HTTPHEADER     => [
    'X-Parse-Application-Id: ' . PARSE_APP_ID,
    'X-Parse-REST-API-Key: ' . PARSE_REST_KEY,
    'Content-Type: application/json',
  ],
]);

$resBody  = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err      = curl_error($ch);
curl_close($ch);

if ($resBody === false) {
  http_response_code(502);
  echo json_encode(['ok' => false, 'error' => 'Proxy error', 'detail' => $err], JSON_UNESCAPED_UNICODE);
  exit;
}

// Si Parse devuelve 4xx/5xx, lo propagamos pero intentando devolver JSON útil
http_response_code($httpCode ?: 200);

// 🔥 FIX CLAVE: Parse suele devolver { "result": { ... } }
// Nosotros devolvemos SOLO el objeto de "result" para que el frontend reciba:
// { ok:true, version:2, advertisements:[...] }
$decoded = json_decode($resBody, true);

if (is_array($decoded) && isset($decoded['result']) && is_array($decoded['result'])) {
  echo json_encode($decoded['result'], JSON_UNESCAPED_UNICODE);
  exit;
}

// Si ya viene plano o no se puede decodificar, devolvemos tal cual
echo $resBody;
