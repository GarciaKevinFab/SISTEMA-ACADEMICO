// src/modules/admission/AdmissionDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Users,
  FileText,
  Award,
  CheckCircle,
  BarChart3,
  GraduationCap,
} from "lucide-react";
import { getAdmissionDashboardStats } from "../../services/admission.service";

/* --- Animaciones --- */
const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.2 },
};

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
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const totalApplicants = stats.total_applicants || 0;
  const totalApplications = stats.total_applications || 0;
  const totalEvaluated = stats.total_evaluated || 0;
  const totalAdmitted = stats.total_admitted || 0;

  return (
    /* ✅ Responsive sólido:
       - min-h-[100dvh]: mejor en móvil iOS
       - overflow-x-hidden: evita desbordes laterales
       - max-w-7xl mx-auto: buen ancho en laptop
    */
    <div className="min-h-[100dvh] w-full overflow-x-hidden p-4 sm:p-6 lg:p-8 pb-40 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* 1. CABECERA */}
      <motion.div
        {...fade}
        className="rounded-2xl p-[1px] bg-gradient-to-r from-blue-500/30 via-indigo-500/30 to-cyan-500/30"
      >
        <div className="w-full min-w-0 rounded-2xl bg-white/70 dark:bg-neutral-900/60 backdrop-blur-md px-4 py-5 sm:px-6 border border-white/50 dark:border-white/10 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-indigo-600" />
              Módulo de Admisión
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              Resumen general del proceso de admisión.
            </p>
          </div>

          <Badge
            variant="outline"
            className="self-start md:self-auto px-3 py-1 bg-indigo-50 text-indigo-700 border-indigo-200 text-sm rounded-lg whitespace-nowrap"
          >
            Proceso Activo
          </Badge>
        </div>
      </motion.div>

      {/* 2. TARJETAS DE MÉTRICAS */}
      {/* 1 col móvil, 2 tablet, 4 laptop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Postulantes */}
        <motion.div {...scaleIn} transition={{ delay: 0.05 }}>
          <Card className="min-w-0 h-full border-t-4 border-t-blue-500 shadow-sm bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm border-white/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Postulantes
              </CardTitle>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
                {totalApplicants}
              </div>
              <p className="text-xs text-blue-600/80 font-medium mt-1">
                Registrados en sistema
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Postulaciones */}
        <motion.div {...scaleIn} transition={{ delay: 0.1 }}>
          <Card className="min-w-0 h-full border-t-4 border-t-indigo-500 shadow-sm bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm border-white/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Postulaciones
              </CardTitle>
              <div className="p-2 bg-indigo-50 rounded-lg">
                <FileText className="h-4 w-4 text-indigo-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
                {totalApplications}
              </div>
              <p className="text-xs text-indigo-600/80 font-medium mt-1">
                Expedientes enviados
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Evaluados */}
        <motion.div {...scaleIn} transition={{ delay: 0.15 }}>
          <Card className="min-w-0 h-full border-t-4 border-t-purple-500 shadow-sm bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm border-white/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Evaluados
              </CardTitle>
              <div className="p-2 bg-purple-50 rounded-lg">
                <Award className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
                {totalEvaluated}
              </div>
              <p className="text-xs text-purple-600/80 font-medium mt-1">
                Con puntaje asignado
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Admitidos */}
        <motion.div {...scaleIn} transition={{ delay: 0.2 }}>
          <Card className="min-w-0 h-full border-t-4 border-t-emerald-500 shadow-sm bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm border-white/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Admitidos
              </CardTitle>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
                {totalAdmitted}
              </div>
              <p className="text-xs text-emerald-600/80 font-medium mt-1">
                Ingresantes oficiales
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 3. ACCIONES RÁPIDAS */}
      <motion.div
        {...fade}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-white/60 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-md p-4 sm:p-6 shadow-sm"
      >
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Accesos Directos
          </h3>
          <p className="text-sm text-gray-500">Gestión rápida</p>
        </div>

        {/* ✅ Grid mejor:
            - móvil: 1 col
            - sm: 2 col
            - lg: 4 col
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="h-auto py-5 sm:py-6 lg:py-5 flex flex-col gap-3 rounded-xl border-dashed border-2 hover:border-solid hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
            onClick={() => navigate("/dashboard/admission/applicants")}
          >
            <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="h-5 w-5" />
            </div>
            <div className="text-center">
              <span className="block font-semibold text-sm sm:text-base text-gray-700 group-hover:text-blue-700">
                Postulantes
              </span>
              <span className="text-[10px] sm:text-xs text-gray-400">
                Base de datos
              </span>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-5 sm:py-6 lg:py-5 flex flex-col gap-3 rounded-xl border-dashed border-2 hover:border-solid hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
            onClick={() => navigate("/dashboard/admission/calls")}
          >
            <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="h-5 w-5" />
            </div>
            <div className="text-center">
              <span className="block font-semibold text-sm sm:text-base text-gray-700 group-hover:text-indigo-700">
                Convocatorias
              </span>
              <span className="text-[10px] sm:text-xs text-gray-400">
                Apertura y cierre
              </span>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-5 sm:py-6 lg:py-5 flex flex-col gap-3 rounded-xl border-dashed border-2 hover:border-solid hover:border-purple-300 hover:bg-purple-50/50 transition-all group"
            onClick={() => navigate("/dashboard/admission/eval")}
          >
            <div className="h-10 w-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Award className="h-5 w-5" />
            </div>
            <div className="text-center">
              <span className="block font-semibold text-sm sm:text-base text-gray-700 group-hover:text-purple-700">
                Evaluaciones
              </span>
              <span className="text-[10px] sm:text-xs text-gray-400">
                Calificar
              </span>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-5 sm:py-6 lg:py-5 flex flex-col gap-3 rounded-xl border-dashed border-2 hover:border-solid hover:border-emerald-300 hover:bg-emerald-50/50 transition-all group"
            onClick={() => navigate("/dashboard/admission/reports")}
          >
            <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="text-center">
              <span className="block font-semibold text-sm sm:text-base text-gray-700 group-hover:text-emerald-700">
                Reportes
              </span>
              <span className="text-[10px] sm:text-xs text-gray-400">
                Estadísticas
              </span>
            </div>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
