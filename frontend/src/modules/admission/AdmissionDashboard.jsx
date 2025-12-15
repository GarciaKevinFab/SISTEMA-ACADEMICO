// src/modules/admission/AdmissionDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Users, FileText, Award, CheckCircle, BarChart3 } from "lucide-react";
import { getAdmissionDashboardStats } from "../../services/admission.service";

export default function AdmissionDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const data = await getAdmissionDashboardStats();
                setStats(data || {});
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    const totalApplicants = stats.total_applicants || 0;
    const totalApplications = stats.total_applications || 0;
    const totalEvaluated = stats.total_evaluated || 0;
    const totalAdmitted = stats.total_admitted || 0;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Badge variant="outline" className="text-sm">
                    {user?.role}
                </Badge>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Postulantes</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{totalApplicants}</div>
                        <p className="text-xs text-muted-foreground">Registrados</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Postulaciones</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{totalApplications}</div>
                        <p className="text-xs text-muted-foreground">Enviadas</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Evaluados</CardTitle>
                        <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">{totalEvaluated}</div>
                        <p className="text-xs text-muted-foreground">Con puntaje</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Admitidos</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{totalAdmitted}</div>
                        <p className="text-xs text-muted-foreground">Ingresantes</p>
                    </CardContent>
                </Card>
            </div>

            {/* Acciones rápidas -> navegan a pestañas del módulo */}
            <Card>
                <CardHeader><CardTitle>Acciones Rápidas</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate("/dashboard/admission/applicants")}>
                            <Users className="h-6 w-6" />
                            <span className="text-sm">Gestionar Postulantes</span>
                        </Button>
                        <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate("/dashboard/admission/calls")}>
                            <FileText className="h-6 w-6" />
                            <span className="text-sm">Convocatorias</span>
                        </Button>
                        <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate("/dashboard/admission/eval")}>
                            <Award className="h-6 w-6" />
                            <span className="text-sm">Evaluaciones</span>
                        </Button>
                        <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate("/dashboard/admission/reports")}>
                            <BarChart3 className="h-6 w-6" />
                            <span className="text-sm">Reportes</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
