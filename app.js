(function(){
  const API = "https://dojo-coach.rgarciaplicet.workers.dev/"; // tu Worker
  const plan = new URLSearchParams(location.search).get("plan") || "full";
  const CONTENT_URL = `./content.${plan}.json`;

  // Estado
  const S = { nombre:"", cliente:"", estilo:"", areaId:"", areaTitle:"", scenId:"", pack:null, lastFrase:"", content:null, templates:null };

  // Utils
  const qs=(s,sc=document)=>sc.querySelector(s);
  const qsa=(s,sc=document)=>Array.from(sc.querySelectorAll(s));
  const progress=(id)=>{ const map={p0:0,p1:1,p2:2,p3:3,p4:4,p5:5,p8:8,p9:9}; const pct=Math.max(10,Math.round(((map[id]??0)+1)/10*100)); qs("#bar").style.width=pct+"%"; };
  const scrollTop=()=>window.scrollTo({top:qs("#dojoApp").offsetTop-10,behavior:"smooth"});
  function copy(t){ t=t||""; if(navigator.clipboard && window.isSecureContext){ navigator.clipboard.writeText(t).then(()=>alert("Copiado")).catch(()=>fallbackCopy(t)); } else fallbackCopy(t); }
  function fallbackCopy(t){ const a=document.createElement("textarea"); a.value=t; a.style.position="fixed"; a.style.left="-9999px"; document.body.appendChild(a); a.select(); try{document.execCommand("copy"); alert("Copiado");}catch(e){alert("No se pudo copiar")} document.body.removeChild(a); }
  function share(t,title){ if(navigator.share){ navigator.share({title:title||"Dojo de Polizar", text:t}).catch(()=>{}); } else { copy(t); window.open("https://wa.me/?text="+encodeURIComponent(t), "_blank"); } }
  function downloadTxt(name, t){ const blob=new Blob([t||""],{type:"text/plain;charset=utf-8"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name||"dojo.txt"; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},0); }
  function slug(s){ s=s||""; try{s=s.normalize("NFD").replace(/[\u0300-\u036f]/g,"")}catch(e){} return s.toLowerCase().replace(/[^\w]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,""); }
  function fillPH(t){ if(!t) return ""; return t.replace(/\{CLIENTE\}/g,S.cliente||"cliente").replace(/\{MI_NOMBRE\}/g,S.nombre||"yo"); }
  async function ai(payload){ const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); if(!r.ok) throw new Error("IA"); return await r.json(); }

  // Navegación
  let currentStep="p0", historySteps=["p0"];
  function go(id){ qsa(".step").forEach(x=>x.classList.remove("active")); qs("#"+id).classList.add("active"); currentStep=id; progress(id); scrollTop(); qs("#btn-back").style.display = (id==="p0")?"none":"inline-flex"; }
  function nav(id){ if(id===currentStep) return; historySteps.push(id); go(id); }
  function shouldConfirmBack(){ return (currentStep==="p4"||currentStep==="p5") && !!S.pack; }
  function goBack(){ if(shouldConfirmBack()){ if(!confirm("¿Volver al paso anterior? Perderás el foco de este escenario. Tus resultados no se guardan aquí.")) return; } if(historySteps.length<=1) return; historySteps.pop(); const prev = historySteps[historySteps.length-1]||"p0"; go(prev); }

  // Carga de contenido y arranque
  fetch(CONTENT_URL).then(r=>{ if(!r.ok) throw new Error("content"); return r.json(); })
    .then(data=>{ S.content=data; init(); })
    .catch(()=>{ alert("No se pudo cargar el contenido."); });

  function init(){
    // Bienvenida
    qs("#start").onclick=()=>{ S.nombre=(qs("#nombre").value||"").trim(); S.cliente=(qs("#cliente").value||"").trim(); buildAreas(); nav("p1"); };

    // Delegación de clicks
    document.addEventListener("click", (e)=>{
      const t=e.target;
      if(t.closest("#btn-back")) goBack();
      else if(t.closest("[data-nav]")){
        const where=t.closest("[data-nav]").dataset.nav;
        if(where==="areas"){ buildAreas(); nav("p1"); }
        if(where==="guia"){ nav("p8"); }
      } else if(t.closest(".area-card .btn")){
        const id=t.closest(".area-card .btn").dataset.area;
        const area=S.content.areas.find(a=>a.id===id)||{};
        S.areaId=id; S.areaTitle=area.title||""; qs("#ctx-area").textContent=S.areaTitle||"—"; nav("p2");
      } else if(t.closest("[data-style]")){
        S.estilo=t.closest("[data-style]").dataset.style; buildScenarios(); nav("p3");
      } else if(t.closest("[data-scenario]")){
        const id=t.closest("[data-scenario]").dataset.scenario; S.scenId=id; buildScenarioView(id); nav("p4");
      } else if(t.closest(".tab")){
        qsa(".tab").forEach(x=>x.classList.remove("active"));
        t.closest(".tab").classList.add("active");
        const key=t.closest(".tab").dataset.tab; const TB=qs("#tmpl-box");
        if(key==="wha") TB.textContent = fillPH(S.templates.whatsapp);
        if(key==="eml") TB.textContent = fillPH(S.templates.emailBody);
        if(key==="call") TB.textContent = fillPH(S.templates.call);
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
        downloadTxt("dojo-"+slug(S.areaId||"area")+"-"+slug(S.scenId||"escenario")+"-resumen.txt", txt);
      } else if(t.closest("#finish")){
        qs("#thanks-name").textContent = S.nombre || "Pro";
        qs("#thanks-area").textContent = S.areaTitle || "tu área";
        nav("p9");
      }
    });

    document.addEventListener("keydown",(e)=>{
      const a=document.activeElement; const typing=a && (a.tagName==="INPUT"||a.tagName==="TEXTAREA"||a.isContentEditable);
      if(e.key==="Enter"&&(a?.id==="nombre"||a?.id==="cliente")){ e.preventDefault(); qs("#start").click(); }
      if(e.key==="Escape" && !typing){ e.preventDefault(); goBack(); }
    });
  }

  // Vistas
  function buildAreas(){
    const grid=qs("#areas-grid"); grid.innerHTML="";
    (S.content.areas||[]).forEach(a=>{
      const d=document.createElement("div");
      d.className="area-card";
      d.innerHTML=`<div class="area-title">${a.title}</div><p class="area-desc">${a.desc||""}</p><div class="group"><button class="btn primary" data-area="${a.id}" type="button">Entrar</button></div>`;
      grid.appendChild(d);
    });
  }

  function buildScenarios(){
    const list=(S.content.scenarios||[]).filter(x=>x.areaId===S.areaId);
    qs("#area-title").textContent=S.areaTitle||"";
    const grid=qs("#scen-grid"); grid.innerHTML="";
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
    const box=qs("#esc-options"); box.innerHTML="";
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

  async function runPlay(sc, label){
    const ans=qs("#esc-answer");
    ans.style.display="block"; ans.innerHTML=`<p class="muted">Generando tu guía…</p>`;
    try{
      const pack = await ai({
        nombre: S.nombre||"Pro",
        estilo: S.estilo||"Neutral",
        area: S.areaTitle,
        escenario: sc.title,
        pregunta: sc.question || ("Cliente: " + sc.title + ". ¿Cómo respondes?"),
        eleccion: label
      });
      if(!pack || !pack.frase_poder) throw new Error("Pack incompleto");
      S.pack=pack;
      ans.innerHTML=renderPack(pack);
      const T=normalizeTemplates(pack, sc.title);
      S.templates=T;
      renderPhrases(pack, sc);
      qs("#tmpl-box").textContent=fillPH(T.whatsapp);
      qs("#toolkit").style.display="grid";
      qs("#esc-continue").style.display="block";
      scrollTop();
    }catch(e){
      ans.innerHTML=`<p class="muted">No pudimos conectar con la IA ahora. Intenta de nuevo en unos segundos.</p>`;
    }
  }

  function renderPack(pack){
    const titulo=pack.titulo_jugada||"Tu Mejor Siguiente Paso";
    const valid=pack.validacion_estrategica;
    const pers=pack.perspectiva_cliente;
    const conc=pack.mejora_potenciadora?.concepto;
    const fraseMej=pack.mejora_potenciadora?.frase_mejorada;
    const frase = pack.frase_poder || "Para acertar, ¿qué te importa más ahora?";
    S.lastFrase = fillPH(frase);
    let html=`<h3>${titulo}</h3>`;
    if(valid) html+=`<div class="fb-sec"><div class="sec-title">¡Bien Jugado! El Acierto Estratégico</div><p>${valid}</p></div>`;
    if(pers) html+=`<div class="fb-sec"><div class="sec-title">En la Mente del Cliente</div><p>${pers}</p></div>`;
    if(conc && fraseMej) html+=`<div class="fb-sec"><div class="sec-title">Potencia Tu Jugada</div><p><strong>El Principio Detrás:</strong> ${conc}</p><p><strong>Frase Mejorada:</strong> ${fraseMej}</p></div>`;
    html+=`<div class="fb-sec"><div class="sec-title">Tu Nueva Frase de Poder</div><p><strong>${S.lastFrase}</strong></p></div>`;
    return html;
  }

function normalizeTemplates(pack, scTitle){
  const frase = pack.frase_poder_2 || pack.frase_poder || "Para acertar, ¿qué te importa más ahora?";
  const micro = pack.micro_accion_refinada || pack.micro_accion || "Agendar 5 minutos para revisar juntos el punto clave.";
  const t = pack.templates || {};

  let w  = t.whatsapp || `Hola {CLIENTE}, soy {MI_NOMBRE}. ${frase}\n${micro}`;
  let es = (t.email && t.email.subject) || `Sobre: ${scTitle||"tu consulta"}`;
  let eb = (t.email && t.email.body)    || `Hola {CLIENTE},\n\n${frase}\n\n${micro}\n\nQuedo atento.\n{MI_NOMBRE}`;
  let c  = t.call || `1) Saludo breve y contexto.\n2) ${frase}\n3) ${micro}\n4) Cierre amable.`;

  // Helpers
  const norm = s => (s||"")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")   // sin acentos
    .replace(/["'«»“”]/g,"")                          // sin comillas
    .replace(/[.,;:!?]/g,"")                          // sin puntuación
    .replace(/\s+/g," ")
    .trim();

  const hasPhrase = (text, phrase) => norm(text).includes(norm(phrase));
  const injectOnce = (text, phrase) => {
    if (!text) return phrase;
    return hasPhrase(text, phrase) ? text : (phrase + "\n" + text);
  };
  const dedupLines = (text) => {
    const seen = new Set(); const out = [];
    (text||"").split(/\n+/).forEach(line=>{
      const key = norm(line);
      if(!key) return;
      if(seen.has(key)) return;
      seen.add(key);
      out.push(line.trim());
    });
    return out.join("\n");
  };
  const escapeRegExp = s => (s||"").replace(/[.*+?^${}()|[```\```/g, "\\$&");
  // Mantener solo la primera aparición de la frase; borrar las siguientes (sin romper el resto)
  const limitOccurrences = (text, phrase) => {
    if(!text) return "";
    const pat = new RegExp(`[\"«»“”']?${escapeRegExp(phrase)}[\"«»“”']?`, "gi");
    let seen = false;
    const cleaned = text.replace(pat, (m)=>{
      if(seen) return ""; // quita repeticiones
      seen = true;
      return m; // conserva la primera
    });
    return cleaned
      .replace(/[ ]{2,}/g," ")
      .replace(/\n[ \t]+\n/g,"\n\n")
      .replace(/\n{3,}/g,"\n\n")
      .trim();
  };
  const tidy = (text) => (text||"").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();

  // Inyectar SOLO si falta; luego deduplicar líneas; luego limitar a 1 ocurrencia total
  w  = tidy( dedupLines( injectOnce(w,  frase) ) );
  eb = tidy( limitOccurrences( dedupLines( injectOnce(eb, frase) ), frase ) );
  c  = tidy( limitOccurrences( dedupLines( injectOnce(c,  frase) ), frase ) );

  return { whatsapp:w, emailSubject:es, emailBody:eb, call:c, frase, micro };
}

  function renderPhrases(pack, sc){
    const list = Array.isArray(pack.frases_rapidas) && pack.frases_rapidas.length ? pack.frases_rapidas : fallbackPhrases(sc.title, sc.type);
    const box=qs("#phrases-box"); box.innerHTML="";
    list.forEach(text=>{
      const row=document.createElement("div");
      row.className="phrase";
      row.innerHTML=`<div>${fillPH(text)}</div><button class="btn" type="button">Copiar</button>`;
      box.appendChild(row);
    });
  }

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

  async function roundTwo(){
    const out=qs("#rr-output");
    if(!out) return;
    const input=(qs("#rr-text")?.value||"").trim();
    out.style.display="block";
    if(!input){ out.textContent="Escribe lo que diría el cliente y generamos la contra‑respuesta."; return; }
    out.textContent="Pensando contigo…";
    const sc=(S.content.scenarios||[]).find(x=>x.areaId===S.areaId && x.id===S.scenId);
    const scTitle=sc?.title || qs("#esc-title")?.textContent || "";
    try{
      const pack=await ai({
        nombre:S.nombre||"Pro",
        estilo:S.estilo||"Neutral",
        area:S.areaTitle,
        escenario:scTitle,
        pregunta:"Segunda ronda",
        eleccion:"Contra-respuesta a: " + input
      });
      if(pack && pack.frase_poder){
        S.pack=pack;
        qs("#esc-answer").innerHTML=renderPack(pack);
        const T=normalizeTemplates(pack, scTitle);
        S.templates=T;
        renderPhrases(pack, sc || {title: scTitle, type:'in-conversation'});
        const micro=pack.micro_accion_refinada || pack.micro_accion;
        if(micro) qs("#micro").value = fillPH(micro);
        out.textContent = `Actualizado.\n\nFrase de poder:\n${S.lastFrase}\n\nSugerencia de micro‑acción:\n${fillPH(micro||'—')}`;
      }else{
        out.textContent="No se pudo refinar ahora. Intenta nuevamente.";
      }
    }catch(e){
      out.textContent="No pudimos conectar con la IA ahora. Intenta de nuevo en unos segundos.";
    }
  }

})();
