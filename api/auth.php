<?php
require_once __DIR__ . "/config.php";

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["ok" => false, "error" => "Method not allowed"]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);

if (!$input || !isset($input["action"])) {
    echo json_encode(["ok" => false, "error" => "Invalid request"]);
    exit;
}

$action = $input["action"];

function callParseFunction($functionName, $payload) {
    $ch = curl_init(PARSE_SERVER_URL . $functionName);

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "X-Parse-Application-Id: " . PARSE_APP_ID,
        "X-Parse-REST-API-Key: " . PARSE_REST_KEY,
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    $response = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ["ok" => false, "error" => "Network error"];
    }

    $decoded = json_decode($response, true);
    if (!$decoded) {
    return ["ok" => false, "error" => "Invalid JSON from Parse"];
    }

    // Parse suele envolver en { "result": ... }
    if (isset($decoded["result"]) && is_array($decoded["result"])) {
    return $decoded["result"];
    }

    return $decoded;

    }

/* =========================
   PRELOGIN
   ========================= */
if ($action === "prelogin") {

    if (!isset($input["phonenumber"])) {
        echo json_encode(["ok" => false, "error" => "Missing phone"]);
        exit;
    }

    $response = callParseFunction("api_solotias_prelogin", [
        "phonenumber" => $input["phonenumber"]
    ]);

    echo json_encode($response);
    exit;
}

/* =========================
   LOGIN
   ========================= */
if ($action === "login") {

    if (!isset($input["user_llamametu_id"]) || !isset($input["verification_code"])) {
        echo json_encode(["ok" => false, "error" => "Missing parameters"]);
        exit;
    }

    $response = callParseFunction("api_solotias_login", [
        "user_llamametu_id" => $input["user_llamametu_id"],
        "verification_code" => $input["verification_code"]
    ]);

    echo json_encode($response);
    exit;
}

echo json_encode(["ok" => false, "error" => "Invalid action"]);
