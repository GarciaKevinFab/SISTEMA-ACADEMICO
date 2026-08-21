// Módulo ADMINISTRATIVOS — observación MINEDU bajo la Ley N° 30512.
//
// Tres pestañas, en el mismo orden que el portal público:
//   1. Jefes de Línea  → cargos de la Ley N° 30512, responsable jalado del
//                        módulo Académico y plan de trabajo.
//   2. Administrativos → fichas + usuarios y accesos; hoja de vida completa.
//   3. Locadores 107   → además, orden de servicio, protocolo y plan.
//
// Todo lo que se registra aquí tiene su espejo en modo público (un solo
// enlace de transparencia, /public/personal).
import React, { useState } from "react";
import { Briefcase, ShieldCheck, Users, HardHat, ExternalLink } from "lucide-react";
import ModuleShell from "@/components/module/ModuleShell";
import { TabsContent } from "@/components/ui/tabs";

import { InjectPersonalStyles, SCOPE } from "./personalStyles";
import JefesLineaPanel from "./JefesLineaPanel";
import StaffPanel from "./StaffPanel";

const TABS = [
    { key: "jefes", label: "Jefes de Línea", Icon: ShieldCheck, group: "personal" },
    { key: "administrativos", label: "Administrativos", Icon: Users, group: "personal" },
    { key: "locadores", label: "Locadores 107", Icon: HardHat, group: "personal" },
];
const GROUP_LABELS = { personal: null };

export default function PersonalModule() {
    const [tab, setTab] = useState("jefes");

    return (
        <div className={SCOPE}>
        <InjectPersonalStyles />
        <ModuleShell
            icon={Briefcase}
            title="Administrativos"
            subtitle="Jefes de línea, personal administrativo y locadores 107 – MINEDU"
            accent="linear-gradient(135deg, #0EA5E9, #1F4E79)"
            tabs={TABS}
            groupLabels={GROUP_LABELS}
            tab={tab}
            onTab={setTab}
            headerRight={
                <a href="/public/personal" target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 hover:bg-slate-50">
                    <ExternalLink size={13} /> Ver modo público
                </a>
            }
        >
            <TabsContent value="jefes" className="fade-in">
                <JefesLineaPanel />
            </TabsContent>
            <TabsContent value="administrativos" className="fade-in">
                <StaffPanel tipo="ADMINISTRATIVO" />
            </TabsContent>
            <TabsContent value="locadores" className="fade-in">
                <StaffPanel tipo="LOCADOR" />
            </TabsContent>
        </ModuleShell>
        </div>
    );
}
