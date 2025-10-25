// ============================================
// DOJO DE POLIZAR v11.0 - REVELADOR PURO
// Sin plantillas. Sin bloques. Solo revelación.
// ============================================

(function(){
  "use strict";

  console.log("🚀 Dojo de Polizar v11.0 - Edición Reveladora Pura");

  // Endpoint del Worker
  const API = "https://index.rgarciaplicet.workers.dev/";
  const plan = new URLSearchParams(location.search).get("plan") || "full";
  const CONTENT_URL = `./content.${plan}.json`;

  // Estado global
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
    content: null
  };
  
  let contentReady = false;
  let contentFetching = false;

  // ===== Utils base =====
  const qs = (s, sc = document) => sc.querySelector(s);
  const qsa = (s, sc = document) => Array.from(sc.querySelectorAll(s));
  const esc = (s) => (s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const progress = (id) => {
    const map = {p0:0, p1:1, p2:2, p3:3, p4:4, p5:5, p8:8, p9:9};
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
      navigator.clipboard.writeText(t).then(() => alert("Copiado")).catch(() => fallbackCopy(t));
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
      alert("Copiado");
    } catch(e) {
      alert("No se pudo copiar");
    }
    document.body.removeChild(a);
  }

  function downloadTxt(name, t) {
    const blob = new Blob([t || ""], {type: "text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob); 
    const a = document.createElement("a");
    a.href = url; 
    a.download = name || "dojo.txt"; 
    document.body.appendChild(a);
    a.click(); 
    setTimeout(() => {
      URL.revokeObjectURL(url); 
      a.remove();
    }, 0);
  }

  function slug(s) { 
    s = s || ""; 
    try {
      s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch(e) {}
    return s.toLowerCase().replace(/[^\w]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  // ===== Llamada al Worker =====
  async function ai(payload) {
    console.log("📤 Enviando al Worker:", payload);
    const r = await fetch(API, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    if(!r.ok) throw new Error("Worker error");
    const response = await r.json();
    console.log("📥 Respuesta del Worker:", response);
    return response;
  }

  // ===== Render feedback revelador =====
  function renderFeedback(text) {
    if (!text) return "<p class='muted'>No se generó feedback.</p>";
    
    // Escapar HTML pero preservar saltos de línea y formato
    let html = esc(text)
      .replace(/\n{3,}/g, '\n\n') // Normalizar saltos múltiples
      .replace(/\n\n/g, '</div><div class="fb-section">')
      .replace(/\n/g, '<br>')
      .replace(/✅/g, '<span class="emoji emoji-check">✅</span> ')
      .replace(/💡/g, '<span class="emoji emoji-bulb">💡</span> ')
      .replace(/🧠/g, '<span class="emoji emoji-brain">🧠</span> ')
      .replace(/🌟/g, '<span class="emoji emoji-star">🌟</span> ')
      .replace(/👉/g, '<span class="emoji emoji-point">👉</span> ')
      .replace(/🔁/g, '<span class="emoji emoji-repeat">🔁</span> ')
      .replace(/→/g, '<span class="arrow">→</span> ')
      .replace(/"/g, '<span class="quote">"</span>');
    
    // Envolver en contenedores
    return `<div class="fb-section">${html}</div>`;
  }

  // ===== Navegación =====
  let currentStep = "p0", historySteps = ["p0"];
  
  function go(id) {
    qsa(".step").forEach(x => x.classList.remove("active"));
    const stepEl = qs("#" + id); 
    if(stepEl) {
      stepEl.classList.add("active");
    }

    currentStep = id; 
    progress(id);
    scrollTop();

    // Topnav visible solo desde p2
    const topnav = qs(".topnav");
    if(topnav) topnav.style.display = (id === "p0" || id === "p1") ? "none" : "flex";

    // Ocultar "Guía" en topnav
    const guiaTop = qs('[data-nav="guia"]');
    if(guiaTop) guiaTop.style.display = "none";

    // "← Volver" solo desde p2
    const backBtn = qs("#btn-back");
    if(backBtn) backBtn.style.display = (id === "p0" || id === "p1") ? "none" : "inline-flex";

    // "Áreas" solo desde p3
    const areasBtn = qs('[data-nav="areas"]');
    if(areasBtn) {
      const stepNum = parseInt((id || "p0").slice(1), 10) || 0;
      areasBtn.style.display = stepNum >= 3 ? "inline-flex" : "none";
    }

    // FAB "Guía" solo desde p2
    const guideFab = qs("#btn-guide-fab");
    if(guideFab) guideFab.style.display = (id === "p0" || id === "p1") ? "none" : "inline-flex";
  }
  
  function nav(id) { 
    if(id === currentStep) return; 
    historySteps.push(id); 
    go(id); 
  }
  
  function shouldConfirmBack() { 
    return (currentStep === "p4" || currentStep === "p5") && !!S.pack; 
  }
  
  function goBack() { 
    if(shouldConfirmBack()) { 
      if(!confirm("¿Volver al paso anterior? Perderá el foco de este escenario.")) return; 
    }
    if(historySteps.length <= 1) return; 
    historySteps.pop(); 
    const prev = historySteps[historySteps.length - 1] || "p0"; 
    go(prev); 
  }

  // ===== FAB "Guía" =====
  function ensureGuideFab() {
    const card = document.querySelector("#dojoApp .card");
    if(!card) return;
    if(!document.querySelector("#btn-guide-fab")) {
      const btn = document.createElement("button");
      btn.id = "btn-guide-fab";
      btn.className = "corner-guide";
      btn.type = "button";
      btn.textContent = "Guía";
      btn.style.display = "none";
      card.appendChild(btn);
    }
  }

  // ===== Contenido =====
  function showAreasLoading() {
    const grid = qs("#areas-grid");
    if(grid) grid.innerHTML = `<div class="fb"><p class="muted">Cargando áreas…</p></div>`;
  }

  function startFetchContent() {
    if(contentReady) return Promise.resolve();
    if(contentFetching) return Promise.resolve();
    
    contentFetching = true;
    
    return fetch(CONTENT_URL)
      .then(r => { 
        if(!r.ok) throw new Error("content"); 
        return r.json(); 
      })
      .then(data => {
        console.log("✅ Contenido cargado:", data);
        S.content = data;
        contentReady = true;
        contentFetching = false;
        if(currentStep === "p1") buildAreas();
        window.dispatchEvent(new Event("dojo:contentReady"));
      })
      .catch((err) => {
        console.error("❌ Error cargando contenido:", err);
        const grid = qs("#areas-grid");
        if(grid) grid.innerHTML = `<div class="fb"><p class="muted">No se pudo cargar el contenido.</p></div>`;
        contentReady = false;
        contentFetching = false;
      })
      .finally(() => {
        const startBtn = qs("#start");
        if(startBtn) { 
          startBtn.disabled = false; 
          startBtn.textContent = "Entrar al Dojo"; 
        }
      });
  }

  // ===== Start Flow =====
  function startFlow() {
    S.nombre = (qs("#nombre")?.value || "").trim();
    S.cliente = (qs("#cliente")?.value || "").trim();
    
    nav("p1");
    
    if(!contentReady) {
      showAreasLoading();
      setStartState(true);
      
      const onReady = () => {
        setStartState(false);
        buildAreas();
        window.removeEventListener("dojo:contentReady", onReady);
      };
      
      window.addEventListener("dojo:contentReady", onReady);
      startFetchContent();
    } else {
      buildAreas();
    }
  }

  function setStartState(loading) {
    const startBtn = qs("#start");
    if(!startBtn) return;
    
    if(loading) {
      startBtn.disabled = true;
      startBtn.textContent = "Cargando…";
    } else {
      startBtn.disabled = false;
      startBtn.textContent = "Entrar al Dojo";
    }
  }

  // ===== Construir vistas =====
  function buildAreas() {
    const grid = qs("#areas-grid"); 
    if(!grid) return;
    
    grid.innerHTML = "";
    const areas = (S.content && S.content.areas) ? S.content.areas : [];
    
    if(!areas.length) {
      grid.innerHTML = `<div class="fb"><p class="muted">No hay áreas disponibles.</p></div>`;
      return;
    }
    
    areas.forEach(a => {
      const d = document.createElement("div");
      d.className = "area-card";
      const icon = a.icon || "📋";
      d.innerHTML = `
        <div class="area-title">${icon} ${esc(a.title)}</div>
        <p class="area-desc">${esc(a.desc || "")}</p>
        <div class="group">
          <button class="btn primary" data-area="${esc(a.id)}" type="button">Entrar</button>
        </div>`;
      grid.appendChild(d);
    });
  }

  function buildScenarios() {
    const list = ((S.content && S.content.scenarios) || []).filter(x => x.areaId === S.areaId);
    const titleEl = qs("#area-title"); 
    if(titleEl) titleEl.textContent = S.areaTitle || "";
    
    const grid = qs("#scen-grid"); 
    if(!grid) return; 
    
    grid.innerHTML = "";
    
    if(!list.length) {
      grid.innerHTML = `<div class="fb"><p class="muted">No hay escenarios para esta área.</p></div>`;
      return;
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
  }

  function buildScenarioView(sid) {
    const sc = getScenarioById(sid);
    if(!sc) { 
      nav("p3"); 
      return; 
    }

    const escBadge = qs("#esc-badge");
    const escTitle = qs("#esc-title");
    const escQuestion = qs("#esc-question");
    
    if(escBadge) escBadge.textContent = "Escenario — " + (S.areaTitle || "");
    if(escTitle) escTitle.textContent = sc.title;
    if(escQuestion) escQuestion.textContent = sc.question || ("Cliente: " + sc.title + ". ¿Cómo responde?");

    const box = qs("#esc-options"); 
    if(!box) return; 
    
    box.innerHTML = "";

    // Mostrar las frases completas como botones
    if(sc.jugadas && sc.jugadas.length > 0) {
      sc.jugadas.forEach(jugada => {
        const b = document.createElement("button");
        b.className = "btn jugada-btn";
        b.type = "button";
        b.dataset.estilo = jugada.estilo;
        b.dataset.texto = jugada.texto;
        // Truncar texto si es muy largo
        const displayText = jugada.texto.length > 60 ? jugada.texto.substring(0, 57) + "..." : jugada.texto;
        b.textContent = displayText;
        b.title = jugada.texto; // Tooltip con texto completo
        box.appendChild(b);
      });
    } else {
      // Fallback (no debería ocurrir si el JSON está bien)
      const jugadas = ["Lógica", "Empática", "Estratégica", "Proactiva"];
      jugadas.forEach(j => {
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
    if(toolkit) toolkit.style.display = "none"; // ← Eliminado toolkit
    if(escContinue) escContinue.style.display = "none";
  }

  function getScenarioById(id) { 
    return ((S.content && S.content.scenarios) || []).find(x => x.areaId === S.areaId && x.id === id); 
  }
  
  function getCurrentScenario() { 
    return getScenarioById(S.scenId); 
  }

  // ===== Ejecutar jugada =====
  async function runPlay(sc, jugadaEstilo, jugadaTexto) {
    const ans = qs("#esc-answer");
    if(ans) {
      ans.style.display = "block"; 
      ans.innerHTML = `<p class="muted">Revelando perspectivas ocultas...</p>`;
    }
    
    try {
      const pack = await ai({
        nombre: S.nombre || "",
        estilo: jugadaEstilo,
        area: S.areaTitle,
        escenario: sc.title,
        pregunta: sc.question,
        pattern: sc.pattern || null,
        keywords: sc.keywords || [],
        frase_usuario: jugadaTexto,
        cliente: S.cliente || ""
      });
      
      S.pack = pack;
      
      if(ans && pack.feedback) {
        // Renderizar feedback con formato limpio
        ans.innerHTML = `<div class="revelation-container">${renderFeedback(pack.feedback)}</div>`;
      }
      
      // Eliminar toolkit (ya no existe)
      const toolkit = qs("#toolkit");
      if(toolkit) toolkit.style.display = "none";
      
      // Extraer frase memorable para p5 (opcional, por compatibilidad)
      if(pack.feedback) {
        const lines = pack.feedback.split('\n');
        const fraseLine = lines.find(line => line.includes('"') && line.match(/"[^"]+"/));
        if (fraseLine) {
          // Extraer solo la frase entre comillas
          const match = fraseLine.match(/"([^"]+)"/);
          S.lastFrase = match ? match[1] : fraseLine.replace(/["]/g, '').trim();
        } else {
          S.lastFrase = "Tu revelación aparecerá aquí";
        }
      }
      
      const escContinue = qs("#esc-continue");
      if(escContinue) escContinue.style.display = "block";
      
      scrollTop();
      
    } catch(e) {
      console.error("Error:", e);
      if(ans) ans.innerHTML = `<p class="muted">No pudimos conectar. Intente de nuevo.</p>`;
    }
  }

  // ===== Segunda ronda (opcional, simplificada) =====
  async function roundTwo() {
    const out = qs("#rr-output"); 
    if(!out) return;
    
    const input = (qs("#rr-text")?.value || "").trim();
    out.style.display = "block";
    
    if(!input) { 
      out.textContent = "Escribe la nueva objeción del cliente."; 
      return; 
    }
    
    out.textContent = "Revelando nueva perspectiva...";

    const sc = getCurrentScenario();
    const escTitle = qs("#esc-title");
    const scTitle = sc?.title || (escTitle ? escTitle.textContent : "") || "";

    try {
      const pack = await ai({
        nombre: S.nombre || "",
        estilo: S.lastJugada || "empatico",
        area: S.areaTitle,
        escenario: scTitle,
        pattern: sc?.pattern || null,
        pregunta: "Segunda ronda: " + input,
        frase_usuario: input,
        cliente: S.cliente || ""
      });
      
      if(pack && pack.feedback) {
        S.pack = pack;
        const escAnswer = qs("#esc-answer");
        if(escAnswer) {
          escAnswer.innerHTML = `<div class="revelation-container">${renderFeedback(pack.feedback)}</div>`;
        }
        out.textContent = "Nueva perspectiva revelada arriba ↑";
      } else {
        out.textContent = "No se pudo generar. Intente nuevamente.";
      }
    } catch(e) {
      out.textContent = "Error de conexión. Intente de nuevo.";
    }
  }

  // ===== Event listeners =====
  function wireEvents() {
    ensureGuideFab();

    // Botón de inicio
    const setupStartButton = () => {
      const startBtn = qs("#start");
      if(startBtn) {
        startBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          startFlow();
        });
        
        if(startBtn.disabled && startBtn.textContent === "Entrar al Dojo") {
          startBtn.disabled = false;
        }
      }
    };

    if(document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupStartButton);
    } else {
      setupStartButton();
    }

    // Delegación global
    document.addEventListener("click", (e) => {
      const t = e.target;

      if(t.closest("#btn-back")) { 
        goBack(); 
      }
      else if(t.closest("#btn-guide-fab")) { 
        nav("p8"); 
      }
      else if(t.closest("[data-nav]")) {
        const where = t.closest("[data-nav]").dataset.nav;
        if(where === "areas") { 
          buildAreas(); 
          nav("p1"); 
        }
        if(where === "guia") { 
          nav("p8"); 
        }
      }
      else if(t.closest(".area-card .btn")) {
        const id = t.closest(".area-card .btn").dataset.area;
        const area = ((S.content && S.content.areas) || []).find(a => a.id === id) || {};
        S.areaId = id; 
        S.areaTitle = area.title || ""; 
        const ctx = qs("#ctx-area"); 
        if(ctx) ctx.textContent = S.areaTitle || "—"; 
        nav("p2");
      }
      else if(t.closest("[data-style]")) {
        S.estilo = t.closest("[data-style]").dataset.style; 
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
        const estilo = btn.dataset.estilo || "empatico";
        const texto = btn.dataset.texto || btn.textContent;
        const sc = getCurrentScenario();
        if(sc) { 
          S.lastJugada = estilo;
          S.lastFrase = texto;
          runPlay(sc, estilo, texto); 
        }
      }
      else if(t.id === "rr-generate") {
        roundTwo();
      }
      else if(t.closest("#to-p5")) {
        const frase = qs("#p5-frase");
        if(frase) frase.textContent = S.lastFrase || "Tu revelación aparecerá aquí.";
        nav("p5");
      }
      else if(t.closest("#btn-wa")) {
        const escTitle = qs('#esc-title');
        const msg = `Dojo de Polizar — ${S.areaTitle}
Escenario: ${escTitle ? escTitle.textContent : "-"}
Estilo: ${S.estilo || "-"}
Cliente: ${S.cliente || "-"}

Revelación clave:
${S.lastFrase || "-"}`;
        window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
      }
      else if(t.closest("#p5-copy")) {
        const escTitle = qs('#esc-title');
        const txt = `Dojo de Polizar — ${S.areaTitle}
Escenario: ${escTitle ? escTitle.textContent : "-"}
Estilo: ${S.estilo || "-"}
Cliente: ${S.cliente || "-"}

Revelación clave:
${S.lastFrase || "-"}`;
        copy(txt);
      }
      else if(t.closest("#p5-dl")) {
        const escTitle = qs('#esc-title');
        const txt = `Dojo de Polizar — ${S.areaTitle}
Escenario: ${escTitle ? escTitle.textContent : "-"}
Estilo: ${S.estilo || "-"}
Cliente: ${S.cliente || "-"}

Revelación clave:
${S.lastFrase || "-"}`;
        downloadTxt("dojo-" + slug(S.areaId || 'area') + "-" + slug(S.scenId || 'escenario') + "-revelacion.txt", txt);
      }
      else if(t.closest("#finish")) {
        const thanksName = qs("#thanks-name");
        const thanksArea = qs("#thanks-area");
        if(thanksName) thanksName.textContent = S.nombre || "Pro";
        if(thanksArea) thanksArea.textContent = S.areaTitle || "su área";
        nav("p9");
      }
    });

    // Keyboard
    document.addEventListener("keydown", (e) => {
      const a = document.activeElement;
      const typing = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable);
      
      if(e.key === "Enter" && (a?.id === "nombre" || a?.id === "cliente")) { 
        e.preventDefault(); 
        startFlow(); 
      }
      if(e.key === "Enter" && a?.id === "rr-text") { 
        e.preventDefault(); 
        const g = qs("#rr-generate"); 
        if(g) g.click(); 
      }
      if(e.key === "Escape" && !typing) { 
        e.preventDefault(); 
        goBack(); 
      }
    });
  }

  // ===== Inicialización =====
  function wireBase() {
    console.log("🎬 Iniciando Dojo de Polizar v11.0...");
    wireEvents();
    console.log("📦 Cargando contenido...");
    startFetchContent();
    go("p0");
  }
  
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireBase);
  } else {
    wireBase();
  }

})();
