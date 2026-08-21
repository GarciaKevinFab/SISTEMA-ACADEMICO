// El caso real: /academic/careers responde {careers:[...]} y el selector de
// programas hacía .map() sobre el objeto -> "map is not a function".
import { comoLista } from "./lista";

describe("comoLista", () => {
    it("desenvuelve la clave conocida", () => {
        expect(comoLista({ careers: [{ id: 1 }] }, ["careers"])).toHaveLength(1);
        expect(comoLista({ items: [1, 2] }, ["items"])).toHaveLength(2);
        expect(comoLista({ results: [1, 2, 3] }, ["items", "results"])).toHaveLength(3);
    });

    it("deja pasar un array pelado", () => {
        expect(comoLista([{ id: 1 }, { id: 2 }])).toHaveLength(2);
    });

    it("cae a una clave desconocida que sí sea array", () => {
        expect(comoLista({ ok: true, data: [9] }, ["careers"])).toEqual([9]);
    });

    it("nunca devuelve algo que no se pueda recorrer", () => {
        for (const entrada of [null, undefined, "texto", 7, {}, { ok: true }]) {
            const r = comoLista(entrada, ["careers"]);
            expect(Array.isArray(r)).toBe(true);
            expect(r).toHaveLength(0);
        }
    });
});
