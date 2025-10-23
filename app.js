// build: dojo-app WOW v2.2 — FIXED v2 — 2025-10-22

(function(){
  "use strict";

  console.log("🚀 Dojo iniciando...");

  // Ajusta este endpoint si usas otro Worker
  const API = "https://index.rgarciaplicet.workers.dev/";
  const plan = new URLSearchParams(location.search).get("plan") || "full";
  const CONTENT_URL = `./content.${plan}.json`;

  // Estado
  const S = {
    nombre:"", cliente:"", estilo:"", areaId:"", areaTitle:"",
    scenId:"", pack:null, lastFrase:"", lastJugada:"", content:null, templates:null
  };
  let contentReady = false;
  let contentFetching = false;

  // ===== Utils base =====
  const qs=(s,sc=document)=>sc.querySelector(s);
  const qsa=(s,sc=document)=>Array.from(sc.querySelectorAll(s));
  const esc=(s)=> (s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const progress=(id)=>{
    const map={p0:0,p1:1,p2:2,p3:3,p4:4,p5:5,p8:8,p9:9};
    const pct=Math.max(10,Math.round(((map[id]??0)+1)/10*100));
    const b=qs("#bar"); if(b) b.style.width=pct+"%";
  };
  const scrollTop=()=>{ const root=qs("#dojoApp"); if(root) window.scrollTo({top:root.offsetTop-10,behavior:"smooth"}); };

  function copy(t){
    t=t||"";
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(t).then(()=>alert("Copiado")).catch(()=>fallbackCopy(t));
    } else fallbackCopy(t);
  }
  function fallbackCopy(t){
    const a=document.createElement("textarea");
    a.value=t; a.style.position="fixed"; a.style.left="-9999px";
    document.body.appendChild(a); a.select();
    try{document.execCommand("copy"); alert("Copiado")}catch(e){alert("No se pudo copiar")}
    document.body.removeChild(a);
  }
  function share(t,title){
    if(navigator.share){ navigator.share({title:title||"Dojo de Polizar", text:t}).catch(()=>{}); }
    else { copy(t); window.open("https://wa.me/?text="+encodeURIComponent(t), "_blank"); }
  }
  function downloadTxt(name, t){
    const blob=new Blob([t||""],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download=name||"dojo.txt"; document.body.appendChild(a);
    a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},0);
  }
  function slug(s){ s=s||""; try{s=s.normalize("NFD").replace(/[\u0300-\u036f]/g,"")}catch(e){} return s.toLowerCase().replace(/[^\w]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,""); }

  // Placeholders {CLIENTE}/{MI_NOMBRE}
  function fillPH(t){
    if(!t) return "";
    const cli = (S.cliente && S.cliente.trim()) ? S.cliente.trim() : "cliente";
    const yo  = (S.nombre && S.nombre.trim()) ? S.nombre.trim()  : "yo";
    return t
      .replace(/\{\s*CLIENTE\s*\}/gi, cli)
      .replace(/\{\s*MI[_\s]*NOMBRE\s*\}/gi, yo);
  }

  // Saneo de lenguaje y signos — reescritura segura
  const FRONT_RULES = [
    { re: /\b(le|te)\s+entiendo\b/gi, to: "tiene sentido" },
    { re: /\b(tienes que|debes|usted debe)\b/gi, to: "si le sirve" },
    { re: /\btranquil[oa]s?\b/gi, to: "" },
    { re: /\bno te preocupes\b/gi, to: "" },
    { re: /\b(claramente|obvio)\b/gi, to: "" },
    { re: /\b(y hablamos luego)\b/gi, to: "" },
    { re: /\bculpa(s|ble|r)?\b/gi, to: "" },
    { re: /\bno vale la pena\b/gi, to: "" },
    { re: /\bno pierdo nada\b/gi, to: "" },
    { re: /\bdecidimos tranquilos\b/gi, to: "decidir con claridad" }
  ];
  const CLOSER_RULES = [
    { re: /\bsi no cuadra(,)? (lo )?dejamos\.?/gi, to: "Avanzamos cuando el valor quede claro; si falta, ajusto." },
    { re: /\bsi no encaja(,)? (no )?avanzamos\.?/gi, to: "Seguimos cuando encaje con sus prioridades; si algo falta, lo ajusto." },
    { re: /\bsi no funciona(,)? (lo )?dejamos\.?/gi, to: "Avanzamos cuando funcione para usted; si falta, lo ajusto." }
  ];
  function cleanTextLocal(s){
    if(!s || typeof s!=="string") return s;
    let out = s;
    FRONT_RULES.forEach(r=>{ out = out.replace(r.re,r.to); });
    CLOSER_RULES.forEach(r=>{ out = out.replace(r.re,r.to); });
    out = out
      .replace(/[ \t]+\n/g,"\n")
      .replace(/[ ]{2,}/g," ")
      .replace(/\?\./g,"?")
      .replace(/\. \?/g,"?")
      .replace(/([!?\.]){2,}/g,"$1")
      .replace(/\s+([!?\.])/g,"$1")
      .replace(/([¿¡])\s+/g,"$1")
      .replace(/\s+([,;:])/g,"$1")
      .trim();
    if(out.length>2000) out = out.slice(0,1980)+"…";
    return out;
  }
  function sanitizeStr(t){ return cleanTextLocal(fillPH(t||"")); }

  async function ai(payload){
    const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(!r.ok) throw new Error("IA");
    return await r.json();
  }

  // ===== Nav / visibilidad =====
  let currentStep="p0", historySteps=["p0"];
  function go(id){
    console.log("📍 Navegando a:", id);
    qsa(".step").forEach(x=>x.classList.remove("active"));
    const stepEl=qs("#"+id); 
    if(stepEl) {
      stepEl.classList.add("active");
      console.log("✅ Step activado:", id);
    } else {
      console.error("❌ No se encontró el step:", id);
    }

    currentStep=id; progress(id);
    const root=qs("#dojoApp"); if(root) window.scrollTo({top:root.offsetTop-10,behavior:"smooth"});

    // Topnav visible solo desde p2
    const topnav = qs(".topnav");
    if (topnav) topnav.style.display = (id==="p0" || id==="p1") ? "none" : "flex";

    // Ocultar "Guía" en topnav (se usa FAB)
    const guiaTop = qs('[data-nav="guia"]');
    if (guiaTop) guiaTop.style.display = "none";

    // "← Volver" solo desde p2
    const backBtn = qs("#btn-back");
    if (backBtn) backBtn.style.display = (id==="p0" || id==="p1") ? "none" : "inline-flex";

    // "Áreas" solo desde p3
    const areasBtn = qs('[data-nav="areas"]');
    if (areasBtn) {
      const stepNum = parseInt((id || "p0").slice(1), 10) || 0;
      areasBtn.style.display = stepNum >= 3 ? "inline-flex" : "none";
    }

    // FAB "Guía" solo desde p2
    const guideFab = qs("#btn-guide-fab");
    if (guideFab) guideFab.style.display = (id==="p0" || id==="p1") ? "none" : "inline-flex";
  }
  function nav(id){ if(id===currentStep) return; historySteps.push(id); go(id); }
  function shouldConfirmBack(){ return (currentStep==="p4"||currentStep==="p5") && !!S.pack; }
  function goBack(){ if(shouldConfirmBack()){ if(!confirm("¿Volver al paso anterior? Perderá el foco de este escenario. Sus resultados no se guardan aquí.")) return; } if(historySteps.length<=1) return; historySteps.pop(); const prev = historySteps[historySteps.length-1]||"p0"; go(prev); }

  // FAB "Guía"
  function ensureGuideFab(){
    const card = document.querySelector("#dojoApp .card");
    if (!card) return;
    if (!document.querySelector("#btn-guide-fab")) {
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
  function showAreasLoading(){
    const grid = qs("#areas-grid");
    if(grid) grid.innerHTML = `<div class="fb"><p class="muted">Cargando áreas…</p></div>`;
  }

  function startFetchContent(){
    console.log("📦 Iniciando carga de contenido...");
    console.log("   - contentFetching:", contentFetching);
    console.log("   - contentReady:", contentReady);
    console.log("   - CONTENT_URL:", CONTENT_URL);
    
    if (contentReady) {
      console.log("✅ Contenido ya está listo");
      return Promise.resolve();
    }
    
    if (contentFetching) {
      console.log("⏳ Ya se está cargando el contenido");
      return Promise.resolve();
    }
    
    contentFetching = true;
    console.log("🔄 Fetching:", CONTENT_URL);
    
    return fetch(CONTENT_URL)
      .then(r=>{ 
        console.log("📡 Respuesta recibida:", r.status);
        if(!r.ok) throw new Error("content"); 
        return r.json(); 
      })
      .then(data=>{
        console.log("✅ Contenido cargado:", data);
        S.content = data;
        contentReady = true;
        contentFetching = false;
        if (currentStep === "p1") buildAreas();
        window.dispatchEvent(new Event("dojo:contentReady"));
      })
      .catch((err)=>{
        console.error("❌ Error cargando contenido:", err);
        const grid=qs("#areas-grid");
        if(grid) grid.innerHTML = `<div class="fb"><p class="muted">No se pudo cargar el contenido. Verifique content.${plan}.json en la raíz.</p></div>`;
        contentReady = false;
        contentFetching = false;
      })
      .finally(()=>{
        const startBtn = qs("#start");
        if(startBtn){ 
          startBtn.disabled = false; 
          startBtn.textContent = "Entrar al Dojo"; 
          console.log("🔘 Botón habilitado");
        }
      });
  }

  // ===== Start Flow (reutilizable) =====
  function startFlow(){
    console.log("🎯 startFlow() ejecutado");
    
    try {
      S.nombre=(qs("#nombre")?.value||"").trim();
      S.cliente=(qs("#cliente")?.value||"").trim();
      console.log("👤 Nombre:", S.nombre || "(vacío)");
      console.log("👥 Cliente:", S.cliente || "(vacío)");
      
      console.log("🚀 Intentando navegar a p1...");
      nav("p1");
      
      if (!contentReady) {
        console.log("⏳ Contenido no está listo, mostrando loading...");
        showAreasLoading();
        setStartState(true);
        
        const onReady = ()=>{
          console.log("✅ Contenido listo (evento)");
          setStartState(false);
          buildAreas();
          window.removeEventListener("dojo:contentReady", onReady);
        };
        
        window.addEventListener("dojo:contentReady", onReady);
        startFetchContent();
      } else {
        console.log("✅ Contenido listo, construyendo áreas...");
        buildAreas();
      }
    } catch(error) {
      console.error("❌ Error en startFlow:", error);
    }
  }

  // ===== Wire de eventos =====
  function setStartState(loading){
    const startBtn = qs("#start");
    if(!startBtn) {
      console.error("❌ Botón #start no encontrado");
      return;
    }
    if(loading){
      startBtn.disabled = true;
      startBtn.textContent = "Cargando…";
      console.log("🔘 Botón deshabilitado (cargando)");
    }else{
      startBtn.disabled = false;
      startBtn.textContent = "Entrar al Dojo";
      console.log("🔘 Botón habilitado");
    }
  }

  function wireEvents(){
    console.log("🔌 Conectando eventos...");
    ensureGuideFab();

    // ESPERAR A QUE EL DOM ESTÉ LISTO
    const setupStartButton = () => {
      const startBtn = qs("#start");
      if(startBtn){
        console.log("✅ Botón #start encontrado, agregando listener");
        startBtn.addEventListener("click", (e) => {
          console.log("🖱️ Click en botón start");
          e.preventDefault();
          e.stopPropagation();
          startFlow();
        });
        
        // Verificar que el botón no esté deshabilitado involuntariamente
        if (startBtn.disabled && startBtn.textContent === "Entrar al Dojo") {
          console.log("⚠️ Botón estaba deshabilitado, habilitando...");
          startBtn.disabled = false;
        }
      } else {
        console.error("❌ Botón #start NO encontrado");
      }
    };

    // Asegurar que el DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupStartButton);
    } else {
      setupStartButton();
    }

    // Delegación global para otros eventos
    document.addEventListener("click", (e)=>{
      const t=e.target;

      if(t.closest("#btn-back")) { goBack(); }
      else if(t.closest("#btn-guide-fab")) { nav("p8"); }
      else if(t.closest("[data-nav]")){
        const where=t.closest("[data-nav]").dataset.nav;
        if(where==="areas"){ buildAreas(); nav("p1"); }
        if(where==="guia"){ nav("p8"); }
      }
      else if(t.closest(".area-card .btn")){
        const id=t.closest(".area-card .btn").dataset.area;
        const area=((S.content&&S.content.areas)||[]).find(a=>a.id===id)||{};
        S.areaId=id; S.areaTitle=area.title||""; const ctx=qs("#ctx-area"); if(ctx) ctx.textContent=S.areaTitle||"—"; nav("p2");
      }
      else if(t.closest("[data-style]")){
        S.estilo=t.closest("[data-style]").dataset.style; buildScenarios(); nav("p3");
      }
      else if(t.closest("[data-scenario]")){
        const id=t.closest("[data-scenario]").dataset.scenario; S.scenId=id; buildScenarioView(id); nav("p4");
      }
      else if(t.closest(".jugada-btn")){
        const btn=t.closest(".jugada-btn");
        const label=btn.dataset.jugada||btn.textContent||"Lógica";
        const sc=getCurrentScenario();
        if(sc){ S.lastJugada = label; runPlay(sc,label); }
      }
      else if(t.closest(".tab")){
        qsa(".tab").forEach(x=>x.classList.remove("active"));
        const tabBtn = t.closest(".tab");
        tabBtn.classList.add("active");
        const key=tabBtn.dataset.tab;
        const TB=qs("#tmpl-box");
        if(S.templates && TB){
          if(key==="wha") TB.textContent = fillPH(S.templates.whatsapp||"");
          if(key==="eml") TB.textContent = (fillPH(S.templates.emailSubject||S.templates.email_subject||"")+"\n\n"+fillPH(S.templates.emailBody||S.templates.email_body||"")).trim();
          if(key==="call") TB.textContent = fillPH(S.templates.call||"");
        }
      }
      else if(t.closest("#btn-copy-tmpl")){
        const box = qs("#tmpl-box"); if(box) copy(box.textContent||"");
      }
      else if(t.closest("#btn-dl-txt")){
        const TB=qs("#tmpl-box"); if(!TB) return;
        const key=(qs(".tab.active")?.dataset.tab)||"wha"; let content="";
        if(S.templates){
          if(key==="wha") content=fillPH(S.templates.whatsapp||"");
          if(key==="eml") content=(fillPH(S.templates.emailSubject||S.templates.email_subject||"")+"\n\n"+fillPH(S.templates.emailBody||S.templates.email_body||"")).trim();
          if(key==="call") content=fillPH(S.templates.call||"");
        } else {
          content = TB.textContent||"";
        }
        downloadTxt("dojo-"+slug(S.areaId||"area")+"-"+slug(S.scenId||"escenario")+"-"+key+".txt", content);
      }
      else if(t.closest("#btn-share-tmpl")){
        const TB=qs("#tmpl-box"); if(!TB) return;
        const key=(qs(".tab.active")?.dataset.tab)||"wha"; let content=TB.textContent||"";
        if(S.templates){
          if(key==="wha") content=fillPH(S.templates.whatsapp||"");
          if(key==="eml") content=(fillPH(S.templates.emailSubject||S.templates.email_subject||"")+"\n\n"+fillPH(S.templates.emailBody||S.templates.email_body||"")).trim();
          if(key==="call") content=fillPH(S.templates.call||"");
        }
        share(content, "Dojo — "+(S.areaTitle||""));
      }
      else if(t.closest(".phrase button")){
        const text=t.closest(".phrase").querySelector("div")?.textContent||""; copy(text);
      }
      else if(t.id==="rr-generate"){
        roundTwo();
      }
      else if(t.closest("#to-p5")){
        const frase = qs("#p5-frase");
        if(frase) frase.textContent = S.lastFrase || "Aún no se ha generado la frase activadora.";
        const micro=(S.pack && (getMicro(S.pack)))||"";
        const microInput = qs("#micro");
        if(microInput && micro) microInput.value = fillPH(micro);
        nav("p5");
      }
      else if(t.closest("#btn-wa")){
        const escTitle = qs('#esc-title');
        const microInput = qs('#micro');
        const msg = `Dojo de Polizar — ${S.areaTitle}
Escenario: ${escTitle ? escTitle.textContent : "-"}
Estilo: ${S.estilo||"-"}
Cliente: ${S.cliente||"-"}

Micro‑acción:
${(microInput?.value||'________')}

Frase activadora:
${S.lastFrase||"-"}`;
        window.open("https://wa.me/?text="+encodeURIComponent(msg),"_blank");
      }
      else if(t.closest("#p5-copy")){
        const escTitle = qs('#esc-title');
        const microInput = qs('#micro');
        const txt = `Dojo de Polizar — ${S.areaTitle}
Escenario: ${escTitle ? escTitle.textContent : "-"}
Estilo: ${S.estilo||"-"}
Cliente: ${S.cliente||"-"}

Micro‑acción:
${(microInput?.value||'________')}

Frase activadora:
${S.lastFrase||"-"}`;
        copy(txt);
      }
      else if(t.closest("#p5-dl")){
        const escTitle = qs('#esc-title');
        const microInput = qs('#micro');
        const txt = `Dojo de Polizar — ${S.areaTitle}
Escenario: ${escTitle ? escTitle.textContent : "-"}
Estilo: ${S.estilo||"-"}
Cliente: ${S.cliente||"-"}

Micro‑acción:
${(microInput?.value||'________')}

Frase activadora:
${S.lastFrase||"-"}`;
        downloadTxt("dojo-"+slug(S.areaId||'area')+"-"+slug(S.scenId||'escenario')+"-resumen.txt", txt);
      }
      else if(t.closest("#finish")){
        const thanksName = qs("#thanks-name");
        const thanksArea = qs("#thanks-area");
        if(thanksName) thanksName.textContent = S.nombre || "Pro";
        if(thanksArea) thanksArea.textContent = S.areaTitle || "su área";
        nav("p9");
      }
    });

    document.addEventListener("keydown",(e)=>{
      const a=document.activeElement;
      const typing=a && (a.tagName==="INPUT"||a.tagName==="TEXTAREA"||a.isContentEditable);
      if(e.key==="Enter"&&(a?.id==="nombre"||a?.id==="cliente")){ e.preventDefault(); startFlow(); }
      if(e.key==="Enter" && a?.id==="rr-text"){ e.preventDefault(); const g=qs("#rr-generate"); if(g) g.click(); }
      if(e.key==="Escape" && !typing){ e.preventDefault(); goBack(); }
    });
  }

  // ===== Vistas =====
  function buildAreas(){
    console.log("🏗️ Construyendo áreas...");
    const grid=qs("#areas-grid"); 
    if(!grid) {
      console.error("❌ No se encontró #areas-grid");
      return;
    }
    grid.innerHTML="";
    const areas = (S.content && S.content.areas) ? S.content.areas : [];
    console.log("📋 Áreas encontradas:", areas.length);
    
    if(!areas.length){
      grid.innerHTML = `<div class="fb"><p class="muted">No hay áreas disponibles.</p></div>`;
      return;
    }
    areas.forEach(a=>{
      const d=document.createElement("div");
      d.className="area-card";
      d.innerHTML=`<div class="area-title">${esc(a.title)}</div><p class="area-desc">${esc(a.desc||"")}</p><div class="group"><button class="btn primary" data-area="${esc(a.id)}" type="button">Entrar</button></div>`;
      grid.appendChild(d);
    });
    console.log("✅ Áreas construidas");
  }

  function buildScenarios(){
    const list=((S.content&&S.content.scenarios)||[]).filter(x=>x.areaId===S.areaId);
    const titleEl=qs("#area-title"); if(titleEl) titleEl.textContent=S.areaTitle||"";
    const grid=qs("#scen-grid"); if(!grid) return; grid.innerHTML="";
    if(!list.length){
      grid.innerHTML = `<div class="fb"><p class="muted">No hay escenarios para esta área.</p></div>`;
      return;
    }
    list.forEach(sc=>{
      const q= sc.question || ("Cliente: " + sc.title + ". ¿Cómo responde?");
      const d=document.createElement("div");
      d.className="sc-card"; d.setAttribute("data-scenario", sc.id);
      d.innerHTML=`<div class="sc-title">${esc(sc.title)}</div><p class="sc-desc">${esc(q)}</p>`;
      grid.appendChild(d);
    });
  }

  function buildScenarioView(sid){
    const sc=getScenarioById(sid);
    if(!sc){ nav("p3"); return; }

    const escBadge = qs("#esc-badge");
    const escTitle = qs("#esc-title");
    const escQuestion = qs("#esc-question");
    if(escBadge) escBadge.textContent="Escenario — " + (S.areaTitle||"");
    if(escTitle) escTitle.textContent=sc.title;
    if(escQuestion) escQuestion.textContent= sc.question || ("Cliente: " + sc.title + ". ¿Cómo responde?");

    const box=qs("#esc-options"); if(!box) return; box.innerHTML="";
    const jugadas = ["Lógica","Empática","Estratégica","Proactiva"];
    jugadas.forEach(j=>{
      const b=document.createElement("button");
      b.className="btn jugada-btn"; b.type="button"; b.dataset.jugada=j; b.textContent=j;
      box.appendChild(b);
    });

    const escAnswer = qs("#esc-answer");
    const toolkit = qs("#toolkit");
    const escContinue = qs("#esc-continue");
    if(escAnswer) escAnswer.style.display="none";
    if(toolkit) toolkit.style.display="none";
    if(escContinue) escContinue.style.display="none";
  }

  function getScenarioById(id){ return ((S.content&&S.content.scenarios)||[]).find(x=>x.areaId===S.areaId && x.id===id); }
  function getCurrentScenario(){ return getScenarioById(S.scenId); }

  // ===== Lógica de IA (WOW) =====
  async function runPlay(sc, jugadaLabel){
    const ans=qs("#esc-answer");
    if(ans) {
      ans.style.display="block"; 
      ans.innerHTML=`<p class="muted">Generando su guía…</p>`;
    }
    try{
      const pack = await ai({
        nombre: S.nombre||"Pro",
        estilo: S.estilo||"Neutral",
        area: S.areaTitle,
        escenario: sc.title,
        type: sc.type || "in-conversation",
        pregunta: sc.question || ("Cliente: " + sc.title + ". ¿Cómo responde?"),
        eleccion: jugadaLabel
      });
      S.pack = sanitizePackLocal(pack);
      if(ans) ans.innerHTML = renderWow(S.pack);

      const type = sc.type || "in-conversation";
      S.templates = composeTemplatesFromPack(S.pack, sc.title, type, S.estilo);
      showTemplatesUI(S.templates, type);

      renderPhrases(S.pack, sc);
      const escContinue = qs("#esc-continue");
      if(escContinue) escContinue.style.display="block";
      scrollTop();
    }catch(e){
      if(ans) ans.innerHTML=`<p class="muted">No pudimos conectar con la IA ahora. Intente de nuevo en unos segundos.</p>`;
    }
  }

  // ===== Fallback de principios — mantiene Potenciador siempre =====
  function ensurePrincipiosLocal(p){
    p.principios_potenciados = p.principios_potenciados || {};
    if(!p.principios_potenciados.regla && p.potenciador_cognitivo?.concepto_nuclear){
      p.principios_potenciados.regla = p.potenciador_cognitivo.concepto_nuclear;
    }
    if(!p.principios_potenciados.frase_activadora && p.potenciador_cognitivo?.frase_de_poder){
      p.principios_potenciados.frase_activadora = p.potenciador_cognitivo.frase_de_poder;
    }
    if(!p.potenciador_cognitivo){
      p.potenciador_cognitivo = {
        concepto_nuclear: p.principios_potenciados.regla || "Claridad antes de compromiso",
        frase_de_poder: p.principios_potenciados.frase_activadora || "Acordemos lo esencial para decidir con claridad."
      };
    }
    if(!p.potenciador_cognitivo.concepto_nuclear){
      p.potenciador_cognitivo.concepto_nuclear = p.principios_potenciados.regla || "Claridad antes de compromiso";
    }
    if(!p.potenciador_cognitivo.frase_de_poder){
      p.potenciador_cognitivo.frase_de_poder = p.principios_potenciados.frase_activadora || "Acordemos lo esencial para decidir con claridad.";
    }
    if(!p.frase_poder) p.frase_poder = p.potenciador_cognitivo.frase_de_poder;
    return p;
  }

  function sanitizePackLocal(p){
    const clone = JSON.parse(JSON.stringify(p||{}));
    const walk=(obj)=>{ for(const k in obj){ if(!Object.prototype.hasOwnProperty.call(obj,k)) continue; if(typeof obj[k]==="string") obj[k]=sanitizeStr(obj[k]); else if(obj[k] && typeof obj[k]==="object") walk(obj[k]); } };
    walk(clone);
    ensurePrincipiosLocal(clone);
    const fp = clone.principios_potenciados?.frase_activadora || clone.potenciador_cognitivo?.frase_de_poder || clone.frase_poder || "";
    S.lastFrase = sanitizeStr(fp);
    return clone;
  }

  // Render WOW (epifanía) — muestra Revelación, Principio y Potenciador + extras si vienen
  function renderWow(p){
    const titulo = esc(sanitizeStr(p.titulo_estrategia || "Estrategia"));
    const revelacion = esc(sanitizeStr(p.la_revelacion || ""));
    const principio = esc(sanitizeStr(p.el_principio || ""));
    const regla = esc(sanitizeStr(p.principios_potenciados?.regla || p.potenciador_cognitivo?.concepto_nuclear || ""));
    const como = esc(sanitizeStr(p.principios_potenciados?.como_potencia || ""));
    const fraseAct = esc(sanitizeStr(p.principios_potenciados?.frase_activadora || p.potenciador_cognitivo?.frase_de_poder || ""));
    const mini = esc(sanitizeStr(p.principios_potenciados?.mini_evidencia || ""));
    const pd = esc(sanitizeStr(p.pregunta_detonante || ""));
    const senal = esc(sanitizeStr(p.senal_a_detectar || p.senal || ""));
    const rae = esc(sanitizeStr(p.riesgo_a_evitar || ""));
    const mdec = Array.isArray(p.micro_decisiones) ? p.micro_decisiones.map(x=>esc(sanitizeStr(x))) : [];
    const espejo = esc(sanitizeStr(p.espejo_sin_juicio || p.espejo || ""));
    const micro = esc(sanitizeStr(p.micro_ajuste || ""));
    const re15 = esc(sanitizeStr(p.reescritura_15s || p.reescritura || ""));
    const score = typeof p.score==="number" ? String(Math.round(p.score*10)/10) : "";
    const metrica = esc(sanitizeStr(p.metrica_clave || ""));

    let html=`<h3>${titulo}</h3>`;
    if(revelacion) html += `<div class="fb-sec"><div class="sec-title">Revelación</div><p>${revelacion}</p></div>`;
    if(principio) html += `<div class="fb-sec"><div class="sec-title">Principio</div><p>${principio}</p></div>`;

    html += `<div class="fb-sec"><div class="sec-title">Potenciador Cognitivo</div>`;
    if(regla) html += `<p><strong>Regla:</strong> ${regla}</p>`;
    if(como) html += `<p><strong>Cómo potencia su jugada:</strong> ${como}</p>`;
    if(fraseAct) html += `<p><strong>Frase activadora:</strong> ${fraseAct}</p>`;
    if(mini) html += `<p><strong>Mini‑evidencia:</strong> ${mini}</p>`;
    html += `</div>`;

    if(pd) html += `<div class="fb-sec"><div class="sec-title">Pregunta detonante</div><p>${pd}</p></div>`;
    if(senal) html += `<div class="fb-sec"><div class="sec-title">Señal a detectar</div><p>${senal}</p></div>`;
    if(rae) html += `<div class="fb-sec"><div class="sec-title">Riesgo a evitar</div><p>${rae}</p></div>`;
    if(mdec.length) html += `<div class="fb-sec"><div class="sec-title">Micro‑decisiones</div><ul>${mdec.map(x=>`<li>${x}</li>`).join("")}</ul></div>`;

    if(espejo) html += `<div class="fb-sec"><div class="sec-title">Espejo (sin juicio)</div><p>${espejo}</p></div>`;
    if(micro) html += `<div class="fb-sec"><div class="sec-title">Micro‑ajuste</div><p>${micro}</p></div>`;
    if(re15) html += `<div class="fb-sec"><div class="sec-title">Versión 15s</div><p>${re15}</p></div>`;
    if(score || metrica) html += `<div class="fb-sec"><div class="sec-title">Indicadores</div><p>${metrica ? `<strong>Métrica:</strong> ${metrica}`:""} ${score?` · <strong>Score:</strong> ${score}/10`:""}</p></div>`;

    return html;
  }

  // ===== Motor de plantillas (solo follow-up) =====
  function norm(s){ return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim(); }
  function contains(text, snippet){ return norm(text).includes(norm(snippet)); }
  function seedInt(str){ let h=0; for(let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0; } return Math.abs(h); }

  function pickArchetype(scenId, jugada, estilo){
    const archetypes = ["propuesta_directa","sugerencia_accion","oferta_apoyo","invitacion_abierta"];
    const seed = seedInt((scenId||"")+":"+(jugada||"")+":"+(estilo||""));
    return archetypes[seed % archetypes.length];
  }
  const DELIVERABLES = [
    "un resumen de 1 página",
    "una lista de verificación simple",
    "un comparativo breve",
    "3 puntos clave en un correo",
    "un ejemplo comparable corto"
  ];
  function pickDeliverable(seed){ return DELIVERABLES[seed % DELIVERABLES.length]; }

  function composeClosure(archetype, deliverable){
    switch(archetype){
      case "propuesta_directa":
        return `Le propongo enviar ${deliverable} y revisarlo juntos pronto. ¿Le funciona?`;
      case "sugerencia_accion":
        return `Podemos empezar con ${deliverable} y ver si encaja. ¿Se lo comparto hoy?`;
      case "oferta_apoyo":
        return `Me encargo de preparar ${deliverable} y se lo envío. Luego confirmamos una revisión breve.`;
      case "invitacion_abierta":
      default:
        return `Le dejo ${deliverable}. Cuando le funcione, lo vemos rápido.`;
    }
  }

  function applyTone(channel, text, estilo){
    if(!text) return "";
    let t=text;

    if(estilo==="Calma"){
      t = t.replace(/\bLe propongo\b/gi, "Si le parece, le propongo");
      if(!/[?？]$/.test(t.trim())) t = t.trim() + " ¿Le funciona?";
    }
    if(estilo==="Curiosidad"){
      const q = "¿Qué punto le ayudaría a decidir mejor?";
      if(!contains(t,q)) t = t + "\n" + q;
    }
    if(estilo==="Claridad"){
      t = t.replace(/\bEn breve\b/gi, "pronto").replace(/\s{2,}/g," ");
    }
    if(estilo==="Avance"){
      t = t.replace(/\bUsted me dice\b/gi, "Luego confirmamos")
           .replace(/\bPodemos empezar\b/gi, "Empecemos con");
    }
    if(estilo==="Humor"){
      const wink = (channel==="call") ? "Prometo ser breve." : "Prometo ser breve 🙂";
      if(!contains(t,"prometo ser breve")) t = t + "\n" + wink;
    }
    return cleanTextLocal(t.trim());
  }

  function getFrasePoder(p){
    return p?.principios_potenciados?.frase_activadora
      || p?.potenciador_cognitivo?.frase_de_poder
      || p?.frase_poder
      || "Acordemos lo esencial para decidir con claridad.";
  }
  function getMicro(p){
    return p?.siguiente_movimiento?.accion_estrategica
      || p?.micro_accion
      || "Enviar 3 puntos claros y acordar el siguiente paso.";
  }

  function composeTemplatesFromPack(pack, scTitle, tipo, estilo){
    // Si el Worker trae "Aplicarlo ahora", úsalo
    const aa = pack?.aplicarlo_ahora || null;
    if(aa){
      return {
        whatsapp: sanitizeStr(aa.whatsapp||""),
        emailSubject: sanitizeStr(aa.email_subject||`Sobre "${scTitle}"`),
        emailBody: sanitizeStr(aa.email_body||""),
        call: sanitizeStr(aa.call||""),
        frase: sanitizeStr(getFrasePoder(pack)),
        micro: sanitizeStr(getMicro(pack))
      };
    }

    if (tipo !== "follow-up") {
      // In-conversation: no plantillas
      return { whatsapp:"", emailSubject:"", emailBody:"", call:"", frase:getFrasePoder(pack), micro:getMicro(pack) };
    }

    // Fallback seguro
    const frase = sanitizeStr(getFrasePoder(pack));
    const micro = sanitizeStr(getMicro(pack));
    const seed = seedInt((S.scenId||"")+":"+(pack.titulo_estrategia||"")+":"+(S.estilo||""));
    const archetype = pickArchetype(S.scenId||"", (S.lastJugada||"Proactiva"), S.estilo||"");
    const deliverable = pickDeliverable(seed);
    const cierre = composeClosure(archetype, deliverable);

    let wa = [
      "Hola {CLIENTE}, soy {MI_NOMBRE}.",
      frase,
      micro,
      "¿Le funciona?"
    ].join("\n");
    wa = applyTone("wha", wa, estilo||"");

    const subj = `Sobre "${scTitle}"`;
    let eb = [
      "Hola {CLIENTE},",
      frase,
      micro,
      "¿Se lo comparto hoy?",
      "{MI_NOMBRE}"
    ].join("\n");
    eb = applyTone("eml", eb, estilo||"");

    let call = [
      "Hola {CLIENTE}, soy {MI_NOMBRE}.",
      frase,
      micro.replace(/\.$/, ""),
      "¿Lo vemos juntos?"
    ].join("\n");
    call = applyTone("call", call, estilo||"");

    return {
      whatsapp: wa,
      emailSubject: subj,
      emailBody: eb,
      call: call,
      frase: frase,
      micro: micro
    };
  }

  function renderPhrases(pack, sc){
    const list = Array.isArray(pack.siguiente_movimiento?.frases_de_apoyo) && pack.siguiente_movimiento.frases_de_apoyo.length
      ? pack.siguiente_movimiento.frases_de_apoyo
      : fallbackPhrases(sc.title, sc.type);
    const box=qs("#phrases-box"); if(!box) return; box.innerHTML="";
    list.forEach(text=>{
      const row=document.createElement("div");
      row.className="phrase";
      row.innerHTML=`<div>${esc(sanitizeStr(text))}</div><button class="btn" type="button">Copiar</button>`;
      box.appendChild(row);
    });
  }

  function fallbackPhrases(title,type){
    const t=(title||"").toLowerCase();
    if(type==='in-conversation'){
      if(t.includes("precio")||t.includes("barato")) return [
        "Comparemos alcance y resultado, no solo el número.",
        "¿Qué resultado quiere asegurar ahora?",
        "Veamos dónde está el valor para usted."
      ];
      if(t.includes("experiencia")||t.includes("mala")) return [
        "Tomemos esa experiencia y definamos no negociables.",
        "Acordemos expectativas, entregables y revisiones.",
        "Cuidemos el proceso para decidir con seguridad."
      ];
    }
    if(t.includes("info")||t.includes("envíe")||t.includes("envia")||t.includes("envíeme")) return [
      "Le envío un resumen claro y lo validamos juntos.",
      "¿Prefiere 3 puntos clave o un comparativo breve?",
      "Comparto lo esencial y lo vemos pronto."
    ];
    return [
      "Vayamos a lo esencial y decidamos con claridad.",
      "Primero claridad, luego el siguiente paso.",
      "Si esto le sirve, avanzamos paso a paso."
    ];
  }

  function showTemplatesUI(templates, type){
    const tk=qs("#toolkit"); const tabs=qs(".tabs"); const titleEl=qs("#tmpl-container h4"); const tmpl=qs("#tmpl-container"); const TB=qs("#tmpl-box");
    if(!tk || !tabs || !titleEl || !tmpl || !TB) return;

    // Mostrar toolkit
    tk.style.display = "grid";

    if(type==="follow-up"){
      titleEl.textContent = "Aplicarlo ahora";
      tabs.style.display="flex";
      tmpl.style.display="block";
      qsa(".tab").forEach(x=>x.classList.remove("active"));
      const whaTab = qs('.tab[data-tab="wha"]'); if(whaTab){ whaTab.style.display="inline-flex"; whaTab.classList.add("active"); }
      const emlTab = qs('.tab[data-tab="eml"]'); if(emlTab) emlTab.style.display="inline-flex";
      const callTab = qs('.tab[data-tab="call"]'); if(callTab) callTab.style.display="inline-flex";
      TB.textContent = fillPH(templates.whatsapp||"");
    }else{
      // In-conversation: no plantillas
      tabs.style.display="none";
      tmpl.style.display="none";
      TB.textContent = "";
    }
  }

  // Segunda ronda
  async function roundTwo(){
    const out=qs("#rr-output"); if(!out) return;
    const input=(qs("#rr-text")?.value||"").trim();
    out.style.display="block";
    if(!input){ out.textContent="Escriba lo que diría el cliente y generamos la contra‑respuesta."; return; }
    out.textContent="Pensando con usted…";

    const sc=getCurrentScenario();
    const escTitle = qs("#esc-title");
    const scTitle=sc?.title || (escTitle ? escTitle.textContent : "") || "";
    const scType = sc?.type || "in-conversation";

    try{
      const pack = await ai({
        nombre:S.nombre||"Pro",
        estilo:S.estilo||"Neutral",
        area:S.areaTitle,
        escenario:scTitle,
        type: scType,
        pregunta:"Segunda ronda",
        eleccion:"Contra-respuesta: " + input
      });
      if(pack){
        S.pack = sanitizePackLocal(pack);
        const escAnswer = qs("#esc-answer");
        if(escAnswer) escAnswer.innerHTML = renderWow(S.pack);

        S.templates = composeTemplatesFromPack(S.pack, scTitle, scType, S.estilo);
        showTemplatesUI(S.templates, scType);

        renderPhrases(S.pack, sc || { title: scTitle, type: scType });

        const micro=getMicro(S.pack);
        const microInput = qs("#micro");
        if(microInput && micro) microInput.value = fillPH(micro);

        out.textContent = `Actualizado.\n\nFrase activadora:\n${S.lastFrase}\n\nSugerencia:\n${fillPH(micro||'—')}`;
      }else{
        out.textContent="No se pudo refinar ahora. Intente nuevamente.";
      }
    }catch(e){
      out.textContent="No pudimos conectar con la IA ahora. Intente de nuevo en unos segundos.";
    }
  }

  // ===== Arranque =====
  function wireBase(){
    console.log("🎬 Iniciando Dojo de Polizar...");
    wireEvents();
    
    // Cargar contenido inmediatamente
    console.log("📦 Cargando contenido al inicio...");
    startFetchContent();
    
    go("p0");
  }
  
  console.log("📄 Script cargado, esperando DOM...");
  
  // Esperar a que el DOM esté completamente listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireBase);
  } else {
    wireBase();
  }

})();
