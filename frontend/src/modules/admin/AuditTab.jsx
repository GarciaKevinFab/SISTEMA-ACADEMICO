// src/modules/admin/AuditTab.jsx
import React, { useEffect, useState } from "react";
import { AuditService } from "../../services/audit.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

const AuditTab = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        q: "", actor: "", action: "", entity: "",
        from: "", to: ""
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await AuditService.list(filters);
            setRows(data?.logs ?? data ?? []);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bitácora / Auditoría</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid md:grid-cols-6 gap-2">
                    <div className="md:col-span-2">
                        <Label>Texto libre</Label>
                        <Input value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} />
                    </div>
                    <div>
                        <Label>Actor</Label>
                        <Input value={filters.actor} onChange={e => setFilters({ ...filters, actor: e.target.value })} />
                    </div>
                    <div>
                        <Label>Acción</Label>
                        <Input placeholder="create/update/delete/login..." value={filters.action}
                            onChange={e => setFilters({ ...filters, action: e.target.value })} />
                    </div>
                    <div>
                        <Label>Entidad</Label>
                        <Input placeholder="user, role, applicant..." value={filters.entity}
                            onChange={e => setFilters({ ...filters, entity: e.target.value })} />
                    </div>
                    <div className="flex items-end gap-2">
                        <Button variant="outline" onClick={() => { setFilters({ q: "", actor: "", action: "", entity: "", from: "", to: "" }); }}>
                            Limpiar
                        </Button>
                        <Button onClick={fetchData}>Buscar</Button>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-2">
                    <div>
                        <Label>Desde</Label>
                        <Input type="datetime-local" value={filters.from}
                            onChange={e => setFilters({ ...filters, from: e.target.value })} />
                    </div>
                    <div>
                        <Label>Hasta</Label>
                        <Input type="datetime-local" value={filters.to}
                            onChange={e => setFilters({ ...filters, to: e.target.value })} />
                    </div>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-2 text-left">Fecha</th>
                                <th className="p-2 text-left">Actor</th>
                                <th className="p-2 text-left">Acción</th>
                                <th className="p-2 text-left">Entidad</th>
                                <th className="p-2 text-left">Detalle</th>
                                <th className="p-2 text-left">IP</th>
                                <th className="p-2 text-left">ReqId</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && <tr><td className="p-3 text-center" colSpan={7}>Cargando…</td></tr>}
                            {!loading && rows.length === 0 && <tr><td className="p-3 text-center" colSpan={7}>Sin registros</td></tr>}
                            {rows.map((r, i) => (
                                <tr key={i} className="border-t">
                                    <td className="p-2">{new Date(r.timestamp || r.created_at).toLocaleString()}</td>
                                    <td className="p-2">{r.actor_name || r.actor_id}</td>
                                    <td className="p-2">{r.action}</td>
                                    <td className="p-2">{r.entity}{r.entity_id ? `#${r.entity_id}` : ""}</td>
                                    <td className="p-2">{r.summary || r.detail}</td>
                                    <td className="p-2">{r.ip}</td>
                                    <td className="p-2">{r.request_id}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

export default AuditTab;
