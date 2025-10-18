// build: dojo-app 2025-10-18

(function(){
  const API = "https://dojo-coach.rgarciaplicet.workers.dev/"; // Worker de Cloudflare
  const plan = new URLSearchParams(location.search).get("plan") || "full";
  const CONTENT_URL = `./content.${plan}.json`;

  // Plantillas: "auto" usa IA si pasa QA; "always" usa blindadas siempre
  const SAFE_TEMPLATES_MODE = "auto"; // "auto" | "always"

  // Estado
  const S = {
    nombre:"", cliente:"", estilo:"", areaId:"", areaTitle:"",
    scenId:"", pack:null, lastFrase:"", content:null, templates:null
  };

  // Utils
  const qs=(s,sc=document)=>sc.querySelector(s);
  const qsa=(s,sc=document)=>Array.from(sc.querySelectorAll(s));
  const progress=(id)=>{ const map={p0:0,p1:1,p2:2,p3:3,p4:4,p5:5,p8:8,p9:9}; const pct=Math.max(10,Math.round(((map[id]??0)+1)/10*100)); const b=qs("#bar"); if(b) b.style.width=pct+"%"; };
  const scrollTop=()=>{ const root=qs("#dojoApp"); if(root) window.scrollTo({top:root.offsetTop-10,behavior:"smooth"}); };
  function copy(t){ t=t||""; if(navigator.clipboard && window.isSecureContext){ navigator.clipboard.writeText(t).then(()=>alert("Copiado")).catch(()=>fallbackCopy(t)); } else fallbackCopy(t); }
  function fallbackCopy(t){ const a=document.createElement("textarea"); a.value=t; a.style.position="fixed"; a.style.left="-9999px"; document.body.appendChild(a); a.select(); try{document.execCommand("copy"); alert("Copiado");}catch(e){alert("No se pudo copiar")} document.body.removeChild(a); }
  function share(t,title){ if(navigator.share){ navigator.share({title:title||"Dojo de Polizar", text:t}).catch(()=>{}); } else { copy(t); window.open("https://wa.me/?text="+encodeURIComponent(t), "_blank"); } }
  function downloadTxt(name, t){ const blob=new Blob([t||""],{type:"text/plain;charset=utf-8"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name||"dojo.txt"; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},0); }
  function slug(s){ s=s||""; try{s=s.normalize("NFD").replace(/[\u0300-\u036f]/g,"")}catch(e){} return s.toLowerCase().replace(/[^\w]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,""); }

  // Reemplazo robusto de placeholders en cualquier texto
  function fillPH(t){
    if(!t) return "";
    const cli = (S.cliente && S.cliente.trim()) ? S.cliente.trim() : "cliente";
    const yo  = (S.nombre && S.nombre.trim()) ? S.nombre.trim()  : "yo";
    return t
      .replace(/\{\s*CLIENTE\s*\}/gi, cli)
      .replace(/\{\s*MI[_\s]*NOMBRE\s*\}/gi, yo);
  }

  async function ai(payload){
    const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(!r.ok) throw new Error("IA");
    return await r.json();
  }

  // Navegación
  let currentStep="p0", historySteps=["p0"];

  function go(id){
  // Activar la vista
  qsa(".step").forEach(x=>x.classList.remove("active"));
  const stepEl = qs("#"+id);
  if (stepEl) stepEl.classList.add("active");

  // Estado y scroll
  currentStep = id;
  progress(id);
  const root = qs("#dojoApp");
  if (root) window.scrollTo({ top: root.offsetTop - 10, behavior: "smooth" });

  // Mostrar topnav solo desde p2
  const topnav = qs(".topnav");
  if (topnav) topnav.style.display = (id==="p0" || id==="p1") ? "none" : "flex";

  // Botón "← Volver" solo desde p2
  const backBtn = qs("#btn-back");
  if (backBtn) backBtn.style.display = (id==="p0" || id==="p1") ? "none" : "inline-flex";

  // Botón "Áreas" solo desde p3
  const areasBtn = qs('[data-nav="areas"]');
  if (areasBtn) {
    const stepNum = parseInt((id || "p0").slice(1), 10) || 0;
    areasBtn.style.display = stepNum >= 3 ? "inline-flex" : "none";
  }
}
  
  function nav(id){ if(id===currentStep) return; historySteps.push(id); go(id); }
  function shouldConfirmBack(){ return (currentStep==="p4"||currentStep==="p5") && !!S.pack; }
  function goBack(){
    if(shouldConfirmBack()){
      const ok = confirm("¿Volver al paso anterior? Perderás el foco de este escenario. Tus resultados no se guardan aquí.");
      if(!ok) return;
    }
    if(historySteps.length<=1) return;
    historySteps.pop();
    const prev = historySteps[historySteps.length-1]||"p0";
    go(prev);
  }

  // Carga de contenido y arranque
  fetch(CONTENT_URL).then(r=>{ if(!r.ok) throw new Error("content"); return r.json(); })
    .then(data=>{ S.content=data; init(); })
    .catch(()=>{ alert("No se pudo cargar el contenido."); });

  function init(){
    // Bienvenida
    const startBtn=qs("#start");
    if(startBtn){
      startBtn.onclick=()=>{ S.nombre=(qs("#nombre")?.value||"").trim(); S.cliente=(qs("#cliente")?.value||"").trim(); buildAreas(); nav("p1"); };
    }

    // Delegación de clicks
    document.addEventListener("click", (e)=>{
      const t=e.target;
      if(t.closest("#btn-back")) {
        goBack();

      } else if(t.closest("[data-nav]")){
        const where=t.closest("[data-nav]").dataset.nav;
        if(where==="areas"){ buildAreas(); nav("p1"); }
        if(where==="guia"){ nav("p8"); }

      } else if(t.closest(".area-card .btn")){
        const id=t.closest(".area-card .btn").dataset.area;
        const area=(S.content.areas||[]).find(a=>a.id===id)||{};
        S.areaId=id; S.areaTitle=area.title||""; const ctx=qs("#ctx-area"); if(ctx) ctx.textContent=S.areaTitle||"—"; nav("p2");

      } else if(t.closest("[data-style]")){
        S.estilo=t.closest("[data-style]").dataset.style; buildScenarios(); nav("p3");

      } else if(t.closest("[data-scenario]")){
        const id=t.closest("[data-scenario]").dataset.scenario; S.scenId=id; buildScenarioView(id); nav("p4");

      } else if(t.closest(".tab")){
        qsa(".tab").forEach(x=>x.classList.remove("active"));
        t.closest(".tab").classList.add("active");
        const key=t.closest(".tab").dataset.tab; const TB=qs("#tmpl-box");
        if(S.templates){
          if(key==="wha") TB.textContent = fillPH(S.templates.whatsapp);
          if(key==="eml") TB.textContent = fillPH(S.templates.emailBody);
          if(key==="call") TB.textContent = fillPH(S.templates.call);
        }

      } else if(t.closest("#btn-copy-tmpl")){
        copy(qs("#tmpl-box").textContent||"");

      } else if(t.closest("#btn-dl-txt")){
        const key=(qs(".tab.active")?.dataset.tab)||"wha"; let content="";
        if(key==="wha") content=fillPH(S.templates.whatsapp);
        if(key==="eml") content="Asunto: "+fillPH(S.templates.emailSubject)+"\n\n"+fillPH(S.templates.emailBody);
        if(key==="call") content=fillPH(S.templates.call);
        downloadTxt("dojo-"+slug(S.areaId||"area")+"-"+slug(S.scenId||"escenario")+"-"+key+".txt", content);

      } else if(t.closest("#btn-share-tmpl")){
        const key=(qs(".tab.active")?.dataset.tab)||"wha"; let content="";
        if(key==="wha") content=fillPH(S.templates.whatsapp);
        if(key==="eml") content=fillPH(S.templates.emailSubject)+"\n\n"+fillPH(S.templates.emailBody);
        if(key==="call") content=fillPH(S.templates.call);
        share(content, "Dojo — "+(S.areaTitle||""));

      } else if(t.closest(".phrase button")){
        const text=t.closest(".phrase").querySelector("div")?.textContent||""; copy(text);

      } else if(t.id==="rr-generate"){
        roundTwo();

      } else if(t.closest("#to-p5")){
        qs("#p5-frase").textContent = S.lastFrase || "Aún no has generado una frase.";
        const micro=(S.pack && (S.pack.micro_accion_refinada||S.pack.micro_accion))||"";
        if(micro) qs("#micro").value = fillPH(micro);
        nav("p5");

      } else if(t.closest("#btn-wa")){
        const msg = `Dojo de Polizar — ${S.areaTitle}
Escenario: ${qs('#esc-title').textContent}
Estilo: ${S.estilo||"-"}
Cliente: ${S.cliente||"-"}

Micro‑acción:
${(qs('#micro')?.value||'________')}

Frase de poder:
${S.lastFrase||"-"}`;
        window.open("https://wa.me/?text="+encodeURIComponent(msg),"_blank");

      } else if(t.closest("#p5-copy")){
        const txt = `Dojo de Polizar — ${S.areaTitle}
Escenario: ${qs('#esc-title').textContent}
Estilo: ${S.estilo||"-"}
Cliente: ${S.cliente||"-"}

Micro‑acción:
${(qs('#micro')?.value||'________')}

Frase de poder:
${S.lastFrase||"-"}`;
        copy(txt);

      } else if(t.closest("#p5-dl")){
        const txt = `Dojo de Polizar — ${S.areaTitle}
Escenario: ${qs('#esc-title').textContent}
Estilo: ${S.estilo||"-"}
Cliente: ${S.cliente||"-"}

Micro‑acción:
${(qs('#micro')?.value||'________')}

Frase de poder:
${S.lastFrase||"-"}`;
        downloadTxt("dojo-"+slug(S.areaId||'area')+"-"+slug(S.scenId||'escenario')+"-resumen.txt", txt);

      } else if(t.closest("#finish")){
        qs("#thanks-name").textContent = S.nombre || "Pro";
        qs("#thanks-area").textContent = S.areaTitle || "tu área";
        nav("p9");
      }
    });

    document.addEventListener("keydown",(e)=>{
      const a=document.activeElement; const typing=a && (a.tagName==="INPUT"||a.tagName==="TEXTAREA"||a.isContentEditable);
      if(e.key==="Enter"&&(a?.id==="nombre"||a?.id==="cliente")){ e.preventDefault(); const st=qs("#start"); if(st) st.click(); }
      if(e.key==="Escape" && !typing){ e.preventDefault(); goBack(); }
    });
  }

  // Vistas
  function buildAreas(){
    const grid=qs("#areas-grid"); if(!grid) return; grid.innerHTML="";
    (S.content.areas||[]).forEach(a=>{
      const d=document.createElement("div");
      d.className="area-card";
      d.innerHTML=`<div class="area-title">${a.title}</div><p class="area-desc">${a.desc||""}</p><div class="group"><button class="btn primary" data-area="${a.id}" type="button">Entrar</button></div>`;
      grid.appendChild(d);
    });
  }

  function buildScenarios(){
    const list=(S.content.scenarios||[]).filter(x=>x.areaId===S.areaId);
    const titleEl=qs("#area-title"); if(titleEl) titleEl.textContent=S.areaTitle||"";
    const grid=qs("#scen-grid"); if(!grid) return; grid.innerHTML="";
    list.forEach(sc=>{
      const q= sc.question || ("Cliente: " + sc.title + ". ¿Cómo respondes?");
      const d=document.createElement("div");
      d.className="sc-card"; d.setAttribute("data-scenario", sc.id);
      d.innerHTML=`<div class="sc-title">${sc.title}</div><p class="sc-desc">${q}</p>`;
      grid.appendChild(d);
    });
  }

  function buildScenarioView(sid){
    const sc=(S.content.scenarios||[]).find(x=>x.areaId===S.areaId && x.id===sid);
    if(!sc){ nav("p3"); return; }
    qs("#esc-badge").textContent="Escenario — " + (S.areaTitle||"");
    qs("#esc-title").textContent=sc.title;
    qs("#esc-question").textContent= sc.question || ("Cliente: " + sc.title + ". ¿Cómo respondes?");
    const box=qs("#esc-options"); if(!box) return; box.innerHTML="";
    const jugadas = Array.isArray(sc.jugadas) && sc.jugadas.length ? sc.jugadas : defaultJugadas(sc.type);
    jugadas.forEach(label=>{
      const b=document.createElement("button");
      b.className="btn"; b.type="button"; b.textContent=label;
      b.onclick=()=>runPlay(sc,label);
      box.appendChild(b);
    });
    qs("#esc-answer").style.display="none";
    qs("#toolkit").style.display="none";
    qs("#esc-continue").style.display="none";
  }

  function defaultJugadas(type){
    return type==="follow-up" ? ["Resumen + micro‑acción","Confirmar prioridad","Recordatorio con fecha"] : ["Validar + pregunta","Reencuadre de valor","Micro‑paso"];
  }

  // Sanitiza TODO el pack de la IA reemplazando placeholders
  function sanitizePack(pack){
    const safe = v => (typeof v === "string" ? fillPH(v) : v);
    const p = { ...pack };

    p.titulo_jugada = safe(p.titulo_jugada);
    p.validacion_estrategica = safe(p.validacion_estrategica);
    p.perspectiva_cliente = safe(p.perspectiva_cliente);

    if (p.mejora_potenciadora) {
      p.mejora_potenciadora = {
        ...p.mejora_potenciadora,
        concepto: safe(p.mejora_potenciadora.concepto),
        frase_mejorada: safe(p.mejora_potenciadora.frase_mejorada)
      };
    }

    p.frase_poder   = safe(p.frase_poder);
    p.frase_poder_2 = safe(p.frase_poder_2);
    p.micro_accion  = safe(p.micro_accion);
    p.micro_accion_refinada = safe(p.micro_accion_refinada);

    if (Array.isArray(p.frases_rapidas)) {
      p.frases_rapidas = p.frases_rapidas.map(safe);
    }

    if (p.templates) {
      p.templates = { ...p.templates };
      p.templates.whatsapp = safe(p.templates.whatsapp);
      p.templates.call     = safe(p.templates.call);
      if (p.templates.email) {
        p.templates.email = {
          ...p.templates.email,
          subject: safe(p.templates.email.subject),
          body:    safe(p.templates.email.body)
        };
      }
    }

    return p;
  }

  // Ejecuta jugada
  async function runPlay(sc, label){
    const ans=qs("#esc-answer");
    ans.style.display="block"; ans.innerHTML=`<p class="muted">Generando tu guía…</p>`;
    try{
      const raw = await ai({
        nombre: S.nombre||"Pro",
        estilo: S.estilo||"Neutral",
        area: S.areaTitle,
        escenario: sc.title,
        pregunta: sc.question || ("Cliente: " + sc.title + ". ¿Cómo respondes?"),
        eleccion: label
      });
      if(!raw || !raw.frase_poder) throw new Error("Pack incompleto");

      // Limpiar placeholders en todo el paquete
      const pack = sanitizePack(raw);
      S.pack=pack;

      ans.innerHTML=renderPack(S.pack);
      S.templates=pickTemplates(S.pack, sc.title, sc.type, S.estilo);
      renderPhrases(S.pack, sc);
      const TB=qs("#tmpl-box"); if(TB) TB.textContent=fillPH(S.templates.whatsapp);
      qs("#toolkit").style.display="grid";
      qs("#esc-continue").style.display="block";
      scrollTop();
    }catch(e){
      ans.innerHTML=`<p class="muted">No pudimos conectar con la IA ahora. Intenta de nuevo en unos segundos.</p>`;
    }
  }

  // Render feedback principal (aplica fillPH y guarda última frase)
  function renderPack(pack){
    const titulo   = fillPH(pack.titulo_jugada || "Tu Mejor Siguiente Paso");
    const valid    = fillPH(pack.validacion_estrategica || "");
    const pers     = fillPH(pack.perspectiva_cliente || "");
    const conc     = fillPH((pack.mejora_potenciadora && pack.mejora_potenciadora.concepto) || "");
    const fraseMej = fillPH((pack.mejora_potenciadora && pack.mejora_potenciadora.frase_mejorada) || "");
    const frase    = pack.frase_poder || "Para acertar, ¿qué te importa más ahora?";
    S.lastFrase    = fillPH(frase);

    let html=`<h3>${titulo}</h3>`;
    if(valid.trim()) html+=`<div class="fb-sec"><div class="sec-title">¡Bien Jugado! El Acierto Estratégico</div><p>${valid}</p></div>`;
    if(pers.trim())  html+=`<div class="fb-sec"><div class="sec-title">En la Mente del Cliente</div><p>${pers}</p></div>`;
    if(conc.trim() || fraseMej.trim()){
      html+=`<div class="fb-sec"><div class="sec-title">Potencia Tu Jugada</div>`;
      if(conc.trim())     html+=`<p><strong>El Principio Detrás:</strong> ${conc}</p>`;
      if(fraseMej.trim()) html+=`<p><strong>Frase Mejorada:</strong> ${fraseMej}</p>`;
      html+=`</div>`;
    }
    html+=`<div class="fb-sec"><div class="sec-title">Tu Nueva Frase de Poder</div><p><strong>${S.lastFrase}</strong></p></div>`;
    return html;
  }

  // ====== Plantillas Blindadas + QA ======

  function norm(s){
    return (s||"")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/["'«»“”]/g,"")
      .replace(/[.,;:!?]/g,"")
      .replace(/\s+/g," ")
      .trim();
  }
  function contains(text, snippet){ return norm(text).includes(norm(snippet)); }
  function dedupLines(text){
    const seen=new Set(), out=[];
    (text||"").split(/\n+/).forEach(line=>{
      const k=norm(line);
      if(!k) return;
      if(seen.has(k)) return;
      seen.add(k);
      out.push(line.trim());
    });
    return out.join("\n");
  }
  function keepFirstPhrase(text, frase){
    if(!text) return "";
    const esc = frase.replace(/[-\/\\^$*+?.()|[```{}]/g, '\\$&');
    let found=false;
    return (text||"").replace(new RegExp(esc,"gi"), (m)=>{ if(found) return ""; found=true; return m; })
      .replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").replace(/[ ]{2,}/g," ").trim();
  }

  // Estilo aplicado (matices suaves por canal)
  function applyTone(channel, text, estilo){
    if(!text) return "";
    let t=text;

    if(estilo==="Calma"){
      t = t.replace(/\bPropongo:?\b/gi, "Si te parece, propongo:");
      if(channel==="call") t = t.replace(/\?$/,". Cuando te funcione, lo vemos.");
    }
    if(estilo==="Curiosidad"){
      const extraQ = "¿Qué te haría sentir seguro para avanzar?";
      if(!contains(t, extraQ)) t = t + "\n" + extraQ;
    }
    if(estilo==="Claridad"){
      t = t.replace(/\bEn resumen:?\b/gi,"Lo esencial:").replace(/\s{2,}/g," ");
    }
    if(estilo==="Avance"){
      t = t.replace(/\bPropuesta:\b/gi,"Propuesta:").replace(/\bPropongo\b/gi,"Te propongo");
    }
    if(estilo==="Humor"){
      const wink = (channel==="call") ? "Prometo ser breve." : "Prometo ser breve 🙂";
      if(!contains(t, "prometo ser breve")) t = t + "\n" + wink;
    }
    return t.trim();
  }

  function buildSafeTemplates(frase, micro, scTitle, tipo, estilo){
    // WhatsApp (3–5 líneas)
    let wa = [
      `Hola {CLIENTE}, soy {MI_NOMBRE}.`,
      frase,
      (tipo==="follow-up" ? micro : "Propongo: " + micro),
      "¿Te va bien?"
    ].join("\n");

    // Email (≤10 líneas)
    const subj = `Sobre “${scTitle}”`;
    let eb = [
      `Hola {CLIENTE},`,
      frase,
      (tipo==="follow-up" ? micro : "Propuesta: " + micro),
      `Quedo atento.`,
      `{MI_NOMBRE}`
    ].join("\n");

    // Llamada (3–4 líneas, natural)
    let callLines;
    if(tipo==="follow-up"){
      callLines = [
        `Hola {CLIENTE}, soy {MI_NOMBRE}. ¿Tienes 2 minutos?`,
        `Sobre “${scTitle}”. ${frase}`,
        `${micro}`,
        `¿Te funciona o prefieres otro momento?`
      ];
    }else{
      callLines = [
        `Hola {CLIENTE}, soy {MI_NOMBRE}.`,
        `${frase}`,
        `¿Qué te gustaría revisar primero para decidir con calma?`,
        `${micro}`
      ];
    }
    let call = callLines.join("\n");

    // Aplicar estilo por canal
    wa   = applyTone("wha",  wa,   estilo);
    eb   = applyTone("eml",  eb,   estilo);
    call = applyTone("call", call, estilo);

    return {
      whatsapp: wa,
      emailSubject: subj,
      emailBody: eb,
      call: call,
      frase, micro
    };
  }

  // Chequeo de coherencia de IA: debe contener frase y la micro (al menos su inicio)
  function passesQA(tpl, frase, micro){
    if(!tpl) return false;
    const shortMicro = (micro||"").split(/\s+/).slice(0,5).join(" ");
    return contains(tpl, frase) && (shortMicro ? contains(tpl, shortMicro) : true);
  }

  function pickTemplates(pack, scTitle, tipo, estilo){
    const frase = pack.frase_poder_2 || pack.frase_poder || "Para acertar, ¿qué te importa más ahora?";
    const micro = pack.micro_accion_refinada || pack.micro_accion || "Agendar 5 minutos para revisar juntos el punto clave.";
    const t = pack.templates || {};
    let w  = t.whatsapp || "";
    let es = (t.email && t.email.subject) || `Sobre “${scTitle||"tu consulta"}”`;
    let eb = (t.email && t.email.body)    || "";
    let c  = t.call || "";

    if(SAFE_TEMPLATES_MODE==="auto"){
      const okIA = passesQA(w,frase,micro) && passesQA(eb,frase,micro) && passesQA(c,frase,micro);
      if(okIA){
        w  = dedupLines(w);
        eb = keepFirstPhrase(dedupLines(eb), frase);
        c  = keepFirstPhrase(dedupLines(c),  frase);
        w  = applyTone("wha",  w,  estilo);
        eb = applyTone("eml",  eb, estilo);
        c  = applyTone("call", c, estilo);
        return { whatsapp:w, emailSubject:es, emailBody:eb, call:c, frase, micro };
      }
    }

    // Si no pasa QA (o modo "always"): blindadas
    return buildSafeTemplates(frase, micro, scTitle, tipo, estilo);
  }

  // Frases rápidas (IA o fallback local)
  function fallbackPhrases(title,type){
    const t=(title||"").toLowerCase();
    if(type==='in-conversation'){
      if(t.includes("precio")||t.includes("barato")) return [
        "¿Qué compararías para sentir que estás eligiendo bien?",
        "Revisemos juntos dónde está el mayor valor para ti.",
        "Más allá del número, ¿qué resultado te importa asegurar?"
      ];
      if(t.includes("no entiendo")) return [
        "Te lo explico en simple: qué cambia para ti y cómo se nota.",
        "¿Qué parte te genera más duda para explicarla mejor?",
        "Piénsalo como [analogía simple]. ¿Tiene sentido así?"
      ];
    }
    if(t.includes("info")||t.includes("pensarlo")) return [
      "Para no enviarte algo genérico, ¿qué info concreta decide aquí?",
      "¿Te propongo 5 minutos solo para cerrar ese punto?",
      "Te mando un resumen de 1 página y lo vemos en breve."
    ];
    return [
      "¿Qué te haría sentir seguro para avanzar?",
      "Prefiero claridad antes que velocidad: así decidimos mejor.",
      "Dime qué punto despejamos primero."
    ];
  }

  function renderPhrases(pack, sc){
    const list = Array.isArray(pack.frases_rapidas) && pack.frases_rapidas.length ? pack.frases_rapidas : fallbackPhrases(sc.title, sc.type);
    const box=qs("#phrases-box"); if(!box) return; box.innerHTML="";
    list.forEach(text=>{
      const row=document.createElement("div");
      row.className="phrase";
      row.innerHTML=`<div>${fillPH(text)}</div><button class="btn" type="button">Copiar</button>`;
      box.appendChild(row);
    });
  }

  // Segunda ronda
  async function roundTwo(){
    const out=qs("#rr-output"); if(!out) return;
    const input=(qs("#rr-text")?.value||"").trim();
    out.style.display="block";
    if(!input){ out.textContent="Escribe lo que diría el cliente y generamos la contra‑respuesta."; return; }
    out.textContent="Pensando contigo…";

    const sc=(S.content.scenarios||[]).find(x=>x.areaId===S.areaId && x.id===S.scenId);
    const scTitle=sc?.title || qs("#esc-title")?.textContent || "";
    const scType = sc?.type  || "in-conversation";

    try{
      const raw = await ai({
        nombre:S.nombre||"Pro",
        estilo:S.estilo||"Neutral",
        area:S.areaTitle,
        escenario:scTitle,
        pregunta:"Segunda ronda",
        eleccion:"Contra-respuesta a: " + input
      });
      if(raw && raw.frase_poder){
        const pack = sanitizePack(raw);
        S.pack=pack;

        qs("#esc-answer").innerHTML=renderPack(S.pack);
        S.templates=pickTemplates(S.pack, scTitle, scType, S.estilo);
        renderPhrases(S.pack, sc || { title: scTitle, type: scType });

        const micro=S.pack.micro_accion_refinada || S.pack.micro_accion;
        if(micro) qs("#micro").value = fillPH(micro);

        out.textContent = `Actualizado.\n\nFrase de poder:\n${S.lastFrase}\n\nSugerencia de micro‑acción:\n${fillPH(micro||'—')}`;
      }else{
        out.textContent="No se pudo refinar ahora. Intenta nuevamente.";
      }
    }catch(e){
      out.textContent="No pudimos conectar con la IA ahora. Intenta de nuevo en unos segundos.";
    }
  }

  // Inicial
  go("p0");

})();
