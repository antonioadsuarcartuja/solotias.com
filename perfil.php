<?php
// perfil.php — Página SSR indexable para /contactos-mujeres-...-OBJECTID
// Requisito: .htaccess reescribe /contactos-mujeres-.* -> perfil.php

header('Content-Type: text/html; charset=utf-8');

/** ---------------------------
 * Helpers
 * --------------------------*/
function esc($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

function currentScheme() {
  return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
}
function currentHost() {
  return $_SERVER['HTTP_HOST'] ?? 'localhost';
}
function currentPath() {
  $uri = $_SERVER['REQUEST_URI'] ?? '/';
  $path = parse_url($uri, PHP_URL_PATH);
  return $path ?: '/';
}
function currentUrl() {
  return currentScheme().'://'.currentHost().($_SERVER['REQUEST_URI'] ?? '/');
}

// Extrae objectId: último segmento tras el último guion
function objectIdFromPrettyPath($path) {
  $prefix = '/contactos-mujeres-';
  if (strpos($path, $prefix) !== 0) return null;
  $tail = trim(substr($path, strlen($prefix)), '/');
  if ($tail === '') return null;
  $parts = array_values(array_filter(explode('-', $tail)));
  if (count($parts) === 0) return null;
  return $parts[count($parts)-1];
}

function httpGetJson($absUrl) {
  $ctx = stream_context_create([
    'http' => [
      'method' => 'GET',
      'timeout' => 6,
      'header' => "Accept: application/json\r\n",
    ]
  ]);
  $raw = @file_get_contents($absUrl, false, $ctx);
  if ($raw === false) return null;
  $json = json_decode($raw, true);
  return is_array($json) ? $json : null;
}

// Normaliza payload igual que en app.js: raw.result o raw
function normalizeAdsPayload($raw) {
  if (!$raw) return null;
  $data = (isset($raw['result']) && is_array($raw['result'])) ? $raw['result'] : $raw;
  if (!is_array($data)) return null;
  if (!isset($data['ok']) || $data['ok'] !== true) return null;
  if (!isset($data['advertisements']) || !is_array($data['advertisements'])) return null;
  return $data['advertisements'];
}

/** ---------------------------
 * 1) Detectar objectId por URL bonita
 * --------------------------*/
$path = currentPath();
$objectId = objectIdFromPrettyPath($path);

if (!$objectId) {
  http_response_code(404);
  echo "Not found";
  exit;
}

/** ---------------------------
 * 2) Buscar el anuncio en /api/ads.php
 *    Mismos defaults que tu app.js:
 *    service=webs, gender=female, web=solotias.com
 * --------------------------*/
$scheme = currentScheme();
$host   = currentHost();
$api    = '/api/ads.php';

$DEFAULT_SERVICE = 'webs';
$DEFAULT_GENDER  = 'female';
$DEFAULT_WEB     = 'solotias.com';

$ad = null;

// Intento A: pedir incluyendo objectId (si tu backend lo soporta)
$directUrl = $scheme.'://'.$host.$api.'?'.http_build_query([
  'service'  => $DEFAULT_SERVICE,
  'gender'   => $DEFAULT_GENDER,
  'web'      => $DEFAULT_WEB,
  'page'     => '1',
  'limit'    => '20',
  'objectId' => $objectId,
]);

$rawA = httpGetJson($directUrl);
$listA = normalizeAdsPayload($rawA);
if ($listA) {
  foreach ($listA as $a) {
    if (isset($a['objectId']) && (string)$a['objectId'] === (string)$objectId) {
      $ad = $a;
      break;
    }
  }
}

// Intento B (fallback): paginar y buscar (por si objectId no existe como filtro)
if (!$ad) {
  $MAX_PAGES = 30;   // ajusta si quieres
  $LIMIT     = 20;

  for ($p=1; $p <= $MAX_PAGES; $p++) {
    $url = $scheme.'://'.$host.$api.'?'.http_build_query([
      'service' => $DEFAULT_SERVICE,
      'gender'  => $DEFAULT_GENDER,
      'web'     => $DEFAULT_WEB,
      'page'    => (string)$p,
      'limit'   => (string)$LIMIT,
    ]);

    $rawB = httpGetJson($url);
    $listB = normalizeAdsPayload($rawB);
    if (!$listB || count($listB) === 0) break;

    foreach ($listB as $a) {
      if (isset($a['objectId']) && (string)$a['objectId'] === (string)$objectId) {
        $ad = $a;
        break 2;
      }
    }
  }
}

if (!$ad) {
  http_response_code(404);
  echo "Not found";
  exit;
}

/** ---------------------------
 * 3) Preparar campos (los mismos que usa tu perfil/modal)
 * --------------------------*/
$name      = (string)($ad['name'] ?? 'Perfil');
$age       = (string)($ad['age'] ?? '');
$city      = (string)($ad['city'] ?? '');
$province  = (string)($ad['province'] ?? '');
$looking   = (string)($ad['looking_for'] ?? '');
$desc      = (string)($ad['description'] ?? '');
$msg       = (string)($ad['message'] ?? '');
$seoText   = (string)($ad['seo_text'] ?? '');
$available = !empty($ad['available']);

$loc = trim($city . ($province ? ', '.$province : ''));

// Title / description
$title = trim($name . ($age !== '' ? ', '.$age : '') . ($loc ? ' · '.$loc : ''));
if ($title === '') $title = 'SoloTIAS · Perfil';

$metaDesc = trim($seoText ?: ($desc ?: $msg));
if ($metaDesc === '') $metaDesc = 'Perfil en SoloTIAS.';
$metaDesc = mb_substr($metaDesc, 0, 160);

$canonical = $scheme.'://'.$host.$path;

// Fotos/vídeos
$photos = (isset($ad['photos']) && is_array($ad['photos'])) ? $ad['photos'] : [];
$media = [];
foreach ($photos as $p) {
  if (!is_array($p)) continue;
  if (!empty($p['video_url'])) {
    $media[] = [
      'type' => 'video',
      'src' => (string)$p['video_url'],
      'poster' => (string)($p['thumbnail_url'] ?? $p['poster'] ?? ''),
    ];
  } elseif (!empty($p['photo_url'])) {
    $media[] = [
      'type' => 'image',
      'src' => (string)$p['photo_url'],
    ];
  }
}

// Hero (igual idea que buildPanelHero: degradado + imagen/poster si hay)
$heroBg = '';
if (count($media) > 0) {
  $first = $media[0];
  if ($first['type'] === 'image') $heroBg = $first['src'];
  if ($first['type'] === 'video' && !empty($first['poster'])) $heroBg = $first['poster'];
}

// Servicio (para texto botón)
$service = strtolower((string)($ad['service'] ?? $DEFAULT_SERVICE));
$isVideoCall = ($service === 'videocalls');

$ctaLabel = $isVideoCall ? 'Videollamada' : 'Llamar';
$ctaText  = $isVideoCall ? 'Videollamada' : 'Llamar';

// Clases CTA como tus cards: call-btn + is-available / is-unavailable
$ctaClass = 'call-btn ' . ($available ? 'is-available' : 'is-unavailable');
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <meta name="theme-color" content="#ffffff"/>
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">
  <meta name="theme-color" media="(prefers-color-scheme: dark)"  content="#1a0012">

  <title><?= esc($title) ?></title>
  <meta name="description" content="<?= esc($metaDesc) ?>">
  <link rel="canonical" href="<?= esc($canonical) ?>">

  <!-- Reutiliza TU CSS real (como index.html) -->
  <link rel="stylesheet" href="/css/styles.css?v=19">

  <!-- JSON-LD básico (mejora SEO sin inventar) -->
  <script type="application/ld+json">
  <?= json_encode([
    "@context" => "https://schema.org",
    "@type" => "ProfilePage",
    "name" => $title,
    "description" => $metaDesc,
    "url" => $canonical,
    "about" => [
      "@type" => "Person",
      "name" => trim($name . ($age !== '' ? ', '.$age : '')),
      "address" => [
        "@type" => "PostalAddress",
        "addressLocality" => $city,
        "addressRegion" => $province,
        "addressCountry" => "ES",
      ],
    ],
  ], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) ?>
  </script>

  <style>
    /* SSR: mostramos el panel como página (sin backdrop bloqueante) */
    #panel { position: relative; inset: auto; }
    #panelBackdrop { display: none !important; }
    #panel.hidden { display: block !important; }
    #panel.open { display: block; }
    #panelSheet { position: relative; transform: none !important; }
  </style>
</head>

<body>
  <!-- Mismo markup del panel que en index.html (clases/ids iguales) -->
  <div aria-hidden="false" class="panel open" id="panel">
    <div class="panel-backdrop" id="panelBackdrop"></div>

    <div aria-modal="true" class="panel-sheet" id="panelSheet" role="dialog">
      <div class="panel-hero" id="panelHero"
        <?php if ($heroBg): ?>
          style='background-image: linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 55%, rgba(255,255,255,0.85) 80%, rgba(255,255,255,1) 100%), url("<?= esc($heroBg) ?>"); background-size: 100% 100%, cover; background-position: 0 0, center; background-repeat: no-repeat, no-repeat;'
        <?php endif; ?>
      >
        <!-- Cerrar: volvemos a home -->
        <a id="panelDesktopClose" class="panel-desktop-close" href="/" aria-label="Cerrar" style="text-decoration:none;">
          <span aria-hidden="true">×</span>
        </a>

        <?php
          // Si el primer media es vídeo, podemos poner el vídeo en hero como hace buildPanelHero
          if (count($media) > 0 && $media[0]['type'] === 'video') {
            $src = $media[0]['src'];
            $poster = $media[0]['poster'] ?? '';
            ?>
            <video
              src="<?= esc($src) ?>"
              muted
              playsinline
              controls
              loop
              preload="metadata"
              <?php if ($poster): ?>poster="<?= esc($poster) ?>"<?php endif; ?>
              style="width:100%; height:100%; object-fit:cover;"
            ></video>
            <?php
          }
        ?>
      </div>

      <div class="panel-body">
        <div class="profile-head">
          <div class="profile-name"><?= esc($name) ?><?= $age !== '' ? ', '.esc($age) : '' ?></div>
          <div class="profile-loc">
            <span aria-hidden="true" class="profile-flag">
              <svg height="14" preserveAspectRatio="none" viewBox="0 0 3 2" width="22">
                <rect fill="#aa151b" height="2" width="3"></rect>
                <rect fill="#f1bf00" height="1" width="3" y="0.5"></rect>
              </svg>
            </span>
            <span class="profile-loc-text"><?= esc($loc ?: '—') ?></span>
          </div>
        </div>

        <div aria-label="Galería" class="profile-gallery">
          <?php foreach ($media as $i => $m): ?>
            <?php if ($m['type'] === 'video'): ?>
              <button
                aria-label="Abrir vídeo"
                class="thumb"
                type="button"
                disabled
                style="opacity:1"
                data-media-type="video"
                data-src="<?= esc($m['src']) ?>"
              >
                <video
                  muted
                  playsinline
                  preload="metadata"
                  src="<?= esc($m['src']) ?>"
                  <?php if (!empty($m['poster'])): ?>poster="<?= esc($m['poster']) ?>"<?php endif; ?>
                ></video>
                <span aria-hidden="true" class="thumb-badge">
                  <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16">
                    <path d="M6.2 5.8h11.6A3.2 3.2 0 0 1 21 9v6a3.2 3.2 0 0 1-3.2 3.2H6.2A3.2 3.2 0 0 1 3 15V9a3.2 3.2 0 0 1 3.2-3.2z" fill="currentColor" opacity=".55"></path>
                    <path d="M11 10.1v3.8c0 .7.8 1.1 1.4.7l3-1.9c.6-.4.6-1.2 0-1.6l-3-1.9c-.6-.4-1.4 0-1.4.7z" fill="currentColor"></path>
                  </svg>
                </span>
              </button>
            <?php else: ?>
              <button
                aria-label="Abrir foto"
                class="thumb"
                type="button"
                disabled
                style="opacity:1"
                data-media-type="image"
                data-src="<?= esc($m['src']) ?>"
              >
                <img alt="Foto extra <?= (int)($i+1) ?>" src="<?= esc($m['src']) ?>"/>
                <span aria-hidden="true" class="thumb-badge">
                  <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16">
                    <path d="M7.2 6.4l1.2-1.6c.3-.4.7-.6 1.2-.6h4.8c.5 0 .9.2 1.2.6l1.2 1.6H19a2.6 2.6 0 0 1 2.6 2.6V18A2.6 2.6 0 0 1 19 20.6H5A2.6 2.6 0 0 1 2.4 18V9a2.6 2.6 0 0 1 2.6-2.6h2.2z" fill="currentColor"></path>
                    <path d="M12 10a3.4 3.4 0 1 0 0 6.8A3.4 3.4 0 0 0 12 10z" fill="currentColor" opacity=".9"></path>
                  </svg>
                </span>
              </button>
            <?php endif; ?>
          <?php endforeach; ?>
        </div>

        <div class="profile-sections">
          <div class="profile-block">
            <div class="profile-label">¿Qué busco?</div>
            <div class="profile-text"><?= esc($looking) ?></div>
          </div>

          <div class="profile-block">
            <div class="profile-label">Descripción</div>
            <div class="profile-text"><?= esc($desc) ?></div>
          </div>

          <div class="profile-block">
            <div class="profile-label">Mensaje</div>
            <div class="profile-text"><?= esc($msg) ?></div>
          </div>

          <div class="profile-block profile-block--long">
            <div class="profile-label">Anuncio</div>
            <div class="profile-text profile-text--long">
              <?= nl2br(esc($seoText)) ?>
            </div>
          </div>
        </div>

        <div class="profile-cta">
          <div class="profile-cta-title">
            <?= $available ? 'Llama a esta TIA que está disponible ahora' : 'Esta TIA no está disponible ahora' ?>
          </div>

          <button aria-label="<?= esc($ctaLabel) ?>" class="<?= esc($ctaClass) ?>" type="button" <?= $available ? '' : 'aria-disabled="true"' ?>>
            <span aria-hidden="true" class="call-ico">
              <?php if ($isVideoCall): ?>
                <!-- Icono simple de vídeo -->
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h8A2.5 2.5 0 0 1 16 6.5v3.2l4.2-3.5c1-.8 2.8 0 2.8 1.4v9.8c0 1.5-1.8 2.2-2.8 1.4L16 15.3v2.2A2.5 2.5 0 0 1 13.5 20h-8A2.5 2.5 0 0 1 3 17.5v-11z" fill="currentColor"/>
                </svg>
              <?php else: ?>
                <!-- Icono simple de teléfono -->
                <svg height="20" viewBox="0 0 24 24" width="20">
                  <path d="M16.6 12.9l-.5.5s-1.1 1.1-4-1.9-1.9-4-1.9-4l.3-.3c.7-.7.8-1.8.2-2.6L9.4 2.9c-.8-1-2.2-1.2-3.1-.3L4.7 4.1c-.4.4-.7 1-.7 1.6.1 1.6.8 5 4.8 9 4.2 4.2 8.2 4.4 9.9 4.2.5 0 1-.3 1.3-.7l1.4-1.4c1-1 .7-2.6-.6-3.3l-1.9-1c-.8-.4-1.8-.3-2.4.4z" fill="currentColor"/>
                </svg>
              <?php endif; ?>
            </span>
            <span class="call-text"><?= esc($ctaText) ?></span>
          </button>

          <div style="margin-top:12px;">
            <a href="/" style="text-decoration:none; opacity:.85;">Volver</a>
          </div>
        </div>

      </div>
    </div>
  </div>

  <script>
    // Intento suave de autoplay de previews de vídeo (silencioso)
    try {
      document.querySelectorAll(".profile-gallery video").forEach(v => {
        v.play().catch(()=>{});
      });
    } catch(e) {}
  </script>
</body>
</html>