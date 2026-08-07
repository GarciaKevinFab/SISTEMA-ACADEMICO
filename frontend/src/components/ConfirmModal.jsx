// ConfirmModal — reemplazo de window.confirm() con modal propio del sistema.
// Uso:
//   const [confirmData, setConfirmData] = useState(null);
//   setConfirmData({ title?, message, confirmLabel?, onConfirm });
//   <ConfirmModal data={confirmData} onClose={() => setConfirmData(null)} />
import React from "react";
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
    AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

export default function ConfirmModal({ data, onClose }) {
    return (
        <AlertDialog open={!!data} onOpenChange={(v) => { if (!v) onClose?.(); }}>
            <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>{data?.title || "¿Confirmar acción?"}</AlertDialogTitle>
                    <AlertDialogDescription>{data?.message}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl" onClick={onClose}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        className="rounded-xl"
                        onClick={() => { const fn = data?.onConfirm; onClose?.(); fn?.(); }}
                    >
                        {data?.confirmLabel || "Confirmar"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
