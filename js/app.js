(() => {
  
  const $ = (s) => document.querySelector(s);

  // Detectar Android (Chrome) y marcar clase
  (() => {
    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    if (isAndroid) document.documentElement.classList.add("is-android");
  })();

  // Registrar Service Worker (sw.js est en la raz)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  // --- Men (hamburguesa) ---
  const menuBtn = $("#menuBtn");
  const menuOverlay = $("#menuOverlay");
  const menuDrawer = $("#menuDrawer");
  const menuClose = $("#menuClose");

  let lastFocus = null;

  function openMenu() {
    if (!menuOverlay) return;
    lastFocus = document.activeElement;
    menuOverlay.hidden = false;

    // Forzar reflow para animacin
    requestAnimationFrame(() => menuOverlay.classList.add("is-open"));
    menuBtn?.setAttribute("aria-expanded", "true");

    // Foco al primer item
    const first = menuDrawer?.querySelector(".menu-item");
    setTimeout(() => first?.focus?.(), 30);

    document.addEventListener("keydown", onMenuKeydown, { capture: true });
  }

  function closeMenu() {
    if (!menuOverlay) return;
    menuOverlay.classList.remove("is-open");
    menuBtn?.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onMenuKeydown, { capture: true });
    setTimeout(() => {
      menuOverlay.hidden = true;
    }, 220);
    setTimeout(() => {
      lastFocus?.focus?.();
    }, 0);
  }

  function onMenuKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      return;
    }

    // Foco simple dentro del drawer (tab loop)
    if (e.key === "Tab" && menuDrawer) {
      const focusables = menuDrawer.querySelectorAll(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  menuBtn?.addEventListener("click", openMenu);
  menuClose?.addEventListener("click", closeMenu);
  menuOverlay?.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.closest && t.closest("[data-close]")) closeMenu();
  });

  // --- Deteccin OS para textos del popup ---
  function getMobileOS() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if (/android/i.test(ua)) return "android";
    if (/iPad|iPhone|iPod/.test(ua)) return "ios";
    return "other";
  }

  // ===============================
// PWA Install Nudge (iOS + Android)
// ===============================
(function initPwaNudge(){
  const KEY = "solotias_pwa_nudge_v1"; // "dismissed"
  const root = document.getElementById("pwaNudge");
  if (!root) return;

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  if (isStandalone) return;                 // ya es PWA
  if (localStorage.getItem(KEY) === "dismissed") return; // no molestar

  const sub = document.getElementById("pwaNudgeSub");
  const iosBox = document.getElementById("pwaIOS");
  const andBox = document.getElementById("pwaAndroid");

  const btnInstall = root.querySelector("[data-pwa-install]");
  const btnCancel  = root.querySelector("[data-pwa-cancel]");
  const closeEls   = root.querySelectorAll("[data-pwa-close]");

  let deferredPrompt = null;

  function open(type){
    // type: "ios" | "android"
    iosBox.hidden = type !== "ios";
    andBox.hidden = type !== "android";

    if (sub) {
      sub.textContent = type === "ios"
        ? "Añádela a tu pantalla de inicio para usarla como app."
        : "Instálala para abrir más rápido y como app.";
    }

    root.hidden = false;
    document.documentElement.classList.add("no-scroll");
    document.body.classList.add("no-scroll");
  }

function close(dismiss = true){
  root.hidden = true;
  document.documentElement.classList.remove("no-scroll");
  document.body.classList.remove("no-scroll");
  if (dismiss) localStorage.setItem(KEY, "dismissed");
}


  closeEls.forEach((el) => el.addEventListener("click", () => close(true)));
  btnCancel?.addEventListener("click", () => close(true));

  // Android: capturamos el evento de instalación real
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // mostramos solo si es android
    const os = getMobileOS?.() || "other";
    if (os === "android") open("android");
  });

  // Si el usuario instala, no volver a mostrar
  window.addEventListener("appinstalled", () => {
    localStorage.setItem(KEY, "dismissed");
    close(false);
  });

  // Botón Instalar (Android)
  btnInstall?.addEventListener("click", async () => {
    if (!deferredPrompt) return close(true);
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch {}
    deferredPrompt = null;
    close(true);
  });

  // iOS: si NO hay beforeinstallprompt y es iOS, mostramos instrucciones 1 vez
  const os = getMobileOS?.() || "other";
  const isIOS = os === "ios";

  // iOS Safari (no standalone) -> mostrar al cargar, pero con retraso suave
  if (isIOS) {
    setTimeout(() => open("ios"), 900);
  }

  // Cerrar con ESC
  document.addEventListener("keydown", (e) => {
    if (!root.hidden && e.key === "Escape") close(true);
  });
})();


  // --- Geolocalizacin (solo localidad) ---
  const geoLine = $("#geoLine");
  const gpsBtn = $("#gpsBtn");

  function setGeoText(text) {
    if (!geoLine) return;
    geoLine.textContent = text;
  }

  async function loadIpLocality() {
    if (!geoLine) return;
    setGeoText("Cargando ubicacin...");
    try {
      const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      if (!res.ok) throw new Error("ipgeo");
      const data = await res.json();
      const city = (data.city || "").trim();
      const region = (data.region || data.region_code || "").trim();
      const label = [city, region].filter(Boolean).join(", ");
      setGeoText(label || "Ubicacin no disponible.");
    } catch {
      setGeoText("Ubicacin no disponible.");
    }
  }

  async function reverseGeocodeLocality(lat, lon) {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}&zoom=12&addressdetails=1&accept-language=es`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("revgeo");

    const data = await res.json();
    const a = data.address || {};

    const locality = (
      a.city || a.town || a.village || a.municipality || a.hamlet || a.locality || ""
    ).trim();

    const province = (a.province || a.county || a.state || a.region || "").trim();

    const label = [locality, province].filter(Boolean).join(", ");
    if (!label) throw new Error("nolabel");
    return label;
  }

  // Popup informativo (cuando el usuario tiene la ubicacin bloqueada)
  function showEnableLocationInfoPopup() {
    const existing = document.getElementById("geoInfoOverlay");
    if (existing) return;

    const os = getMobileOS();
    let bodyText = "";

    if (os === "ios") {
      bodyText =
        "Para activar tu ubicacin y hablar con chicas cerca de ti:\n\n" +
        "Ajustes ? Safari ? Ubicacin ? Permitir\n\n" +
        "Luego vuelve a abrir SoloChicas.";
    } else if (os === "android") {
      bodyText =
        "Para activar tu ubicacin y hablar con chicas cerca de ti:\n\n" +
        "Ajustes ? Privacidad ? Ubicacin ? Permitir\n\n" +
        "Asegrate de permitir la ubicacin para tu navegador y vuelve a abrir SoloChicas.";
    } else {
      bodyText =
        "Para activar tu ubicacin, revisa los permisos de ubicacin del navegador en los ajustes del dispositivo.";
    }

    const overlay = document.createElement("div");
    overlay.id = "geoInfoOverlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "4000";
    overlay.style.display = "grid";
    overlay.style.placeItems = "center";
    overlay.style.background = "rgba(0,0,0,.45)";
    overlay.style.backdropFilter = "blur(10px)";

    const card = document.createElement("div");
    card.style.width = "min(420px, 92vw)";
    card.style.borderRadius = "22px";
    card.style.background = "rgba(255,255,255,.95)";
    card.style.border = "1px solid rgba(231,231,234,.95)";
    card.style.boxShadow = "0 18px 50px rgba(0,0,0,.16)";
    card.style.padding = "16px";

    const title = document.createElement("div");
    title.textContent = "Activa tu ubicacin";
    title.style.fontWeight = "900";
    title.style.fontSize = "16px";
    title.style.marginBottom = "8px";

    const body = document.createElement("div");
    body.style.fontSize = "14px";
    body.style.lineHeight = "1.35";
    body.style.color = "#2b2d31";
    body.style.whiteSpace = "pre-line";
    body.textContent = bodyText;

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.marginTop = "14px";

    const btnClose = document.createElement("button");
    btnClose.type = "button";
    btnClose.textContent = "Entendido";
    btnClose.style.height = "42px";
    btnClose.style.padding = "0 14px";
    btnClose.style.borderRadius = "14px";
    btnClose.style.border = "1px solid rgba(231,231,234,.95)";
    btnClose.style.background = "#111214";
    btnClose.style.color = "#fff";
    btnClose.style.fontWeight = "900";
    btnClose.style.cursor = "pointer";

    function close() {
      overlay.remove();
      gpsBtn?.focus?.();
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });

    btnClose.addEventListener("click", close);

    actions.appendChild(btnClose);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    setTimeout(() => btnClose.focus(), 0);
  }

  function requestDeviceGeo() {
    if (!geoLine) return;

    setGeoText("Obteniendo tu ubicacin...");

    if (!("geolocation" in navigator)) {
      setGeoText("Usando ubicacin aproximada...");
      gpsBtn?.classList.add("gps-pulse");
      loadIpLocality();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const label = await reverseGeocodeLocality(pos.coords.latitude, pos.coords.longitude);
          setGeoText(label);
          gpsBtn?.classList.remove("gps-pulse");
        } catch {
          setGeoText("Usando ubicacin aproximada...");
          gpsBtn?.classList.add("gps-pulse");
          loadIpLocality();
        }
      },
      () => {
        setGeoText("Usando ubicacin aproximada...");
        gpsBtn?.classList.add("gps-pulse");
        loadIpLocality();
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
    );
  }

  async function getGeoPermissionState() {
    // "granted" | "prompt" | "denied" | "unknown"
    if (!("permissions" in navigator) || !navigator.permissions?.query) return "unknown";
    try {
      const status = await navigator.permissions.query({ name: "geolocation" });
      return status.state || "unknown";
    } catch {
      return "unknown";
    }
  }

  // Al iniciar la PWA: pedir GPS (si est en prompt saldr el popup del sistema)
  async function initGeoOnLoad() {
    if (!geoLine) return;

    // Mostramos IP rpido
    loadIpLocality();

    const state = await getGeoPermissionState();
    if (state === "denied") {
      gpsBtn?.classList.add("gps-pulse");
      return;
    }

    requestDeviceGeo();
  }

  // Si deneg y pulsa botn: NO pedir GPS, solo popup + mantener IP
  async function onGpsButtonClick() {
    const state = await getGeoPermissionState();
    if (state === "denied") {
      showEnableLocationInfoPopup();
      loadIpLocality();
      return;
    }
    requestDeviceGeo();
  }

  gpsBtn?.addEventListener("click", onGpsButtonClick);
  initGeoOnLoad();

  // --- Swipe + Video ---
  const container = $("#swipeContainer");
  let cards = container ? Array.from(container.querySelectorAll(".swipe-card")) : [];
  const adMap = new Map();
  const dotsEl = $("#dots");
  const toast = $("#toast");

  const panel = $("#panel");
  const panelBackdrop = $("#panelBackdrop");
  const panelSheet = $("#panelSheet");
  const panelHero = $("#panelHero");
  const panelClose = $("#panelClose");

  const SOUND_PREF_KEY = "solotias_sound_pref"; // "on" | "off"
  const AUDIO_UNLOCKED_KEY = "solotias_audio_unlocked"; // "1"
  const TOAST_ONCE_KEY = "solotias_toast_once"; // "1"

  let lastOpenedCardIndex = null;


/* =========================
   DATA INTEGRATION (Back4App/Parse Cloud)
   ========================= */
const DEFAULT_WEB = "solotias.com";
const DEFAULT_SERVICE = "webs";
const DEFAULT_GENDER = "female";

// Servicio activo (se puede cambiar desde el menú: Teléfono/Vídeo)
let currentService = DEFAULT_SERVICE;
// Configurable endpoints/headers without hardcoding secrets.
// You can define these in a small inline script before app.js if needed:
// window.__PARSE_FUNCTION_URL, window.__PARSE_APP_ID, window.__PARSE_REST_KEY
const PARSE_FUNCTION_URL = "/api/ads.php";


// --- Infinite paging (prefetch) ---
const ADS_LIMIT = 20;        // cantidad por página (limit)
const PREFETCH_OFFSET = 5;   // cuando queden 5 cartas para terminar, precarga

let adsPage = 1;
let adsDynamicEnabled = false;
let adsPrefetching = false;
let adsExhausted = false;
let isReloadingService = false;
const seenAdIds = new Set();

// Loader overlay (inline styles para no tocar CSS)
let adsLoaderEl = null;
function ensureAdsLoader() {
  if (adsLoaderEl) return adsLoaderEl;
  const el = document.createElement("div");
  el.id = "adsLoader";
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = [
    "position:fixed",
    "inset:0",
    "display:none",
    "align-items:center",
    "justify-content:center",
    "background:rgba(255,255,255,.75)",
    "backdrop-filter:saturate(1.2) blur(6px)",
    "-webkit-backdrop-filter:saturate(1.2) blur(6px)",
    "z-index:9999"
  ].join(";");
  el.innerHTML = `
    <div style="
      width:44px;height:44px;border-radius:999px;
      border:4px solid rgba(0,0,0,.12);
      border-top-color: rgba(0,0,0,.55);
      animation: adsSpin .8s linear infinite;
    "></div>
    <style>
      @keyframes adsSpin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
    </style>
  `;
  document.body.appendChild(el);
  adsLoaderEl = el;
  return el;
}
function showAdsLoader() {
  const el = ensureAdsLoader();
  el.style.display = "flex";
  el.setAttribute("aria-hidden", "false");
}
function hideAdsLoader() {
  if (!adsLoaderEl) return;
  adsLoaderEl.style.display = "none";
  adsLoaderEl.setAttribute("aria-hidden", "true");
}

// Recargar deck desde página 1 con un service concreto
// Recargar deck desde página 1 con un service concreto
async function reloadAdsWithService(service) {
  if (isReloadingService) return;
  isReloadingService = true;

  currentService = String(service || DEFAULT_SERVICE).toLowerCase();
  console.log("SERVICE ACTUAL:", currentService); // 👈 PONLO AQUÍ
  // mantenemos compatibilidad interna: normalizeService convierte videocalls->videocalls (UI)
  // pero aquí enviamos EXACTO lo que el backend espera.
  if (currentService !== "webs" && currentService !== "videocalls") {
    currentService = DEFAULT_SERVICE;
  }

  // reset estado paging
  adsPage = 1;
  adsExhausted = false;
  adsPrefetching = false;

  showAdsLoader();
  try {
    const ads = await fetchAdvertisements({
      web: DEFAULT_WEB,
      service: currentService,
      gender: DEFAULT_GENDER,
      page: 1,
      limit: ADS_LIMIT,
    });

    if (ads && ads.length) {
      adsDynamicEnabled = true;
      renderAdvertisementsIntoDeck(ads);
      index = 0;
      updateStack();
      bindSoundButtons(); // nuevas cards
    } else {
      // si no hay resultados, marcamos como agotado
      adsExhausted = true;
    }
  } catch (e) {
    console.warn("[ads] reload failed:", e);
  } finally {
    hideAdsLoader();
    isReloadingService = false;
  }
}

// Exponer para handlers fuera del IIFE / scopes
window.reloadAdsWithService = reloadAdsWithService;


function randInt(maxExclusive) {
  return Math.floor(Math.random() * Math.max(1, maxExclusive));
}
function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[randInt(arr.length)];
}
function weightedPick({ videoItems = [], photoItems = [], videoWeight = 0.7 }) {
  const hasVideos = Array.isArray(videoItems) && videoItems.length > 0;
  const hasPhotos = Array.isArray(photoItems) && photoItems.length > 0;

  if (hasVideos && !hasPhotos) return { kind: "video", item: pickRandom(videoItems) };
  if (!hasVideos && hasPhotos) return { kind: "image", item: pickRandom(photoItems) };
  if (!hasVideos && !hasPhotos) return { kind: "none", item: null };

  const r = Math.random();
  if (r < videoWeight) return { kind: "video", item: pickRandom(videoItems) };
  return { kind: "image", item: pickRandom(photoItems) };
}

function getPrincipalPhoto(ad) {
  const photos = Array.isArray(ad?.photos) ? ad.photos : [];
  return photos.find(p => p?.principal) || photos[0] || null;
}

function normalizeService(service) {
  const s = String(service || DEFAULT_SERVICE).toLowerCase();
  return (s === "videocalls" || s === "videocalls" || s === "video") ? "videocalls" : "webs";
}

function availabilityText(ad) {
  const service = normalizeService(ad?.service);
  if (ad?.available) {
    return service === "videocalls"
      ? "Estoy disponible, Videollámame"
      : "Estoy disponible, Llámame";
  }
  return "No estoy disponible ahora";
}

function ctaText(service) {
  return normalizeService(service) === "videocalls" ? "Videollamada" : "Llámame";
}

function buildPhoneIconSvg() {
  // SVG moderno (teléfono) - creado desde cero
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <path fill="currentColor" d="M16.7 13.1l-1.9-.9a2.2 2.2 0 0 0-2.3.4l-.7.7a11.7 11.7 0 0 1-4.9-4.9l.7-.7a2.2 2.2 0 0 0 .4-2.3L7.1 3.3A2.2 2.2 0 0 0 4.7 2l-1.2.3A2.2 2.2 0 0 0 2 4.5c0 9.7 7.8 17.5 17.5 17.5a2.2 2.2 0 0 0 2.2-1.5l.3-1.2a2.2 2.2 0 0 0-1.3-2.4z"/>
    </svg>
  `;
}

