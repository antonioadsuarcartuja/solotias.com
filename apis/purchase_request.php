<?php
declare(strict_types=1);

/**
 * Proxy same-origin para Cloud Function: api_purchase_request
 * Frontend -> /apis/purchase_request.php -> Back4App
 */

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["ok" => false, "error" => "Method Not Allowed"], JSON_UNESCAPED_UNICODE);
  exit;
}

// --- CONFIG (usa las mismas keys que ya usas en tu proxy de anuncios/precios) ---
const PARSE_APP_ID   = "IGHDCrWNI0qMCljZlB8wvs7TfiELgH99LIR1aYX0";
const PARSE_REST_KEY = "QLJ7R07bWPn0mlqEtZEFzQAuWK2hgEeak9buQzn9";
const PARSE_SERVER   = "https://parseapi.back4app.com";

function parse_post_json(): array {
  $raw = file_get_contents("php://input");
  $j = json_decode($raw ?: "{}", true);
  return is_array($j) ? $j : [];
}

function parse_request(string $path, string $bodyJson): array {
  $url = rtrim(PARSE_SERVER, "/") . $path;

  $headers = [
    "X-Parse-Application-Id: " . PARSE_APP_ID,
    "X-Parse-REST-API-Key: " . PARSE_REST_KEY,
    "Content-Type: application/json",
  ];

  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
  curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
  curl_setopt($ch, CURLOPT_POSTFIELDS, $bodyJson);
  curl_setopt($ch, CURLOPT_TIMEOUT, 30);

  $raw = curl_exec($ch);
  $err = curl_error($ch);
  $st  = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($raw === false) return [0, null, $err ?: "curl_error"];
  $j = json_decode($raw, true);
  return [$st, is_array($j) ? $j : null, $raw];
}

// --- MAIN ---
$in = parse_post_json();

// Añadimos http_host en servidor para que sea fiable
$in["http_host"] = $_SERVER["HTTP_HOST"] ?? "";

// OJO: la IP NO hace falta enviarla; en Cloud tienes request.ip.
// Pero si Cloud quiere "Ip" en params, se lo pasamos también:
$in["Ip"] = $_SERVER["REMOTE_ADDR"] ?? "";

// Llamada a Cloud Function
[$st, $json, $raw] = parse_request("/functions/api_purchase_request", json_encode($in));

http_response_code($st > 0 ? $st : 502);

if (is_array($json)) {
  echo json_encode($json, JSON_UNESCAPED_UNICODE);
} else {
  echo $raw ?: json_encode(["ok" => false, "error" => "Bad gateway"], JSON_UNESCAPED_UNICODE);
}
