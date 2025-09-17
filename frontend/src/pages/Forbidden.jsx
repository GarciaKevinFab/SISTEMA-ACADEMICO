export default function Forbidden() {
    return (
        <div className="p-10 text-center">
            <h1 className="text-2xl font-semibold">403 — Acceso denegado</h1>
            <p className="text-muted-foreground mt-2">No tienes permisos para ver esta sección.</p>
        </div>
    );
}