function buildVideoIconSvg() {
  // SVG moderno (cámara) - creado desde cero
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <path fill="currentColor" d="M4.8 6.6A2.8 2.8 0 0 1 7.6 3.8h7A2.8 2.8 0 0 1 17.4 6.6v10.8a2.8 2.8 0 0 1-2.8 2.8h-7a2.8 2.8 0 0 1-2.8-2.8V6.6z"/>
      <path fill="currentColor" d="M18.6 9.3l3.1-2a1.2 1.2 0 0 1 1.8 1v7.4a1.2 1.2 0 0 1-1.8 1l-3.1-2V9.3z" opacity=".95"/>
    </svg>
  `;
}

async function fetchAdvertisements({
  service = DEFAULT_SERVICE,
  gender = DEFAULT_GENDER,
  web = DEFAULT_WEB,
  province_id = "",
  page = 1,
  limit = 20,
} = {}) {
  const qs = new URLSearchParams({
    service,
    gender,
    web,
    page: String(page),
    limit: String(limit),
  });

  if (province_id) qs.set("province_id", province_id);

  const res = await fetch(`${PARSE_FUNCTION_URL}?${qs.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) throw new Error("api_data_advertisments: network error");

  const raw = await res.json();

  // 👇 ESTA ES LA CLAVE
  const data = (raw && raw.result && typeof raw.result === "object")
    ? raw.result
    : raw;

  if (!data || data.ok !== true || !Array.isArray(data.advertisements)) {
    throw new Error("api_data_advertisments: invalid payload");
  }

  return data.advertisements;
}



function createCardElFromAd(ad) {
  const photos = Array.isArray(ad?.photos) ? ad.photos : [];
  const photoItems = photos.filter(p => p?.photo_url);
  const videoItems = photos.filter(p => p?.video_url);

  const choice = weightedPick({ videoItems, photoItems, videoWeight: 0.7 });
  const kind = choice.kind;
  const item = choice.item;

  const card = document.createElement("article");
  card.className = "swipe-card";
  card.dataset.adId = ad?.objectId || "";
  card.dataset.available = ad?.available ? "true" : "false";
  card.dataset.service = normalizeService(ad?.service);
  card.dataset.type = kind === "video" ? "video" : "image";

  // Availability pill
  const avail = document.createElement("div");
  avail.className = "availability";
  avail.setAttribute("aria-label", "Disponible");
  const dot = document.createElement("span");
  dot.className = "avail-dot";
  dot.setAttribute("aria-hidden", "true");
  dot.style.background = ad?.available ? "#22c55e" : "#ef4444";
  dot.style.boxShadow = ad?.available ? "0 0 0 4px rgba(34,197,94,.18)" : "0 0 0 4px rgba(239,68,68,.18)";
  const at = document.createElement("span");
  at.className = "availability-text";
  at.textContent = availabilityText(ad);
  avail.appendChild(dot);
  avail.appendChild(at);
  card.appendChild(avail);

  // Media
  if (kind === "video" && item?.video_url) {
    const v = document.createElement("video");
    v.src = item.video_url;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    card.appendChild(v);

    const snd = document.createElement("button");
    snd.type = "button";
    snd.className = "sound-toggle";
    snd.setAttribute("aria-label", "Activar sonido");
    snd.innerHTML = `<span aria-hidden="true" class="sound-toggle__icon"></span><span class="sr-only">Silenciar</span>`;
    card.appendChild(snd);
  } else if (item?.photo_url) {
    const img = document.createElement("img");
    img.src = item.photo_url;
    img.alt = `Foto de ${ad?.name || ""}`.trim() || "Foto";
    card.appendChild(img);
  } else {
    // fallback: placeholder vacío (mantiene layout)
    const img = document.createElement("img");
    img.src = "img/foto1.jpg";
    img.alt = "Foto";
    card.appendChild(img);
  }

  // Fade
  const fade = document.createElement("div");
  fade.className = "card-fade";
  card.appendChild(fade);

  // Bottom overlay (meta + CTA)
  const bottom = document.createElement("div");
  bottom.className = "overlay-bottom";

  const meta = document.createElement("div");
  meta.className = "meta";

  const rowName = document.createElement("div");
  rowName.className = "meta-row name";
  rowName.innerHTML = `
    <span aria-hidden="true" class="verified">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M12 2l2.2 2.6 3.3-.3.8 3.2 3 1.5-1.5 3 1.5 3-3 1.5-.8 3.2-3.3-.3L12 22l-2.2-2.6-3.3.3-.8-3.2-3-1.5L4.2 12 2.7 9l3-1.5.8-3.2 3.3.3L12 2z" fill="#0a84ff"></path>
        <path d="M10.4 12.4l-1.6-1.6-1.1 1.1 2.7 2.7 5.9-5.9-1.1-1.1-4.8 4.8z" fill="#ffffff"></path>
      </svg>
    </span>
    <span class="name-text"></span>
  `;
  rowName.querySelector(".name-text").textContent = `${ad?.name || "—"}, ${ad?.age || ""}`.replace(", ", ", ").trim();
  meta.appendChild(rowName);

  const rowLoc = document.createElement("div");
  rowLoc.className = "meta-row loc";
  rowLoc.innerHTML = `
    <span aria-hidden="true" class="flag">
      <svg height="14" width="22" viewBox="0 0 3 2" preserveAspectRatio="none">
        <rect width="3" height="2" fill="#aa151b"></rect>
        <rect y="0.5" width="3" height="1" fill="#f1bf00"></rect>
      </svg>
    </span>
    <span class="loc-text"></span>
  `;
  rowLoc.querySelector(".loc-text").textContent = [ad?.city, ad?.province].filter(Boolean).join(", ") || "—";
  meta.appendChild(rowLoc);

  const rowTag = document.createElement("div");
  rowTag.className = "meta-row tagline";
  rowTag.textContent = ad?.message || "";
  meta.appendChild(rowTag);

  bottom.appendChild(meta);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "call-btn " + (ad?.available ? "is-available" : "is-unavailable");
  btn.setAttribute("aria-label", normalizeService(ad?.service) === "videocalls" ? "Videollamada" : "Llamar");
  if (!ad?.available) {
    btn.setAttribute("aria-disabled", "true");
  }

  const isVideoCall = normalizeService(ad?.service) === "videocalls";
btn.dataset.callMode = isVideoCall ? "video" : "voice";
btn.innerHTML = `
  <span aria-hidden="true" class="call-ico">${isVideoCall ? buildVideoIconSvg() : buildPhoneIconSvg()}</span>
  <span class="call-text">${isVideoCall ? "Videollamada" : "Llámame"}</span>
`;

  bottom.appendChild(btn);

  card.appendChild(bottom);

  return card;
}

function renderAdvertisementsIntoDeck(ads) {
  if (!container) return;

  // Limpiar map y container (sin tocar otros nodos fuera del deck)
  adMap.clear();
  seenAdIds.clear();
  container.innerHTML = "";

  (ads || []).forEach((ad) => {
    if (!ad || !ad.objectId) return;
    if (seenAdIds.has(ad.objectId)) return;

    seenAdIds.add(ad.objectId);
    adMap.set(ad.objectId, ad);

    const card = createCardElFromAd(ad);
    container.appendChild(card);
  });

  // re-snapshot cards
  cards = Array.from(container.querySelectorAll(".swipe-card"));

  // Estado paginación
  adsPage = 1;
  adsExhausted = !ads || ads.length < ADS_LIMIT;
}

function appendAdvertisementsIntoDeck(ads) {
  if (!container) return 0;

  let added = 0;

  (ads || []).forEach((ad) => {
    if (!ad || !ad.objectId) return;
    if (seenAdIds.has(ad.objectId)) return;

    seenAdIds.add(ad.objectId);
    adMap.set(ad.objectId, ad);

    const card = createCardElFromAd(ad);
    container.appendChild(card);
    added += 1;
  });

  if (added > 0) {
    cards = Array.from(container.querySelectorAll(".swipe-card"));
  }

  return added;
}

async function prefetchNextAdsPageIfNeeded() {
  if (isReloadingService) return;
  if (!adsDynamicEnabled) return;
  if (adsExhausted) return;
  if (adsPrefetching) return;
  if (!cards || cards.length === 0) return;

  // Disparar cuando queden PREFETCH_OFFSET cartas para terminar
  // Ej: cards.length=20, PREFETCH_OFFSET=5 => triggerIndex=14 (carta 15)
  const triggerIndex = Math.max(0, cards.length - (PREFETCH_OFFSET + 1));
  if (index < triggerIndex) return;

  adsPrefetching = true;

  try {
    const nextPage = adsPage + 1;

    const nextAds = await fetchAdvertisements({
      web: DEFAULT_WEB,
      service: currentService,
      gender: DEFAULT_GENDER,
      page: nextPage,
      limit: ADS_LIMIT,
    });

    const added = appendAdvertisementsIntoDeck(nextAds);

    // Si devuelve menos que el limit o no añade nada => fin
    if (!nextAds || nextAds.length < ADS_LIMIT || added === 0) {
      adsExhausted = true;
    } else {
      adsPage = nextPage;
    }
  } catch (e) {
    console.warn("[ads] prefetch next page failed:", e);
  } finally {
    adsPrefetching = false;
  }
}

function enableListadosSwipeToDelete(listRootEl, { onDelete } = {}) {
  const ACTION_W = 112; // Debe coincidir con el CSS
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let activeRow = null;
  let dragging = false;

  function closeAll(exceptRow = null) {
    listRootEl.querySelectorAll(".listados-row.is-open").forEach((r) => {
      if (r !== exceptRow) r.classList.remove("is-open");
      const fg = r.querySelector(".listados-row__fg");
      if (fg) {
        fg.style.transition = "";
        fg.style.transform = "";
      }
    });
  }

  // Cerrar si se toca fuera
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".listados-row")) {
      closeAll();
    }
  });

  // Click en botón rojo "Eliminar"
  listRootEl.addEventListener("click", (e) => {
    const delBtn = e.target.closest(".listados-row__delete");
    if (!delBtn) return;

    const row = delBtn.closest(".listados-row");
    if (!row) return;

    const id = row.dataset.rowId || "";
    onDelete?.(id, row);
  });

  listRootEl.addEventListener("pointerdown", (e) => {
    const fg = e.target.closest(".listados-row__fg");
    if (!fg) return;

    activeRow = fg.closest(".listados-row");
    if (!activeRow) return;

    closeAll(activeRow);

    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    dragging = false;

    fg.setPointerCapture?.(e.pointerId);
  });

  listRootEl.addEventListener("pointermove", (e) => {
    if (!activeRow) return;

    const fg = activeRow.querySelector(".listados-row__fg");
    if (!fg) return;

    const mx = e.clientX - startX;
    const my = e.clientY - startY;

    if (!dragging) {
      if (Math.abs(mx) < 8) return; // umbral mínimo
      if (Math.abs(my) > Math.abs(mx)) {
        activeRow = null; // scroll vertical
        return;
      }
      dragging = true;
      fg.style.transition = "none";
    }

    dx = Math.min(0, Math.max(-ACTION_W, mx)); // solo hacia izquierda
    fg.style.transform = `translateX(${dx}px)`;
  });

  function endGesture() {
    if (!activeRow) return;

    const fg = activeRow.querySelector(".listados-row__fg");
    if (!fg) {
      activeRow = null;
      return;
    }

    fg.style.transition = "";
    fg.style.transform = "";

    if (dx <= -ACTION_W * 0.5) {
      activeRow.classList.add("is-open");
    } else {
      activeRow.classList.remove("is-open");
    }

    activeRow = null;
    dragging = false;
    dx = 0;
  }

  listRootEl.addEventListener("pointerup", endGesture);
  listRootEl.addEventListener("pointercancel", endGesture);
}
// ===== Swipe-to-delete Listados =====

let listadosSwipeReady = false;

function initListadosSwipe() {
  if (listadosSwipeReady) return;

  const list = document.getElementById("listadosList");
  if (!list) return;

  enableListadosSwipeToDelete(list, {
    onDelete: (id, row) => {
      if (row) {
        row.style.transition = "opacity 0.2s ease";
        row.style.opacity = "0";
        setTimeout(() => {
          row.remove();
        }, 200);
      }
    }
  });

  listadosSwipeReady = true;
}
window.initListadosSwipe = initListadosSwipe;

function getAdFromCard(card) {
  const id = card?.dataset?.adId || "";
  return id ? adMap.get(id) : null;
}

function populateProfilePanel(ad) {
  if (!ad) return;

  // Header: name + age, loc
  const nameEl = document.querySelector(".profile-name");
  const locEl = document.querySelector(".profile-loc-text");
  if (nameEl) nameEl.textContent = `${ad.name || "—"}, ${ad.age || ""}`.trim();
  if (locEl) locEl.textContent = [ad.city, ad.province].filter(Boolean).join(", ") || "—";

  // ===============================
  // Gallery thumbnails
  // ===============================
  const gallery = document.querySelector(".profile-gallery");
  if (gallery) {
    gallery.innerHTML = "";
    const photos = Array.isArray(ad.photos) ? ad.photos : [];

    photos.forEach((p) => {
      const isVideo = !!p?.video_url;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "thumb";
      btn.setAttribute("aria-label", isVideo ? "Abrir vídeo" : "Abrir foto");
      btn.setAttribute("data-media-type", isVideo ? "video" : "image");
      btn.setAttribute("data-src", isVideo ? p.video_url : p.photo_url);

      if (isVideo) {
        const v = document.createElement("video");

        v.src = p.video_url;
        v.muted = true;
        v.playsInline = true;
        v.autoplay = true;
        v.loop = true;
        v.preload = "metadata";

        // Safari / iOS seguridad extra
        v.setAttribute("muted", "");
        v.setAttribute("playsinline", "");
        v.setAttribute("autoplay", "");
        v.setAttribute("loop", "");

        if (p.thumbnail_url) {
          v.poster = p.thumbnail_url;
        }

        btn.appendChild(v);

        // Intentar reproducir (silencioso => permitido)
        requestAnimationFrame(() => {
          v.play().catch(() => {});
        });

      } else {
        const img = document.createElement("img");
        img.alt = "Foto";
        img.src = p.photo_url;
        btn.appendChild(img);
      }

      gallery.appendChild(btn);
    });
  }

  // ===============================
  // Text blocks
  // ===============================
  const blocks = document.querySelectorAll(".profile-sections .profile-block .profile-text");
  if (blocks && blocks.length >= 4) {
    blocks[0].textContent = ad.looking_for || "";
    blocks[1].textContent = ad.description || "";
    blocks[2].textContent = ad.message || "";
    blocks[3].textContent = ad.seo_text || "";
  }

// ===============================
// CTA block final
// ===============================
const ctaTitle = document.querySelector(".profile-cta-title");
const ctaBtn = document.querySelector(".profile-cta .call-btn");
const ctaBtnText = document.querySelector(".profile-cta .call-text");
const ctaIco = document.querySelector(".profile-cta .call-ico");

const service = normalizeService(ad.service);
const available = !!ad.available;

if (ctaBtnText) {
  ctaBtnText.textContent = (service === "videocalls") ? "Videollamada" : "Llamar";
}

if (ctaIco) {
  ctaIco.innerHTML = (service === "videocalls") ? buildVideoIconSvg() : buildPhoneIconSvg();
}

if (ctaBtn) {
  ctaBtn.setAttribute("aria-label", (service === "videocalls") ? "Videollamada" : "Llamar");

  if (available) {
    ctaBtn.classList.remove("is-unavailable");
    ctaBtn.setAttribute("aria-disabled", "false");
  } else {
    ctaBtn.classList.add("is-unavailable");
    ctaBtn.setAttribute("aria-disabled", "true");
  }
}

if (ctaTitle) {
  if (available) {
    ctaTitle.textContent =
      (service === "videocalls")
        ? "Videollama a esta TIA que está disponible ahora"
        : "Llama a esta TIA que está disponible ahora";
  } else {
    ctaTitle.textContent = "Ahora mismo no está disponible, inténtalo más tarde";
  }
}
}


