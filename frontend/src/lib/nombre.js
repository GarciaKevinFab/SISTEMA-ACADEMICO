/* ═══════════════════════════════════════════════════════════════
   Nombre del estudiante — un solo formato en todo el frontend.

   Formato oficial (Nómina de Matrícula / actas MINEDU):
       "APELLIDOS, NOMBRES"

   Antes cada pantalla lo armaba a su manera: la de Traslados imprimía
   "{nombres} {apellidoPaterno} {apellidoMaterno}" con la caja tal cual venía
   de la base, así que se veía "Melisa CONDOR MACHACUAY" junto a
   "KEYSI ARACELI ESCOBAR HUALLPA". El backend equivalente está en
   backend/students/name_utils.py
   ═══════════════════════════════════════════════════════════════ */

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim().toUpperCase();

/** Acepta las tres formas en que el backend nombra los campos:
 *  snake_case (apellido_paterno), camelCase (apellidoPaterno) y
 *  el par first_name / last_name (donde last_name ya trae ambos apellidos). */
export function apellidosDe(p = {}) {
    const pat = p.apellidoPaterno ?? p.apellido_paterno ?? p.last_name ?? "";
    const mat = p.apellidoMaterno ?? p.apellido_materno ?? "";
    return norm(`${pat} ${mat}`);
}

export function nombresDe(p = {}) {
    return norm(p.nombres ?? p.first_name ?? "");
}

/** "APELLIDOS, NOMBRES" — usar en listados, actas, registros y selectores. */
export function nombreOficial(p = {}) {
    const ap = apellidosDe(p);
    const no = nombresDe(p);
    if (ap && no) return `${ap}, ${no}`;
    // Sin campos estructurados: caer al nombre ya armado que traiga el backend
    return ap || no || norm(p.nombre ?? p.full_name ?? p.nombre_completo ?? "");
}
