// POLIZARIUM - SIDEBAR v1
// Maneja expandir/contraer y muestra modo invitado (futuro: login)

(function(){
  "use strict";

  function initSidebar(){
    const sidebar = document.getElementById("pz-sidebar");
    const toggle = document.getElementById("pz-sidebar-toggle");
    const avatar = document.getElementById("pz-user-avatar");
    const label = document.getElementById("pz-user-label");

    if (!sidebar || !toggle) return;

    // Estado inicial: colapsado
    // (puedes cambiar a expandido si prefieres)
    sidebar.classList.add("collapsed");

    // Expandir/contraer al hacer clic en el toggle
    toggle.addEventListener("click", ()=>{
      sidebar.classList.toggle("collapsed");
    });

    // Modo invitado por ahora
    if (avatar) avatar.textContent = "?";
    if (label) label.textContent = "Modo invitado";

    // Más adelante:
    // - si hay login, aquí podemos actualizar avatar y label
    // - si hay historial, podemos rellenar #pz-history-list
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSidebar);
  } else {
    initSidebar();
  }
})();