async function initDynamicAds() {
  try {
    const ads = await fetchAdvertisements({
      web: DEFAULT_WEB,
      service: currentService,
      gender: DEFAULT_GENDER,
      page: 1,
      limit: ADS_LIMIT,
    });

    if (ads && ads.length) {
      adsDynamicEnabled = true;
      adsPrefetching = false;
      // render setea adsPage/adsExhausted/seenAdIds
      renderAdvertisementsIntoDeck(ads);
      return true;
    }
  } catch (err) {
    console.warn("[ads] fallback to static cards:", err);
  }

  // fallback: keep whatever is in HTML
  adsDynamicEnabled = false;
  adsPrefetching = false;
  adsExhausted = true;

  cards = container ? Array.from(container.querySelectorAll(".swipe-card")) : [];
  return false;
}

  let index = 0;
  let dragging = false;
  let startX = 0,
    startY = 0;
  let dx = 0,
    dy = 0;
  let underlayDirection = 0; // -1 izquierda, 1 derecha, 0 ninguno
  let startTime = 0;

  function showToastOnce(msg) {
    if (!toast) return;
    if (localStorage.getItem(TOAST_ONCE_KEY) === "1") return;
    localStorage.setItem(TOAST_ONCE_KEY, "1");
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 1100);
  }

  function getSoundPref() {
    return localStorage.getItem(SOUND_PREF_KEY) || "off";
  }
  function setSoundPref(v) {
    localStorage.setItem(SOUND_PREF_KEY, v);
  }
  function isAudioUnlocked() {
    return localStorage.getItem(AUDIO_UNLOCKED_KEY) === "1";
  }
  function setAudioUnlocked() {
    localStorage.setItem(AUDIO_UNLOCKED_KEY, "1");
  }

  function buildDots() {
    if (!dotsEl) return;
    dotsEl.innerHTML = "";
    cards.forEach((_, i) => {
      const d = document.createElement("div");
      d.className = "dot" + (i === index ? " active" : "");
      dotsEl.appendChild(d);
    });
  }

  function updateSoundButton(card) {
    const video = card.querySelector("video");
    const btn = card.querySelector(".sound-toggle");
    if (!btn) return;

    if (!video) {
      btn.style.display = "none";
      return;
    }

    btn.style.display = "grid";
    const isMuted = video.muted;

    // SVG sin emojis
    btn.innerHTML = isMuted
      ? `<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
           <path fill="currentColor" d="M5 10v4h3l4 4V6L8 10H5z"></path>
           <path fill="currentColor" d="M16.5 12l2.5 2.5-1.1 1.1L15.4 13.1l-2.5 2.5-1.1-1.1 2.5-2.5-2.5-2.5 1.1-1.1 2.5 2.5 2.5-2.5 1.1 1.1-2.5 2.5z"></path>
         </svg>`
      : `<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
           <path fill="currentColor" d="M5 10v4h3l4 4V6L8 10H5z"></path>
           <path fill="currentColor" d="M14.5 8.5a1 1 0 0 1 1.4 0 5 5 0 0 1 0 7.1 1 1 0 0 1-1.4-1.4 3 3 0 0 0 0-4.2 1 1 0 0 1 0-1.4z"></path>
           <path fill="currentColor" d="M17.3 5.7a1 1 0 0 1 1.4 0 9 9 0 0 1 0 12.6 1 1 0 1 1-1.4-1.4 7 7 0 0 0 0-9.8 1 1 0 0 1 0-1.4z"></path>
         </svg>`;

    btn.setAttribute("aria-label", isMuted ? "Activar sonido" : "Desactivar sonido");
  }

    function forceMuteActiveCardVideo() {
    try {
      const card = cards?.[index];
      const v = card?.querySelector?.("video");
      if (v) {
        if (!v.muted) v.muted = true;
        if (typeof updateSoundButton === "function") updateSoundButton(card);
      }

      const ph = document.getElementById("panelHero") || window.panelHero;
      const pv = ph?.querySelector?.("video");
      if (pv && !pv.muted) pv.muted = true;

    } catch (e) {
      console.warn("[forceMuteActiveCardVideo] error:", e);
    }
  }
  window.forceMuteActiveCardVideo = forceMuteActiveCardVideo;


  function updateMediaPlayback() {
    const pref = getSoundPref();
    const unlocked = isAudioUnlocked();

    cards.forEach((card, i) => {
      const video = card.querySelector("video");
      if (!video) return;

      const active = i === index;

      if (active) {
        video.playsInline = true;
        video.muted = !(pref === "on" && unlocked);
        updateSoundButton(card);
        video.play().catch(() => {});
      } else {
        try {
          video.pause();
          video.currentTime = 0;
        } catch {}
        video.muted = true;
        updateSoundButton(card);
      }
    });
  }

		
 

