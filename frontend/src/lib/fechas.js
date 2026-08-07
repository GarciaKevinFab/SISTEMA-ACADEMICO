/* ═══════════════════════════════════════════════════════════════
   Fechas con hora — conversión para <input type="datetime-local">

   El backend guarda y devuelve las fechas en UTC (ISO con zona). El input
   `datetime-local` trabaja SIEMPRE en hora local y sin zona, así que hay que
   convertir en los dos sentidos.

   Cortar el ISO con `.slice(0, 16)` NO sirve: muestra la hora UTC como si
   fuera local. En Lima (UTC-5) eso corría todo 5 horas — y como al guardar el
   valor se reinterpretaba como hora local, cada vez que se abría y guardaba la
   ventana se desplazaba 5 horas más. Era el motivo de que "se cambie sola".
   ═══════════════════════════════════════════════════════════════ */

const pad = (n) => String(n).padStart(2, "0");

/** ISO del backend → "YYYY-MM-DDTHH:MM" en hora local, para el input. */
export function isoALocal(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        + `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor del input (hora local, sin zona) → ISO con zona, para el backend.
 *  Se manda con zona explícita para que el servidor no tenga que adivinarla. */
export function localAIso(valor) {
    if (!valor) return null;
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO → texto legible en hora local ("06/08/2026, 23:59"). */
export function fechaHoraLegible(iso, opciones = {}) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("es-PE", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", ...opciones,
    });
}
