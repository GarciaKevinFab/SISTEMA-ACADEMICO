import React, { useState } from "react";
import { SecurityService } from "../../services/security.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";

const SecurityModule = () => {
    const [qr, setQr] = useState(null);
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
        } catch {
            toast.error("Código inválido");
        }
    };

   return (
        // HE AÑADIDO 'pb-32': Esto deja espacio abajo para que el botón flotante no tape nada
        <div className="p-4 md:p-6 pb-32 space-y-6 max-w-3xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Autenticación de Dos Factores (TOTP)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!qr ? (
                        <Button onClick={start} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                            Activar 2FA
                        </Button>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Escanee el QR con Google Authenticator/Authy y luego ingrese el código de 6 dígitos.
                            </p>
                            
                            {/* Imagen centrada y adaptable */}
                            <div className="flex justify-center my-4">
                                <img 
                                    alt="qr" 
                                    className="w-48 h-48 border rounded-lg p-2"
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr)}`} 
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Código de verificación</Label>
                                <Input 
                                    value={code} 
                                    onChange={e => setCode(e.target.value)} 
                                    placeholder="123456" 
                                    className="text-center text-lg tracking-widest"
                                />
                            </div>

                            {/* Botones apilados en móvil para evitar errores de clic */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button className="w-full sm:w-auto" onClick={verify}>
                                    Verificar
                                </Button>
                                <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setQr(null); setSecret(null); setCode(""); }}>
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="border-t pt-4"></div>

                    {/* Botones inferiores adaptables */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button 
                            variant="outline" 
                            className="w-full sm:w-auto text-wrap h-auto py-2"
                            onClick={async () => {
                                const { codes } = await SecurityService.getBackupCodes();
                                const blob = new Blob([codes.join("\n")], { type: "text/plain" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url; a.download = "backup-codes.txt"; a.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            Generar códigos de respaldo
                        </Button>

                        <Button 
                            variant="destructive"
                            className="w-full sm:w-auto"
                            onClick={async () => {
                                await SecurityService.disableMFA();
                                toast.success("2FA desactivado");
                            }}
                        >
                            Desactivar 2FA
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SecurityModule;
