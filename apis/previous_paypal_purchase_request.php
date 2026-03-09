<?php
declare(strict_types=1);

/**
 * Proxy same-origin -> Cloud Function: api_previous_paypal_purchase_request
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

// --- CONFIG (usa las mismas keys que ya usas en tu proxy de compra) ---
const PARSE_APP_ID   = "IGHDCrWNI0qMCljZlB8wvs7TfiELgH99LIR1aYX0";
const PARSE_REST_KEY = "QLJ7R07bWPn0mlqEtZEFzQAuWK2hgEeak9buQzn9";
const PARSE_SERVER   = "https://parseapi.back4app.com";

function read_json_body(): array {
  $raw = file_get_contents("php://input");
  $j = json_decode($raw ?: "{}", true);
  return is_array($j) ? $j : [];
}

function call_cloud_function(string $fn, array $payload): array {
  $url = rtrim(PARSE_SERVER, "/") . "/functions/" . $fn;

  $headers = [
    "X-Parse-Application-Id: " . PARSE_APP_ID,
    "X-Parse-REST-API-Key: " . PARSE_REST_KEY,
    "Content-Type: application/json",
  ];

  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
  curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
  curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
  curl_setopt($ch, CURLOPT_TIMEOUT, 30);

  $raw = curl_exec($ch);
  $err = curl_error($ch);
  $st  = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);

  if ($raw === false) return [0, null, $err ?: "curl_error"];
  $j = json_decode($raw, true);
  return [$st, is_array($j) ? $j : null, $raw];
}

$in = read_json_body();

$user_llamametu_id = isset($in["user_llamametu_id"]) ? trim((string)$in["user_llamametu_id"]) : "";
$coin_price_id = isset($in["coin_price_id"]) ? trim((string)$in["coin_price_id"]) : "";

if ($user_llamametu_id === "" || $coin_price_id === "") {
  http_response_code(400);
  echo json_encode(["ok" => false, "error" => "Missing user_llamametu_id or coin_price_id"], JSON_UNESCAPED_UNICODE);
  exit;
}

// Params exigidos por la Cloud Function
$http_host = "solotias.com";
$ip = isset($in["ip"]) ? trim((string)$in["ip"]) : "";
if ($ip === "") $ip = $_SERVER["REMOTE_ADDR"] ?? "";

[$st, $json, $raw] = call_cloud_function("api_previous_paypal_purchase_request", [
  "user_llamametu_id" => $user_llamametu_id,
  "coin_price_id" => $coin_price_id,
  "ip" => $ip,
  "http_host" => $http_host,
]);

http_response_code($st > 0 ? $st : 502);

if (is_array($json)) {
  echo json_encode($json, JSON_UNESCAPED_UNICODE);
} else {
  echo $raw ?: json_encode(["ok" => false, "error" => "Bad gateway"], JSON_UNESCAPED_UNICODE);
}
