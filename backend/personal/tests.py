"""Tests del módulo Personal.

Cubren lo que se rompe en silencio: que las migraciones estén completas,
que los endpoints respondan y que el alcance del coordinador de área no se
pueda saltar cambiando el parámetro a mano.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from catalogs.models import Career, Teacher
from personal.models import JefeLinea, Personal

User = get_user_model()


def _user(username, **kw):
    """El UserManager del proyecto no acepta is_staff en create_user."""
    staff = kw.pop("is_staff", False)
    u = User.objects.create_user(
        username=username, password="x", email=f"{username}@t.local",
        full_name=kw.pop("full_name", username), **kw)
    if staff:
        u.is_staff = True
        u.save(update_fields=["is_staff"])
    return u


class MigracionesTest(TestCase):
    """Si falta una migración, estos campos revientan al tocarse."""

    def test_campos_nuevos_existen(self):
        # Los 13 cargos los siembra la migración 0002; si falta, esto avisa.
        j = JefeLinea.objects.get(cargo="DIRECTOR_GENERAL")
        self.assertIsNone(j.resolucion_archivo.name or None)
        self.assertIsNone(j.resolucion_subida)
        self.assertEqual(list(j.careers.all()), [])

    def test_grados_incluyen_tecnico_y_secundaria(self):
        codigos = [c for c, _ in Personal.GRADOS_ACADEMICOS]
        self.assertIn("TECNICO", codigos)
        self.assertIn("SECUNDARIA", codigos)


class JefesLineaTest(TestCase):
    def setUp(self):
        self.admin = _user("admin1", is_staff=True)
        self.cli = APIClient()
        self.cli.force_authenticate(self.admin)

    def test_listado_siembra_los_cargos_de_la_ley(self):
        r = self.cli.get("/api/personal/jefes-linea")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(len(r.data["rows"]), len(JefeLinea.CARGOS))
        fila = r.data["rows"][0]
        for clave in ("cargo_label", "rd_url", "careers", "plan_trabajo_url"):
            self.assertIn(clave, fila)

    def test_no_admin_recibe_403(self):
        cli = APIClient()
        cli.force_authenticate(_user("pepe"))
        self.assertEqual(cli.get("/api/personal/jefes-linea").status_code, 403)

    def test_asignar_responsable_y_programas(self):
        self.cli.get("/api/personal/jefes-linea")
        j = JefeLinea.objects.get(cargo="COORD_AREA_EDUC_FISICA")
        t = Teacher.objects.create(full_name="Docente Uno", document="111")
        c1 = Career.objects.create(name="Educación Física", code="EF")
        c2 = Career.objects.create(name="Comunicación", code="COM")
        r = self.cli.put(f"/api/personal/jefes-linea/{j.id}",
                         {"teacher_id": t.id, "career_ids": [c1.id, c2.id]},
                         format="json")
        self.assertEqual(r.status_code, 200, r.data)
        # El de Educación Física lleva DOS programas: ese es el caso que
        # obliga a que sea M2M.
        self.assertEqual(len(r.data["careers"]), 2)
        self.assertEqual(r.data["responsable"]["teacher_id"], t.id)


class StaffTest(TestCase):
    def setUp(self):
        self.cli = APIClient()
        self.cli.force_authenticate(_user("admin2", is_staff=True))

    def test_alta_crea_ficha_usuario_y_clave(self):
        r = self.cli.post("/api/personal/staff", {
            "tipo": "ADMINISTRATIVO", "apellido_paterno": "Perez",
            "nombres": "Ana", "document": "70707070", "cargo": "Secretaria",
        }, format="multipart")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data.get("temporary_password"))
        self.assertEqual(r.data["username"], "70707070")

    def test_listado_filtra_por_tipo(self):
        Personal.objects.create(tipo=Personal.ADMINISTRATIVO, nombres="A")
        Personal.objects.create(tipo=Personal.LOCADOR, nombres="B")
        r = self.cli.get("/api/personal/staff", {"tipo": "LOCADOR"})
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(len(r.data["rows"]), 1)


class PublicoTest(TestCase):
    def test_directorio_no_pide_login(self):
        r = APIClient().get("/api/personal/public/directorio")
        self.assertEqual(r.status_code, 200, r.data)
        for clave in ("jefes_linea", "administrativos", "locadores"):
            self.assertIn(clave, r.data)


class AlcanceCoordinadorTest(TestCase):
    """Lo importante: que el coordinador NO pueda ver otro programa."""

    def setUp(self):
        self.mio = Career.objects.create(name="Educación Física", code="EF")
        self.otro = Career.objects.create(name="Inicial", code="INI")

        self.user = _user("coord")
        t = Teacher.objects.create(user=self.user, full_name="Coord Uno",
                                   document="222")
        j = JefeLinea.objects.get(cargo="COORD_AREA_EDUC_FISICA")
        j.teacher = t
        j.save()
        j.careers.add(self.mio)

        self.cli = APIClient()
        self.cli.force_authenticate(self.user)

    def test_carreras_coordinadas(self):
        from personal.coordinacion import carreras_coordinadas
        self.assertEqual(carreras_coordinadas(self.user), [self.mio.id])

    def test_mi_programa_devuelve_solo_los_suyos(self):
        r = self.cli.get("/api/personal/me/programa", {"period": "2026-II"})
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual([c["id"] for c in r.data["careers"]], [self.mio.id])

    def test_mi_programa_rechaza_un_programa_ajeno(self):
        r = self.cli.get("/api/personal/me/programa",
                         {"period": "2026-II", "career_id": self.otro.id})
        self.assertEqual(r.status_code, 403, r.data)

    def test_reporte_exige_career_id_y_lo_valida(self):
        # Sin career_id: 400 y le dice cuáles son los suyos.
        r = self.cli.get("/api/academic/admin/evaluation/silabos-sesiones",
                         {"period": "2026-II"})
        self.assertEqual(r.status_code, 400, r.data)
        self.assertEqual(r.data.get("career_ids"), [self.mio.id])
        # Con un programa ajeno: 403, aunque cambie el parámetro a mano.
        r = self.cli.get("/api/academic/admin/evaluation/silabos-sesiones",
                         {"period": "2026-II", "career_id": self.otro.id})
        self.assertEqual(r.status_code, 403, r.data)
        # Con el suyo: pasa el gate.
        r = self.cli.get("/api/academic/admin/evaluation/silabos-sesiones",
                         {"period": "2026-II", "career_id": self.mio.id})
        self.assertEqual(r.status_code, 200, r.data)

    def test_sin_programas_no_es_coordinador(self):
        cli = APIClient()
        cli.force_authenticate(_user("nadie"))
        r = cli.get("/api/academic/admin/evaluation/silabos-sesiones",
                    {"period": "2026-II"})
        self.assertEqual(r.status_code, 403, r.data)


class RendimientoPorCicloTest(TestCase):
    """El bundle del acta se indexa por user_id o pk y la nota vive en
    final_grade / PROMEDIO_FINAL / FINAL. Leerlo a mano daba siempre 0."""

    def setUp(self):
        from academic.models import (Course, Plan, PlanCourse, Section,
                                     Enrollment, EnrollmentItem, SectionGrades)
        from students.models import Student

        car = Career.objects.create(name="Educación Inicial", code="EI")
        plan = Plan.objects.create(career=car, name="Plan EI 2020")
        curso = Course.objects.create(code="C1", name="Didáctica", credits=3)
        pc = PlanCourse.objects.create(plan=plan, course=curso, semester=1)
        self.sec = Section.objects.create(plan_course=pc, label="A",
                                          period="2026-I")

        # Tres alumnos: uno aprobado, uno desaprobado, uno sin nota.
        self.alumnos = []
        for i, doc in enumerate(("10000001", "10000002", "10000003")):
            u = _user(f"al{i}")
            st = Student.objects.create(num_documento=doc, nombres=f"Alumno {i}",
                                        user=u, plan=plan)
            self.alumnos.append(st)
            e = Enrollment.objects.create(student=st, period="2026-I",
                                          status=Enrollment.STATUS_CONFIRMED)
            EnrollmentItem.objects.create(enrollment=e, plan_course=pc,
                                          section=self.sec)

        SectionGrades.objects.create(section=self.sec, grades={
            # por user_id, con final_grade
            str(self.alumnos[0].user_id): {"final_grade": 15},
            # por pk, con PROMEDIO_FINAL (la otra clave y el otro rotulo)
            str(self.alumnos[1].id): {"PROMEDIO_FINAL": 8},
        })
        self.car = car

    def test_cuenta_las_notas_cargadas(self):
        from personal.views.programa import _ciclos
        from academic.views.evaluation import _sections_for

        secciones = list(_sections_for("2026-I", career_id=self.car.id))
        self.assertEqual(len(secciones), 1)

        [d] = _ciclos(secciones)
        self.assertEqual(d["ciclo"], 1)
        self.assertEqual(d["matriculados"], 3)
        # Lo que fallaba: con_nota daba 0 aunque el acta tuviera notas.
        self.assertEqual(d["con_nota"], 2)
        self.assertEqual(d["aprobados"], 1)
        self.assertEqual(d["desaprobados"], 1)
        self.assertEqual(d["promedio"], 11.5)

    def test_sin_actas_no_inventa_promedio(self):
        from academic.models import SectionGrades
        from personal.views.programa import _ciclos
        from academic.views.evaluation import _sections_for

        SectionGrades.objects.all().delete()
        [d] = _ciclos(list(_sections_for("2026-I", career_id=self.car.id)))
        self.assertEqual(d["con_nota"], 0)
        self.assertIsNone(d["promedio"])
