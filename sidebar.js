// POLIZARIUM - SIDEBAR v1.2
// Desktop: barra fija, colapsable, empuja el dojoApp.
// Móvil: barra overlay controlada por hamburguesa.

(function(){
  "use strict";

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function applyLayoutAccordingSidebar(sidebar) {
    const dojoApp = document.getElementById("dojoApp");
    if (!dojoApp || !sidebar) return;

    if (isMobile()) {
      // En móvil, el contenido ocupa todo el ancho siempre
      dojoApp.style.marginLeft = "0";
      return;
    }

    // En desktop, ajustamos margen según estado colapsado/expandido
    if (sidebar.classList.contains("collapsed")) {
      dojoApp.style.marginLeft = "120px"; // coincide con .pz-sidebar.collapsed width
    } else {
      dojoApp.style.marginLeft = "260px"; // coincide con .pz-sidebar width
    }
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
    applyLayoutAccordingSidebar(sidebar);

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
        // Nos aseguramos de que no tenga "expanded" sobrando
        sidebar.classList.remove("expanded");
      }
      applyLayoutAccordingSidebar(sidebar);
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

    // Reajustar layout si el viewport cambia (por ej. rotación)
    window.addEventListener("resize", ()=>{
      applyLayoutAccordingSidebar(sidebar);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSidebar);
  } else {
    initSidebar();
  }
})();
