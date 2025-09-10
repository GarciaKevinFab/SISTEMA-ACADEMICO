// src/modules/security/SecurityModule.jsx
import React, { useState } from "react";
import { SecurityService } from "../../services/security.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";

const SecurityModule = () => {
    const [qr, setQr] = useState(null);       // otpauth_url -> muéstralo como <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}`} />
    const [secret, setSecret] = useState(null);
    const [code, setCode] = useState("");

    const start = async () => {
        const data = await SecurityService.startMFASetup();
        setQr(data.otpauth_url);
        setSecret(data.secret);
    };
    const verify = async () => {
        try {
            await SecurityService.verifyMFASetup(code);
            toast.success("2FA activado");
            setQr(null); setSecret(null); setCode("");
        } catch { toast.error("Código inválido"); }
    };

    return (
        <div className="p-6 space-y-6">
            <Card>
                <CardHeader><CardTitle>Autenticación de Dos Factores (TOTP)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {!qr ? (
                        <Button onClick={start} className="bg-blue-600 hover:bg-blue-700">Activar 2FA</Button>
                    ) : (
                        <>
                            <p className="text-sm text-gray-600">Escanee el QR con Google Authenticator/Authy y luego ingrese el código de 6 dígitos.</p>
                            <img alt="qr" className="w-40 h-40"
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr)}`} />
                            <div>
                                <Label>Código de verificación</Label>
                                <Input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={verify}>Verificar</Button>
                                <Button variant="outline" onClick={() => { setQr(null); setSecret(null); setCode(""); }}>Cancelar</Button>
                            </div>
                        </>
                    )}

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={async () => {
                            const { codes } = await SecurityService.getBackupCodes();
                            const blob = new Blob([codes.join("\n")], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url; a.download = "backup-codes.txt"; a.click();
                            URL.revokeObjectURL(url);
                        }}>Generar códigos de respaldo</Button>

                        <Button variant="outline" onClick={async () => {
                            await SecurityService.disableMFA();
                            toast.success("2FA desactivado");
                        }}>Desactivar 2FA</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SecurityModule;
