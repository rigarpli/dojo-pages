// Versión PRO propuesta del app.js — estructura limpia, modular y con efectos fluidos
// NOTA: Esta es una base optimizada y pulida. No incluye tus estilos CSS ni HTML,
// pero está diseñada para conectarse exactamente igual a tu worker actual.

(function(){
  "use strict";

  console.log("🔥 Polizarium PRO — app.js optimizado y unificado");

  // ================================
  // CONFIG
  // ================================
  const API = "https://index.rgarciaplicet.workers.dev/";
  const CONTENT_URL = `./content.full.json`;

  // ================================
  // ESTADO GLOBAL
  // ================================
  const S = {
    nombre: "",
    cliente: "",
    areaId: "",
    areaTitle: "",
    scenId: "",
    content: null,
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
  const esc = (s="") => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

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
    try { data = JSON.parse(text); } catch(e) {
      return `<p class='muted'>❌ JSON inválido</p>`;
    }
    const r = data.revelacion;
    return `
      <div class="feedback-animated">
        <div class="feedback-section" style="animation-delay:0ms;">
          <strong>✨ LO QUE TU FRASE YA CONTENÍA:</strong><br>
          ${esc(r.lo_que_contenia)}
        </div>
        <div class="feedback-section" style="animation-delay:500ms;">
          <strong>🗣️ TU MENSAJE, PERFECCIONADO:</strong><br>
          “${esc(r.frase_afinada)}”
        </div>
        <div class="feedback-section" style="animation-delay:1000ms;">
          <strong>🔑 TU SUPERPODER:</strong><br>
          ${esc(r.llave_maestra)}
        </div>
      </div>`;
  }

  // ================================
  // NAVEGACIÓN
  // ================================
  let currentStep = "p0";
  function go(id){
    qsa(".step").forEach(x=>x.classList.remove("active"));
    qs(`#${id}`)?.classList.add("active");
    currentStep = id;
    window.scrollTo({top:0, behavior:"smooth"});
  }

  // ================================
  // CONTENIDO
  // ================================
  function startFetchContent(){
    if(contentReady || contentFetching) return;
    contentFetching = true;

    fetch(CONTENT_URL)
      .then(r => r.json())
      .then(data => {
        S.content = data;
        contentReady = true;
      })
      .catch(err => console.error("Error cargando contenido", err))
      .finally(()=> contentFetching=false);
  }

  function buildAreas(){
    const grid = qs("#areas-grid"); if(!grid) return;
    const areas = S.content?.areas || [];
    grid.innerHTML = "";

    areas.forEach(a=>{
      const d = document.createElement("div");
      d.className="area-card";
      d.dataset.area=a.id;
      d.innerHTML=`<div class='area-title'>${a.icon||"📌"} ${esc(a.title)}</div>`;
      grid.appendChild(d);
    });
  }

  async function buildScenarios(){
    const indexR = await fetch(`/content/areas/${S.areaId}/index.json`);
    const index = await indexR.json();

    const promises = index.scenarioIds.map(async id=>{
      const r = await fetch(`/content/areas/${S.areaId}/${id}.json`);
      if(r.ok) return await r.json();
      return null;
    });

    S.scenarios = (await Promise.all(promises)).filter(Boolean);

    const grid = qs("#scen-grid");
    grid.innerHTML="";
    S.scenarios.forEach(sc=>{
      const d = document.createElement("div");
      d.className="sc-card";
      d.dataset.scenario = sc.id;
      d.innerHTML = `
        <div class='sc-title'>${esc(sc.title)}</div>
        <p>${esc(sc.question)}</p>
      `;
      grid.appendChild(d);
    });
  }

  function buildScenarioView(sid){
    const sc = S.scenarios.find(x=>x.id===sid);
    if(!sc) return;

    qs("#esc-title").textContent = sc.title;
    qs("#esc-question").textContent = sc.question;

    const box = qs("#esc-options");
    box.innerHTML = `
      <textarea id='user-response' rows='4' placeholder='Escribe tu respuesta real...'></textarea>
      <button class='btn primary' id='reveal-adn'>Revelar mi ADN</button>
    `;
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
      ans.innerHTML = renderFeedback(pack.feedback);
    } catch(e){
      ans.innerHTML = `<p class='muted'>❌ Error generando</p>`;
    }
  }

  // ================================
  // EVENTOS
  // ================================
  function wireEvents(){
    qs("#start")?.addEventListener("click", ()=>{
      S.nombre = qs("#nombre").value.trim();
      S.cliente = qs("#cliente").value.trim();
      go("p1");
      buildAreas();
    });

    document.addEventListener("click", e=>{
      const t = e.target;

      if(t.closest(".area-card")){
        const id = t.closest(".area-card").dataset.area;
        const area = S.content.areas.find(a=>a.id===id);
        S.areaId = id;
        S.areaTitle = area.title;
        buildScenarios();
        go("p3");
        return;
      }

      if(t.closest(".sc-card")){
        const id = t.closest(".sc-card").dataset.scenario;
        S.scenId = id;
        buildScenarioView(id);
        go("p4");
        return;
      }

      if(t.id === "reveal-adn"){
        const userResponse = qs("#user-response").value.trim();
        if(!userResponse){ alert("Escribe tu respuesta"); return; }
        const sc = S.scenarios.find(x=>x.id===S.scenId);
        runPlay(sc, userResponse);
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
