<?php
declare(strict_types=1);

/**
 * CHICAS EN TU CIUDAD - Advertisements API (SOLO LECTURA)
 *
 * Frontend -> /apis/advertisements.php -> Back4App Cloud Function: api_data_advertisments
 *
 * No expone keys en el navegador (las keys están en servidor).
 * No permite editar/borrar: solo llama a una Cloud Function de lectura.
 *
 * IMPORTANTE:
 * - NO uses Master Key aquí.
 * - Recomendado mover estas constantes a un archivo fuera del webroot o variables de entorno.
 */

// ---------- HEADERS ----------
header("Content-Type: application/json; charset=UTF-8");
// (Opcional) CORS si lo sirves desde otro dominio/subdominio:
// header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");

// Preflight
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

// Solo GET/POST (para no romper el frontend actual que hace POST)
if ($_SERVER["REQUEST_METHOD"] !== "GET" && $_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["ok" => false, "error" => "Method Not Allowed"], JSON_UNESCAPED_UNICODE);
  exit;
}

// ---------- CONFIG ----------
// Back4App / Parse credentials (REST)
const PARSE_APP_ID   = "IGHDCrWNI0qMCljZlB8wvs7TfiELgH99LIR1aYX0";
const PARSE_REST_KEY = "QLJ7R07bWPn0mlqEtZEFzQAuWK2hgEeak9buQzn9";
const PARSE_SERVER   = "https://parseapi.back4app.com";

// ---------- HELPERS ----------
function parse_request(string $method, string $path, array $query = [], array $headers = [], ?string $bodyJson = null): array {
  $base = rtrim(PARSE_SERVER, "/");
  $url  = $base . $path;

  if (!empty($query)) {
    $url .= "?" . http_build_query($query);
  }

  $h = [
    "X-Parse-Application-Id: " . PARSE_APP_ID,
    "X-Parse-REST-API-Key: " . PARSE_REST_KEY,
    "Content-Type: application/json"
  ];
  foreach ($headers as $line) $h[] = $line;

  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
  curl_setopt($ch, CURLOPT_HTTPHEADER, $h);
  curl_setopt($ch, CURLOPT_TIMEOUT, 20);

  if ($bodyJson !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $bodyJson);
  }

  $raw = curl_exec($ch);
  $err = curl_error($ch);
  $st  = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($raw === false) return [0, null, $err ?: "curl_error"];

  $j = json_decode($raw, true);
  return [$st, is_array($j) ? $j : null, $raw];
}

// ---------- MAIN ----------
// Llamada a Cloud Function (sin variables)
[$st, $json, $raw] = parse_request("POST", "/functions/api_data_advertisments", [], [], "{}");

// Devuelve tal cual (Parse suele envolver en {"result": ...})
http_response_code($st > 0 ? $st : 502);

if (is_array($json)) {
  echo json_encode($json, JSON_UNESCAPED_UNICODE);
} else {
  echo $raw ?: json_encode(["ok" => false, "error" => "Bad gateway"], JSON_UNESCAPED_UNICODE);
}
