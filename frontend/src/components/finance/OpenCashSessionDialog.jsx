import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { toast } from "../../utils/safeToast";
import { CashBanks } from "../../services/finance.service";

export default function OpenCashSessionDialog({ open, onOpenChange, onCreated }) {
    const [openingAmount, setOpeningAmount] = useState("0");
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);

    const openingNumber = useMemo(() => {
        const n = Number(openingAmount);
        return Number.isFinite(n) ? n : NaN;
    }, [openingAmount]);

    const canSubmit = Number.isFinite(openingNumber) && openingNumber >= 0 && !saving;

    const submit = async () => {
        if (!canSubmit) return;

        try {
            setSaving(true);

            const payload = {
                opening_amount: openingNumber,
                note: note?.trim() || "",
            };

            const created = await CashBanks.openSession(payload);
            toast.success("Caja abierta ✅");
            onCreated?.(created);
            onOpenChange(false);

            setOpeningAmount("0");
            setNote("");
        } catch (e) {
            toast.error(e?.message || "No se pudo abrir caja");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Abrir caja</DialogTitle>
                    <DialogDescription>Registra el monto de apertura para iniciar una sesión.</DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <Label>Monto de apertura (PEN)</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={openingAmount}
                            onChange={(e) => setOpeningAmount(e.target.value)}
                            placeholder="0.00"
                        />
                        {!Number.isFinite(openingNumber) && <p className="text-xs text-destructive mt-1">Monto inválido</p>}
                    </div>

                    <div>
                        <Label>Nota (opcional)</Label>
                        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Turno mañana" />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={submit} disabled={!canSubmit}>
                        {saving ? "Abriendo..." : "Abrir caja"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
