"""
Vistas para Asistencia, Sílabos y Configuración de Evaluación
"""
import csv
from datetime import datetime
from django.db import transaction
from rest_framework.response import Response 
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework import permissions, status
from rest_framework_simplejwt.authentication import JWTAuthentication

from academic.models import (
    Section, AttendanceSession, AttendanceRow,
    Syllabus, EvaluationConfig
)
from academic.serializers import AttendanceSessionSerializer
from .utils import ok, ALLOWED_ATT


# ══════════════════════════════════════════════════════════════
# ASISTENCIA
# ══════════════════════════════════════════════════════════════

class AttendanceSessionsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, section_id):
        qs = AttendanceSession.objects.filter(section_id=section_id).prefetch_related("rows").order_by("-id")
        return ok(sessions=AttendanceSessionSerializer(qs, many=True).data)
    
    def post(self, request, section_id):
        body = request.data or {}
        date_str = body.get("date")
        
        if date_str:
            try:
                d = datetime.strptime(date_str, "%Y-%m-%d").date()
            except Exception:
                return Response({"detail": "date inválida (YYYY-MM-DD)"}, status=400)
            sess, _ = AttendanceSession.objects.get_or_create(section_id=section_id, date=d)
        else:
            sess = AttendanceSession.objects.create(section_id=section_id)
        
        return ok(session=AttendanceSessionSerializer(sess).data)


class AttendanceSessionCloseView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, section_id, session_id):
        sess = get_object_or_404(AttendanceSession, id=session_id, section_id=section_id)
        sess.closed = True
        sess.save()
        return ok(success=True)


class AttendanceSessionSetView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    
    def put(self, request, section_id, session_id):
        sess = get_object_or_404(AttendanceSession, id=session_id, section_id=section_id)
        rows = (request.data or {}).get("rows", [])
        
        if not isinstance(rows, list):
            return Response({"detail": "rows debe ser lista"}, status=400)
        
        with transaction.atomic():
            AttendanceRow.objects.filter(session=sess).delete()
            for r in rows:
                sid = r.get("student_id")
                try:
                    sid = int(sid)
                except Exception:
                    sid = 0
                st = (r.get("status") or "").upper().strip()
                AttendanceRow.objects.create(session=sess, student_id=sid, status=st)
        
        return ok(success=True)


# ══════════════════════════════════════════════════════════════
# IMPORTACIÓN MASIVA DE ASISTENCIA
# ══════════════════════════════════════════════════════════════

class AttendanceImportPreviewView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        f = request.FILES.get("file")
        section_id = (request.data or {}).get("section_id")
        
        if not f or not section_id:
            return Response({"detail": "file y section_id son requeridos"}, status=400)
        
        try:
            int(section_id)
        except Exception:
            return Response({"detail": "section_id inválido"}, status=400)
        
        errors = []
        preview = []
        
        decoded = f.read().decode("utf-8-sig", errors="ignore").splitlines()
        reader = csv.DictReader(decoded)
        
        for idx, row in enumerate(reader, start=2):
            status_val = (row.get("status") or row.get("estado") or "").strip().upper()
            date_val = (row.get("date") or row.get("fecha") or "").strip()
            student_name = (row.get("student_name") or row.get("nombre") or row.get("student") or "").strip()
            student_id = (row.get("student_id") or row.get("id") or "").strip()
            
            if status_val not in ALLOWED_ATT:
                errors.append({"row": idx, "message": f"status inválido: {status_val}"})
                continue
            
            if date_val:
                try:
                    datetime.strptime(date_val, "%Y-%m-%d")
                except Exception:
                    errors.append({"row": idx, "message": "date inválida (YYYY-MM-DD)"})
                    continue
            else:
                date_val = str(timezone.now().date())
            
            if not student_id and not student_name:
                errors.append({"row": idx, "message": "Falta student_id o student_name"})
                continue
            
            preview.append({
                "student_id": int(student_id) if student_id.isdigit() else None,
                "student_name": student_name or (f"ID {student_id}" if student_id else "Desconocido"),
                "date": date_val,
                "status": status_val,
            })
        
        return ok(preview=preview, errors=errors)


class AttendanceImportSaveView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        body = request.data or {}
        section_id = body.get("section_id")
        data = body.get("attendance_data") or []
        
        if not section_id:
            return Response({"detail": "section_id requerido"}, status=400)
        
        if not isinstance(data, list):
            return Response({"detail": "attendance_data debe ser lista"}, status=400)
        
        section = get_object_or_404(Section, id=int(section_id))
        
        by_date = {}
        for r in data:
            dt = (r.get("date") or "").strip()
            st = (r.get("status") or "").strip().upper()
            sid = r.get("student_id")
            if not dt or st not in ALLOWED_ATT:
                continue
            by_date.setdefault(dt, []).append((sid, st))
        
        with transaction.atomic():
            for dt, rows in by_date.items():
                d = datetime.strptime(dt, "%Y-%m-%d").date()
                sess, _ = AttendanceSession.objects.get_or_create(section=section, date=d)
                AttendanceRow.objects.filter(session=sess).delete()
                for sid, st in rows:
                    try:
                        sid_int = int(sid) if sid is not None else 0
                    except Exception:
                        sid_int = 0
                    AttendanceRow.objects.create(session=sess, student_id=sid_int, status=st)
        
        return ok(success=True)


# ══════════════════════════════════════════════════════════════
# SÍLABOS
# ══════════════════════════════════════════════════════════════

class SyllabusView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, section_id):
        s = Syllabus.objects.filter(section_id=section_id).first()
        if not s:
            return ok(syllabus=None)
        return ok(syllabus={"filename": s.file.name, "size": getattr(s.file, "size", 0)})
    
    def post(self, request, section_id):
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "Archivo requerido"}, status=status.HTTP_400_BAD_REQUEST)
        
        obj, _ = Syllabus.objects.get_or_create(section_id=section_id)
        obj.file = f
        obj.save()
        return ok(syllabus={"filename": obj.file.name, "size": getattr(obj.file, "size", 0)})
    
    def delete(self, request, section_id):
        Syllabus.objects.filter(section_id=section_id).delete()
        return ok(success=True)


# ══════════════════════════════════════════════════════════════
# CONFIGURACIÓN DE EVALUACIÓN
# ══════════════════════════════════════════════════════════════

class EvaluationConfigView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, section_id):
        obj = EvaluationConfig.objects.filter(section_id=section_id).first()
        return ok(config=(obj.config if obj else []))
    
    def put(self, request, section_id):
        cfg = request.data if isinstance(request.data, list) else (request.data or {}).get("config", [])
        obj, _ = EvaluationConfig.objects.get_or_create(section_id=section_id)
        obj.config = cfg
        obj.save()
        return ok(config=obj.config)