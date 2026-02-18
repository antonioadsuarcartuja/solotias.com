<?php
declare(strict_types=1);

/**
 * PayPal IPN handler
 * Recibe POST de PayPal y lo reenvía TAL CUAL a ParseCloud
 */

header("Content-Type: application/json");

// Solo POST
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["ok" => false, "error" => "Method Not Allowed"]);
  exit;
}

// Leer POST completo de PayPal
$paypalPost = $_POST;

// Seguridad mínima
if (empty($paypalPost)) {
  http_response_code(400);
  echo json_encode(["ok" => false, "error" => "Empty PayPal POST"]);
  exit;
}

// --- CONFIG Parse ---
const PARSE_APP_ID   = "IGHDCrWNI0qMCljZlB8wvs7TfiELgH99LIR1aYX0";
const PARSE_REST_KEY = "QLJ7R07bWPn0mlqEtZEFzQAuWK2hgEeak9buQzn9";
const PARSE_SERVER   = "https://parseapi.back4app.com";

$url = rtrim(PARSE_SERVER, "/") . "/functions/api_paypal_response";

$headers = [
  "X-Parse-Application-Id: " . PARSE_APP_ID,
  "X-Parse-REST-API-Key: " . PARSE_REST_KEY,
  "Content-Type: application/json"
];

// Llamada a ParseCloud reenviando TODO el POST
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paypalPost));
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Responder a PayPal SIEMPRE 200
http_response_code(200);

// Log opcional
echo $response ?: json_encode(["ok" => true]);
