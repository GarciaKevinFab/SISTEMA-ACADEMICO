import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "../../utils/safeToast";
import { CashBanks } from "../../services/finance.service";

export default function AddCashMovementDialog({ open, onOpenChange, sessionId, onCreated }) {
    const [type, setType] = useState("IN");
    const [amount, setAmount] = useState("0");
    const [concept, setConcept] = useState("");
    const [saving, setSaving] = useState(false);

    const amountNumber = useMemo(() => {
        const n = Number(amount);
        return Number.isFinite(n) ? n : NaN;
    }, [amount]);

    const canSubmit = !!sessionId && (type === "IN" || type === "OUT") && Number.isFinite(amountNumber) && amountNumber > 0 && !saving;

    const submit = async () => {
        if (!canSubmit) return;

        try {
            setSaving(true);
            const payload = {
                type,
                amount: amountNumber,
                concept: concept?.trim() || "",
            };

            await CashBanks.addMovement(sessionId, payload);
            toast.success("Movimiento registrado ✅");
            onCreated?.();
            onOpenChange(false);

            setType("IN");
            setAmount("0");
            setConcept("");
        } catch (e) {
            toast.error(e?.message || "No se pudo registrar el movimiento");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Nuevo movimiento</DialogTitle>
                    <DialogDescription>Registra un ingreso o egreso para la sesión de caja.</DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <Label>Tipo</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="IN">Ingreso</SelectItem>
                                <SelectItem value="OUT">Egreso</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Monto</Label>
                        <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                        {!Number.isFinite(amountNumber) && <p className="text-xs text-destructive mt-1">Monto inválido</p>}
                    </div>

                    <div>
                        <Label>Concepto (opcional)</Label>
                        <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej: Pago matrícula" />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={submit} disabled={!canSubmit}>
                        {saving ? "Guardando..." : "Guardar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
