// POLIZARIUM - SIDEBAR v1.2
// Desktop: barra fija, colapsable, empuja el dojoApp.
// Móvil: barra overlay controlada por hamburguesa.

(function(){
  "use strict";

  function isMobile() {
    return window.matchMedia("(max-width: 820px)").matches;
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
      dojoApp.style.marginLeft = "115px"; // coincide con .pz-sidebar.collapsed width
    } else {
      dojoApp.style.marginLeft = "260px"; // coincide con .pz-sidebar width
    }
  }

  function initSidebar(){
    const sidebar      = document.getElementById("pz-sidebar");
    const sidebarToggle = document.getElementById("pz-sidebar-toggle");
    const headerToggle  = document.getElementById("pz-header-toggle");
    const avatar       = document.getElementById("pz-user-avatar");
    const label        = document.getElementById("pz-user-label");
    const guideBtn     = document.getElementById("pz-action-guide");
    const historyBtn   = document.getElementById("pz-action-history");


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

    // Click en Historial: si la barra está colapsada, expandirla
if (historyBtn) {
  historyBtn.addEventListener("click", () => {
    // En móvil o desktop, usar el mismo toggle
    if (sidebar.classList.contains("collapsed")) {
      toggleSidebar(); // expandirá la barra y ajustará layout
    }
    // (Opcionalmente en el futuro podríamos hacer scroll al bloque de historial)
  });
}

    // Enlace a Guía del dojo
    if (guideBtn) {
      guideBtn.addEventListener("click", ()=>{
        // Usar go("p8") expuesto en window desde app.js
        if (typeof window.go === "function") {
          window.go("p8");
        } else {
          // Fallback simple: cambiar el hash
          location.hash = "#p8";
        }

        // En móvil, si la barra está overlay, la cerramos al ir a Guía
        if (isMobile() && sidebar.classList.contains("expanded")) {
          sidebar.classList.remove("expanded");
          sidebar.classList.add("collapsed");
          applyLayoutAccordingSidebar(sidebar);
        }
      });
    }

    // Modo invitado
    if (avatar) avatar.textContent = "😎";
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
