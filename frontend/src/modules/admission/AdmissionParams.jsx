// src/modules/admission/AdmissionParams.jsx
//
// Propósito: Plantilla de valores por defecto que se pre-llenan
// al crear una nueva convocatoria + configuración institucional global.
//
// Cada convocatoria puede ajustar sus valores individualmente.

import React, { useEffect, useState } from "react";
import { AdmissionParams } from "../../services/admission.service";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { Settings, Save, RotateCcw, GraduationCap, Globe, KeyRound } from "lucide-react";

const ALL_DOCS = [
    { value: "FOTO_CARNET", label: "Fotografía tamaño carné" },
    { value: "COPIA_DNI", label: "Copia de DNI" },
    { value: "PARTIDA_NACIMIENTO", label: "Partida de Nacimiento" },
    { value: "CERTIFICADO_ESTUDIOS", label: "Certificado de Estudios" },
    { value: "CARNET_CONADIS", label: "Carné CONADIS (si aplica)" },
];

/* Mapeo de códigos viejos → nuevos para migración automática */
const LEGACY_CODE_MAP = {
    PHOTO: "FOTO_CARNET",
    DNI_COPY: "COPIA_DNI",
    BIRTH_CERTIFICATE: "PARTIDA_NACIMIENTO",
    STUDY_CERTIFICATE: "CERTIFICADO_ESTUDIOS",
    CONADIS_COPY: "CARNET_CONADIS",
};

const migrateCodes = (arr) => {
    if (!Array.isArray(arr)) return [];
    const migrated = arr.map((code) => LEGACY_CODE_MAP[code] || code);
    return [...new Set(migrated)]; // eliminar duplicados
};

const DEFAULT_PARAMS = {
    // Plantilla convocatorias
    default_min_age: 16,
    default_max_age: 35,
    default_fee: 0,
    default_max_applications: 1,
    default_required_documents: ["FOTO_CARNET", "COPIA_DNI", "PARTIDA_NACIMIENTO", "CERTIFICADO_ESTUDIOS"],
    // Institucional
    institution_name: "",
    institution_code: "",
    results_public_message: "Los resultados serán publicados en la fecha indicada.",
    // Credenciales
    auto_generate_credentials: true,
    credential_password_length: 8,
};

const normalize = (raw) => ({
    ...DEFAULT_PARAMS,
    ...(raw || {}),
    default_required_documents: migrateCodes(
        Array.isArray(raw?.default_required_documents)
            ? raw.default_required_documents
            : DEFAULT_PARAMS.default_required_documents
    ),
});

