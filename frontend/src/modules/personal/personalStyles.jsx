// Estilos del módulo Personal.
//
// Nota histórica: este archivo nació para neutralizar `modules/academic/
// styles.css`, una hoja heredada que aplicaba reglas globales con
// `!important` sobre `main`, `header`, `input`, `select`, `textarea`,
// `button` y `table` en TODA la aplicación. Esa hoja ya quedó acotada a
// `.legacy-academic`, así que aquí solo quedan cosas propias del módulo:
//
//   · las clases de color de los botones (los botones del módulo no llevan
//     clases `bg-*` de Tailwind, se pintan desde aquí);
//   · el alto de los modales, que es un arreglo de layout real: sin
//     `min-height:0` el hijo flex no encoge y el modal se desborda de la
//     pantalla en vez de hacer scroll interno.
import { useEffect } from "react";

export const SCOPE = "adm-scope";

const NAVY = "#1F4E79";

const CSS = `
/* ── Botones del módulo ── */
/* Sin \`color: inherit\`: ModuleShell pone \`color:#FFFFFF\` en su raíz y los
   botones del pie del modal salían en blanco sobre fondo claro. Al no
   declarar color, mandan las clases \`text-*\` de cada botón. */
.adm-scope .adm-plain,
.adm-scope .adm-ghost { background-color: transparent; }
.adm-scope .adm-ghost:hover { background-color: #F1F5F9; }

.adm-scope .adm-primary { background-color: ${NAVY}; color: #FFFFFF; }
.adm-scope .adm-primary:hover:not(:disabled) { background-color: #17395A; }
.adm-scope .adm-primary:disabled { opacity: 0.55; }

.adm-scope .adm-soft { background-color: #EFF6FF; color: #1D4ED8; }
.adm-scope .adm-soft:hover { background-color: #DBEAFE; }

.adm-scope .adm-outline { background-color: #FFFFFF; color: #475569; }
.adm-scope .adm-outline:hover:not(:disabled) { background-color: #F8FAFC; }
.adm-scope .adm-outline:disabled { opacity: 0.55; }

.adm-scope .adm-danger { background-color: transparent; color: #DC2626; }
.adm-scope .adm-danger:hover { background-color: #FEF2F2; }

/* Píldoras del hero público (sobre fondo azul marino) */
.adm-scope .adm-chip { background-color: rgba(255, 255, 255, 0.12); color: #FFFFFF; }
.adm-scope .adm-chip:hover { background-color: rgba(255, 255, 255, 0.22); }

/* ── Modales ──
   Se montan con portal a <body> a propósito: la tarjeta de ModuleShell lleva
   \`backdrop-blur\`, y un backdrop-filter crea un containing block para los
   descendientes \`position: fixed\`. Dentro de ella el overlay se anclaba a la
   tarjeta (miles de píxeles de alto) en vez de a la pantalla, y el modal
   quedaba centrado fuera de cuadro: se veía cortado por arriba. */
.adm-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(6px);
}
.adm-modal { max-height: calc(100dvh - 2rem); }
.adm-modal-body {
  min-height: 0;          /* sin esto el hijo flex no encoge y se desborda */
  overflow-y: auto;
  overscroll-behavior: contain;
}
`;

export function InjectPersonalStyles() {
    useEffect(() => {
        const id = "personal-module-styles";
        if (document.getElementById(id)) return;
        const s = document.createElement("style");
        s.id = id;
        s.textContent = CSS;
        document.head.appendChild(s);
    }, []);
    return null;
}
