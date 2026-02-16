<?php
header('Content-Type: application/json; charset=utf-8');

// ==========================
// CLAVES (TEMPORALMENTE AQUÍ)
// ==========================
$appId = "7a5fc3e6dd6847babca324129c881cbc";
$appCertificate = "e9973d6b694a412baf82e47acf0b1d9c";

$smsClave = "9obae8ng4f47enn";
$smsIdCliente = "64";
$smsRuta = "5";
$smsAlfabeto = "0";
$smsRemitente = "Solotias";

// ==========================
// VALIDAR ENTRADA
// ==========================
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

$invitePhone = isset($body['invitePhone']) ? trim($body['invitePhone']) : '';

if ($invitePhone === '') {
	http_response_code(400);
	echo json_encode(['error' => 'invitePhone es obligatorio'], JSON_UNESCAPED_UNICODE);
	exit;
}

// ==========================
// GENERAR CALL
// ==========================
require_once __DIR__ . '/../agora/src/RtcTokenBuilder2.php';

$callId = bin2hex(random_bytes(8));
$channel = 'call_' . $callId;

$expireSeconds = 3600;
$privilegeExpire = time() + $expireSeconds;

$callerUid = 1;
$role = RtcTokenBuilder2::ROLE_PUBLISHER;

$callerToken = RtcTokenBuilder2::buildTokenWithUid(
	$appId,
	$appCertificate,
	$channel,
	$callerUid,
	$role,
	$privilegeExpire
);

$inviteUrl = 'https://solotias.com/?call=' . urlencode($callId);

// ==========================
// ENVIAR SMS
// ==========================
$smsUrl = 'https://ws1.premiumnumbers.es/sms/push/sendPush?' . http_build_query([
	'idCliente' => $smsIdCliente,
	'ruta' => $smsRuta,
	'alfabeto' => $smsAlfabeto,
	'clave' => $smsClave,
	'remitente' => $smsRemitente,
	'destinatarios' => $invitePhone,
	'texto' => "Tienes una videollamada: " . $inviteUrl
]);

$ch = curl_init($smsUrl);
curl_setopt_array($ch, [
	CURLOPT_RETURNTRANSFER => true,
	CURLOPT_TIMEOUT => 12,
	CURLOPT_CONNECTTIMEOUT => 6,
	CURLOPT_SSL_VERIFYPEER => true,
	CURLOPT_SSL_VERIFYHOST => 2,
]);

$smsResult = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($smsResult === false || $httpCode >= 400) {
	http_response_code(500);
	echo json_encode([
		'error' => 'No se pudo enviar el SMS',
		'details' => $curlError
	], JSON_UNESCAPED_UNICODE);
	exit;
}

// ==========================
// RESPUESTA FINAL
// ==========================
echo json_encode([
	'appId' => $appId,
	'callId' => $callId,
	'channel' => $channel,
	'callerUid' => $callerUid,
	'callerToken' => $callerToken,
	'expireAt' => $privilegeExpire,
	'inviteUrl' => $inviteUrl
], JSON_UNESCAPED_UNICODE);

