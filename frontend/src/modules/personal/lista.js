// Los endpoints del proyecto no devuelven una forma única: unos responden
// el array pelado, otros lo envuelven ({careers: [...]}, {items: [...]},
// {results: [...]}). Asumir una sola forma y llamar .map() sobre el objeto
// envuelto revienta la pantalla con "map is not a function".
//
// comoLista() SIEMPRE devuelve un array: busca la primera clave conocida
// que contenga uno y, si no encuentra ninguna, entrega [] en vez de dejar
// pasar algo que no se puede recorrer.
export function comoLista(data, claves = ["items", "results", "rows"]) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];
    for (const k of claves) {
        if (Array.isArray(data[k])) return data[k];
    }
    // Última red: cualquier valor de primer nivel que sí sea un array.
    for (const v of Object.values(data)) {
        if (Array.isArray(v)) return v;
    }
    return [];
}
