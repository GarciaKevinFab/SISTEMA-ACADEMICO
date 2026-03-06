"""
UBIGEO Perú - Endpoints para departamentos, provincias y distritos
"""
import os
import json
from typing import Optional
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .utils import _norm


# ═══════════════════════════════════════════════════════════════
# DATA DEMO (fallback si no existe ubigeo_pe.json)
# ═══════════════════════════════════════════════════════════════

UBIGEO_DEMO = {
    "15": {  # Lima
        "name": "LIMA",
        "provinces": {
            "1501": {
                "name": "LIMA",
                "districts": {
                    "150101": "LIMA",
                    "150114": "LA MOLINA",
                    "150140": "SURCO",
                    "150122": "MIRAFLORES"
                }
            },
            "1508": {
                "name": "HUAURA",
                "districts": {
                    "150801": "HUACHO",
                    "150802": "HUALMAY"
                }
            },
        },
    },
    "20": {  # Piura
        "name": "PIURA",
        "provinces": {
            "2001": {
                "name": "PIURA",
                "districts": {
                    "200101": "PIURA",
                    "200104": "CASTILLA"
                }
            },
        },
    },
}

_UBIGEO_CACHE: Optional[dict] = None


def _load_ubigeo_pe() -> dict:
    """Carga ubigeo_pe.json o usa DEMO como fallback"""
    global _UBIGEO_CACHE
    
    if isinstance(_UBIGEO_CACHE, dict):
        return _UBIGEO_CACHE
    
    candidates = [
        os.path.join(settings.BASE_DIR, "catalogs", "data", "ubigeo_pe.json"),
        os.path.join(settings.BASE_DIR, "backend", "catalogs", "data", "ubigeo_pe.json"),
        os.path.join(os.getcwd(), "catalogs", "data", "ubigeo_pe.json"),
        os.path.join(os.getcwd(), "backend", "catalogs", "data", "ubigeo_pe.json"),
    ]
    
    last_err = None
    for path in candidates:
        try:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict) and data:
                    _UBIGEO_CACHE = data
                    print(f"[UBIGEO] OK loaded: {path} (deps={len(data)})")
                    return data
                else:
                    last_err = f"JSON vacío o inválido en {path}"
        except Exception as e:
            last_err = f"{type(e).__name__}: {e} ({path})"
    
    print(f"[UBIGEO] FALLBACK DEMO. BASE_DIR={settings.BASE_DIR} CWD={os.getcwd()} ERR={last_err}")
    _UBIGEO_CACHE = UBIGEO_DEMO
    return _UBIGEO_CACHE


def _ub_name(x) -> str:
    """Helper para nombre limpio"""
    return (x or "").strip()


# ═══════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ubigeo_departments(request):
    """Lista departamentos"""
    ub = _load_ubigeo_pe()
    out = [{"code": k, "name": _ub_name(v.get("name"))} for k, v in ub.items()]
    out.sort(key=lambda x: x["name"])
    return Response(out)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ubigeo_provinces(request):
    """Lista provincias de un departamento"""
    ub = _load_ubigeo_pe()
    dep = (request.query_params.get("department") or "").strip()
    
    if dep not in ub:
        return Response([])
    
    provs = ub[dep].get("provinces") or {}
    out = [{"code": k, "name": _ub_name(v.get("name"))} for k, v in provs.items()]
    out.sort(key=lambda x: x["name"])
    return Response(out)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ubigeo_districts(request):
    """Lista distritos de una provincia"""
    ub = _load_ubigeo_pe()
    dep = (request.query_params.get("department") or "").strip()
    prov = (request.query_params.get("province") or "").strip()
    
    if dep not in ub:
        return Response([])
    
    provs = ub[dep].get("provinces") or {}
    if prov not in provs:
        return Response([])
    
    dists = provs[prov].get("districts") or {}
    out = [{"code": k, "name": _ub_name(v)} for k, v in dists.items()]
    out.sort(key=lambda x: x["name"])
    return Response(out)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def ubigeo_search(request):
    """Búsqueda por nombre o código (máx 50 resultados)"""
    q = (request.query_params.get("q") or "").strip()
    if not q:
        return Response([])
    
    qq = _norm(q)
    ub = _load_ubigeo_pe()
    res = []
    
    for dep_code, dep in ub.items():
        dep_name = dep.get("name", "")
        
        if qq in _norm(dep_name) or qq in _norm(dep_code):
            res.append({"department": {"code": dep_code, "name": dep_name}})
        
        provs = dep.get("provinces") or {}
        for prov_code, prov in provs.items():
            prov_name = prov.get("name", "")
            
            if qq in _norm(prov_name) or qq in _norm(prov_code):
                res.append({
                    "department": {"code": dep_code, "name": dep_name},
                    "province": {"code": prov_code, "name": prov_name},
                })
            
            dists = prov.get("districts") or {}
            for dist_code, dist_name in dists.items():
                if qq in _norm(dist_name) or qq in _norm(dist_code):
                    res.append({
                        "department": {"code": dep_code, "name": dep_name},
                        "province": {"code": prov_code, "name": prov_name},
                        "district": {"code": dist_code, "name": dist_name},
                    })
            
            if len(res) >= 50:
                break
    
    return Response(res[:50])