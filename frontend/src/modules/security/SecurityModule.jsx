import React, { useState } from "react";
import { SecurityService } from "../../services/security.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, QrCode, Download, Trash2, Key } from "lucide-react";
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
   <div className="p-4 md:p-8 pb-32 space-y-8 max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
        
    {/* Encabezado fuera del Card para mayor limpieza */}
    <div className="flex items-center gap-4 mb-2">
        <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
            <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Seguridad de la Cuenta</h2>
            <p className="text-sm text-white font-medium opacity-90">Proteja su acceso con autenticación de doble factor</p>
        </div>
    </div>

        <Card className="border-none shadow-xl shadow-slate-200/60 overflow-hidden bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b border-slate-50 bg-slate-50/30 pb-6">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                    <Key className="h-4 w-4 text-blue-500" />
                    Configuración TOTP
                </CardTitle>
            </CardHeader>

            <CardContent className="p-6 md:p-8 space-y-8">
                
                {!qr ? (
                    <div className="flex flex-col items-center py-6 text-center space-y-4">
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
                            <QrCode className="h-10 w-10 text-blue-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-bold text-slate-800">El 2FA no está activo</h3>
                            <p className="text-sm text-slate-500 max-w-xs">Añada una capa extra de seguridad para evitar accesos no autorizados.</p>
                        </div>
                        <Button 
                            onClick={start} 
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 rounded-xl px-8 transition-all active:scale-95"
                        >
                            Comenzar Activación
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in slide-in-from-bottom-4">
                        <div className="flex gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800">
                            <ShieldAlert className="h-5 w-5 shrink-0" />
                            <p className="text-sm font-medium leading-relaxed">
                                Escanee el código QR con una aplicación como <span className="font-bold">Google Authenticator</span> o <span className="font-bold">Authy</span>.
                            </p>
                        </div>
                        
                        {/* QR Refinado */}
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-2xl blur opacity-75"></div>
                                <div className="relative bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                                    <img 
                                        alt="qr" 
                                        className="w-48 h-48"
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr)}`} 
                                    />
                                </div>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Código de Registro Único</span>
                        </div>

                        <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <div className="space-y-2 text-center">
                                <Label className="text-slate-700 font-bold">Ingrese el código de 6 dígitos</Label>
                                <Input 
                                    value={code} 
                                    onChange={e => setCode(e.target.value)} 
                                    placeholder="000 000" 
                                    maxLength={6}
                                    className="text-center text-3xl font-black tracking-[0.5em] h-16 bg-white border-slate-200 rounded-xl focus:ring-blue-100 focus:border-blue-400 transition-all shadow-inner"
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <Button className="w-full sm:w-auto flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold" onClick={verify}>
                                    Confirmar y Activar
                                </Button>
                                <Button variant="ghost" className="w-full sm:w-auto rounded-xl text-slate-500" onClick={() => { setQr(null); setSecret(null); setCode(""); }}>
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sección de Respaldo y Peligro */}
                <div className="pt-6 border-t border-slate-100 space-y-4">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <Button 
                            variant="outline" 
                            className="w-full sm:w-auto flex-1 h-auto py-3 px-6 rounded-xl border-slate-200 hover:bg-slate-50 hover:text-slate-900 group transition-all"
                            onClick={async () => {
                                const { codes } = await SecurityService.getBackupCodes();
                                const blob = new Blob([codes.join("\n")], { type: "text/plain" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url; a.download = "backup-codes.txt"; a.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            <Download className="h-4 w-4 mr-2 text-slate-400 group-hover:text-blue-500 transition-colors" />
                            Descargar códigos de respaldo
                        </Button>

                        <Button 
                            variant="ghost"
                            className="w-full sm:w-auto px-6 h-12 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium"
                            onClick={async () => {
                                await SecurityService.disableMFA();
                                toast.success("2FA desactivado correctamente");
                            }}
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Desactivar
                        </Button>
                    </div>
                    
                    <p className="text-[11px] text-center text-slate-400 font-medium">
                        Si pierde acceso a su dispositivo móvil, podrá entrar usando los códigos de respaldo.
                    </p>
                </div>
            </CardContent>
        </Card>
    </div>
);
};

export default SecurityModule;
