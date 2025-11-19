// POLIZARIUM - SIDEBAR v1.1
// Maneja expandir/contraer en desktop y overlay en móvil

(function(){
  "use strict";

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function initSidebar(){
    const sidebar = document.getElementById("pz-sidebar");
    const toggle = document.getElementById("pz-sidebar-toggle");
    const avatar = document.getElementById("pz-user-avatar");
    const label = document.getElementById("pz-user-label");

    if (!sidebar || !toggle) return;

    // Estado inicial:
    // - Desktop: colapsado (estrecho)
    // - Mobile: colapsado (oculto fuera de la pantalla)
    sidebar.classList.add("collapsed");

    toggle.addEventListener("click", ()=>{
      if (isMobile()) {
        // En móvil, togglear "expanded" para overlay
        const isExpanded = sidebar.classList.toggle("expanded");
        if (isExpanded) {
          sidebar.classList.remove("collapsed");
        } else {
          sidebar.classList.add("collapsed");
        }
      } else {
        // En desktop, solo togglear "collapsed" (estrecho vs ancho)
        sidebar.classList.toggle("collapsed");
      }
    });

    // Modo invitado por ahora
    if (avatar) avatar.textContent = "?";
    if (label) label.textContent = "Modo invitado";

    // TODO futuro:
    // - Si hay login, actualizar avatar (inicial) y label (correo/nombre)
    // - Si hay historial, rellenar #pz-history-list
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSidebar);
  } else {
    initSidebar();
  }
})();