function updateStack(){
  cards.forEach((c,i)=>{
    c.classList.toggle("active", i === index);
    c.classList.toggle("peek", i === index+1);
    c.classList.remove("peek-prev");   // <- AÑADIDO
    if(i !== index){
      c.style.transform="";
      c.style.opacity="";
      c.style.transition="";
    }
  });
  buildDots();
  updateMediaPlayback();

  // Prefetch siguiente página cuando se acerca al final
  prefetchNextAdsPageIfNeeded();

  // FIX Chrome Android – repintar topbar tras cambio de carta
  const topbar = document.querySelector(".topbar");
  if (topbar) {
    // Forzamos un repaint/composite rápido (workaround Chrome Android)
  topbar.style.transform = "translateZ(0)";
  void topbar.offsetHeight;
  topbar.style.transform = "";


  }
}



		
  function setCardTransform(card, x, y) {
    const rot = Math.max(-12, Math.min(12, x / 18));
    card.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`;
  }

  function resetCard(card) {
    card.style.transition = "transform 220ms cubic-bezier(.2,.9,.2,1)";
    setCardTransform(card, 0, 0);
    setTimeout(() => (card.style.transition = ""), 240);
  }

  function flyOut(card, dir) {
    const w = container.clientWidth;
    const x = dir * (w + 180);
    const y = dy * 0.35;
    card.style.transition = "transform 240ms ease-out, opacity 240ms ease-out";
    card.style.opacity = "0";
    setCardTransform(card, x, y);
  }

  function goNext() {
    if (index >= cards.length - 1) return;
    index++;
    updateStack();
  }

  function goPrev() {
    if (index <= 0) return;
    index--;
    updateStack();
  }

  function toggleSoundActive() {
    const card = cards[index];
    if (!card) return;
    const video = card.querySelector("video");
    if (!video) return;

    const next = getSoundPref() === "on" ? "off" : "on";
    setSoundPref(next);

    if (next === "on") {
      video.muted = false;
      video
        .play()
        .then(() => {
          setAudioUnlocked();
          updateSoundButton(card);
          showToastOnce("Sonido activado");
          updateMediaPlayback();
        })
        .catch(() => {
          video.muted = true;
          updateSoundButton(card);
          updateMediaPlayback();
        });
    } else {
      video.muted = true;
      updateSoundButton(card);
      updateMediaPlayback();
    }
  }

  function bindSoundButtons() {
    cards.forEach((card) => {
      const btn = card.querySelector(".sound-toggle");
      if (!btn) return;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSoundActive();
      });
    });
  }

  // --- Panel (swipe up) + shared element ---
  function getActiveMediaEl(card) {
    return card.querySelector("img") || card.querySelector("video");
  }

  function buildPanelHero(card) {
    if (!panelHero) return;
    panelHero.innerHTML = "";
    const img = card.querySelector("img");
    const vid = card.querySelector("video");

    if (img) {
      const heroImg = document.createElement("img");
      heroImg.src = img.currentSrc || img.src;
      heroImg.alt = img.alt || "";
      panelHero.appendChild(heroImg);
      return;
    }

    if (vid) {
      const heroVid = document.createElement("video");
      heroVid.src = vid.currentSrc || vid.src;
      heroVid.muted = vid.muted;
      heroVid.playsInline = true;
      heroVid.controls = true;
      heroVid.loop = true;
      heroVid.preload = "metadata";
      panelHero.appendChild(heroVid);
      heroVid.play().catch(() => {});
    }
  }

function openPanelFromCard(card) {
  if (!panel || !panelHero || !panelSheet) return;

  lastOpenedCardIndex = index;

  const mediaEl = getActiveMediaEl(card);
  if (!mediaEl) return;

  // Abrimos panel inmediato y sin transición del sheet (evita menguar)
  panel.hidden = false;
  panel.removeAttribute("hidden");
  panel.classList.remove("hidden");
  panel.style.setProperty("--panelBackAlpha", "0");

  const prevTransition = panelSheet.style.transition;
  panelSheet.style.transition = "none";
  panel.classList.add("open");

  buildPanelHero(card);
  try { populateProfilePanel(getAdFromCard(card) || null); } catch {}
  panelHero.style.visibility = "hidden";

  // Forzar layout
  panelSheet.offsetHeight;

  const from = mediaEl.getBoundingClientRect();
  const to = panelHero.getBoundingClientRect();

  const clone = mediaEl.cloneNode(true);
  const wrapper = document.createElement("div");
  wrapper.className = "hero-clone";
  wrapper.style.left = `${from.left}px`;
  wrapper.style.top = `${from.top}px`;
  wrapper.style.width = `${from.width}px`;
  wrapper.style.height = `${from.height}px`;
  wrapper.style.opacity = "1";

  // ✅ SOLO el clon tiene esquinas redondeadas
  wrapper.style.borderRadius = "34px";
  wrapper.style.overflow = "hidden";
  wrapper.style.transform = "translateZ(0)";

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  panel.style.setProperty("--panelBackAlpha", "1");

  const durationMs = 420;
  const anim = wrapper.animate(
    [
      {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        opacity: 1,
        borderRadius: "34px",
      },
      {
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        opacity: 1,
        borderRadius: "0px",
      },
    ],
    {
      duration: durationMs,
      easing: "cubic-bezier(.16,1,.3,1)",
      fill: "forwards",
    }
  );

  const finish = () => {
    wrapper.remove();

    // ✅ Cross-fade mínimo para evitar salto visual
    panelHero.style.opacity = "0";
    panelHero.style.visibility = "visible";

    requestAnimationFrame(() => {
      panelHero.style.transition = "opacity 120ms ease";
      panelHero.style.opacity = "1";
      setTimeout(() => {
        panelHero.style.transition = "";
      }, 140);
    });

    panelSheet.style.transition = prevTransition;
  };

  // ✅ FIX ANDROID: garantizar limpieza aunque onfinish falle o se cancele
  let done = false;
  const safeFinish = () => {
    if (done) return;
    done = true;
    finish();
  };

  anim.onfinish = safeFinish;
  anim.oncancel = safeFinish;

  // ✅ Fallback universal (Android incluido)
  setTimeout(safeFinish, durationMs + 140);
}



  // Header Telegram: aplanar al hacer scroll y volver al subir
// Header Telegram: 3:5 al abrir -> 1:1 al hacer scroll -> vuelve a 3:5 al subir
let heroScrollBound = false;
function initHeroCollapseOnScroll() {
  if (heroScrollBound) return;
  if (!panel || !panelHero) return;

  const scroller = document.querySelector(".panel-body") || panelSheet;
  if (!scroller) return;

  heroScrollBound = true;

  const BASE_RATIO = 3 / 5; // width/height = 0.6
  const MIN_RATIO = 1;      // 1:1 => width/height = 1
  const MAX_SCROLL = 180;   // px para colapsar del todo (ajstalo)

  function applyForScroll(y) {
    const t = Math.min(1, Math.max(0, y / MAX_SCROLL));
    const r = BASE_RATIO + (MIN_RATIO - BASE_RATIO) * t; // width/height

    const w = panelSheet?.clientWidth || panelHero.clientWidth || window.innerWidth;
    const h = Math.round(w / r);
    panelHero.style.height = `${h}px`;
  }

  function onScroll() {
    applyForScroll(scroller.scrollTop || 0);
  }

  function reset() {
    // vuelve a 3:5
    applyForScroll(0);
  }

  scroller.addEventListener("scroll", onScroll, { passive: true });
  panel.addEventListener("panel:close", reset);

  // Recalcular si cambia el ancho (rotacin / resize)
  window.addEventListener(
    "resize",
    () => {
      if (panel && !panel.classList.contains("hidden")) onScroll();
    },
    { passive: true }
  );

  // Estado inicial
  reset();
}


function closePanel() {
  if (!panel) return;

  const topbar = document.querySelector(".topbar");

  // Hard repaint específico Chrome Android (sin parpadeo notable)
  

  panel.dispatchEvent(new Event("panel:close"));

  const card = lastOpenedCardIndex != null ? cards[lastOpenedCardIndex] : null;
  const fromEl = panelHero?.querySelector("img, video");
  const toEl = card ? card.querySelector("img") || card.querySelector("video") : null;

  // Cierre simple si no hay shared-element
  if (!fromEl || !toEl) {
    panel.classList.remove("open");
    panel.style.setProperty("--panelBackAlpha", "0");

    setTimeout(() => {
      panel.classList.add("hidden");
      if (panelHero) panelHero.innerHTML = "";
      panelHero.style.visibility = "visible";
      panel.style.removeProperty("--panelBackAlpha");
      if (panelSheet) panelSheet.style.transform = "";

      hardRepaintTopbar();
    }, 260);

    return;
  }

  const from = fromEl.getBoundingClientRect();
  const to = toEl.getBoundingClientRect();

  const clone = fromEl.cloneNode(true);
  const wrapper = document.createElement("div");
  wrapper.className = "hero-clone";
  wrapper.style.left = `${from.left}px`;
  wrapper.style.top = `${from.top}px`;
  wrapper.style.width = `${from.width}px`;
  wrapper.style.height = `${from.height}px`;
  wrapper.style.opacity = "1";
  wrapper.style.borderRadius = "34px";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  panelHero.style.visibility = "hidden";

  panel.classList.remove("open");
  panel.style.setProperty("--panelBackAlpha", "0");

  const durationMs = 420;
  const anim = wrapper.animate(
    [
      {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        opacity: 1,
      },
      {
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        opacity: 0.98,
      },
    ],
    {
      duration: durationMs,
      easing: "cubic-bezier(.16,1,.3,1)",
      fill: "forwards",
    }
  );

  const finish = () => {
    wrapper.remove();
    panel.classList.add("hidden");
    if (panelHero) panelHero.innerHTML = "";
    panelHero.style.visibility = "visible";
    panel.style.removeProperty("--panelBackAlpha");
    if (panelSheet) panelSheet.style.transform = "";

    hardRepaintTopbar();
  };

  let done = false;
  const safeFinish = () => {
    if (done) return;
    done = true;
    finish();
  };

  anim.onfinish = safeFinish;
  anim.oncancel = safeFinish;
  setTimeout(safeFinish, durationMs + 140);
}





  panelBackdrop?.addEventListener("click", closePanel);
  panelClose?.addEventListener("click", closePanel);

  // --- Drag down con SNAP (bounce / inercia) ---
function initPanelDragSnap() {
  if (!panel || !panelSheet) return;

  let pActive = false;
  let pDragging = false;
  let pStartY = 0;
  let pDy = 0;
  let pStartT = 0;

  const START_THRESHOLD = 10; // px antes de considerar drag

  function setY(y) {
    panelSheet.style.transition = "";
    panelSheet.style.transform = `translateY(${Math.max(0, y)}px)`;
    const prog = Math.min(1, Math.max(0, y / 240));
    panel.style.setProperty("--panelBackAlpha", String(1 - prog));
  }

  function snapOpen(fromY) {
    if (!pDragging) return;

    panelSheet.style.transition = "";
    panelSheet
      .animate(
        [
          { transform: `translateY(${Math.max(0, fromY)}px)` },
          { transform: "translateY(-10px)" },
          { transform: "translateY(0px)" },
        ],
        { duration: 420, easing: "cubic-bezier(.2,.9,.2,1)" }
      )
      .onfinish = () => {
        panelSheet.style.transform = "translateY(0px)";
        panel.style.setProperty("--panelBackAlpha", "1");
      };
  }

  function snapClose(fromY) {
    const h = Math.max(window.innerHeight, 700);
    panelSheet.style.transition = "";
    panelSheet
      .animate(
        [
          { transform: `translateY(${Math.max(0, fromY)}px)` },
          { transform: `translateY(${h}px)` },
        ],
        { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" }
      )
      .onfinish = () => closePanel();

    panel.style.setProperty("--panelBackAlpha", "0");
  }

  function start(clientY) {
    pActive = true;
    pDragging = false;
    pStartY = clientY;
    pDy = 0;
    pStartT = Date.now();
    panelSheet.style.transition = "";
  }

  function move(clientY) {
    if (!pActive) return;

    const rawDy = clientY - pStartY;

    // No es drag todava: espera a pasar el umbral
    if (!pDragging) {
      if (rawDy < START_THRESHOLD) return;
      pDragging = true;
    }

    pDy = rawDy;

    // resistencia hacia arriba
    if (pDy < 0) pDy = pDy * 0.25;

    setY(pDy);
  }

  function end() {
    if (!pActive) return;
    pActive = false;

    // Si fue toque (sin drag), salimos sin hacer nada
    if (!pDragging) return;

    const dt = Date.now() - pStartT;
    const v = pDy / Math.max(1, dt); // px/ms

    const CLOSE_DIST = 120;
    const CLOSE_VEL = 0.85;

    if (pDy > CLOSE_DIST || v > CLOSE_VEL) {
      snapClose(pDy);
      return;
    }
    snapOpen(pDy);
  }

  const usePointer = "PointerEvent" in window;

  // ? Solo permitimos drag-to-close si el gesto empieza en la cabecera
  const dragHandle = panelHero || panelSheet;

  function canStartCloseGesture(eTarget) {
    // 1) Debe empezar en panelHero
    if (panelHero && !eTarget.closest("#panelHero")) return false;

    // 2) Recomendado: solo permitir cerrar si el contenido est arriba del todo
    const scroller = document.querySelector(".panel-body");
    if (scroller && scroller.scrollTop > 0) return false;

    return true;
  }

  if (usePointer) {
    dragHandle.addEventListener("pointerdown", (e) => {
      if (panel.classList.contains("hidden")) return;
      if (!canStartCloseGesture(e.target)) return;

      start(e.clientY);
      dragHandle.setPointerCapture?.(e.pointerId);
    });

    dragHandle.addEventListener("pointermove", (e) => move(e.clientY));
    dragHandle.addEventListener("pointerup", end);
    dragHandle.addEventListener("pointercancel", end);
  } else {
    dragHandle.addEventListener(
      "touchstart",
      (e) => {
        if (panel.classList.contains("hidden")) return;
        if (!canStartCloseGesture(e.target)) return;

        start(e.touches[0].clientY);
      },
      { passive: true }
    );

    dragHandle.addEventListener(
      "touchmove",
      (e) => move(e.touches[0].clientY),
      { passive: true }
    );

    dragHandle.addEventListener("touchend", end, { passive: true });
    dragHandle.addEventListener("touchcancel", end, { passive: true });
  }
}


  // --- Swipe gestures on cards ---
  function activeCard() {
    return cards[index];
  }

    function clearUnderlays(){
    cards.forEach(c => c.classList.remove("peek-prev"));
  }

  function warmCardMedia(card){
  if (!card) return;

  const img = card.querySelector("img");
  if (img) {
    img.loading = "eager";
    // fuerza a decodificar antes de hacerla active (reduce “blanco”)
    if (img.decode) img.decode().catch(()=>{});
  }

  const vid = card.querySelector("video");
  if (vid) {
    vid.preload = "auto";
  }
}

  function setUnderlayByDx(dx){

    let newDirection = 0;
    if (dx > 0) newDirection = 1;
    else if (dx < 0) newDirection = -1;

    // si no cambia la dirección, no hacemos nada
    if (newDirection === underlayDirection) return;

    // limpiar estado anterior
    cards.forEach(c => c.classList.remove("peek-prev"));

    const next = cards[index + 1];

    // si voy a la derecha (volver atrás)
    if (newDirection === 1) {

      // ocultamos temporalmente la siguiente
      if (next) next.classList.remove("peek");

      const prev = cards[index - 1];
      if (prev) {
        warmCardMedia(prev); // 🔥 precarga / decode para evitar flash blanco
        prev.classList.add("peek-prev");
      }

    } else {
      // si voy a la izquierda o vuelvo al centro, restauramos la siguiente
      if (next) next.classList.add("peek");
    }

    underlayDirection = newDirection;
  }




  function onStart(x, y) {
    const card = activeCard();
    if (!card) return;
    dragging = true;
    clearUnderlays();   // ← añade esta línea aquí
    underlayDirection = 0;
    warmCardMedia(cards[index - 1]);
    startTime = Date.now();
    startX = x;
    startY = y;
    dx = 0;
    dy = 0;
    card.style.opacity = "";
    card.style.transition = "";
  }


  function onMove(x, y) {
    if (!dragging) return;
    const card = activeCard();
    if (!card) return;
    dx = x - startX;
    dy = y - startY;
    setUnderlayByDx(dx);          // <- AÑADIDO
    setCardTransform(card, dx, dy);
  }

  function onEnd() {
  if (!dragging) return;
  dragging = false;


  const card = activeCard();
  if (!card) return;

  const elapsed = Date.now() - startTime;
  const isTap = Math.abs(dx) < 10 && Math.abs(dy) < 10 && elapsed < 280;

  if (isTap) {
    if (card.querySelector("video")) toggleSoundActive();
    else resetCard(card);
    return;
  }

  const THX = 90;
  const THY = 90;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx <= -THX) {
      flyOut(card, -1);
      setTimeout(() => {
        card.style.opacity = "";
        card.style.transform = "";
        card.style.transition = "";
        goNext();
      }, 250);
      return;
    }
    if (dx >= THX) {
      flyOut(card, +1);
      setTimeout(() => {
        card.style.opacity = "";
        card.style.transform = "";
        card.style.transition = "";
        goPrev();
      }, 250);
      return;
    }
    resetCard(card);
    return;
  }

  if (dy <= -THY) {
    openPanelFromCard(card);
    resetCard(card);
    return;
  }

  resetCard(card);
}

  function initSwipe() {
    if (!container || cards.length === 0) return;

    updateStack();
    bindSoundButtons();
    initPanelDragSnap();



if (typeof initHeroCollapseOnScroll === "function") {
	initHeroCollapseOnScroll(); // ya tiene guard para no duplicar listeners
}



    const usePointer = "PointerEvent" in window;

    if (usePointer) {
      container.addEventListener("pointerdown", (e) => {
        // ✅ si empiezas tocando un botón/enlace, no lo tratamos como tap de la card
        if (e.target.closest("button, a, .sound-toggle, .call-btn")) return;

        onStart(e.clientX, e.clientY);
        container.setPointerCapture?.(e.pointerId);
      });
      container.addEventListener("pointermove", (e) => onMove(e.clientX, e.clientY));
      container.addEventListener("pointerup", onEnd);
      container.addEventListener("pointercancel", onEnd);
    } else {
      container.addEventListener(
        "touchstart",
        (e) => {
          // ✅ mismo bloqueo en móviles (touch)
          if (e.target.closest("button, a, .sound-toggle, .call-btn")) return;

          onStart(e.touches[0].clientX, e.touches[0].clientY);
        },
        { passive: true }
      );
      container.addEventListener(
        "touchmove",
        (e) => onMove(e.touches[0].clientX, e.touches[0].clientY),
        { passive: true }
      );
      container.addEventListener("touchend", onEnd, { passive: true });
      container.addEventListener("touchcancel", onEnd, { passive: true });
    }
  }



  async function initAdsAndSwipe(){
    await initDynamicAds();
    // reset índice y re-init stack con las cards reales
    index = 0;
    initSwipe();
  }

  initAdsAndSwipe();



// --- Visor fullscreen de media (fotos/vdeos) ---
const mediaViewer = document.getElementById("mediaViewer");
const mediaViewerClose = document.getElementById("mediaViewerClose");
const mediaViewerContent = document.getElementById("mediaViewerContent");
let viewerItems = [];
let viewerIndex = 0;
let viewerIndicator = null;
let viewerStartX = 0;


function openMediaViewer(type, src) {
  if (!mediaViewer || !mediaViewerContent) return;

  // 1) Construir lista desde las miniaturas actuales del perfil
  const thumbs = Array.from(document.querySelectorAll(".profile-gallery .thumb"));

  viewerItems = thumbs
    .map((t) => ({
      type: t.getAttribute("data-media-type") || "image",
      src: t.getAttribute("data-src") || ""
    }))
    .filter((x) => !!x.src);

  // 2) Encontrar índice del elemento que se clicó
  viewerIndex = viewerItems.findIndex((i) => i.src === src);
  if (viewerIndex < 0) viewerIndex = 0;

  // 3) Render del item actual (con tu lógica de video/iOS)
  renderViewerItem();

  // 4) Bloquear scroll del fondo
  document.documentElement.classList.add("viewer-open");
  document.body.classList.add("viewer-open");

  // 5) Mostrar visor
  mediaViewer.hidden = false;
  mediaViewer.removeAttribute("hidden");
  mediaViewer.classList.remove("hidden");
  mediaViewer.setAttribute("aria-hidden", "false");
}
function renderViewerIndicator() {
  if (!mediaViewerContent) return;

  if (viewerIndicator) viewerIndicator.remove();

  viewerIndicator = document.createElement("div");
  viewerIndicator.className = "media-viewer__indicator";

  viewerItems.forEach((_, i) => {
    const line = document.createElement("span");
    if (i === viewerIndex) line.classList.add("active");
    viewerIndicator.appendChild(line);
  });

  mediaViewerContent.appendChild(viewerIndicator);
}

function renderViewerItem(direction = 0) {
  if (!mediaViewerContent) return;

  const oldEl = mediaViewerContent.querySelector(".media-viewer__stage");

  const item = viewerItems[viewerIndex];
  if (!item) return;

  const wrapper = document.createElement("div");
  wrapper.className = "media-viewer__stage";
  wrapper.style.position = "absolute";
  wrapper.style.inset = "0";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";
  wrapper.style.background = "#000";

  if (item.type === "video") {
    const v = document.createElement("video");
    v.src = item.src;
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    wrapper.appendChild(v);
    v.play().catch(()=>{});
  } else {
    const img = document.createElement("img");
    img.src = item.src;
    img.style.maxWidth = "100%";
    img.style.maxHeight = "100%";
    wrapper.appendChild(img);
  }

  mediaViewerContent.appendChild(wrapper);
  renderViewerIndicator();

  if (oldEl) {
    wrapper.style.transform = `translateX(${direction * 40}px)`;
    wrapper.style.opacity = "0";

    requestAnimationFrame(() => {
      wrapper.style.transition = "all .35s cubic-bezier(.22,.8,.22,1)";
      wrapper.style.transform = "translateX(0)";
      wrapper.style.opacity = "1";
    });

    oldEl.style.transition = "all .35s cubic-bezier(.22,.8,.22,1)";
    oldEl.style.transform = `translateX(${-direction * 40}px)`;
    oldEl.style.opacity = "0";

    setTimeout(() => oldEl.remove(), 350);
  }
}

function nextViewerItem() {
  if (viewerIndex < viewerItems.length - 1) {
    viewerIndex++;
    renderViewerItem(-1); // izquierda
  }
}

function prevViewerItem() {
  if (viewerIndex > 0) {
    viewerIndex--;
    renderViewerItem(1); // derecha
  }
}




function closeMediaViewer() {
  if (!mediaViewer || !mediaViewerContent) return;

  // Salir de fullscreen si existe
  try {
    const exit =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.msExitFullscreen;

    if (
      exit &&
      (document.fullscreenElement ||
        document.webkitFullscreenElement)
    ) {
      exit.call(document);
    }
  } catch {}

  mediaViewer.classList.add("hidden");
  mediaViewer.setAttribute("aria-hidden", "true");
  mediaViewerContent.innerHTML = "";

  // Restaurar scroll
  document.documentElement.classList.remove("viewer-open");
  document.body.classList.remove("viewer-open");
}


// Cerrar por X o por backdrop
mediaViewerClose?.addEventListener("click", closeMediaViewer);
mediaViewer?.addEventListener("touchstart", (e) => {
  viewerStartX = e.touches[0].clientX;
}, { passive: true });

mediaViewer?.addEventListener("touchend", (e) => {
  const endX = e.changedTouches[0].clientX;
  const diff = endX - viewerStartX;

  if (Math.abs(diff) > 50) {
    if (diff < 0) nextViewerItem(); // izquierda => siguiente
    else prevViewerItem();          // derecha  => anterior
  }
}, { passive: true });

mediaViewer?.addEventListener("click", (e) => {
  if (e.target && e.target.closest && e.target.closest("[data-close]")) closeMediaViewer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && mediaViewer && !mediaViewer.classList.contains("hidden")) {
    e.preventDefault();
    closeMediaViewer();
  }
});

// Click en miniaturas del perfil
document.addEventListener("click", (e) => {
  const btn = e.target?.closest?.(".thumb");
  if (!btn) return;

  const type = btn.getAttribute("data-media-type") || "image";
  const src = btn.getAttribute("data-src");
  if (!src) return;

  openMediaViewer(type, src);
});

// Click en la cabecera (panelHero) para abrir media principal
panelHero?.addEventListener("click", () => {
  const el = panelHero.querySelector("img, video");
  if (!el) return;

  const isVideo = el.tagName.toLowerCase() === "video";
  const src = el.currentSrc || el.src;
  if (!src) return;

  openMediaViewer(isVideo ? "video" : "image", src);
});

})();

let currentCallMode = "video"; // "video" | "voice"

function configureCallModal(mode) {
  currentCallMode = mode;

  // Elementos reales según tu index.html
  const titleEl = document.getElementById("vcTitle");
  const primaryBtn = document.getElementById("vcPrimaryBtn");
  const primaryText = document.getElementById("vcPrimaryText");
  const primaryIconPath = document.querySelector("#vcPrimaryBtn .vc-ico svg path");
  const footTextSpan = document.querySelector("#vcFoot span:last-child");

  if (!titleEl || !primaryBtn || !primaryText) return;

  // Path original de cámara (el que ya tienes en el HTML)
  const VIDEO_PATH =
    "M17 10.5V7a2 2 0 0 0-2-2H5A2 2 0 0 0 3 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 4v-11l-4 4z";

  // Path de teléfono (simple y claro)
  const PHONE_PATH =
    "M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.07 21 3 13.93 3 5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z";

  if (mode === "voice") {
    titleEl.textContent = "Llamada de voz";
    primaryText.textContent = "Iniciar llamada";

    if (primaryIconPath) primaryIconPath.setAttribute("d", PHONE_PATH);

    if (footTextSpan) {
      footTextSpan.textContent =
        "Os llamamos a ambos y os conectamos en directo de forma anónima y privada. Al pulsar 'Iniciar llamada', recibirás una llamada del número 919 999 798. Descuelga y hablad libremente de lo que os apetezca.";
    }

    return;
  }

  // Default: video
  titleEl.textContent = "Videollamada";
  primaryText.textContent = "Iniciar videollamada";

  if (primaryIconPath) primaryIconPath.setAttribute("d", VIDEO_PATH);

  if (footTextSpan) {
    // Deja tu texto de video como estaba (si quieres el original exacto, lo pones aquí)
    footTextSpan.innerHTML =
      "Si no contesta en <b>20s</b>, la llamada se cancelará automáticamente.";
  }
}



/* =========================
   VIDEO CALL SHEET (NEW)
   ========================= */
(function initVideoCallSheet() {

	const overlay = document.getElementById("vcOverlay");
	const closeBtn = document.getElementById("vcCloseBtn");

	const avatarWrap = document.getElementById("vcAvatarWrap");
	const avatar = document.getElementById("vcAvatar");
	const nameEl = document.getElementById("vcName");
	const pill = document.getElementById("vcPill");
	const headline = document.getElementById("vcHeadline");
	const sub = document.getElementById("vcSub");

	const primaryBtn = document.getElementById("vcPrimaryBtn");
	const primaryText = document.getElementById("vcPrimaryText");

	const msgBtn = document.getElementById("vcMsgBtn");
	const profileBtn = document.getElementById("vcProfileBtn");

	const callRoot = document.getElementById("callRoot");
	const remoteVideo = document.getElementById("remoteVideo");
	const localVideo = document.getElementById("localVideo");
	const hangupBtn = document.getElementById("hangup");

	if (!overlay || !primaryBtn) return;

	let lastFocus = null;
	let currentProfile = {};
	let isCalling = false;

	function lockScroll() {
		document.documentElement.classList.add("no-scroll");
		document.body.classList.add("no-scroll");
	}

	function unlockScroll() {
		document.documentElement.classList.remove("no-scroll");
		document.body.classList.remove("no-scroll");
	}

	function setState(state) {
		avatarWrap.classList.remove("is-calling");

		if (state === "calling") {
			isCalling = true;
			avatarWrap.classList.add("is-calling");
			pill.textContent = "Llamando...";
			headline.textContent = "Conectando con la sala...";
			sub.textContent = "Estás esperando a que la invitada se una.";
			primaryText.textContent = "Cancelar llamada";
			return;
		}

    isCalling = false;
    pill.textContent = "En línea ahora";

    if (currentCallMode === "voice") {
      headline.textContent = "Está disponible para llamada";
      sub.textContent = "Inicia la llamada y espera a que se una.";
      primaryText.textContent = "Iniciar llamada";
    } else {
      headline.textContent = "Está disponible para videollamada";
      sub.textContent = "Inicia la llamada y espera a que se una.";
      primaryText.textContent = "Iniciar videollamada";
    }

  }
  	function close() {
		overlay.classList.remove("is-open");
		setTimeout(() => {
			overlay.hidden = true;
			lastFocus?.focus?.();
		}, 200);
		unlockScroll();
	}

async function openFromCard(card) {
  lastFocus = document.activeElement;

  const nameRaw = card?.querySelector(".name-text")?.textContent?.trim() || "María";
  const imgEl = card?.querySelector("img");
  const photo = imgEl?.getAttribute("src") || "";

  // ✅ 1) Leer advertisement_id desde data-ad-id (ya lo tienes en createCardElFromAd)
  const adId = (card?.dataset?.adId || "").trim();

  // Debug: te dice exactamente qué se ha detectado
  console.log("[VideoCall] card:", card);
  console.log("[VideoCall] advertisement_id detectado:", adId || "(vacío)");

  currentProfile = {
    name: nameRaw,
    photo,
    adId
  };

  nameEl.textContent = nameRaw;
  avatar.src = photo || "img/foto1.jpg";

  const mode = card?.querySelector(".call-btn")?.dataset?.callMode || "video";
  configureCallModal(mode);

  // Si falta adId, avisamos (no bloquea abrir, pero sí iniciarla)
  if (!adId) {
    headline.textContent = "Falta el ID del anuncio";
    sub.textContent = "Esta tarjeta no tiene advertisement_id (data-ad-id). No se puede enviar la invitación por SMS.";
  } else {
    setState("online");
  }

  if (callRoot) {
    callRoot.hidden = true;
    callRoot.classList.add("hidden");
    callRoot.setAttribute("aria-hidden", "true");
  }
  if (remoteVideo) remoteVideo.innerHTML = "";
  if (localVideo) localVideo.innerHTML = "";

  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  overlay.classList.add("is-open");

  // refresca sesión (tal y como ya lo tenías)
  await window.SoloTIASAuth?.refreshUserData?.({ silent: true });
  window.refreshSessionUI?.();

  lockScroll();
}


document.addEventListener("click", (e) => {
  const btn = e.target.closest(".call-btn");
  if (!btn) return;

  // ✅ evita que el tap de la card dispare toggleSoundActive()
  e.preventDefault();
  e.stopPropagation();

  const card = btn.closest(".swipe-card");
  if (card?.dataset?.available === "false" || btn.getAttribute("aria-disabled") === "true") return;

  window.forceMuteActiveCardVideo?.();
  openFromCard(card);
});



	closeBtn?.addEventListener("click", close);

  // ===============================
  // CLICK EN BOTÓN LLAMAR/VIDEOLLAMAR (PERFIL)
  // ===============================
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".profile-cta .call-btn");

    if (!btn) return;

    // si está deshabilitado, no hacemos nada
    if (btn.getAttribute("aria-disabled") === "true") return;

    // usamos la card que abrió el perfil (se setea en openPanelFromCard)
    const card =
      typeof lastOpenedCardIndex === "number" && cards?.[lastOpenedCardIndex]
        ? cards[lastOpenedCardIndex]
        : null;

    if (!card) return;

    // seguridad extra: si la card dice no disponible, no abrimos
    const cardBtn = card.querySelector(".call-btn");
    if (card?.dataset?.available === "false" || cardBtn?.getAttribute("aria-disabled") === "true") return;

    // abre el MISMO modal que el botón de la carta
    window.forceMuteActiveCardVideo?.();
    openFromCard(card);
  });


	// ===============================
	// BOTÓN PRINCIPAL (AGORA + SMS)
	// ===============================

// CTA principal (AGORA + SMS)
primaryBtn.addEventListener("click", async () => {

  if (primaryBtn.dataset.busy === "1") return;

  // 👇 MOSTRAR OVERLAY INSTANTÁNEO
  showConnectOverlay(
    "Creando tu sala privada…",
    "Un momento, estamos conectando la videollamada."
  );

  // 👇 Forzamos render antes del fetch (muy importante)
  await new Promise(requestAnimationFrame);
    // Cancelar llamada
    if (isCalling) {
      primaryBtn.dataset.busy = "1";

      try {
        if (typeof stopAgoraCall === "function") {
          await stopAgoraCall();
        }

        if (callRoot) {
          callRoot.hidden = true;
          callRoot.classList.add("hidden");
          callRoot.setAttribute("aria-hidden", "true");
        }

	setState("online");
	document.body.classList.remove("call-active");
	exitCallAndReturnHome();


      } catch (err) {
        console.error(err);
        setState("online");
      }

      primaryBtn.dataset.busy = "0";
      return;
    }

    // ✅ Validar advertisement_id
    if (!currentProfile.adId) {
      headline.textContent = "No se puede iniciar la llamada";
      sub.textContent = "Falta el identificador del anuncio (advertisement_id).";
      return;
    }


    primaryBtn.dataset.busy = "1";

    // 🟢 MODO VOICE (no toca Agora)
    if (currentCallMode === "voice") {
      console.log("Aquí irá la llamada telefónica real");
      primaryBtn.dataset.busy = "0";
      return;
    }
    try {
      // 1) Crear llamada + enviar SMS
      const res = await fetch("/api/create_call.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        advertisement_id: currentProfile.adId
      })

      });

      if (!res.ok) throw new Error("Error servidor");

      const data = await res.json();

      // Esperamos: { channel, callerUid, callerToken, inviteUrl, appId? }
      if (!data.channel || !data.callerToken || typeof data.callerUid === "undefined") {
        throw new Error("Datos inválidos desde create_call.php");
      }

		if (!data.appId) throw new Error("Falta appId en create_call.php");

      // 2) Entrar en Agora como usuario que espera
      await startAgoraCall({
        appId: data.appId,
        channel: data.channel,
        token: data.callerToken,
        uid: data.callerUid
      });

      // 3) Mostrar capa de llamada
      if (callRoot) {
        callRoot.hidden = false;
        callRoot.classList.remove("hidden");
        callRoot.setAttribute("aria-hidden", "false");
      }

      setState("calling");
		document.body.classList.add("call-active");

    } catch (err) {
      console.error(err);
      setState("online");
      headline.textContent = "Error al iniciar la llamada";
      sub.textContent = "Inténtalo de nuevo.";
    } finally {
      primaryBtn.dataset.busy = "0";
    }
  });

  // Colgar desde controles
  hangupBtn?.addEventListener("click", async () => {
    try {
      await stopAgoraCall();
    } catch (err) {
      console.error(err);
    }

    if (callRoot) {
      callRoot.hidden = true;
      callRoot.classList.add("hidden");
      callRoot.setAttribute("aria-hidden", "true");
    }

	setState("online");
	exitCallAndReturnHome();


  });

function initAgoraToggleControls() {
  const toggleMicBtn = document.getElementById("toggleMic");
  const toggleSpeakerBtn = document.getElementById("toggleSpeaker");

  if (!toggleMicBtn && !toggleSpeakerBtn) return;

  const micImg = toggleMicBtn?.querySelector("img");
  const speakerImg = toggleSpeakerBtn?.querySelector("img");

  // MIC (solo audio, no cámara)
  toggleMicBtn?.addEventListener("click", async () => {
    if (!__agoraLocalAudioTrack) return;

    try {
      // leer estado real (Agora a veces expone isEnabled() o enabled)
      const enabled =
        (typeof __agoraLocalAudioTrack.isEnabled === "function")
          ? __agoraLocalAudioTrack.isEnabled()
          : (typeof __agoraLocalAudioTrack.enabled === "boolean")
            ? __agoraLocalAudioTrack.enabled
            : true;

      const next = !enabled;
      await __agoraLocalAudioTrack.setEnabled(next);

      if (!next) {
        toggleMicBtn.classList.add("is-off");
        toggleMicBtn.setAttribute("aria-pressed", "true");
        if (micImg) micImg.src = "/img/mic-off.svg";
      } else {
        toggleMicBtn.classList.remove("is-off");
        toggleMicBtn.setAttribute("aria-pressed", "false");
        if (micImg) micImg.src = "/img/mic-on.svg";
      }
    } catch (err) {
      console.error("Error toggling mic:", err);
    }
  });

  // ALTAVOZ (mute/unmute audio remoto)
  toggleSpeakerBtn?.addEventListener("click", () => {
    __agoraSpeakerMuted = !__agoraSpeakerMuted;

    if (__agoraSpeakerMuted) {
      toggleSpeakerBtn.classList.add("is-off");
      toggleSpeakerBtn.setAttribute("aria-pressed", "true");
      if (speakerImg) speakerImg.src = "/img/speaker-off.svg";
    } else {
      toggleSpeakerBtn.classList.remove("is-off");
      toggleSpeakerBtn.setAttribute("aria-pressed", "false");
      if (speakerImg) speakerImg.src = "/img/speaker-on.svg";
    }

    if (__agoraRemoteAudioTrack?.setVolume) {
      __agoraRemoteAudioTrack.setVolume(__agoraSpeakerMuted ? 0 : 100);
    }
  });
}



// Llamar una vez para activar los handlers
initAgoraToggleControls();
// ===============================
// BOTÓN "ENVIAR MENSAJE" (ENGANCHE TEMPORAL VISUAL)
// ===============================

msgBtn?.addEventListener("click", (e) => {
  e.preventDefault();

  // Solo para pruebas visuales
  if (typeof window.openPhoneAuthModal === "function") {
    window.openPhoneAuthModal();
  }
});


})();
 
/* =========================
   AGORA (WEB SDK) HELPERS
   ========================= */

let __agoraClient = null;
let __agoraLocalAudioTrack = null;
let __agoraLocalVideoTrack = null;
let __agoraJoined = false;
let __agoraSession = null;
let __agoraLeaveSent = false;
let __agoraRemoteAudioTrack = null;
let __agoraSpeakerMuted = false;


// --- FIX real: evitar que se rompa JS + forzar repaint en Chrome Android ---
function hardRepaintEl(el) {
  if (!el) return;

  // Forzar repaint sin “parpadeo” visible
  const prev = el.style.transform;
  el.style.transform = "translateZ(0)";
  void el.offsetHeight; // fuerza reflow
  el.style.transform = prev;
}

function hardRepaintTopbar() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  // Fuerza reflow
  void topbar.offsetHeight;

  // Forzar capa en topbar
  const prevTop = topbar.style.transform;
  topbar.style.transform = "translate3d(0,0,0)";

  // Forzar repintado también de los hijos (botones derecha/izquierda)
  const left = topbar.querySelector(".left");
  const right = topbar.querySelector(".right");

  const prevLeft = left ? left.style.transform : "";
  const prevRight = right ? right.style.transform : "";

  if (left) left.style.transform = "translateZ(0)";
  if (right) right.style.transform = "translateZ(0)";

  requestAnimationFrame(() => {
    if (left) left.style.transform = prevLeft || "";
    if (right) right.style.transform = prevRight || "";
    topbar.style.transform = prevTop || "";
  });
}

function hardRepaintBottomNav() {
  const nav = document.querySelector(".bottom-nav");
  if (!nav) return;

  void nav.offsetHeight;

  const prev = nav.style.transform;
  nav.style.transform = "translate3d(0,0,0)";
  requestAnimationFrame(() => {
    nav.style.transform = prev || "";
  });
}

// Al volver atrás (BFCache) Chrome Android a veces no repinta fixed
window.addEventListener("pageshow", () => {
  hardRepaintTopbar();
  hardRepaintBottomNav();
  // doble RAF ayuda mucho en Android
  requestAnimationFrame(() => requestAnimationFrame(() => {
    hardRepaintTopbar();
    hardRepaintBottomNav();
  }));
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    hardRepaintTopbar();
    hardRepaintBottomNav();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      hardRepaintTopbar();
      hardRepaintBottomNav();
    }));
  }
});



function agoraNowStamp() {
  const d = new Date();
  return { iso: d.toISOString(), ms: d.getTime() };
}

function getUserLlamametuIdSafe() {
  // 1) si tú lo guardas en algún sitio, úsalo
  // 2) fallback vacío (no rompe)
  return (window.__llamametu_user_id ? String(window.__llamametu_user_id) : "");
}

async function callLocalAgoraApi(path, payload) {
  try {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    // No bloqueamos la llamada por errores de log
    return await r.json().catch(() => ({}));
  } catch {
    return {};
  }
}
// Detectar cierre de pestaña / refresh
window.addEventListener("beforeunload", () => {

  if (__agoraSession && !__agoraLeaveSent) {

    __agoraLeaveSent = true;

    const t = agoraNowStamp();

    if (navigator.sendBeacon) {
      const data = new Blob(
        [JSON.stringify({
          user_llamametu_id: getUserLlamametuIdSafe(),
          channel: __agoraSession.channel,
          caller_uid: __agoraSession.uid,
          event_at_iso: t.iso,
          event_at_ms: t.ms,
          leave_reason: "unload",
        })],
        { type: "application/json" }
      );

      navigator.sendBeacon("/api/agora_leave_channel.php", data);
    }
  }
});

async function startAgoraCall(params) {
  const appId = params && params.appId ? String(params.appId).trim() : "";
  const channel = params && params.channel ? String(params.channel).trim() : "";
  const token = params && params.token ? String(params.token).trim() : "";
  const uid = params && typeof params.uid !== "undefined" ? params.uid : null;

  try {
    if (!appId || !channel || !token || uid === null) {
      throw new Error("startAgoraCall: faltan appId/channel/token/uid");
    }

    if (!window.AgoraRTC) {
      throw new Error("AgoraRTC no está disponible. Carga el Agora Web SDK en index.html.");
    }

    if (__agoraJoined) {
      await stopAgoraCall();
    }

    const remoteContainer = document.getElementById("remoteVideo");
    const localContainer = document.getElementById("localVideo");

    if (!remoteContainer || !localContainer) {
      throw new Error("No existen #remoteVideo o #localVideo en el DOM.");
    }

    remoteContainer.innerHTML = "";
    localContainer.innerHTML = "";

    __agoraClient = window.AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

    __agoraClient.on("user-published", async (user, mediaType) => {
      await __agoraClient.subscribe(user, mediaType);

      if (mediaType === "video" && user.videoTrack) {
        const remotePlayer = document.createElement("div");
        remotePlayer.id = `agora-remote-${user.uid}`;
        remotePlayer.style.width = "100%";
        remotePlayer.style.height = "100%";
        remoteContainer.innerHTML = "";
        remoteContainer.appendChild(remotePlayer);

        user.videoTrack.play(remotePlayer.id);
      }

      if (mediaType === "audio" && user.audioTrack) {
        __agoraRemoteAudioTrack = user.audioTrack;

        // aplicar estado actual del altavoz
        try {
          if (typeof __agoraRemoteAudioTrack.setVolume === "function") {
            __agoraRemoteAudioTrack.setVolume(__agoraSpeakerMuted ? 0 : 100);
          }
        } catch (e) {}

        __agoraRemoteAudioTrack.play();
      }
    });

    __agoraClient.on("user-unpublished", (user, mediaType) => {

      // 🔊 Si solo dejó de publicar audio (mic apagado)
      if (mediaType === "audio") {
        __agoraRemoteAudioTrack = null;
        return; // 👈 CLAVE: no tocar el vídeo
      }

      // 🎥 Solo si dejó de publicar vídeo
      if (mediaType === "video") {
        const el = document.getElementById(`agora-remote-${user.uid}`);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
    });

    // ✅ SI EL OTRO CUELGA/SALTA DEL CANAL, YO TAMBIÉN CUELGO
    __agoraClient.on("user-left", async (user) => {
      // 👇 limpiar siempre al salir
      __agoraRemoteAudioTrack = null;

      const el = document.getElementById(`agora-remote-${user.uid}`);
      if (el && el.parentNode) el.parentNode.removeChild(el);

      // Si ya no estoy en llamada (o ya se está cerrando), no hago nada
      if (!__agoraJoined) return;

      try {
        // esto hace leave + limpia tracks + vacía contenedores (tu stopAgoraCall)
        await stopAgoraCall("peer_left");
      } catch (e) {
        console.error("[auto-hangup] stopAgoraCall error:", e);
      }

      // cerrar UI si existe esta función en tu app (no rompe si no existe)
      try {
        if (typeof exitCallAndReturnHome === "function") {
          exitCallAndReturnHome();
        }
      } catch (e) {}
    });

    await __agoraClient.join(appId, channel, token, uid);
    __agoraJoined = true;

    __agoraLocalAudioTrack = await window.AgoraRTC.createMicrophoneAudioTrack();
    __agoraLocalVideoTrack = await window.AgoraRTC.createCameraVideoTrack();

    await __agoraClient.publish([__agoraLocalAudioTrack, __agoraLocalVideoTrack]);

    __agoraSession = { appId, channel, uid };
    __agoraLeaveSent = false;

    const tJoin = agoraNowStamp();
    callLocalAgoraApi("/api/agora_join_channel.php", {
      user_llamametu_id: getUserLlamametuIdSafe(),
      channel,
      caller_uid: uid,
      event_at_iso: tJoin.iso,
      event_at_ms: tJoin.ms,
    });

    const localPlayer = document.createElement("div");
    localPlayer.id = "agora-local-player";
    localPlayer.style.width = "100%";
    localPlayer.style.height = "100%";
    localContainer.innerHTML = "";
    localContainer.appendChild(localPlayer);

    __agoraLocalVideoTrack.play(localPlayer.id);

    return true;
  } finally {
    // ✅ Se oculta SIEMPRE (éxito o error)
    hideConnectOverlay();
  }
}


 

async function stopAgoraCall(reason = "manual") {
  try {
    // Enviar LEAVE solo una vez
    if (__agoraSession && !__agoraLeaveSent) {
      __agoraLeaveSent = true;

      const tLeave = agoraNowStamp();
      callLocalAgoraApi("/api/agora_leave_channel.php", {
        user_llamametu_id: getUserLlamametuIdSafe(),
        channel: __agoraSession.channel,
        caller_uid: __agoraSession.uid,
        event_at_iso: tLeave.iso,
        event_at_ms: tLeave.ms,
        leave_reason: reason,
      });
    }

    if (__agoraLocalAudioTrack) {
      __agoraLocalAudioTrack.stop();
      __agoraLocalAudioTrack.close();
      __agoraLocalAudioTrack = null;
    }

    if (__agoraLocalVideoTrack) {
      __agoraLocalVideoTrack.stop();
      __agoraLocalVideoTrack.close();
      __agoraLocalVideoTrack = null;
    }

    if (__agoraClient && __agoraJoined) {
      await __agoraClient.leave();
    }
  } finally {
    __agoraJoined = false;
    __agoraClient = null;
    __agoraSession = null;

    const remoteContainer = document.getElementById("remoteVideo");
    const localContainer = document.getElementById("localVideo");
    if (remoteContainer) remoteContainer.innerHTML = "";
    if (localContainer) localContainer.innerHTML = "";
  }
}



function exitCallAndReturnHome() {
	// Quitar fullscreen
	document.body.classList.remove("call-active");

	// Cerrar overlay SIEMPRE (evita blanco)
	const overlay = document.getElementById("vcOverlay");
	if (overlay) {
		overlay.classList.remove("is-open");
		overlay.hidden = true;
		overlay.setAttribute("aria-hidden", "true");
	}

	// Desbloquear scroll
	document.documentElement.classList.remove("no-scroll");
	document.body.classList.remove("no-scroll");

	// Ocultar callRoot y limpiar videos
	const callRoot = document.getElementById("callRoot");
	if (callRoot) {
		callRoot.hidden = true;
		callRoot.classList.add("hidden");
		callRoot.setAttribute("aria-hidden", "true");
	}
	const remoteVideo = document.getElementById("remoteVideo");
	const localVideo = document.getElementById("localVideo");
	if (remoteVideo) remoteVideo.innerHTML = "";
	if (localVideo) localVideo.innerHTML = "";

	// Volver a home si venías por enlace de invitación
	const url = new URL(window.location.href);
	if (url.searchParams.has("call")) {
		url.searchParams.delete("call");
		window.location.replace(url.origin + url.pathname);
	}
}

/* =========================
   INVITE LINK AUTO-JOIN
   Para la invitada (SMS)
   ========================= */

(function autoJoinFromInviteLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    const callId = params.get("call");
    if (!callId) return;

    const channel = `call_${String(callId).trim()}`;
    const uid = Math.floor(Math.random() * 900000) + 1000;

    const tokenUrl = `/api/agora_token.php?channel=${encodeURIComponent(channel)}&uid=${encodeURIComponent(uid)}`;

    fetch(tokenUrl, { method: "GET" })
      .then((r) => r.json())
      .then(async (t) => {
        if (!t || !t.appId || !t.channel || !t.uid || !t.token) {
          throw new Error("Token inválido desde servidor para invitada.");
        }

        const overlay = document.getElementById("vcOverlay");
        if (overlay) {
          overlay.hidden = false;
          overlay.classList.add("is-open");
          overlay.setAttribute("aria-hidden", "false");
        }

        const callRoot = document.getElementById("callRoot");
        if (callRoot) {
          callRoot.hidden = false;
          callRoot.classList.remove("hidden");
          callRoot.setAttribute("aria-hidden", "false");
        }
		document.body.classList.add("call-active");


        await startAgoraCall({
          appId: t.appId,
          channel: t.channel,
          token: t.token,
          uid: t.uid
        });
      })
      .catch((err) => {
        console.error("No se pudo unir a la llamada desde el enlace:", err);
      });
  } catch (err) {
    console.error("autoJoinFromInviteLink error:", err);
  }
})(); 
/* =========================
   PHONE AUTH MODAL (FULLSCREEN)
   ========================= */
(function initPhoneAuthModal() {
  const overlay = document.getElementById("authOverlay");
  const closeBtn = document.getElementById("authCloseBtn");

  const step1 = document.getElementById("authStep1");
  const step2 = document.getElementById("authStep2");

  const countrySel = document.getElementById("authCountry");
  const phoneInput = document.getElementById("authPhone");
  const sendBtn = document.getElementById("authSendBtn");
  const errorEl = document.getElementById("authError");

  const otpWrap = overlay?.querySelector(".auth-otp");
  const otpInputs = otpWrap ? Array.from(otpWrap.querySelectorAll(".otp")) : [];
  const timerEl = document.getElementById("authTimer");
  const phonePreview = document.getElementById("authPhonePreview");
  const backBtn = document.getElementById("authBackBtn");

  if (!overlay || !countrySel || !phoneInput || !sendBtn || !step1 || !step2) return;

  const COUNTRIES = [
    { code: "ES", name: "España", prefix: "+34", digits: 9, mask: "### ### ###" },
    { code: "MX", name: "México", prefix: "+52", digits: 10, mask: "### ### ####" },
    { code: "GT", name: "Guatemala", prefix: "+502", digits: 8, mask: "#### ####" },
    { code: "HN", name: "Honduras", prefix: "+504", digits: 8, mask: "#### ####" },
    { code: "SV", name: "El Salvador", prefix: "+503", digits: 8, mask: "#### ####" },
    { code: "NI", name: "Nicaragua", prefix: "+505", digits: 8, mask: "#### ####" },
    { code: "CR", name: "Costa Rica", prefix: "+506", digits: 8, mask: "#### ####" },
    { code: "PA", name: "Panamá", prefix: "+507", digits: 8, mask: "#### ####" },
    { code: "CU", name: "Cuba", prefix: "+53", digits: 8, mask: "#### ####" },
    { code: "DO", name: "República Dominicana", prefix: "+1 (DO)", digits: 10, mask: "### ### ####" },
    { code: "CO", name: "Colombia", prefix: "+57", digits: 10, mask: "### ### ####" },
    { code: "VE", name: "Venezuela", prefix: "+58", digits: 10, mask: "### ### ####" },
    { code: "EC", name: "Ecuador", prefix: "+593", digits: 9, mask: "### ### ###" },
    { code: "PE", name: "Perú", prefix: "+51", digits: 9, mask: "### ### ###" },
    { code: "BO", name: "Bolivia", prefix: "+591", digits: 8, mask: "#### ####" },
    { code: "PY", name: "Paraguay", prefix: "+595", digits: 9, mask: "### ### ###" },
    { code: "CL", name: "Chile", prefix: "+56", digits: 9, mask: "# #### ####" },
    { code: "AR", name: "Argentina", prefix: "+54", digits: 10, mask: "## #### ####" },
    { code: "UY", name: "Uruguay", prefix: "+598", digits: 8, mask: "#### ####" },
    { code: "GQ", name: "Guinea Ecuatorial", prefix: "+240", digits: 9, mask: "### ### ###" },
  ];

  let isOpen = false;
  let step = 1;

  let selected = COUNTRIES[0];
  let phoneDigits = ""; // solo números (sin espacios)
  let maskedPhone = ""; // visual

  let countdown = 60; // mostrar 00:60 -> 00:00 (tal cual requisito)
  let timerId = null;

  // =========================
  // NUEVO: Estado login real (proxy /api/auth.php)
  // =========================
  let preloginUserId = "";      // user_llamametu_id devuelto por prelogin
  let otpAttemptsLeft = 3;      // máximo 3 intentos fallidos
  let verifyingOtp = false;     // evita doble verificación
  let sendingPhone = false;     // evita doble envío prelogin

  // ---------- Helpers ----------
  const onlyDigits = (s) => (s || "").replace(/\D+/g, "");
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function formatWithMask(digits, mask) {
    let out = "";
    let di = 0;

    for (let i = 0; i < mask.length; i++) {
      const ch = mask[i];
      if (ch === "#") {
        if (di >= digits.length) break;
        out += digits[di++];
      } else {
        if (di === 0 && digits.length === 0) continue; // evita empezar con espacios
        out += ch;
      }
    }
    return out;
  }

  function requiredDigits() {
    return selected?.digits ?? 9;
  }

  function setNiceError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg || "";
  }

  async function callAuthProxy(payload) {
    const res = await fetch("/api/auth.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("network");
    const data = await res.json().catch(() => null);
    if (!data) throw new Error("invalid_json");
    return data;
  }

  function resetOtpAttempts() {
    otpAttemptsLeft = 3;
    verifyingOtp = false;
  }

  function updatePhoneUI({ silent = false } = {}) {
    const req = requiredDigits();

    // Validación suave (sin ser pesado)
    const len = phoneDigits.length;
    const ok = len === req;

    maskedPhone = formatWithMask(phoneDigits, selected.mask);
    phoneInput.value = maskedPhone;
    phoneInput.placeholder = selected.mask;

    sendBtn.disabled = !ok;

    if (!silent && errorEl) {
      if (len === 0) errorEl.textContent = "";
      else if (len < req) errorEl.textContent = `Faltan ${req - len} dígitos.`;
      else if (len > req) errorEl.textContent = `Máximo ${req} dígitos para ${selected.name}.`;
      else errorEl.textContent = "";
    }
  }

  function getFormattedFullPhone() {
    // Mostrar prefijo + máscara ya aplicada
    const shown = maskedPhone || formatWithMask(phoneDigits, selected.mask);
    return `${selected.prefix} ${shown}`.trim();
  }
  function getE164Phone() {
    // limpiar prefijo: "+1 (DO)" → "1"
    const prefixDigits = onlyDigits(selected.prefix);
    // unir todo sin espacios
    return `+${prefixDigits}${phoneDigits}`;
  }

  function setStep(nextStep) {
    step = nextStep;

    if (step === 1) {
      step1.hidden = false;
      step2.hidden = true;
      stopTimer();
      // foco
      setTimeout(() => phoneInput.focus(), 0);
      return;
    }

    step1.hidden = true;
    step2.hidden = false;

    // preview
    if (phonePreview) phonePreview.textContent = getFormattedFullPhone();

    // iniciar timer y OTP
    resetOtp();
    startTimer();

    // NUEVO: re-habilitar OTP inputs al entrar en step2
    otpInputs.forEach((i) => (i.disabled = false));
    resetOtpAttempts();
    setNiceError("");

    setTimeout(() => otpInputs[0]?.focus?.(), 0);
  }

  function lockScroll() {
    document.documentElement.classList.add("auth-open");
    document.body.classList.add("auth-open");
  }

  function unlockScroll() {
    document.documentElement.classList.remove("auth-open");
    document.body.classList.remove("auth-open");
  }

  function open() {
    if (isOpen) return;
    isOpen = true;

    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("is-open"));
    overlay.setAttribute("aria-hidden", "false");

    lockScroll();
    setStep(1);
  }

  function resetAll() {
    selected = COUNTRIES[0];
    phoneDigits = "";
    maskedPhone = "";
    countdown = 60;

    // NUEVO: reset login real
    preloginUserId = "";
    resetOtpAttempts();
    sendingPhone = false;

    // select
    countrySel.value = selected.code;

    // phone
    phoneInput.value = "";
    phoneInput.placeholder = selected.mask;

    if (errorEl) errorEl.textContent = "";
    sendBtn.disabled = true;

    // otp/timer
    stopTimer();
    resetOtp();
    otpInputs.forEach((i) => (i.disabled = false));
    if (timerEl) timerEl.textContent = "00:60";
    if (phonePreview) phonePreview.textContent = "—";

    step = 1;
    step1.hidden = false;
    step2.hidden = true;
  }

  function close() {
    if (!isOpen) return;

    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    stopTimer();
    unlockScroll();

    setTimeout(() => {
      overlay.hidden = true;
      isOpen = false;
      resetAll();
    }, 180);
  }

  // ---------- Timer ----------
  function renderTimer() {
    // requisito: 00:60 -> 00:00
    const s = clamp(countdown, 0, 60);
    const ss = String(s).padStart(2, "0");
    if (timerEl) timerEl.textContent = `00:${ss}`;
  }

  function startTimer() {
    stopTimer();
    countdown = 60;
    renderTimer();

    timerId = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        countdown = 0;
        renderTimer();
        stopTimer();
        return;
      }
      renderTimer();
    }, 1000);
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  // ---------- OTP ----------
  function resetOtp() {
    otpInputs.forEach((i) => (i.value = ""));
  }

  function getOtpValue() {
    return otpInputs.map((i) => onlyDigits(i.value || "")).join("");
  }

  async function verifyOtpAndLogin(code6) {
    if (verifyingOtp) return;

    // si no hay prelogin id, el flujo no está listo
    if (!preloginUserId) {
      setNiceError("Sesión caducada. Vuelve a solicitar el código.");
      setStep(1);
      return;
    }

    verifyingOtp = true;
    setNiceError("");

    try {
      const r = await callAuthProxy({
        action: "login",
        user_llamametu_id: preloginUserId,
        verification_code: String(code6),
      });

    if (r && r.ok === true && r.successful_verification === true) {
      try {
        // Guardamos sesión completa (incluye user_data, coins, phone, virtual_number)
        window.SoloTIASAuth?.setSession?.(r);
      } catch {}

      close();
      return;
    }


      // ❌ verificación fallida: consumir intento
      otpAttemptsLeft -= 1;

      if (otpAttemptsLeft <= 0) {
        setNiceError("Has superado el número máximo de intentos. Vuelve a solicitar un nuevo código.");
        otpInputs.forEach((i) => (i.disabled = true));
        return;
      }

      setNiceError(`Código incorrecto. Solo tienes 3 intentos y solo te quedan ${otpAttemptsLeft}.`);
      resetOtp();
      otpInputs[0]?.focus?.();

    } catch (e) {
      setNiceError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      verifyingOtp = false;
    }
  }

  function handleOtpInput(e, idx) {
    const input = e.target;
    const v = onlyDigits(input.value).slice(0, 1);
    input.value = v;

    if (v && idx < otpInputs.length - 1) {
      otpInputs[idx + 1].focus();
    }

    // Si completo (6) => verificación REAL
    if (getOtpValue().length === 6) {
      verifyOtpAndLogin(getOtpValue());
    }
  }

  function handleOtpKeydown(e, idx) {
    const k = e.key;

    if (k === "Backspace") {
      if (otpInputs[idx].value) return; // borra el actual normalmente

      // si ya estaba vacío, retrocede
      if (idx > 0) {
        e.preventDefault();
        otpInputs[idx - 1].focus();
        otpInputs[idx - 1].value = "";
      }
      return;
    }

    if (k === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      otpInputs[idx - 1].focus();
    }
    if (k === "ArrowRight" && idx < otpInputs.length - 1) {
      e.preventDefault();
      otpInputs[idx + 1].focus();
    }
  }

  function handleOtpPaste(e) {
    const text = (e.clipboardData?.getData("text") || "").trim();
    const digits = onlyDigits(text).slice(0, 6);
    if (!digits) return;

    e.preventDefault();
    for (let i = 0; i < otpInputs.length; i++) {
      otpInputs[i].value = digits[i] || "";
    }
    const nextIndex = Math.min(digits.length, otpInputs.length - 1);
    otpInputs[nextIndex]?.focus?.();

    if (digits.length === 6) {
      // verificación REAL
      verifyOtpAndLogin(digits);
    }
  }

  // ---------- Build select ----------
  function populateCountries() {
    countrySel.innerHTML = "";
    COUNTRIES.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.code;

      // SOLO el prefijo visible
      opt.textContent = c.prefix;

      countrySel.appendChild(opt);
    });
    countrySel.value = selected.code;
  }

  function onCountryChange() {
    const code = countrySel.value;
    selected = COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];

    // reset teléfono al cambiar país (requisito)
    phoneDigits = "";
    maskedPhone = "";
    if (errorEl) errorEl.textContent = "";
    updatePhoneUI({ silent: true });
    phoneInput.focus();
  }

  function onPhoneInput(e) {
    const req = requiredDigits();
    const digits = onlyDigits(e.target.value).slice(0, req);
    phoneDigits = digits;
    updatePhoneUI();
  }

  async function onSendCode() {
    // PRELOGIN real (envía sms)
    if (sendBtn.disabled) return;
    if (sendingPhone) return;

    sendingPhone = true;
    sendBtn.disabled = true;
    setNiceError("");

    try {
      const fullPhone = getE164Phone();

      const r = await callAuthProxy({
        action: "prelogin",
        phonenumber: fullPhone,
      });

      // Esperado: { ok:true, user_llamametu_id:"..." }
      if (!r || r.ok !== true || !r.user_llamametu_id) {
        setNiceError("No se pudo enviar el código. Inténtalo de nuevo.");
        return;
      }

      preloginUserId = String(r.user_llamametu_id);
      window.__llamametu_user_id = preloginUserId;

      // pasar a step2
      setStep(2);

    } catch (e) {
      setNiceError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      sendingPhone = false;
      updatePhoneUI({ silent: true });
    }
  }

  // ---------- Events ----------
  populateCountries();

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    // opcional: cerrar si clic fuera del sheet (en este caso sheet ocupa todo, pero por consistencia)
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  countrySel.addEventListener("change", onCountryChange);
  phoneInput.addEventListener("input", onPhoneInput);

  // evitar letras / teclas raras
  phoneInput.addEventListener("keydown", (e) => {
    const allowed =
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "Tab";
    if (allowed) return;

    // permitir solo números
    if (!/^\d$/.test(e.key)) e.preventDefault();
  });

  sendBtn.addEventListener("click", onSendCode);

  backBtn?.addEventListener("click", () => {
    setStep(1);
  });

  otpInputs.forEach((inp, idx) => {
    inp.addEventListener("input", (e) => handleOtpInput(e, idx));
    inp.addEventListener("keydown", (e) => handleOtpKeydown(e, idx));
    inp.addEventListener("paste", handleOtpPaste);
  });

  // ---------- Public API (para abrir desde donde quieras) ----------
  window.openPhoneAuthModal = open;
  window.closePhoneAuthModal = close;

  // (Opcional) abre automáticamente la primera vez si no está verificado:
  // try {
  //   if (localStorage.getItem("solotias_phone_verified") !== "1") open();
  // } catch {}
})();


(function initHeaderDropdownMenu(){
  const wrap = document.querySelector(".hdr-menu");
  const btn = document.getElementById("hdrMenuBtn");
  const panel = document.getElementById("hdrMenuPanel");
  if(!wrap || !btn || !panel) return;

  // Botones fijos en cabecera (siempre visibles)
  const phoneTopBtn = document.getElementById("hdrPhoneBtn");
  const videoTopBtn = document.getElementById("hdrVideoBtn");

  phoneTopBtn?.addEventListener("click", (e)=>{
    e.preventDefault();
    window.reloadAdsWithService?.("webs");
  });

  videoTopBtn?.addEventListener("click", (e)=>{
    e.preventDefault();
    window.reloadAdsWithService?.("videocalls");
  });


  function open(){
    wrap.classList.add("is-open");
    panel.hidden = false;
    btn.setAttribute("aria-expanded","true");
  }

  function close(){
    wrap.classList.remove("is-open");
    btn.setAttribute("aria-expanded","false");
    setTimeout(()=>{ panel.hidden = true; }, 180);
  }

  function toggle(){
    if(wrap.classList.contains("is-open")) close();
    else open();
  }

  btn.addEventListener("click",(e)=>{
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });

  panel.addEventListener("click",(e)=>{
    const b = e.target.closest("button");
    if(!b) return;

    if (b.id === "hdrListadosBtn") {
      const overlay = document.getElementById("listadosOverlay");
      if (overlay) {
        overlay.hidden = false;
        overlay.setAttribute("aria-hidden", "false");
        requestAnimationFrame(() => overlay.classList.add("is-open"));
        document.documentElement.classList.add("no-scroll");
        document.body.classList.add("no-scroll");

        window.initListadosSwipe?.();

        // ✅ NUEVO: enganchar carga real
        window.bindListadosInfiniteScroll?.();
        window.loadListados?.({ reset: true });
      }
      close();
      return;
    }


    // ✅ NUEVO: Fichas
    if (b.id === "hdrFichasBtn") {
      goToStore();
      close();
      return;
    }

    // Perfil
    if (b.id === "hdrPerfilBtn") {
      window.openProfileModal?.();
      close();
      return;
    }

    close();
  }); // ✅ ESTE CIERRE TE FALTABA

  document.addEventListener("click",(e)=>{
    if(panel.hidden) return;
    if(e.target.closest(".hdr-menu")) return;
    close();
  });

  document.addEventListener("keydown",(e)=>{
    if(e.key === "Escape" && !panel.hidden){
      e.preventDefault();
      close();
    }
  });
})();

(function initHeaderCollapsedMenu(){
  const details = document.getElementById("hdrCollapsedMenu");
  if (!details) return;

  function closeMenu(){
    details.removeAttribute("open");
  }

  // Helper: engancha click si existe
  function on(id, fn){
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      fn(e);
      closeMenu();
    });
  }

  // --- Localización: reutiliza EXACTAMENTE la lógica ya existente del gpsBtn ---
  // Tu geo init ya engancha gpsBtn por id="gpsBtn" y hace initGeoOnLoad(), etc. :contentReference[oaicite:4]{index=4}
  // Para el botón “logged” (si lo usas), lo hacemos disparar el click del gpsBtn real:
  on("gpsBtnLogged", () => {
    document.getElementById("gpsBtn")?.click();
  });

  // --- Teléfono / Vídeo: misma lógica que antes ---
  on("hdrPhoneBtn", () => window.reloadAdsWithService?.("webs"));
  on("hdrVideoBtn", () => window.reloadAdsWithService?.("videocalls"));

  // En logged (si están):
  on("hdrPhoneBtnLogged", () => window.reloadAdsWithService?.("webs"));
  on("hdrVideoBtnLogged", () => window.reloadAdsWithService?.("videocalls"));

  // --- Listados / Fichas / Perfil: misma lógica que antes en el menú ---
  on("hdrListadosBtn", () => {
    const overlay = document.getElementById("listadosOverlay");
    if (!overlay) return;

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => overlay.classList.add("is-open"));
    document.documentElement.classList.add("no-scroll");
    document.body.classList.add("no-scroll");

    window.initListadosSwipe?.();
    window.bindListadosInfiniteScroll?.();
    window.loadListados?.({ reset: true });
  });

  on("hdrFichasBtn", () => {
    // usa tu función existente
    window.goToStore ? window.goToStore() : (typeof goToStore === "function" ? goToStore() : null);
  });

  on("hdrPerfilBtn", () => {
    window.openProfileModal?.();
  });

  // Cierra al clicar fuera
  document.addEventListener("click", (e)=>{
    if (!details.hasAttribute("open")) return;
    if (e.target.closest("#hdrCollapsedMenu")) return;
    closeMenu();
  });

  // Cierra con ESC
  document.addEventListener("keydown", (e)=>{
    if (e.key === "Escape" && details.hasAttribute("open")) {
      e.preventDefault();
      closeMenu();
    }
  });
})();




/* =========================
   Listados Modal (close)
   ========================= */
(function initListadosModalClose(){
  const overlay = document.getElementById("listadosOverlay");
  const closeBtn = document.getElementById("listadosCloseBtn");
  if(!overlay || !closeBtn) return;

  function unlock(){
    document.documentElement.classList.remove("no-scroll");
    document.body.classList.remove("no-scroll");
  }

  function close(){
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden","true");
    unlock();
    setTimeout(()=>{ overlay.hidden = true; }, 180);
  }

  closeBtn.addEventListener("click", (e)=>{ e.preventDefault(); close(); });

  overlay.addEventListener("click", (e)=>{
    if(e.target === overlay) close();
  });

  document.addEventListener("keydown",(e)=>{
    if(e.key === "Escape" && overlay && !overlay.hidden){
      e.preventDefault();
      close();
    }
  });
})();


/* =========================
   Políticas y Términos modal
   ========================= */
(function initPoliciesModal(){
  const overlay = document.getElementById("policiesOverlay");
  const closeBtn = document.getElementById("policiesCloseBtn");
  const content = document.getElementById("policiesContent");
  if(!overlay || !closeBtn || !content) return;

  let loaded = false;

  function lock(){
    document.documentElement.classList.add("auth-open");
    document.body.classList.add("auth-open");
  }
  function unlock(){
    document.documentElement.classList.remove("auth-open");
    document.body.classList.remove("auth-open");
  }

  async function load(){
    if(loaded) return;
    try{
      const res = await fetch("/politicas.html", { cache: "no-store" });
      const html = await res.text();
      const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      content.innerHTML = m ? m[1] : html;
      loaded = true;
    }catch{
      content.textContent = "No se pudo cargar /politicas.html";
    }
  }

  function open(){
    overlay.hidden = false;
    requestAnimationFrame(()=> overlay.classList.add("is-open"));
    overlay.setAttribute("aria-hidden","false");
    lock();
    load();
  }

  function close(){
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden","true");
    unlock();
    setTimeout(()=>{ overlay.hidden = true; }, 180);
  }

  // ✅ API para usar “más adelante”
  window.openPoliciesModal = open;
  window.closePoliciesModal = close;

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click",(e)=>{ if(e.target === overlay) close(); });
  document.addEventListener("keydown",(e)=>{
    if(e.key === "Escape" && overlay && !overlay.hidden){
      e.preventDefault();
      close();
    }
  });

  })();

  // ===============================
// Cookie Consent (UE) — simple y compatible
// ===============================
(function initCookieConsent(){
  const KEY = "solotias_cookie_consent_v1"; // accepted | rejected
  const root = document.getElementById("cookieConsent");
  if (!root) return;

  const saved = localStorage.getItem(KEY);
  if (saved === "accepted") {
    enableNonEssentialCookies();
    return;
  }
  if (saved === "rejected") {
    disableNonEssentialCookies();
    return;
  }

  // Si no hay elección, mostramos banner
  root.hidden = false;

  const acceptBtn = root.querySelector("[data-cookie-accept]");
  const rejectBtn = root.querySelector("[data-cookie-reject]");
  const settingsBtn = root.querySelector("[data-cookie-settings]");

  acceptBtn?.addEventListener("click", () => {
    localStorage.setItem(KEY, "accepted");
    root.hidden = true;
    enableNonEssentialCookies();
  });

  rejectBtn?.addEventListener("click", () => {
    localStorage.setItem(KEY, "rejected");
    root.hidden = true;
    disableNonEssentialCookies();
  });

  // “Configurar” (mínimo): por ahora lo tratamos como rechazar hasta que tengas panel real
  // (Si quieres, te hago un mini-modal con toggles: Analítica / Marketing)
  settingsBtn?.addEventListener("click", () => {
    // Ejemplo: abrir modal propio si ya tienes sistema de overlays
    // openCookieSettingsModal();
    // Por defecto, no activamos nada sin consentimiento explícito:
    localStorage.setItem(KEY, "rejected");
    root.hidden = true;
    disableNonEssentialCookies();
  });

  function enableNonEssentialCookies(){
    // Aquí enganchas Analytics/Ads SOLO cuando el usuario acepta.
    // Ejemplo:
    // window.loadAnalytics?.();
  }

  function disableNonEssentialCookies(){
    // Asegura que NO se carguen scripts no esenciales.
    // Si ya los cargas en HTML, muévelos a enableNonEssentialCookies()
  }

})();


/* =========================
   AUTH SESSION (SoloTIASAuth) + UI SYNC
   ========================= */
(function initSoloTIASAuth(){
  const KEY_SESSION = "solotias_session_v1"; // JSON con respuesta de login (incluye user_data)
  const KEY_LOGGED  = "solotias_logged";     // "1" / null
  const KEY_UID     = "solotias_user_llamametu_id";

  // =========================
  // USER DATA REFRESH (coins, phone, virtual_number) via Cloud Function api_user_data
  // =========================
  // Configurable URL (por si lo sirves vía proxy PHP):
  // window.__USER_DATA_URL = "/api/user_data.php" (ejemplo)
  const USER_DATA_URL = window.__USER_DATA_URL || "/api/user_data.php";

  let userDataInFlight = null;

  async function fetchUserDataFromServer(user_llamametu_id) {
    if (!user_llamametu_id) throw new Error("missing_user_llamametu_id");

    const res = await fetch(USER_DATA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ user_llamametu_id: String(user_llamametu_id) }),
    });

    if (!res.ok) throw new Error("user_data_network");

    const raw = await res.json().catch(() => null);
    if (!raw) throw new Error("user_data_invalid_json");

    // Permitimos ambos formatos:
    // 1) Directo: { objectId, virtual_number, phone, coins }
    // 2) Envuelto: { result: { ... } }
    const data = (raw && raw.result && typeof raw.result === "object") ? raw.result : raw;

    // Validación mínima
    if (!data || !data.objectId) throw new Error("user_data_invalid_payload");

    return data;
  }

  function mergeUserDataIntoSession(userData) {
    const sess = getSession();
    if (!sess) return null;

    // mantenemos todo lo demás; solo actualizamos user_data
    sess.user_data = {
      ...(sess.user_data || {}),
      objectId: userData.objectId ?? sess.user_data?.objectId,
      virtual_number: userData.virtual_number ?? sess.user_data?.virtual_number,
      phone: userData.phone ?? sess.user_data?.phone,
      coins: userData.coins ?? sess.user_data?.coins,
    };

    try {
      localStorage.setItem(KEY_SESSION, JSON.stringify(sess));
      if (sess?.user_data?.objectId) localStorage.setItem(KEY_UID, String(sess.user_data.objectId));
    } catch {}

    return sess;
  }

async function refreshUserData({ silent = true } = {}) {
  const sess = getSession();
  const uid =
    sess?.user_data?.objectId ||
    localStorage.getItem(KEY_UID) ||
    null;

  if (!uid) return null;

  // Evita llamadas duplicadas si se abre/cierra rápido el modal
  if (userDataInFlight) return userDataInFlight;

  // 🔄 ACTIVAR SPINNER (ANTES de llamar a la API)
  window.__COINS_LOADING__ = true;
  window.refreshSessionUI?.();

  userDataInFlight = (async () => {
    try {
      const userData = await fetchUserDataFromServer(uid);
      mergeUserDataIntoSession(userData);
      return userData;
    } catch (e) {
      if (!silent) console.error("[api_user_data] error:", e);
      return null;
    } finally {
      userDataInFlight = null;

      // 🔄 DESACTIVAR SPINNER (cuando termina la llamada)
      window.__COINS_LOADING__ = false;
      window.refreshSessionUI?.();
    }
  })();

  return userDataInFlight;
}


  function safeParse(raw){
    try { return JSON.parse(raw); } catch { return null; }
  }

function getSession(){
  const raw = localStorage.getItem(KEY_SESSION);
  const data = raw ? safeParse(raw) : null;
  if (!data) return null;

  // ✅ Requisito mínimo real: tener user_data.objectId
  if (!data.user_data || !data.user_data.objectId) return null;

  // ✅ successful_verification lo tratamos como "soft"
  // (no bloquea refresco de coins si viene como "true" o 1 o no viene)
  return data;
}


  function isLogged(){
    return !!getSession();
  }

  function setSession(loginResponse){
    try {
      localStorage.setItem(KEY_SESSION, JSON.stringify(loginResponse));
      localStorage.setItem(KEY_LOGGED, "1");
      if (loginResponse?.user_data?.objectId) {
        localStorage.setItem(KEY_UID, String(loginResponse.user_data.objectId));
      }
    } catch {}
    window.refreshSessionUI?.();
  }

  function clearSession(){
    try {
      // Sesión principal (JSON completo con user_data)
      localStorage.removeItem("solotias_session_v1");

      // Flag de login
      localStorage.removeItem("solotias_logged");

      // ID usuario
      localStorage.removeItem("solotias_user_llamametu_id");

      // Compatibilidad con sistema anterior
      localStorage.removeItem("solotias_phone_verified");
      localStorage.removeItem("solotias_phone_verified_value");

    } catch (e) {
      console.error("Error limpiando sesión:", e);
    }

    // Sincroniza Header, VC modal y Perfil
    window.refreshSessionUI?.();
  }

  window.SoloTIASAuth = { getSession, isLogged, setSession, clearSession, refreshUserData };


window.refreshSessionUI = function refreshSessionUI(){
  const sess = getSession();
  const logged = !!sess;
  // --- Mostrar grupo logged/guest del menú colapsado ---
  document.documentElement.classList.toggle("is-logged", logged);
  const coins = sess?.user_data?.coins;
  const phone = sess?.user_data?.phone;
  const code  = sess?.user_data?.virtual_number;

  // --- Header icons (menu colapsado) ---
  const fichasBtn = document.getElementById("hdrFichasBtn");
  const perfilBtn = document.getElementById("hdrPerfilBtn");
  if (fichasBtn) fichasBtn.hidden = !logged;
  if (perfilBtn) perfilBtn.hidden = !logged;

  // --- Botón menú (3 puntos) solo si está logueado ---
  const hdrMenuWrap = document.querySelector(".hdr-menu");
  const hdrMenuBtn = document.getElementById("hdrMenuBtn");
  const hdrMenuPanel = document.getElementById("hdrMenuPanel");

  if (hdrMenuWrap) hdrMenuWrap.hidden = !logged;
  if (hdrMenuBtn) hdrMenuBtn.hidden = !logged;

  // si no está logueado, cerramos/ocultamos el panel por seguridad
  if (!logged && hdrMenuPanel) {
    hdrMenuPanel.hidden = true;
    hdrMenuWrap?.classList?.remove("is-open");
    hdrMenuBtn?.setAttribute?.("aria-expanded","false");
  }


  // --- VC modal buttons (mensaje / coins info) ---
  const vcMsgBtn   = document.getElementById("vcMsgBtn");
  const vcCoinsBtn = document.getElementById("vcCoinsBtn");

  if (vcMsgBtn && vcCoinsBtn) {
    if (logged) {
      vcMsgBtn.hidden = true;
      vcCoinsBtn.hidden = false;

      const hasCoins = (coins === 0 || coins === "0" || coins != null);
      const loadingCoins = !!window.__COINS_LOADING__ && !hasCoins;

      if (loadingCoins) {
        vcCoinsBtn.innerHTML = `
          <span class="coins-loading">
            <span>Dispones de coins</span>
            <span class="coins-spinner" aria-hidden="true"></span>
            <span>· comprar más fichas</span>
          </span>
        `;
      } else {
        vcCoinsBtn.textContent = `Dispones de coins: ${hasCoins ? coins : "—"} · comprar más fichas`;
      }
    } else {
      vcMsgBtn.hidden = false;
      vcCoinsBtn.hidden = true;
    }
  }

  // --- VC modal primary button (INICIAR LLAMADA / VIDEO) ---
  const vcPrimaryBtn = document.getElementById("vcPrimaryBtn");
  if (vcPrimaryBtn) {
    if (logged) {
      vcPrimaryBtn.classList.remove("is-disabled");
      vcPrimaryBtn.disabled = false;
      vcPrimaryBtn.removeAttribute("aria-disabled");
    } else {
      vcPrimaryBtn.classList.add("is-disabled");
      vcPrimaryBtn.disabled = true;
      vcPrimaryBtn.setAttribute("aria-disabled", "true");
    }
  }

  // --- Perfil modal (pintado en vivo si existe setter) ---
  window.setProfileModalData?.({
    code: code ?? "—",
    phone: phone ?? "—",
    coins: coins ?? "—"
  });
};

  // primera sincronización al cargar
  window.refreshSessionUI?.();
  document.addEventListener("DOMContentLoaded", () => {
    window.refreshSessionUI?.();
  });
})();

// --- VC Coins → Tienda ---
document.addEventListener("DOMContentLoaded", () => {
  const vcCoinsBtn = document.getElementById("vcCoinsBtn");
  if (!vcCoinsBtn) return;

  vcCoinsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    goToStore();
  });
});



/* =========================
   PROFILE MODAL (ADAPTADO A TU HTML)
   ========================= */
(function initProfileModal(){

  const overlay = document.getElementById("profileOverlay");
  const closeBtn = document.getElementById("profileCloseBtn");

  const elCode = document.getElementById("profileCode");
  const elPhoneMask = document.getElementById("profilePhoneMask");
  const elPhoneTail = document.getElementById("profilePhoneTail");
  const elTokens = document.getElementById("profileTokens");

  const storeBtn = document.getElementById("profileStoreBtn");
  const logoutBtn = document.getElementById("profileLogoutBtn");

  if(!overlay || !closeBtn) return;

  function lock(){
    document.documentElement.classList.add("auth-open");
    document.body.classList.add("auth-open");
  }

  function unlock(){
    document.documentElement.classList.remove("auth-open");
    document.body.classList.remove("auth-open");
  }

  function paintFromSession(){
    const sess = window.SoloTIASAuth?.getSession?.();
    const ud = sess?.user_data || {};

    // Código virtual_number
    if (elCode) {
      elCode.textContent = ud.virtual_number != null
        ? String(ud.virtual_number)
        : "—";
    }

    // Teléfono completo (lo pintamos entero en profilePhoneMask)
    if (elPhoneMask) {
      if (ud.phone) {
        elPhoneMask.textContent = String(ud.phone);
      } else {
        elPhoneMask.textContent = "—";
      }
    }

    // Si existe el span tail, lo ocultamos porque ahora mostramos teléfono completo
    if (elPhoneTail) {
      elPhoneTail.hidden = true;
    }

    // Coins (sin número + spinner mientras carga)
    if (elTokens) {
      const coins = ud.coins;
      const hasCoins = (coins === 0 || coins === "0" || coins != null);
      const loadingCoins = !!window.__COINS_LOADING__ && !hasCoins;

      if (loadingCoins) {
        elTokens.innerHTML = `<span class="coins-spinner" aria-hidden="true"></span>`;
      } else {
        elTokens.textContent = hasCoins ? String(coins) : "—";
      }
    }

  }

  async function open(){
    if (!window.SoloTIASAuth?.isLogged?.()) {
      window.openPhoneAuthModal?.();
      return;
    }

    // ✅ Abrir inmediatamente con lo que haya en sesión
    paintFromSession();

    overlay.hidden = false;
    requestAnimationFrame(()=> overlay.classList.add("is-open"));
    overlay.setAttribute("aria-hidden","false");

    lock();

    // ✅ Refrescar coins en segundo plano (sin bloquear apertura)
    window.SoloTIASAuth?.refreshUserData?.({ silent: true })
      .then(() => {
        paintFromSession(); // actualiza datos cuando lleguen
      })
      .catch(() => {});
  }



  function close(){
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden","true");
    unlock();

    setTimeout(()=>{
      overlay.hidden = true;
    }, 180);
  }

  // Exponer API
  window.openProfileModal = open;
  window.closeProfileModal = close;

  // Para que refreshAuthUI pueda actualizar datos en caliente
  window.setProfileModalData = function setProfileModalData(data = {}){
    if (data.code != null && elCode) {
      elCode.textContent = String(data.code);
    }

    if (data.phone != null && elPhoneMask) {
      elPhoneMask.textContent = String(data.phone);
    }

  if (elTokens) {
    const coins = data.coins;
    const hasCoins = (coins === 0 || coins === "0" || coins != null);
    const loadingCoins = !!window.__COINS_LOADING__ && !hasCoins;

    if (loadingCoins) {
      elTokens.innerHTML = `<span class="coins-spinner" aria-hidden="true"></span>`;
    } else if (hasCoins) {
      elTokens.textContent = String(coins);
    }
  }


    if (elPhoneTail) {
      elPhoneTail.hidden = true;
    }
  };

  closeBtn.addEventListener("click", (e)=>{
    e.preventDefault();
    close();
  });

  overlay.addEventListener("click",(e)=>{
    if(e.target === overlay) close();
  });

  document.addEventListener("keydown",(e)=>{
    if(e.key === "Escape" && overlay && !overlay.hidden){
      e.preventDefault();
      close();
    }
  });

  // Enlaces legales
  overlay.querySelectorAll("[data-open-policies]").forEach((btn)=>{
    btn.addEventListener("click",(e)=>{
      e.preventDefault();
      close();
      window.openPoliciesModal?.();
    });
  });

  storeBtn?.addEventListener("click",(e)=>{
    e.preventDefault();
    goToStore();
  });


  // Abandonar → cerrar sesión
  logoutBtn?.addEventListener("click",(e)=>{
    e.preventDefault();
    window.SoloTIASAuth?.clearSession?.();
    close();
  });

})();


// ===============================
// CLOSE ALL OVERLAYS + GO STORE
// ===============================
function closeAllOverlaysForNavigation() {
  try {
    // --- Menú hamburguesa (drawer) ---
    const menuOverlay = document.getElementById("menuOverlay");
    const menuBtn = document.getElementById("menuBtn");
    if (menuOverlay) {
      menuOverlay.classList.remove("is-open");
      menuOverlay.hidden = true;
    }
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");

    // --- Menú colapsado header (dropdown) ---
    const hdrWrap = document.querySelector(".hdr-menu");
    const hdrPanel = document.getElementById("hdrMenuPanel");
    const hdrBtn = document.getElementById("hdrMenuBtn");
    if (hdrWrap) hdrWrap.classList.remove("is-open");
    if (hdrPanel) hdrPanel.hidden = true;
    if (hdrBtn) hdrBtn.setAttribute("aria-expanded", "false");

    // --- Overlays “grandes” ---
    const ids = [
      "vcOverlay",
      "authOverlay",
      "profileOverlay",
      "listadosOverlay",
      "policiesOverlay",
      "mediaViewer",
      "geoInfoOverlay", // popup info GPS (si existe)
    ];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      el.classList.remove("is-open");
      el.classList.remove("open");   // panel usa .open
      el.classList.add("hidden");    // varios usan .hidden
      el.hidden = true;              // overlays usan hidden attribute
      el.setAttribute("aria-hidden", "true");
    });

    // Limpiar contenido del mediaViewer si aplica (evita “flash” al volver)
    const mediaContent = document.getElementById("mediaViewerContent");
    if (mediaContent) mediaContent.innerHTML = "";

    // --- Estado global de scroll / fullscreen ---
    document.documentElement.classList.remove("no-scroll", "auth-open", "viewer-open");
    document.body.classList.remove("no-scroll", "auth-open", "viewer-open", "call-active");

    // Si estás en callRoot, lo ocultamos también
    const callRoot = document.getElementById("callRoot");
    if (callRoot) {
      callRoot.hidden = true;
      callRoot.classList.add("hidden");
      callRoot.setAttribute("aria-hidden", "true");
    }

    // opcional: parar agora si existe (no bloquea navegación)
    try { window.stopAgoraCall?.(); } catch {}

  } catch (e) {
    // no hacemos nada, es “best-effort”
  }
}

function goToStore() {
  closeAllOverlaysForNavigation();
  // navega a tienda en raíz
  window.location.href = "/tienda.html";
}

/* =========================
   Listados: Calls (ParseCloud)
   ========================= */
(function initListadosCallsModule(){
  const ENDPOINT = (window.__CALLS_URL || "/api/calls.php");

  let page = 1;
  let loading = false;
  let exhausted = false;
  let scrollBound = false;

  function $(id){ return document.getElementById(id); }

  function getUserId(){
    // Preferimos la sesión (si existe), y si no, el localStorage que ya usas en otros flujos
    const fromSession =
      window.SoloTIASAuth?.getSession?.()?.user_data?.objectId ||
      window.session?.user_data?.objectId;

    const fromLS = (() => {
      try { return localStorage.getItem("solotias_user_llamametu_id") || ""; } catch { return ""; }
    })();

    return (fromSession || fromLS || "").trim();
  }

  function showLoading(on){
    const el = $("listadosLoading");
    if (el) el.hidden = !on;
  }
  function showEmpty(on){
    const el = $("listadosEmpty");
    if (el) el.hidden = !on;
  }

  function parseDateStr(s){
    // "04/02/26 09:57"
    if (!s || typeof s !== "string") return null;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
    if (!m) return null;
    const dd = Number(m[1]), mm = Number(m[2]), yy = Number(m[3]);
    const HH = Number(m[4]), MN = Number(m[5]);
    const year = 2000 + yy;
    return new Date(year, mm - 1, dd, HH, MN, 0, 0);
  }

  function formatDaySep(d){
    // “Hoy · dd/mm/yy”, “Ayer · dd/mm/yy”, si no “dd/mm/yy”
    const pad = (n)=> String(n).padStart(2,"0");
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth()+1);
    const yy = String(d.getFullYear()).slice(-2);
    const base = `${dd}/${mm}/${yy}`;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((that - today) / 86400000);

    if (diffDays === 0) return `Hoy · ${base}`;
    if (diffDays === -1) return `Ayer · ${base}`;
    return base;
  }

  function typeLabel(call_type){
    return call_type === "videocall" ? "Videollamada" : "Llamada";
  }

  function safeImg(url){
    const u = (url || "").trim();
    return u || "img/foto1.jpg"; // fallback local (no rompe layout)
  }

  function createDaySepEl(text){
    const wrap = document.createElement("div");
    wrap.className = "listados-day";
    wrap.innerHTML = `<div class="listados-day-sep"></div>`;
    wrap.querySelector(".listados-day-sep").textContent = text;
    return wrap;
  }

  function createRowEl(call){
    const row = document.createElement("div");
    row.className = "listados-row";
    row.dataset.rowId = call?.objectId || "";
    row.dataset.kind = call?.call_type || "call";

    const photo = safeImg(call?.advertisement?.url_principal_photo);
    const label = typeLabel(call?.call_type);
    const dateTxt = (call?.date || "").trim();
    const dur = (call?.duration || "").trim();
    const coins = (call?.coins ?? "").toString().trim();

    row.innerHTML = `
      <div class="listados-row__bg" aria-hidden="true">
        <button class="listados-row__delete" type="button" aria-label="Eliminar">
          <span class="listados-row__bg-label">Eliminar</span>
          <span class="listados-row__bg-ico" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="currentColor" d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9z"/>
            </svg>
          </span>
        </button>
      </div>

      <div class="listados-row__fg">
        <div class="listados-item">
          <img class="listados-avatar" src="${photo}" alt="Avatar" loading="lazy">
          <div class="listados-meta">
            <div class="listados-type">${label}</div>
            <div class="listados-sub">${dateTxt} · ${dur}</div>
          </div>
          <div class="listados-right">
            <span class="listados-badge">${coins} Fichas</span>
          </div>
        </div>
      </div>
    `;
    return row;
  }

  async function fetchPage(p){
    const userId = getUserId();
    if (!userId) throw new Error("missing_user_llamametu_id_front");

    const res = await fetch(ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_llamametu_id: userId, page: p })
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(raw?.error || "calls_http_error");

    // Tu proxy devuelve directamente el result (ok/page/calls)
    if (!raw || raw.ok !== true || !Array.isArray(raw.calls)) {
      throw new Error("calls_invalid_payload");
    }
    return raw;
  }

  function sortCallsDesc(calls){
    return calls.slice().sort((a,b)=>{
      const da = parseDateStr(a?.date);
      const db = parseDateStr(b?.date);
      return (db?.getTime?.() || 0) - (da?.getTime?.() || 0);
    });
  }

  function renderAppend(calls){
    const list = $("listadosList");
    if (!list) return;

    // agrupamos por día “bonito”
    let lastSep = null;
    calls.forEach((c)=>{
      const d = parseDateStr(c?.date);
      const sep = d ? formatDaySep(d) : "—";

      if (sep !== lastSep) {
        list.appendChild(createDaySepEl(sep));
        lastSep = sep;
      }
      list.appendChild(createRowEl(c));
    });
  }

  async function load({ reset=false } = {}){
    const list = $("listadosList");
    if (!list) return;
    if (loading) return;
    if (exhausted && !reset) return;

    if (reset) {
      page = 1;
      exhausted = false;
      list.innerHTML = "";
      showEmpty(false);
    }

    loading = true;
    showLoading(true);

    try{
      const data = await fetchPage(page);
      const calls = sortCallsDesc(data.calls);

      if (page === 1 && calls.length === 0) {
        showEmpty(true);
        exhausted = true;
        return;
      }

      if (calls.length === 0) {
        exhausted = true;
        return;
      }

      renderAppend(calls);

      // Si devuelve hasta 50 por página, cuando venga menos de 50 suele indicar fin
      if (calls.length < 50) exhausted = true;

      page += 1;

    } catch (e) {
      // Si quieres ver el error real en consola:
      console.error("Listados load error:", e);
      // mantenemos el empty si no hay nada en pantalla
      if ((list.children?.length || 0) === 0) showEmpty(true);
    } finally {
      showLoading(false);
      loading = false;
    }
  }

  function bindInfiniteScroll(){
    if (scrollBound) return;
    const body = document.querySelector("#listadosOverlay .listados-body");
    if (!body) return;

    body.addEventListener("scroll", () => {
      if (loading || exhausted) return;
      const nearBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 120;
      if (nearBottom) load({ reset:false });
    }, { passive:true });

    scrollBound = true;
  }

  // Delete rojo: por ahora solo quita del DOM, API borrar vendrá después
  // (tu motor swipe ya llama onDelete(id,row) y hace row.remove()) :contentReference[oaicite:2]{index=2}

  window.loadListados = load;
  window.bindListadosInfiniteScroll = bindInfiniteScroll;
})();


(function initGestureCoachOnce(){
  const KEY = "solotias_gesture_coach_v1";
  const el = document.getElementById("gestureCoach");
  const swipeContainer = document.getElementById("swipeContainer");

  if (!el || !swipeContainer) return;
  if (localStorage.getItem(KEY) === "1") return;

  function show(){
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
  }

  function hideForever(){
    if (localStorage.getItem(KEY) === "1") return;

    localStorage.setItem(KEY, "1");
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");

    swipeContainer.removeEventListener("pointerdown", onMoveStart);
    swipeContainer.removeEventListener("touchstart", onMoveStart);
  }

  function onMoveStart(e){
    // Solo ocultar si realmente empieza un gesto sobre una card
    if (e.target.closest(".swipe-card")) {
      hideForever();
    }
  }

  // Mostrar tras pequeño delay cuando todo esté renderizado
  setTimeout(show, 800);

  // Escuchar solo gestos sobre cartas
  swipeContainer.addEventListener("pointerdown", onMoveStart, { passive:true });
  swipeContainer.addEventListener("touchstart", onMoveStart, { passive:true });

})();

function showConnectOverlay(title, sub) {
  const el = document.getElementById("connectOverlay");
  if (!el) return;

  const t = el.querySelector(".connect-ov__title");
  const s = el.querySelector(".connect-ov__sub");

  if (t && title) t.textContent = title;
  if (s && sub) s.textContent = sub;

  el.hidden = false;
  el.setAttribute("aria-hidden", "false");
  document.documentElement.classList.add("no-scroll");
  document.body.classList.add("no-scroll");
}

function hideConnectOverlay() {
  const el = document.getElementById("connectOverlay");
  if (!el) return;

  el.hidden = true;
  el.setAttribute("aria-hidden", "true");
  document.documentElement.classList.remove("no-scroll");
  document.body.classList.remove("no-scroll");
}

