import React, { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Check, X, Loader2, GripVertical } from "lucide-react";
import { AdmissionModalities } from "../../services/admission.service";

export default function AdmissionModalitiesManagement() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const data = await AdmissionModalities.list();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Error al cargar modalidades");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return toast.error("Ingrese un nombre");
    try {
      setAdding(true);
      await AdmissionModalities.create({ name, order: items.length });
      setNewName("");
      toast.success("Modalidad creada");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al crear");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Eliminar "${name}"?`)) return;
    try {
      await AdmissionModalities.remove(id);
      toast.success("Modalidad eliminada");
      load();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async () => {
    const name = editName.trim();
    if (!name) return toast.error("El nombre es obligatorio");
    try {
      await AdmissionModalities.update(editingId, { name });
      toast.success("Modalidad actualizada");
      cancelEdit();
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al actualizar");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Modalidades de Admisión</h2>
        <p className="text-sm text-slate-500">Gestione las modalidades disponibles para postulación.</p>
      </div>

      {/* Agregar nueva */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Nueva modalidad</label>
          <Input
            placeholder="Ej: Ingreso Ordinario"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
        <Button onClick={handleAdd} disabled={adding || !newName.trim()} size="sm" className="h-9">
          {adding ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
          Agregar
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          No hay modalidades registradas. Agregue una arriba.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm"
            >
              <GripVertical size={14} className="text-slate-300 shrink-0" />

              {editingId === item.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="flex-1 h-8"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={saveEdit}>
                    <Check size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={cancelEdit}>
                    <X size={14} />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium text-slate-700">{item.name}</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => startEdit(item)}>
                    <Edit size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(item.id, item.name)}>
                    <Trash2 size={14} />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
