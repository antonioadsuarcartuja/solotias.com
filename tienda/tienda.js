(function () {
  const packsGrid = document.getElementById("packsGrid");
  const chosenBox = document.getElementById("chosenBox");
  const chosenName = document.getElementById("chosenName");
  const chosenDesc = document.getElementById("chosenDesc");
  const warnBox = document.getElementById("warnBox");
  const btnBack = document.getElementById("btnBack");

  btnBack?.addEventListener("click", () => history.back());

  // Rellenar años 2026..2046
  const expYear = document.getElementById("expYear");
  if (expYear) {
    for (let y = 2026; y <= 2046; y++) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      expYear.appendChild(opt);
    }
  }

  // Accordion (solo 1 abierto)
  const accordion = document.getElementById("accordion");
  accordion?.addEventListener("click", (e) => {
    const btn = e.target.closest(".acc-btn");
    if (!btn) return;

    const item = btn.closest(".acc-item");
    if (!item) return;

    const isOpen = item.getAttribute("data-open") === "true";
    accordion.querySelectorAll(".acc-item").forEach((it) => it.setAttribute("data-open", "false"));
    item.setAttribute("data-open", isOpen ? "false" : "true");
  });

  // Enlace "¿Qué es?" vacío
  document.querySelectorAll("[data-empty-link]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // vacío intencionalmente
    });
  });

  // Config cabeceras Parse (Back4App)
  function buildCloudHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (window.B4A_APP_ID) headers["X-Parse-Application-Id"] = window.B4A_APP_ID;
    if (window.B4A_REST_API_KEY) headers["X-Parse-REST-API-Key"] = window.B4A_REST_API_KEY;
    if (window.B4A_SESSION_TOKEN) headers["X-Parse-Session-Token"] = window.B4A_SESSION_TOKEN;
    return headers;
  }

  // Endpoint functions
  function getCloudFunctionEndpoint(functionName) {
    // 1) URL explícita
    if (window.B4A_CLOUD_FUNCTION_URL) return window.B4A_CLOUD_FUNCTION_URL;

    // 2) Parse Server base (si existe)
    if (window.B4A_PARSE_SERVER_URL) {
      return String(window.B4A_PARSE_SERVER_URL).replace(/\/$/, "") + "/functions/" + functionName;
    }

    // 3) Proxy same-origin (recomendado, igual que anuncios)
    if (functionName === "api_get_coin_prices") return "/apis/coin_prices.php";

    // fallback genérico
    return "";
  }

  // Precios (Cloud Function api_get_coin_prices via proxy same-origin)
  async function fetchCoinPrices() {
    const endpoint = getCloudFunctionEndpoint("api_get_coin_prices");
    if (!endpoint) throw new Error("No hay endpoint para api_get_coin_prices.");

    // Si vamos por proxy same-origin, NO hace falta headers Parse
    const isProxy = endpoint.startsWith("/apis/");

    const res = await fetch(endpoint, {
      method: "GET", // igual que anuncios: simple y cache-controlable
      headers: isProxy ? { "Accept": "application/json" } : buildCloudHeaders(),
      cache: "no-store"
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (_) { json = null; }

    if (!res.ok) {
      const msg = (json && (json.error || json.message)) ? (json.error || json.message) : text;
      throw new Error("Error al cargar precios: " + msg);
    }

    // Parse suele envolver en {result: ...}
    const data = (json && typeof json === "object" && "result" in json) ? json.result : json;
    return data;
  }

  // user_llamametu_id (según app.js)
  function getUserLlamametuId() {
    try {
      const fromAuth = window.SoloTIASAuth?.getSession?.()?.user_data?.objectId;
      if (fromAuth) return String(fromAuth);
    } catch (_) {}

    const fromLs = (typeof localStorage !== "undefined")
      ? localStorage.getItem("solotias_user_llamametu_id")
      : null;
    if (fromLs) return String(fromLs);

    if (window.__llamametu_user_id) return String(window.__llamametu_user_id);
    return "";
  }

  async function getClientIpBestEffort() {
    // Solo se usa para PayPal porque la Cloud Function actual lee request.params.ip
    // Si falla, devolvemos "" y el servidor/proxy puede completarlo.
    try {
      const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
      const j = await res.json();
      return (j && j.ip) ? String(j.ip) : "";
    } catch (_) {
      return "";
    }
  }

  // Normaliza packs (robusto a estructuras)
  function normalizePacks(raw) {
    const arr =
      (raw && Array.isArray(raw.coin_princes) ? raw.coin_princes : null) ||
      (raw && Array.isArray(raw.coin_prices) ? raw.coin_prices : null) ||
      (raw && Array.isArray(raw.items) ? raw.items : null) ||
      (Array.isArray(raw) ? raw : []);

    return arr.slice(0, 4).map((p, i) => ({
      id: p.objectId || p.id || String(i),
      name: String(p.name || "Pack"),
      coins: Number(p.coins ?? 0),

      // ✅ compatibilidad + nuevos campos
      description: String(p.description || ""),
      call_description: String(p.call_description || ""),
      videocall_description: String(p.videocall_description || ""),

      price: Number(p.price ?? 0),
      recommended: Boolean(p.recommended)
    }));
  }

  function euro(n) {
    if (!Number.isFinite(n)) return "";
    return n.toFixed(2).replace(".", ",");
  }

  async function handleCardPurchase() {
    const statusEl = document.getElementById("payStatus");
    const btn = document.getElementById("payCardBtn");

    function setStatus(type, text) {
      if (!statusEl) return;
      statusEl.className = "pay-status " + type;
      statusEl.textContent = text;
      statusEl.style.display = "block";
    }

    // Pack seleccionado
    const pack = packs.find(p => String(p.id) === String(selectedId));
    if (!pack || String(pack.id).startsWith("empty-")) {
      setStatus("error", "Selecciona un pack válido antes de pagar.");
      return;
    }

    const user_llamametu_id = getUserLlamametuId();
    if (!user_llamametu_id) {
      setStatus("error", "No se pudo identificar tu sesión. Vuelve a iniciar sesión e inténtalo de nuevo.");
      return;
    }

    // Inputs (en este HTML ya no hay teléfono ni titular; tomamos los inputs por orden dentro del panel TARJETA)
    const cardItem = document.querySelector('.acc-item[data-key="card"]');
    const inputs = cardItem ? cardItem.querySelectorAll("input") : [];
    const selects = cardItem ? cardItem.querySelectorAll("select") : [];

    const card_number = (inputs[0]?.value || "").trim().replace(/\s+/g, "");
    const card_cvc = (inputs[1]?.value || "").trim();

    const month = (selects[0]?.value || "").trim(); // MM
    const yearFull = (selects[1]?.value || "").trim(); // YYYY
    const year2 = yearFull ? yearFull.slice(-2) : "";
    const card_expiration_date = (month && year2) ? `${month}${year2}` : "";

    // Validaciones mínimas (sin bloquear UX)
    if (!card_number) { setStatus("error", "Indica el número de tarjeta."); return; }
    if (!card_expiration_date || card_expiration_date.length !== 4) { setStatus("error", "Selecciona la caducidad (mes y año)."); return; }
    if (!card_cvc) { setStatus("error", "Indica el CVC."); return; }

    // UI: procesando
    setStatus("info", "Estamos procesando su compra un momento porfavor");

    // Evitar doble click
    if (btn) btn.disabled = true;

    try {
      const payload = {
        user_llamametu_id,
        coin_price_id: pack.id,
        card_number,
        card_expiration_date, // MMYY
        card_cvc,
        http_host: "solotias.com"
      };

      const res = await fetch("/apis/purchase_request.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store"
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch (_) { json = null; }

      if (!res.ok) {
        const msg = (json && (json.error || json.message)) ? (json.error || json.message) : text;
        throw new Error(msg || "Error de compra.");
      }

      // Back4App suele devolver {result: ...}
      const data = (json && typeof json === "object" && "result" in json) ? json.result : json;

      const charged = Boolean(data && data.charged);
      if (!charged) {
        const errMsg = (data && (data.error || data.message)) ? (data.error || data.message) : "No se pudo completar el pago.";
        setStatus("error", String(errMsg));
        return;
      }

      setStatus("ok", "Compra realizada con éxito, ya puedes llamar");
    } catch (e) {
      setStatus("error", (e && e.message) ? e.message : "Error de compra.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handlePaypalPurchase() {
    const statusEl = document.getElementById("paypalStatus");
    const btn = document.getElementById("payPaypalBtn");
    const form = document.getElementById("paypal_form");

    function setStatus(type, text) {
      if (!statusEl) return;
      statusEl.className = "pay-status " + type;
      statusEl.textContent = text;
      statusEl.style.display = "block";
    }

    // Pack seleccionado
    const pack = packs.find(p => String(p.id) === String(selectedId));
    if (!pack || String(pack.id).startsWith("empty-")) {
      setStatus("error", "Selecciona un pack válido antes de pagar con PayPal.");
      return;
    }

    const user_llamametu_id = getUserLlamametuId();
    if (!user_llamametu_id) {
      setStatus("error", "No se pudo identificar tu sesión. Vuelve a iniciar sesión e inténtalo de nuevo.");
      return;
    }

    const ip = await getClientIpBestEffort();

    if (!form) {
      setStatus("error", "No se encontró el formulario de PayPal en la página.");
      return;
    }

    setStatus("info", "Redirigiendo a PayPal…");
    if (btn) btn.disabled = true;

    try {
      const res = await fetch("/apis/previous_paypal_purchase_request.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_llamametu_id,
          coin_price_id: pack.id,
          ip,
          http_host: "solotias.com"
        }),
        cache: "no-store"
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch (_) { json = null; }

      if (!res.ok) {
        const msg = (json && (json.error || json.message)) ? (json.error || json.message) : text;
        throw new Error(msg || "No se pudo iniciar PayPal.");
      }

      const data = (json && typeof json === "object" && "result" in json) ? json.result : json;

      if (!data || data.ok !== true || !data.names) {
        throw new Error("Respuesta inválida al preparar PayPal.");
      }

      const names = data.names;

      // Rellenar inputs del form
      form.querySelector('input[name="business"]').value = String(names.business || "");
      form.querySelector('input[name="item_name"]').value = String(names.item_name || "");
      form.querySelector('input[name="item_number"]').value = String(names.item_number || "");
      form.querySelector('input[name="amount"]').value = String(names.amount || "");

      // Validación mínima
      if (!form.querySelector('input[name="business"]').value ||
          !form.querySelector('input[name="item_name"]').value ||
          !form.querySelector('input[name="item_number"]').value ||
          !form.querySelector('input[name="amount"]').value) {
        throw new Error("Faltan datos para enviar a PayPal.");
      }

      // Enviar a PayPal
      form.submit();
    } catch (e) {
      setStatus("error", (e && e.message) ? e.message : "Error al iniciar PayPal.");
      if (btn) btn.disabled = false;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  let packs = [];
  let selectedId = "";

  function renderPacks() {
    if (!packsGrid) return;

    if (!packs.length) {
      packsGrid.innerHTML = `<div class="warn">No hay packs disponibles en este momento.</div>`;
      return;
    }

    packsGrid.innerHTML = packs.map(p => {
      const selected = p.id === selectedId ? " selected" : "";

      // ✅ Prioridad: call_description, y si no, description (compatibilidad)
      const callDesc = (p.call_description && String(p.call_description).trim())
        ? String(p.call_description)
        : String(p.description || "");

      // ✅ Nueva línea opcional: videocall_description
      const videoDesc = (p.videocall_description && String(p.videocall_description).trim())
        ? String(p.videocall_description)
        : "";

      return `
        <div class="card shop-card${selected}" role="button" tabindex="0" data-pack-id="${escapeHtml(p.id)}">
          <div class="shop-card-name">${escapeHtml(p.name)}</div>

          <div class="shop-card-line">
            <div class="shop-card-coins">${escapeHtml(String(p.coins))}</div>
            <b>Créditos:</b>
          </div>

          <div class="shop-card-line">
            <img src="tienda/icons/reloj.svg" alt="" class="icon-inline">
            ${escapeHtml(callDesc)}
          </div>

          ${videoDesc ? `
            <div class="shop-card-line">
              <img src="tienda/icons/reloj.svg" alt="" class="icon-inline">
              ${escapeHtml(videoDesc)}
            </div>
          ` : ""}

          <div class="shop-card-price">
            ${escapeHtml(euro(p.price))} €
          </div>
        </div>
      `;
    }).join("");
  }

  function setChosen(pack) {
    if (!chosenBox || !chosenName || !chosenDesc) return;

    if (!pack) {
      chosenBox.style.display = "none";
      return;
    }

    chosenName.textContent = pack.name;
    chosenDesc.textContent = " " + pack.coins + " créditos";
    chosenBox.style.display = "block";
  }

  function bindPackEvents() {
    if (!packsGrid) return;

    packsGrid.addEventListener("click", (e) => {
      const card = e.target.closest("[data-pack-id]");
      if (!card) return;

      const id = card.getAttribute("data-pack-id");
      selectedId = id;

      const pack = packs.find(p => String(p.id) === String(id));
      renderPacks();
      setChosen(pack);
    });

    packsGrid.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest("[data-pack-id]");
      if (!card) return;
      e.preventDefault();
      card.click();
    });
  }

  function setupOrientationOverlayTienda() {
    const overlay = document.getElementById("rotateOverlayTienda");
    if (!overlay) return;

    function isTouchDevice() {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const noHover = window.matchMedia("(hover: none)").matches;
      const hasTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
      return hasTouch && (coarse || noHover);
    }

    function update() {
      const isLandscape = window.matchMedia("(orientation: landscape)").matches;
      const shouldShow = isTouchDevice() && isLandscape;

      overlay.classList.toggle("open", shouldShow);
      overlay.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    }

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", update);
    }

    update();
  }

  async function init() {
    bindPackEvents();

    // ✅ Overlay orientación (solo móvil/PWA)
    setupOrientationOverlayTienda();

    try {
      const raw = await fetchCoinPrices();
      packs = normalizePacks(raw);

      while (packs.length < 4) {
        packs.push({
          id: "empty-" + packs.length,
          name: "—",
          coins: 0,
          description: "No disponible",
          call_description: "",
          videocall_description: "",
          price: 0,
          recommended: false
        });
      }

      const firstReal = packs.find(p => !String(p.id).startsWith("empty-")) || packs[0];
      selectedId = firstReal ? firstReal.id : "";
      renderPacks();
      setChosen(firstReal);

      if (warnBox) warnBox.style.display = "none";
    } catch (err) {
      if (warnBox) {
        warnBox.style.display = "block";
        warnBox.textContent = (err && err.message) ? err.message : "No se pudieron cargar los precios.";
      }
      if (packsGrid) {
        packsGrid.innerHTML = `<div class="warn">No se pudieron cargar los packs ahora mismo.</div>`;
      }
    }

    // ✅ Listener del botón de pago (tarjeta)
    const payBtn = document.getElementById("payCardBtn");
    if (payBtn) payBtn.addEventListener("click", handleCardPurchase);

    // ✅ Listener del botón de PayPal (no rompe nada)
    const paypalBtn = document.getElementById("payPaypalBtn");
    if (paypalBtn) paypalBtn.addEventListener("click", handlePaypalPurchase);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }

  init();
})();