export default function AdmissionParamsModule() {
    const [params, setParams] = useState(DEFAULT_PARAMS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        AdmissionParams.get()
            .then((d) => setParams(normalize(d)))
            .catch(() => setParams(normalize(null)))
            .finally(() => setLoading(false));
    }, []);

    const setField = (key, val) => setParams((p) => ({ ...p, [key]: val }));

    const toggleDoc = (docValue) => {
        setParams((p) => {
            const list = p.default_required_documents || [];
            return {
                ...p,
                default_required_documents: list.includes(docValue)
                    ? list.filter((x) => x !== docValue)
                    : [...list, docValue],
            };
        });
    };

    const save = async () => {
        setSaving(true);
        try {
            await AdmissionParams.save(params);
            toast.success("Configuración guardada");
        } catch {
            toast.error("Error al guardar configuración");
        } finally {
            setSaving(false);
        }
    };

    const reset = () => {
        setParams(normalize(null));
        toast.info("Valores restaurados a los predeterminados");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    const reqDocs = params.default_required_documents || [];

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            {/* Header */}
            <div className="pb-4">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <Settings className="h-7 w-7 text-blue-600" />
                    Configuración de Admisión
                </h2>
                <p className="text-gray-500 mt-1 text-sm">
                    Estos valores se usarán como plantilla al crear nuevas
                    convocatorias. Cada convocatoria puede ajustarlos individualmente.
                </p>
            </div>

            {/* ══════════════════════════════════════════ */}
            {/* SECCIÓN 1: Datos Institucionales          */}
            {/* ══════════════════════════════════════════ */}
            <Card className="border shadow-sm rounded-xl">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-gray-700 flex items-center gap-2">
                        <Globe className="h-4 w-4 text-blue-500" />
                        Datos de la Institución
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Nombre de la institución
                            </Label>
                            <Input
                                value={params.institution_name}
                                onChange={(e) => setField("institution_name", e.target.value)}
                                placeholder="IESPP Gustavo Allende Llavería"
                                className="h-11 border-gray-300 rounded-xl"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Código modular
                            </Label>
                            <Input
                                value={params.institution_code}
                                onChange={(e) => setField("institution_code", e.target.value)}
                                placeholder="Ej: 1105014"
                                className="h-11 border-gray-300 rounded-xl"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Mensaje público de resultados
                        </Label>
                        <textarea
                            rows={2}
                            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm resize-none focus:ring-1 focus:ring-blue-200 focus:border-blue-400"
                            value={params.results_public_message}
                            onChange={(e) => setField("results_public_message", e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* ══════════════════════════════════════════ */}
            {/* SECCIÓN 2: Plantilla para convocatorias   */}
            {/* ══════════════════════════════════════════ */}
            <Card className="border shadow-sm rounded-xl">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-gray-700 flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-blue-500" />
                        Valores por Defecto — Nueva Convocatoria
                    </CardTitle>
                    <p className="text-xs text-gray-500 mt-1">
                        Estos valores se pre-llenarán automáticamente al crear una nueva convocatoria.
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Edad mínima</Label>
                            <Input type="number" className="h-11 border-gray-300 rounded-xl"
                                value={params.default_min_age}
                                onChange={(e) => setField("default_min_age", parseInt(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Edad máxima</Label>
                            <Input type="number" className="h-11 border-gray-300 rounded-xl"
                                value={params.default_max_age}
                                onChange={(e) => setField("default_max_age", parseInt(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Costo inscripción (S/.)</Label>
                            <Input type="number" step="0.01" className="h-11 border-gray-300 rounded-xl"
                                value={params.default_fee}
                                onChange={(e) => setField("default_fee", parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Máx. postulaciones</Label>
                            <Input type="number" min="1" max="5" className="h-11 border-gray-300 rounded-xl"
                                value={params.default_max_applications}
                                onChange={(e) => setField("default_max_applications", parseInt(e.target.value) || 1)} />
                        </div>
                    </div>

                    {/* Documentos */}
                    <div className="space-y-3">
                        <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                            Documentos requeridos por defecto
                        </Label>
                        <div className="grid sm:grid-cols-2 gap-2">
                            {ALL_DOCS.map((d) => {
                                const isChecked = reqDocs.includes(d.value);
                                return (
                                    <label
                                        key={d.value}
                                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${isChecked
                                            ? "border-blue-500 bg-blue-50/50"
                                            : "border-gray-100 bg-white hover:border-gray-200"
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={isChecked}
                                            onChange={() => toggleDoc(d.value)}
                                        />
                                        <span className={`text-sm font-medium ${isChecked ? "text-blue-700" : "text-gray-600"}`}>
                                            {d.label}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ══════════════════════════════════════════ */}
            {/* SECCIÓN 3: Credenciales automáticas       */}
            {/* ══════════════════════════════════════════ */}
            <Card className="border shadow-sm rounded-xl">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-gray-700 flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-blue-500" />
                        Generación de Credenciales
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <label className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all border-gray-100 hover:border-gray-200">
                        <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={params.auto_generate_credentials}
                            onChange={(e) => setField("auto_generate_credentials", e.target.checked)}
                        />
                        <div>
                            <span className="text-sm font-medium text-gray-700">
                                Generar usuario y contraseña al verificar pago
                            </span>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Al confirmar el pago de un postulante admitido, el sistema
                                crea automáticamente sus credenciales de acceso.
                            </p>
                        </div>
                    </label>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Longitud de contraseña
                            </Label>
                            <Input type="number" min="6" max="16" className="h-11 border-gray-300 rounded-xl"
                                value={params.credential_password_length}
                                onChange={(e) => setField("credential_password_length", parseInt(e.target.value) || 8)} />
                        </div>
                        <div className="flex items-end pb-2">
                            <p className="text-xs text-gray-500">
                                El usuario siempre será el N° de DNI del postulante.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ══════════════════════════════════════════ */}
            {/* ACCIONES                                  */}
            {/* ══════════════════════════════════════════ */}
            <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={reset} className="text-gray-500">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Restaurar valores
                </Button>
                <Button
                    onClick={save}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Guardando..." : "Guardar Configuración"}
                </Button>
            </div>
        </div>
    );
}