// Versión PRO + LOADER de app.js — conectada al Worker Loader de contenido
// - Áreas: se leen de https://polizarium-loader.../areas
// - Escenarios: se leen de https://polizarium-loader.../areas/:areaId
// - Feedback IA: usa el worker actual (index.rgarciaplicet.workers.dev)

(function(){
  "use strict";

  console.log("🔥 Polizarium PRO — app.js conectado al Loader de contenido (con Guía + banners + imágenes + retry)");

  // ================================
  // CONFIG
  // ================================
  const LOADER_BASE = "https://polizarium-loader.rgarciaplicet.workers.dev";
  const CONTENT_URL = `${LOADER_BASE}/areas`; // lista de áreas (Loader)
  const API = "https://index.rgarciaplicet.workers.dev/"; // Worker de feedback IA

  // ================================
  // ESTADO GLOBAL
  // ================================
  const S = {
    nombre: "",
    cliente: "",
    areaId: "",
    areaTitle: "",
    scenId: "",
    content: null,   // { areas: [...] } del Loader
    scenarios: [],
    lastFrase: "",
    pack: null
  };

  let contentReady = false;
  let contentFetching = false;

  // ================================
  // HELPERS
  // ================================
  const qs = (s, sc=document) => sc.querySelector(s);
  const qsa = (s, sc=document) => Array.from(sc.querySelectorAll(s));
  const esc = (s = "") => s.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));

  async function ai(payload){
    const r = await fetch(API,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    if(!r.ok) throw new Error("Worker error");
    return await r.json();
  }

  function renderFeedback(text){
    if(!text) return `<p class='muted'>⚠️ No se generó feedback</p>`;
    let data;
    try { 
      data = JSON.parse(text); 
    } catch(e) {
      return `<p class='muted'>❌ JSON inválido</p>`;
    }
    const r = data.revelacion || {};
    return `
      <div class="feedback-animated">
        <div class="feedback-section" style="animation-delay:0ms;">
          <strong>✨ LO QUE TU FRASE YA CONTENÍA:</strong><br>
          ${esc(r.lo_que_contenia || "")}
        </div>
        <div class="feedback-section" style="animation-delay:500ms;">
          <strong>🗣️ TU MENSAJE, PERFECCIONADO:</strong><br>
          “${esc(r.frase_afinada || "")}”
        </div>
        <div class="feedback-section" style="animation-delay:1000ms;">
          <strong>🔑 TU SUPERPODER:</strong><br>
          ${esc(r.llave_maestra || "")}
        </div>
      </div>`;
  }

  function copy(t) {
    t = t || "";
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t)
        .then(() => alert("✅ Copiado"))
        .catch(() => fallbackCopy(t));
    } else {
      fallbackCopy(t);
    }
  }

  function fallbackCopy(t) {
    const a = document.createElement("textarea");
    a.value = t;
    a.style.position = "fixed";
    a.style.left = "-9999px";
    document.body.appendChild(a);
    a.select();
    try {
      document.execCommand("copy");
      alert("✅ Copiado");
    } catch(e) {
      alert("❌ No se pudo copiar");
    }
    document.body.removeChild(a);
  }

  function slug(s) {
    s = s || "";
    try {
      s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch(e) {}
    return s.toLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // ================================
  // NAVEGACIÓN
  // ================================
  let currentStep = "p0";
  function go(id){
    qsa(".step").forEach(x=>x.classList.remove("active"));
    const target = qs(`#${id}`);
    if (target) {
      target.classList.add("active");
      currentStep = id;
      window.scrollTo({top:0, behavior:"smooth"});
    }
  }

  // ================================
  // CONTENIDO DESDE LOADER
  // ================================
  function startFetchContent(){
    if(contentReady || contentFetching) return;
    contentFetching = true;

    fetch(CONTENT_URL)
      .then(r => r.json())
      .then(data => {
        // Loader devuelve { areas: [...] }
        S.content = data;
        contentReady = true;
        buildAreas();
      })
      .catch(err => console.error("Error cargando contenido desde Loader", err))
      .finally(()=> contentFetching=false);
  }

  function buildAreas(){
    const grid = qs("#areas-grid"); 
    if(!grid) return;
    const areas = S.content?.areas || [];
    grid.innerHTML = "";

    if (!areas.length) {
      grid.innerHTML = `<div class="fb"><p class="muted">No hay áreas disponibles.</p></div>`;
      return;
    }

    areas.forEach(a=>{
      const d = document.createElement("div");
      d.className = "area-card";
      d.dataset.area = a.id;

      // Fondo como en la versión original: imagen por área + overlay suave
      const imagePath = `/images/${a.id}_bg.jpg`;
      d.style.backgroundImage = `linear-gradient(rgba(47, 67, 72, 0.05), rgba(47, 67, 72, 0.05)), url('${imagePath}')`;

      d.innerHTML = `
        <div class="area-title">${a.icon || "📋"} ${esc(a.title)}</div>
        <p class="area-desc">${esc(a.desc || "")}</p>
        <div class="group">
          <button class="btn primary" data-area="${esc(a.id)}" type="button">Entrar</button>
        </div>
      `;
      grid.appendChild(d);
    });
  }

  async function buildScenarios(){
    if(!S.areaId) return;
    const url = `${LOADER_BASE}/areas/${S.areaId}`;

    try {
      const res = await fetch(url);
      if(!res.ok){
        console.error("Error cargando escenarios desde Loader", res.status);
        return;
      }
      const data = await res.json();
      S.scenarios = data.escenarios || [];

      const grid = qs("#scen-grid");
      grid.innerHTML="";
      S.scenarios.forEach(sc=>{
        const d = document.createElement("div");
        d.className = "sc-card";
        d.dataset.scenario = sc.id;
        d.innerHTML = `
          <div class='sc-title'>${esc(sc.title)}</div>
          <p class='sc-desc'>${esc(sc.question || "")}</p>
        `;
        grid.appendChild(d);
      });

      // Actualizar título de área en p3
      const titleEl = qs("#area-title");
      if (titleEl) titleEl.textContent = S.areaTitle || "";

      // Actualizar banner de área
      const banner = qs("#area-banner");
      const bannerTitle = qs("#area-banner-title");
      const bannerSubtitle = qs("#area-banner-subtitle");

      if (banner && bannerTitle && bannerSubtitle) {
        banner.className = "area-banner"; // reset classes
        banner.classList.add(`bg-${S.areaId}`);
        banner.style.display = "flex";

        const area = (S.content?.areas || []).find(a => a.id === S.areaId);
        if (area) {
          bannerTitle.textContent = area.title;
          bannerSubtitle.textContent = area.desc;
        } else {
          bannerTitle.textContent = "";
          bannerSubtitle.textContent = "";
        }
      }

    } catch (err) {
      console.error("Error en buildScenarios con Loader:", err);
    }
  }

  function buildScenarioView(sid){
    const sc = S.scenarios.find(x=>x.id===sid);
    if(!sc) return;

    const escBadge = qs("#esc-badge");
    if (escBadge) escBadge.textContent = "Área — " + (S.areaTitle || "");

    qs("#esc-title").textContent = sc.title;
    qs("#esc-question").textContent = sc.question || ("Cliente: " + sc.title + ". ¿Cómo respondes?");

    const box = qs("#esc-options");
    box.innerHTML = `
      <textarea id='user-response' 
                rows='4' 
                placeholder='¿Cómo responderías TÚ? Escribe con tus propias palabras...' 
                style="width:100%; padding:12px; border-radius:12px; border:1px solid var(--stroke); background:#16252a; color:#e8f1f3; margin-bottom:16px;"></textarea>
      <button class='btn primary' id='reveal-adn'>Revelar mi ADN conversacional</button>
    `;

    const ans = qs("#esc-answer");
    if (ans) {
      ans.innerHTML = "";
      ans.style.display = "none";
      ans.classList.remove("show");
    }

    const actions = qs("#feedback-actions");
    if (actions) actions.style.display = "none";

    const hint = qs("#post-feedback-hint");
    if (hint) hint.style.display = "none";

    const options = qs("#post-feedback-options");
    if (options) options.style.display = "none";
  }

  // ================================
  // IA PLAY
  // ================================
  async function runPlay(sc, fraseUsuario){
    const ans = qs("#esc-answer");
    ans.innerHTML = `<p class='muted'>⏳ Generando...</p>`;
    ans.style.display = "block";

    try{
      const pack = await ai({
        nombre: S.nombre,
        cliente: S.cliente,
        area: S.areaTitle,
        escenario: sc.title,
        frase_usuario: fraseUsuario
      });

      S.pack = pack;
      S.lastFrase = fraseUsuario;

      ans.innerHTML = renderFeedback(pack.feedback);
      ans.classList.add("show");

      const actions = qs("#feedback-actions");
      if (actions) actions.style.display = "flex";

      const hint = qs("#post-feedback-hint");
      if (hint) hint.style.display = "block";

      const options = qs("#post-feedback-options");
      if (options) options.style.display = "block";
    } catch(e){
      console.error("Error en runPlay:", e);
      ans.innerHTML = `<p class='muted'>❌ Error generando</p>`;
    }
  }

  // ================================
  // EVENTOS
  // ================================
  function wireEvents(){
    // Botón de inicio
    qs("#start")?.addEventListener("click", ()=>{
      S.nombre = qs("#nombre").value.trim();
      S.cliente = qs("#cliente").value.trim();
      go("p1");
      if(!contentReady){
        startFetchContent();
      }
    });

    // ← Volver
    qs("#btn-back")?.addEventListener("click", ()=>{
      if(currentStep === "p3"){
        go("p1");
      } else if (currentStep === "p4"){
        go("p3");
      } else {
        go("p0");
      }
    });

    // Botones "Áreas" y "Guía" (topnav y cierre)
    qsa("[data-nav]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const nav = btn.getAttribute("data-nav");
        if (nav === "areas") {
          go("p1");
        } else if (nav === "guia") {
          go("p8");
        }
      });
    });

    // FAB "Guía" (esquina inferior)
    qs("#btn-guide-fab")?.addEventListener("click", () => {
      go("p8");
    });

    // Toggle lista / grid en escenarios
    qs("#toggle-view")?.addEventListener("click", ()=>{
      const grid = qs("#scen-grid");
      if(!grid) return;
      const isList = grid.classList.toggle("list-view");
      const btn = qs("#toggle-view");
      if (btn) {
        btn.textContent = isList ? "🔳 Ver como tarjetas" : "📋 Ver como lista";
      }
    });

    // Clicks globales
    document.addEventListener("click", e=>{
      const t = e.target;

      // Click en botón "Entrar" dentro de la tarjeta de área
      if (t.closest(".area-card .btn")) {
        const btn = t.closest(".area-card .btn");
        const id = btn.dataset.area;
        const area = (S.content?.areas || []).find(a => a.id === id);
        if (!area) return;

        S.areaId = id;
        S.areaTitle = area.title || "";

        const ctx = qs("#area-title");
        if (ctx) ctx.textContent = S.areaTitle || "—";

        buildScenarios();
        go("p3");
        return;
      }

      // Click en tarjeta de escenario
      if(t.closest(".sc-card")){
        const id = t.closest(".sc-card").dataset.scenario;
        S.scenId = id;
        buildScenarioView(id);
        go("p4");
        return;
      }

      // Revelar ADN
      if(t.id === "reveal-adn"){
        const userResponse = qs("#user-response").value.trim();
        if(!userResponse){ alert("Escribe tu respuesta"); return; }
        const sc = S.scenarios.find(x=>x.id===S.scenId);
        if (!sc) return;
        runPlay(sc, userResponse);
        return;
      }

      // Copiar revelación
      if (t.closest("#p5-copy")) {
        const escTitle = qs('#esc-title');
        const txt = `Polizarium — ${S.areaTitle}\nEscenario: ${escTitle?.textContent || "-"}\n\nRevelación:\n${S.lastFrase || "-"}`;
        copy(txt);
        return;
      }

      // Descargar .txt
      if (t.closest("#p5-dl")) {
        const escTitle = qs('#esc-title');
        const txt = `Polizarium — ${S.areaTitle}\nEscenario: ${escTitle?.textContent || "-"}\n\nRevelación:\n${S.lastFrase || "-"}`;
        const blob = new Blob([txt], {type: "text/plain;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `polizarium-${slug(S.areaId || 'area')}-${slug(S.scenId || 'escenario')}.txt`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          a.remove();
        }, 0);
        return;
      }

      // Compartir por WhatsApp
      if (t.closest("#btn-wa")) {
        const escTitle = qs('#esc-title');
        const msg = `Polizarium — ${S.areaTitle}\nEscenario: ${escTitle?.textContent || "-"}\n\nRevelación:\n${S.lastFrase || "-"}`;
        window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
        return;
      }

      // Finalizar sesión
      if (t.closest("#finish")) {
        const thanksName = qs("#thanks-name");
        const thanksArea = qs("#thanks-area");
        if (thanksName) thanksName.textContent = S.nombre || "Profesional";
        if (thanksArea) thanksArea.textContent = S.areaTitle || "tu área";
        go("p9");
        return;
      }

      // Reintentar el mismo escenario con otra respuesta
      if (t.id === "retry-same") {
        const box = qs("#esc-options");
        if (box) {
          box.innerHTML = `
            <textarea id='user-response' 
                      rows='4' 
                      placeholder='Escribe otra forma en que responderías...' 
                      style="width:100%; padding:12px; border-radius:12px; border:1px solid var(--stroke); background:#16252a; color:#e8f1f3; margin-bottom:16px;"></textarea>
            <button class='btn primary' id='reveal-adn'>Revelar mi ADN conversacional</button>
          `;
        }
        const ans = qs("#esc-answer");
        if (ans) {
          ans.innerHTML = "";
          ans.style.display = "none";
          ans.classList.remove("show");
        }
        const actions = qs("#feedback-actions");
        if (actions) actions.style.display = "none";
        const hint = qs("#post-feedback-hint");
        if (hint) hint.style.display = "none";
        const options = qs("#post-feedback-options");
        if (options) options.style.display = "none";
        return;
      }

      // Explorar otro escenario en la misma área
      if (t.id === "explore-same-area") {
        buildScenarios();
        go("p3");
        return;
      }
    });
  }

  // ================================
  // INIT
  // ================================
  function init(){
    startFetchContent();
    wireEvents();
    go("p0");
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
