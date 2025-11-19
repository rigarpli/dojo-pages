// POLIZARIUM - SIDEBAR v1.1
// Maneja expandir/contraer en desktop y overlay en móvil

(function(){
  "use strict";

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function initSidebar(){
    const sidebar = document.getElementById("pz-sidebar");
    const sidebarToggle = document.getElementById("pz-sidebar-toggle");
    const headerToggle = document.getElementById("pz-header-toggle");
    const avatar = document.getElementById("pz-user-avatar");
    const label = document.getElementById("pz-user-label");

    if (!sidebar) return;

    // Estado inicial: colapsado (desktop estrecho, mobile oculto)
    sidebar.classList.add("collapsed");

    function toggleSidebar() {
      if (isMobile()) {
        const isExpanded = sidebar.classList.toggle("expanded");
        if (isExpanded) {
          sidebar.classList.remove("collapsed");
        } else {
          sidebar.classList.add("collapsed");
        }
      } else {
        // Desktop: solo estrecho vs ancho
        sidebar.classList.toggle("collapsed");
      }
    }

    // Toggle interno (en la propia sidebar)
    if (sidebarToggle) {
      sidebarToggle.addEventListener("click", toggleSidebar);
    }

    // Toggle desde el header (hamburguesa)
    if (headerToggle) {
      headerToggle.addEventListener("click", toggleSidebar);
    }

    // Modo invitado
    if (avatar) avatar.textContent = "?";
    if (label) label.textContent = "Modo invitado";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSidebar);
  } else {
    initSidebar();
  }
})();
