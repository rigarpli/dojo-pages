// build: dojo-app v3.0 SEGUROS - Comunicación completa
// CAMBIOS: Envía TODOS los datos del escenario al Worker

(function(){
  "use strict";

  console.log("🚀 Dojo de Polizar v3.0 - Edición Seguros");

  // Endpoint del Worker
  const API = "https://index.rgarciaplicet.workers.dev/";
  const plan = new URLSearchParams(location.search).get("plan") || "full";
  const CONTENT_URL = `./content.${plan}.json`;

  // Estado global
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
    const cli = (S.cliente && S.cliente.trim()) ? S.cliente.trim() : "";
    const yo  = (S.nombre && S.nombre.trim()) ? S.nombre.trim()  : "";
    
    if(cli) {
      t = t.replace(/\{\s*CLIENTE\s*\}/gi, cli);
    } else {
      // Si no hay nombre de cliente, eliminar referencias
      t = t.replace(/Hola \{\s*CLIENTE\s*\},?/gi, "Hola,");
      t = t.replace(/\{\s*CLIENTE\s*\},?/gi, "");
    }
    
    if(yo) {
      t = t.replace(/\{\s*MI[_\s]*NOMBRE\s*\}/gi, yo);
    } else {
      t = t.replace(/\{\s*MI[_\s]*NOMBRE\s*\}/gi, "Tu corredor");
    }
    
    return t;
  }

  async function ai(payload){
    console.log("📤 Enviando al Worker:", payload);
    const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(!r.ok) throw new Error("IA");
    const response = await r.json();
    console.log("📥 Respuesta del Worker:", response);
    return response;
  }

  // ===== Nav / visibilidad =====
  let currentStep="p0", historySteps=["p0"];
  function go(id){
    qsa(".step").forEach(x=>x.classList.remove("active"));
    const stepEl=qs("#"+id); 
    if(stepEl) {
      stepEl.classList.add("active");
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
    if (contentReady) {
      return Promise.resolve();
    }
    
    if (contentFetching) {
      return Promise.resolve();
    }
    
    contentFetching = true;
    
    return fetch(CONTENT_URL)
      .then(r=>{ 
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
        }
      });
  }

  // ===== Start Flow =====
  function startFlow(){
    S.nombre=(qs("#nombre")?.value||"").trim();
    S.cliente=(qs("#cliente")?.value||"").trim();
    
    nav("p1");
    
    if (!contentReady) {
      showAreasLoading();
      setStartState(true);
      
      const onReady = ()=>{
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

  // ===== Wire de eventos =====
  function setStartState(loading){
    const startBtn = qs("#start");
    if(!startBtn) {
      return;
    }
    if(loading){
      startBtn.disabled = true;
      startBtn.textContent = "Cargando…";
    }else{
      startBtn.disabled = false;
      startBtn.textContent = "Entrar al Dojo";
    }
  }

  function wireEvents(){
    ensureGuideFab();

    // Botón de inicio
    const setupStartButton = () => {
      const startBtn = qs("#start");
      if(startBtn){
        startBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          startFlow();
        });
        
        if (startBtn.disabled && startBtn.textContent === "Entrar al Dojo") {
          startBtn.disabled = false;
        }
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
    const grid=qs("#areas-grid"); 
    if(!grid) {
      return;
    }
    grid.innerHTML="";
    const areas = (S.content && S.content.areas) ? S.content.areas : [];
    
    if(!areas.length){
      grid.innerHTML = `<div class="fb"><p class="muted">No hay áreas disponibles.</p></div>`;
      return;
    }
    areas.forEach(a=>{
      const d=document.createElement("div");
      d.className="area-card";
      const icon = a.icon || "📋";
      d.innerHTML=`<div class="area-title">${icon} ${esc(a.title)}</div><p class="area-desc">${esc(a.desc||"")}</p><div class="group"><button class="btn primary" data-area="${esc(a.id)}" type="button">Entrar</button></div>`;
      grid.appendChild(d);
    });
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
      d.className="sc-card"; 
      d.setAttribute("data-scenario", sc.id);
      
      // Indicador de dificultad
      const difficulty = sc.difficulty || 3;
      const stars = "⭐".repeat(difficulty);
      
      d.innerHTML=`<div class="sc-title">${esc(sc.title)} <span style="float:right;font-size:12px">${stars}</span></div><p class="sc-desc">${esc(q)}</p>`;
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

  // ===== Lógica de IA - CAMBIO CRÍTICO AQUÍ =====
  async function runPlay(sc, jugadaLabel){
    const ans=qs("#esc-answer");
    if(ans) {
      ans.style.display="block"; 
      ans.innerHTML=`<p class="muted">Generando tu feedback…</p>`;
    }
    try{
      // ENVIAR TODOS LOS DATOS DEL ESCENARIO
      const pack = await ai({
        nombre: S.nombre||"",
        estilo: S.estilo||"Claridad",
        area: S.areaTitle,
        escenario: sc.title,
        
        // NUEVOS CAMPOS CRÍTICOS
        pattern: sc.pattern || null,  // ← IMPORTANTE
        keywords: sc.keywords || [],  // ← IMPORTANTE
        context: sc.context || "",  // ← IMPORTANTE
        scenarioId: sc.id || "",  // ← IMPORTANTE
        difficulty: sc.difficulty || 3,  // ← IMPORTANTE
        real_challenge: sc.real_challenge || "",  // ← IMPORTANTE
        
        type: sc.type || "in-conversation",
        pregunta: sc.question || ("Cliente: " + sc.title + ". ¿Cómo responde?"),
        eleccion: jugadaLabel,
        cliente: S.cliente || ""
      });
      
      S.pack = pack;
      if(ans) ans.innerHTML = renderWow(S.pack);

      const type = sc.type || "in-conversation";
      S.templates = extractTemplates(S.pack);
      showTemplatesUI(S.templates, type);

      renderPhrases(S.pack, sc);
      const escContinue = qs("#esc-continue");
      if(escContinue) escContinue.style.display="block";
      scrollTop();
      
      // Guardar frase activadora
      S.lastFrase = S.pack?.principios_potenciados?.frase_activadora 
        || S.pack?.potenciador_cognitivo?.frase_de_poder 
        || S.pack?.frase_poder 
        || "";
        
    }catch(e){
      if(ans) ans.innerHTML=`<p class="muted">No pudimos conectar. Intente de nuevo en unos segundos.</p>`;
    }
  }

  // Render WOW
  function renderWow(p){
    const titulo = esc(p.titulo_estrategia || "Estrategia");
    const revelacion = esc(p.la_revelacion || "");
    const principio = esc(p.el_principio || "");
    const regla = esc(p.principios_potenciados?.regla || p.potenciador_cognitivo?.concepto_nuclear || "");
    const como = esc(p.principios_potenciados?.como_potencia || "");
    const fraseAct = esc(p.principios_potenciados?.frase_activadora || p.potenciador_cognitivo?.frase_de_poder || "");
    const mini = esc(p.principios_potenciados?.mini_evidencia || "");
    const pd = esc(p.pregunta_detonante || "");
    const senal = esc(p.senal_a_detectar || p.senal || "");
    const rae = esc(p.riesgo_a_evitar || "");
    const mdec = Array.isArray(p.micro_decisiones) ? p.micro_decisiones.map(x=>esc(x)) : [];
    const espejo = esc(p.espejo_sin_juicio || p.espejo || "");
    const micro = esc(p.micro_ajuste || "");
    const re15 = esc(p.reescritura_15s || p.reescritura || "");
    const score = typeof p.score==="number" ? String(Math.round(p.score*10)/10) : "";
    const metrica = esc(p.metrica_clave || "");

    let html=`<h3>${titulo}</h3>`;
    if(revelacion) html += `<div class="fb-sec"><div class="sec-title">Revelación</div><p>${revelacion}</p></div>`;
    if(principio) html += `<div class="fb-sec"><div class="sec-title">Principio</div><p>${principio}</p></div>`;

    html += `<div class="fb-sec"><div class="sec-title">Potenciador Cognitivo</div>`;
    if(regla) html += `<p><strong>Regla:</strong> ${regla}</p>`;
    if(como) html += `<p><strong>Cómo potencia tu jugada:</strong> ${como}</p>`;
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

  function extractTemplates(pack){
    // Si el Worker envía aplicarlo_ahora, usarlo
    if(pack?.aplicarlo_ahora){
      return {
        whatsapp: pack.aplicarlo_ahora.whatsapp || "",
        email_subject: pack.aplicarlo_ahora.email_subject || "",
        email_body: pack.aplicarlo_ahora.email_body || "",
        call: pack.aplicarlo_ahora.call || ""
      };
    }
    
    // Fallback
    return {
      whatsapp: "",
      email_subject: "",
      email_body: "",
      call: ""
    };
  }

  function getMicro(p){
    return p?.siguiente_movimiento?.accion_estrategica
      || p?.micro_accion
      || "Definir siguiente paso concreto";
  }

  function renderPhrases(pack, sc){
    const list = Array.isArray(pack.siguiente_movimiento?.frases_de_apoyo) && pack.siguiente_movimiento.frases_de_apoyo.length
      ? pack.siguiente_movimiento.frases_de_apoyo
      : ["Explorar necesidad real", "Clarificar prioridades"];
    const box=qs("#phrases-box"); if(!box) return; box.innerHTML="";
    list.forEach(text=>{
      const row=document.createElement("div");
      row.className="phrase";
      row.innerHTML=`<div>${esc(text)}</div><button class="btn" type="button">Copiar</button>`;
      box.appendChild(row);
    });
  }

  function showTemplatesUI(templates, type){
    const tk=qs("#toolkit"); 
    const tabs=qs(".tabs"); 
    const titleEl=qs("#tmpl-container h4"); 
    const tmpl=qs("#tmpl-container"); 
    const TB=qs("#tmpl-box");
    
    if(!tk || !tabs || !titleEl || !tmpl || !TB) return;

    // SIEMPRE mostrar toolkit y plantillas
    tk.style.display = "grid";
    titleEl.textContent = "Aplicarlo ahora";
    tabs.style.display="flex";
    tmpl.style.display="block";
    
    // Resetear tabs
    qsa(".tab").forEach(x=>x.classList.remove("active"));
    
    // Activar WhatsApp por defecto
    const whaTab = qs('.tab[data-tab="wha"]'); 
    if(whaTab){ 
      whaTab.style.display="inline-flex"; 
      whaTab.classList.add("active"); 
    }
    
    const emlTab = qs('.tab[data-tab="eml"]'); 
    if(emlTab) emlTab.style.display="inline-flex";
    
    const callTab = qs('.tab[data-tab="call"]'); 
    if(callTab) callTab.style.display="inline-flex";
    
    // Mostrar contenido
    TB.textContent = fillPH(templates.whatsapp || "Generando plantilla...");
  }

  // Segunda ronda
  async function roundTwo(){
    const out=qs("#rr-output"); if(!out) return;
    const input=(qs("#rr-text")?.value||"").trim();
    out.style.display="block";
    if(!input){ out.textContent="Escribe lo que diría el cliente y generamos la contra‑respuesta."; return; }
    out.textContent="Pensando contigo…";

    const sc=getCurrentScenario();
    const escTitle = qs("#esc-title");
    const scTitle=sc?.title || (escTitle ? escTitle.textContent : "") || "";
    const scType = sc?.type || "in-conversation";

    try{
      const pack = await ai({
        nombre:S.nombre||"",
        estilo:S.estilo||"Claridad",
        area:S.areaTitle,
        escenario:scTitle,
        
        // Incluir datos del escenario
        pattern: sc?.pattern || null,
        keywords: sc?.keywords || [],
        context: sc?.context || "",
        scenarioId: sc?.id || "",
        
        type: scType,
        pregunta:"Segunda ronda",
        eleccion:"Contra-respuesta: " + input,
        cliente: S.cliente || ""
      });
      
      if(pack){
        S.pack = pack;
        const escAnswer = qs("#esc-answer");
        if(escAnswer) escAnswer.innerHTML = renderWow(S.pack);

        S.templates = extractTemplates(S.pack);
        showTemplatesUI(S.templates, scType);

        renderPhrases(S.pack, sc || { title: scTitle, type: scType });

        const micro=getMicro(S.pack);
        const microInput = qs("#micro");
        if(microInput && micro) microInput.value = fillPH(micro);

        S.lastFrase = S.pack?.principios_potenciados?.frase_activadora 
          || S.pack?.potenciador_cognitivo?.frase_de_poder 
          || "";

        out.textContent = `Actualizado.\n\nFrase activadora:\n${S.lastFrase}\n\nSugerencia:\n${fillPH(micro||'—')}`;
      }else{
        out.textContent="No se pudo refinar. Intente nuevamente.";
      }
    }catch(e){
      out.textContent="Error de conexión. Intente de nuevo.";
    }
  }

  // ===== Arranque =====
  function wireBase(){
    console.log("🎬 Iniciando Dojo de Polizar v3.0...");
    wireEvents();
    
    // Cargar contenido inmediatamente
    console.log("📦 Cargando contenido...");
    startFetchContent();
    
    go("p0");
  }
  
  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireBase);
  } else {
    wireBase();
  }

})();
