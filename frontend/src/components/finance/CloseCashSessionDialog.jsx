import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { toast } from "../../utils/safeToast";
import { CashBanks } from "../../services/finance.service";

export default function CloseCashSessionDialog({ open, onOpenChange, sessionId, suggestedClosingAmount = 0, onClosed }) {
    const [closingAmount, setClosingAmount] = useState(String(suggestedClosingAmount ?? 0));
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);

    const closingNumber = useMemo(() => {
        const n = Number(closingAmount);
        return Number.isFinite(n) ? n : NaN;
    }, [closingAmount]);

    const canSubmit = !!sessionId && Number.isFinite(closingNumber) && closingNumber >= 0 && !saving;

    const submit = async () => {
        if (!canSubmit) return;

        try {
            setSaving(true);
            const payload = {
                closing_amount: closingNumber,
                note: note?.trim() || "",
            };

            await CashBanks.closeSession(sessionId, payload);
            toast.success("Caja cerrada ✅");
            onClosed?.();
            onOpenChange(false);

            setNote("");
        } catch (e) {
            toast.error(e?.message || "No se pudo cerrar caja");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Cerrar caja</DialogTitle>
                    <DialogDescription>Ingresa el monto final y cierra la sesión.</DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <Label>Monto de cierre</Label>
                        <Input type="number" min="0" step="0.01" value={closingAmount} onChange={(e) => setClosingAmount(e.target.value)} />
                        {!Number.isFinite(closingNumber) && <p className="text-xs text-destructive mt-1">Monto inválido</p>}
                    </div>

                    <div>
                        <Label>Nota (opcional)</Label>
                        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: arqueo OK, sin diferencias" />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={submit} disabled={!canSubmit}>
                        {saving ? "Cerrando..." : "Cerrar caja"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
