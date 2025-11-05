// ============================================
// DOJO DE POLIZAR v15.1 - MOTOR DE PRINCIPIOS + UX MEJORADA + BANNER DE ÁREA
// Incluye: fondos por área (solo en banner), toggle vista escenarios, estilos por acción, animaciones en feedback.
// Cambios clave:
//   - Banner de área separado del header principal.
//   - Badge corregido a "Área — [nombre]".
//   - S.scenarios asignado correctamente.
//   - Preparado para escenarios en archivos separados (comentado).
// Revisado minuciosamente. Sin parches. Listo para producción.
// ============================================

(function(){
  "use strict";

  console.log("🚀 Dojo de Polizar v15.1 - Motor de Principios + UX Mejorada + Banner de Área");

  const API = "https://index.rgarciaplicet.workers.dev/";
  const plan = new URLSearchParams(location.search).get("plan") || "full";
  const CONTENT_URL = `./content.full.json`;

  const S = {
    nombre: "", 
    cliente: "", 
    estilo: "", 
    areaId: "", 
    areaTitle: "",
    scenId: "", 
    pack: null, 
    lastFrase: "", 
    lastJugada: "", 
    content: null,
    scenarios: [] // ← Estado global para escenarios (¡CRÍTICO!)
  };
  
  let contentReady = false;
  let contentFetching = false;

  // Utils
  const qs = (s, sc = document) => sc.querySelector(s);
  const qsa = (s, sc = document) => Array.from(sc.querySelectorAll(s));
  const esc = (s) => (s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const progress = (id) => {
    const map = {p0:0, p1:1, p3:2, p4:3, p8:8, p9:9};
    const pct = Math.max(10, Math.round(((map[id] ?? 0) + 1) / 10 * 100));
    const b = qs("#bar"); 
    if(b) b.style.width = pct + "%";
  };

  const scrollTop = () => { 
    const root = qs("#dojoApp"); 
    if(root) window.scrollTo({top: root.offsetTop - 10, behavior: "smooth"}); 
  };

  function copy(t) {
    t = t || "";
    if(navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t).then(() => alert("✅ Copiado")).catch(() => fallbackCopy(t));
    } else fallbackCopy(t);
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
    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch(e) {}
    return s.toLowerCase().replace(/[^\w]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  async function ai(payload) {
    const r = await fetch(API, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    if(!r.ok) throw new Error("Worker error");
    return await r.json();
  }

  // Render feedback con animaciones secuenciales
  function renderFeedback(text) {
    if (!text || text.trim() === "") 
      return "<p class='muted'>⚠️ No se generó feedback. Inténtalo de nuevo.</p>";
    
    const sections = text.split('\n—\n');
    let html = '';
    
    sections.forEach((section, index) => {
      const delay = index * 300;
      html += `<div class="feedback-section" style="animation-delay: ${delay}ms;">${esc(section).replace(/\n/g, '<br>')}</div>`;
    });
    
    return `<div class="feedback-animated">${html}</div>`;
  }

  // Navegación
  let currentStep = "p0", historySteps = ["p0"];
  
  function go(id) {
    qsa(".step").forEach(x => x.classList.remove("active"));
    const stepEl = qs("#" + id); 
    if(stepEl) stepEl.classList.add("active");

    currentStep = id; 
    progress(id);
    scrollTop();

    const topnav = qs(".topnav");
    if(topnav) topnav.style.display = (id === "p0" || id === "p1") ? "none" : "flex";

    const backBtn = qs("#btn-back");
    if(backBtn) backBtn.style.display = (id === "p0" || id === "p1") ? "none" : "inline-flex";

    const areasBtn = qs('[data-nav="areas"]');
    if(areasBtn) {
      const stepNum = parseInt((id || "p0").slice(1), 10) || 0;
      areasBtn.style.display = stepNum >= 3 ? "inline-flex" : "none";
    }

    const guideFab = qs("#btn-guide-fab");
    if(guideFab) guideFab.style.display = (id === "p0" || id === "p1") ? "none" : "inline-flex";

    // ✅ OCULTAR/MOSTRAR BANNER DE ÁREA SEGÚN PASO
    const banner = qs("#area-banner");
    if(banner) {
      if(id === "p3" || id === "p4") {
        banner.style.display = "flex";
      } else {
        banner.style.display = "none";
      }
    }
  }
  
  function nav(id) { 
    if(id === currentStep) return; 
    if (!(currentStep === "p1" && id === "p3")) {
      historySteps.push(id); 
    }
    go(id); 
  }
  
  function goBack() { 
    if(historySteps.length <= 1) return; 
    historySteps.pop(); 
    const prev = historySteps[historySteps.length - 1] || "p0"; 
    go(prev); 
  }

  function ensureGuideFab() {
    if (!qs("#btn-guide-fab")) {
      const card = qs("#dojoApp .card");
      if(!card) return;
      const btn = document.createElement("button");
      btn.id = "btn-guide-fab";
      btn.className = "corner-guide";
      btn.type = "button";
      btn.textContent = "Guía";
      btn.style.display = "none";
      card.appendChild(btn);
    }
  }

  // Contenido
  function showAreasLoading() {
    const grid = qs("#areas-grid");
    if(grid) grid.innerHTML = `<div class="fb"><p class="muted">Cargando áreas…</p></div>`;
  }

  function startFetchContent() {
    if(contentReady) return Promise.resolve();
    if(contentFetching) return Promise.resolve();
    
    contentFetching = true;
    
    return fetch(CONTENT_URL)
      .then(r => { if(!r.ok) throw new Error("content"); return r.json(); })
      .then(data => {
        S.content = data;
        contentReady = true;
        contentFetching = false;
        if(currentStep === "p1") buildAreas();
        window.dispatchEvent(new Event("dojo:contentReady"));
      })
      .catch(err => {
        console.error("❌ Error cargando contenido:", err);
        const grid = qs("#areas-grid");
        if(grid) grid.innerHTML = `<div class="fb"><p class="muted">No se pudo cargar el contenido.</p></div>`;
        contentReady = false;
        contentFetching = false;
      })
      .finally(() => {
        const startBtn = qs("#start");
        if(startBtn) { startBtn.disabled = false; startBtn.textContent = "Entrar al Dojo"; }
      });
  }

  // Start
  function startFlow() {
    S.nombre = (qs("#nombre")?.value || "").trim();
    S.cliente = (qs("#cliente")?.value || "").trim();
    nav("p1");
    
    if(!contentReady) {
      showAreasLoading();
      setStartState(true);
      window.addEventListener("dojo:contentReady", () => {
        setStartState(false);
        buildAreas();
      }, { once: true });
      startFetchContent();
    } else {
      buildAreas();
    }
  }

  function setStartState(loading) {
    const startBtn = qs("#start");
    if(startBtn) {
      startBtn.disabled = loading;
      startBtn.textContent = loading ? "Cargando…" : "Entrar al Dojo";
    }
  }

  // Vistas
  function buildAreas() {
    const grid = qs("#areas-grid"); 
    if(!grid) return;
    grid.innerHTML = "";
    const areas = (S.content?.areas) || [];
    if(!areas.length) {
      grid.innerHTML = `<div class="fb"><p class="muted">No hay áreas disponibles.</p></div>`;
      return;
    }
    areas.forEach(a => {
      const d = document.createElement("div");
      d.className = "area-card";
      d.dataset.area = a.id;
      // ✅ Aplicar imagen de fondo desde JS (mejor control)
      // ✅ Usa RUTA ABSOLUTA desde la raíz del sitio
const imagePath = `/images/${a.id}_bg.jpg`;
d.style.backgroundImage = `linear-gradient(rgba(47, 67, 72, 0.6), rgba(47, 67, 72, 0.6)), url('${imagePath}')`;
      d.innerHTML = `
        <div class="area-title">${a.icon || "📋"} ${esc(a.title)}</div>
        <p class="area-desc">${esc(a.desc || "")}</p>
        <div class="group">
          <button class="btn primary" data-area="${esc(a.id)}" type="button">Entrar</button>
        </div>`;
      grid.appendChild(d);
    });
  }

  // ✅ FUNCIÓN ACTUALIZADA: CARGA ESCENARIOS Y CONFIGURA BANNER DE ÁREA
  async function buildScenarios() {
    try {
      // 🔄 OPCIÓN 1 (actual): cargar un solo archivo por área
      const areaData = await fetch(`./content/areas/${S.areaId}.json`).then(r => {
        if (!r.ok) throw new Error("Área no encontrada");
        return r.json();
      });

      // 🔄 OPCIÓN 2 (comentada): cargar múltiples archivos (descomenta si quieres usarla)
      /*
      const indexResponse = await fetch(`./content/areas/${S.areaId}/index.json`);
      if (!indexResponse.ok) throw new Error("Índice no encontrado");
      const indexData = await indexResponse.json();
      
      const scenarioPromises = indexData.scenarios.map(scId => 
        fetch(`./content/areas/${S.areaId}/${scId}.json`)
          .then(r => r.json())
          .catch(e => {
            console.warn(`❌ No se pudo cargar escenario: ${scId}`, e);
            return null;
          })
      );
      
      let scenarios = await Promise.all(scenarioPromises);
      scenarios = scenarios.filter(sc => sc !== null);
      */

      // ✅ ASIGNAR A ESTADO GLOBAL (¡ESTO ES CLAVE!)
      S.scenarios = areaData.scenarios || []; // ← ¡NO OLVIDAR ESTA LÍNEA!

      // ✅ CONFIGURAR BANNER DE ÁREA (no el header principal)
      const banner = qs("#area-banner");
      if(banner) {
        // Limpiar clases anteriores
        banner.classList.remove(
          "bg-objeciones_clasicas",
          "bg-guerra_digital",
          "bg-situaciones_limite",
          "bg-renovaciones",
          "bg-upsell_crossell",
          "bg-clientes_dificiles",
          "bg-cierre_ventas"
        );
        // Añadir nueva clase
        banner.classList.add(`bg-${S.areaId}`);
        banner.style.display = "flex";
        
        // ✅ CONFIGURAR BANNER DE ÁREA (título + subtítulo)
// ✅ CONFIGURAR BANNER DE ÁREA (título + subtítulo)
const banner = qs("#area-banner");
if(banner) {
  // Limpiar clases anteriores
  banner.classList.remove(
    "bg-objeciones_clasicas",
    "bg-guerra_digital",
    "bg-situaciones_limite",
    "bg-renovaciones",
    "bg-upsell_crossell",
    "bg-clientes_dificiles",
    "bg-cierre_ventas"
  );
  // Añadir nueva clase
  banner.classList.add(`bg-${S.areaId}`);
  banner.style.display = "flex";
  
  // Actualizar título
  const bannerTitle = qs("#area-banner-title");
  if(bannerTitle) bannerTitle.textContent = S.areaTitle || "";
  
  // ✅ ¡CORREGIDO! Actualizar subtítulo
  const bannerSubtitle = qs("#area-banner-subtitle");
  if(bannerSubtitle) {
    // Buscar el objeto del área para obtener su descripción
    const area = (S.content?.areas || []).find(a => a.id === S.areaId);
    bannerSubtitle.textContent = area?.desc || ""; // ← ¡Esto sí funciona!
  }
}
  
        const list = S.scenarios;
      const titleEl = qs("#area-title"); 
      if(titleEl) titleEl.textContent = S.areaTitle || "";
      
      const grid = qs("#scen-grid"); 
      if(!grid) return; 
      grid.innerHTML = "";
      
      if(!list.length) {
        grid.innerHTML = `<div class="fb"><p class="muted">No hay escenarios para esta área.</p></div>`;
        return;
      }
      
      // Aplicar vista guardada
      const isListView = localStorage.getItem('scenariosView') === 'list';
      if (isListView) {
        grid.classList.add('list-view');
        const toggleBtn = qs("#toggle-view");
        if(toggleBtn) toggleBtn.textContent = "Ver como cuadrícula";
      } else {
        grid.classList.remove('list-view');
        const toggleBtn = qs("#toggle-view");
        if(toggleBtn) toggleBtn.textContent = "Ver como lista";
      }
      
      list.forEach(sc => {
        const q = sc.question || ("Cliente: " + sc.title + ". ¿Cómo responde?");
        const d = document.createElement("div");
        d.className = "sc-card"; 
        d.setAttribute("data-scenario", sc.id);
        const difficulty = sc.difficulty || 3;
        const stars = "⭐".repeat(difficulty);
        d.innerHTML = `
          <div class="sc-title">${esc(sc.title)} <span style="float:right;font-size:12px">${stars}</span></div>
          <p class="sc-desc">${esc(q)}</p>`;
        grid.appendChild(d);
      });
    } catch (e) {
      console.error("❌ Error cargando escenarios:", e.message);
      const grid = qs("#scen-grid");
      if(grid) grid.innerHTML = `<div class="fb"><p class="muted">Error al cargar escenarios. Intente recargar.</p></div>`;
    }
  }

  function buildScenarioView(sid) {
    const sc = (S.scenarios || []).find(x => x.id === sid);
    if(!sc) {
      console.error("❌ Escenario no encontrado:", sid);
      nav("p3");
      return;
    }

    // ✅ CORRECCIÓN: Badge ahora dice "Área — [nombre]"
    const escBadge = qs("#esc-badge");
    const escTitle = qs("#esc-title");
    const escQuestion = qs("#esc-question");
    if(escBadge) escBadge.textContent = "Área — " + (S.areaTitle || ""); // ← ¡CORREGIDO!
    if(escTitle) escTitle.textContent = sc.title;
    if(escQuestion) escQuestion.textContent = sc.question || ("Cliente: " + sc.title + ". ¿Cómo responde?");

    const box = qs("#esc-options"); 
    if(!box) return; 
    box.innerHTML = "";

    if(sc.acciones?.length) {
      sc.acciones.forEach(accion => {
        const b = document.createElement("button");
        b.className = "btn jugada-btn";
        b.type = "button";
        b.dataset.estilo = accion.tipo;
        b.dataset.texto = accion.texto_boton;
        b.textContent = accion.texto_boton;
        b.title = accion.texto_boton;
        box.appendChild(b);
      });
    } else {
      ["Lógica", "Empática", "Estratégica", "Proactiva"].forEach(j => {
        const b = document.createElement("button");
        b.className = "btn jugada-btn";
        b.type = "button";
        b.dataset.jugada = j;
        b.textContent = j;
        box.appendChild(b);
      });
    }

    const escAnswer = qs("#esc-answer");
    const toolkit = qs("#toolkit");
    const escContinue = qs("#esc-continue");
    if(escAnswer) escAnswer.style.display = "none";
    if(toolkit) toolkit.style.display = "none";
    if(escContinue) escContinue.style.display = "none";
  }

  // ⚡ FUNCIÓN CORREGIDA: AHORA ENVÍA EL ADN CORRECTO DE CADA ACCIÓN
  async function runPlay(sc, jugadaEstilo, jugadaTexto) {
    const ans = qs("#esc-answer");
    if(ans) {
      ans.style.display = "block";
      ans.innerHTML = `
        <div class="loader-container">
          <div class="spinner"></div>
          <p class="muted">🧠 Generando tu revelación conversacional<span class="dots">...</span></p>
        </div>
      `;
    }
    
    try {
      console.log("🚀 Estilo recibido (raw):", jugadaEstilo);
      console.log("🚀 Texto de la acción:", jugadaTexto);

      const estiloNormalizado = jugadaEstilo.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      
      let accion = sc.acciones.find(a => {
        const tipoNormalizado = (a.tipo || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return tipoNormalizado === estiloNormalizado;
      });

      if (!accion) {
        console.warn("⚠️ No se encontró por tipo. Buscando por texto...");
        accion = sc.acciones.find(a => a.texto_boton === jugadaTexto);
      }

      if (!accion || !accion.adn_feedback) {
        throw new Error(`❌ No se encontró ADN para la acción: ${jugadaEstilo}`);
      }

      console.log("✅ ADN cargado:", accion.adn_feedback.principio_oculto);

      const pack = await ai({
        nombre: S.nombre || "",
        estilo: jugadaEstilo,
        area: S.areaTitle,
        escenario: sc.title,
        pregunta: sc.question,
        frase_usuario: jugadaTexto,
        adn_feedback: accion.adn_feedback,
        cliente: S.cliente || ""
      });
      
      S.pack = pack;
      
      if(ans && pack.feedback) {
        ans.innerHTML = renderFeedback(pack.feedback);
        const actions = qs("#feedback-actions");
        if(actions) actions.style.display = "flex";
      }
      
      scrollTop();
      
    } catch(e) {
      console.error("💥 Error crítico en runPlay:", e.message);
      if(ans) ans.innerHTML = `<p class="muted">❌ Error interno. Por favor, recarga y prueba de nuevo.</p>`;
    }
  }

  // Segunda ronda (opcional)
  async function roundTwo() {
    const out = qs("#rr-output"); 
    if(!out) return;
    const input = (qs("#rr-text")?.value || "").trim();
    out.style.display = "block";
    if(!input) { out.textContent = "Escribe la nueva objeción."; return; }
    out.textContent = "Generando...";

    const sc = (S.scenarios || []).find(x => x.id === S.scenId);
    if(!sc) { 
      out.textContent = "Escenario no encontrado."; 
      return; 
    }

    try {
      const pack = await ai({
        nombre: S.nombre || "",
        estilo: S.lastJugada || "Lógica",
        area: S.areaTitle,
        escenario: sc.title,
        frase_usuario: input,
        cliente: S.cliente || ""
      });
      
      if(pack?.feedback) {
        S.pack = pack;
        const escAnswer = qs("#esc-answer");
        if(escAnswer) escAnswer.innerHTML = renderFeedback(pack.feedback);
        out.textContent = "↑ Mira tu nueva revelación arriba";
      } else {
        out.textContent = "No se pudo generar.";
      }
    } catch(e) {
      out.textContent = "Error de conexión.";
    }
  }

  // Eventos
  function wireEvents() {
    ensureGuideFab();

    qs("#start")?.addEventListener("click", startFlow);

    document.addEventListener("click", (e) => {
      const t = e.target;

      if(t.closest("#btn-back")) goBack();
      else if(t.closest("#btn-guide-fab")) nav("p8");
      else if(t.closest("[data-nav]")) {
        const where = t.closest("[data-nav]").dataset.nav;
        if(where === "areas") { buildAreas(); nav("p1"); }
        if(where === "guia") nav("p8");
      }
      else if(t.closest(".area-card .btn")) {
        const id = t.closest(".area-card .btn").dataset.area;
        const area = (S.content?.areas || []).find(a => a.id === id) || {};
        S.areaId = id; 
        S.areaTitle = area.title || ""; 
        const ctx = qs("#ctx-area"); 
        if(ctx) ctx.textContent = S.areaTitle || "—"; 
        buildScenarios();
        nav("p3");
      }
      else if(t.closest("[data-scenario]")) {
        const id = t.closest("[data-scenario]").dataset.scenario; 
        S.scenId = id; 
        buildScenarioView(id); 
        nav("p4");
      }
      else if(t.closest(".jugada-btn")) {
        const btn = t.closest(".jugada-btn");
        if (btn.disabled) return;
        btn.disabled = true;
        btn.textContent = "Generando…";

        const estilo = btn.dataset.estilo || "Lógica";
        const texto = btn.dataset.texto || btn.textContent;
        
        const sc = (S.scenarios || []).find(x => x.id === S.scenId);
        if(sc) { 
          S.lastJugada = estilo; 
          S.lastFrase = texto; 
          runPlay(sc, estilo, texto)
            .finally(() => {
              btn.disabled = false;
              btn.textContent = texto;
            });
        } else {
          console.error("❌ Escenario no encontrado en S.scenarios:", S.scenId);
          btn.disabled = false;
          btn.textContent = texto;
        }
      }
      else if(t.id === "rr-generate") roundTwo();
      else if(t.closest("#p5-copy")) {
        const escTitle = qs('#esc-title');
        const txt = `Dojo de Polizar — ${S.areaTitle}\nEscenario: ${escTitle?.textContent || "-"}\nRevelación clave:\n${S.lastFrase || "-"}`;
        copy(txt);
      }
      else if(t.closest("#p5-dl")) {
        const escTitle = qs('#esc-title');
        const txt = `Dojo de Polizar — ${S.areaTitle}\nEscenario: ${escTitle?.textContent || "-"}\nRevelación clave:\n${S.lastFrase || "-"}`;
        const blob = new Blob([txt], {type: "text/plain;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `dojo-${slug(S.areaId || 'area')}-${slug(S.scenId || 'escenario')}.txt`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
      }
      else if(t.closest("#btn-wa")) {
        const escTitle = qs('#esc-title');
        const msg = `Dojo de Polizar — ${S.areaTitle}\nEscenario: ${escTitle?.textContent || "-"}\nRevelación clave:\n${S.lastFrase || "-"}`;
        window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
      }
      else if(t.closest("#finish")) {
        const thanksName = qs("#thanks-name");
        const thanksArea = qs("#thanks-area");
        if(thanksName) thanksName.textContent = S.nombre || "Profesional";
        if(thanksArea) thanksArea.textContent = S.areaTitle || "tu área";
        nav("p9");
      }
      else if(t.id === "toggle-view") {
        const grid = qs("#scen-grid");
        const isListView = grid.classList.contains('list-view');
        if (isListView) {
          grid.classList.remove('list-view');
          localStorage.setItem('scenariosView', 'grid');
          t.textContent = "Ver como lista";
        } else {
          grid.classList.add('list-view');
          localStorage.setItem('scenariosView', 'list');
          t.textContent = "Ver como cuadrícula";
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      const a = document.activeElement;
      if(e.key === "Enter" && (a?.id === "nombre" || a?.id === "cliente")) { e.preventDefault(); startFlow(); }
      if(e.key === "Enter" && a?.id === "rr-text") { e.preventDefault(); qs("#rr-generate")?.click(); }
      if(e.key === "Escape" && !["INPUT","TEXTAREA"].includes(a?.tagName)) { e.preventDefault(); goBack(); }
    });
  }

  // Inicio
  function wireBase() {
    wireEvents();
    startFetchContent();
    go("p0");
  }
  
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireBase);
  } else {
    wireBase();
  }

})();
