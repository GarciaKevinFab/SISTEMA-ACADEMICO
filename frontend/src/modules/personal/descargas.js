// Descarga de archivos protegidos por JWT.
//
// Un <a href="/api/..."> abre la URL en una pestaña nueva SIN el header
// Authorization, asi que el backend responde 401 y el usuario ve la pagina
// de error de DRF en vez de su PDF. Hay que pedirlo por axios (que si lleva
// el token) y entregar el blob al navegador.
import { toast } from "sonner";
import { api } from "../../lib/api";

export async function descargar(ruta, nombre) {
    try {
        const res = await api.get(ruta, { responseType: "blob" });
        const blob = res?.data instanceof Blob ? res.data : new Blob([res.data]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        return true;
    } catch (e) {
        // El detalle del error viaja como blob: hay que leerlo para mostrarlo.
        let msg = "No se pudo descargar el archivo";
        try {
            if (e?.response?.data instanceof Blob) {
                msg = JSON.parse(await e.response.data.text())?.detail || msg;
            } else {
                msg = e?.response?.data?.detail || msg;
            }
        } catch { /* se queda el mensaje generico */ }
        toast.error(msg);
        return false;
    }
}
