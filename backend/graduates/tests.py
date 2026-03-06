from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Graduate


class GraduateModelTest(TestCase):
    def setUp(self):
        self.grad = Graduate.objects.create(
            dni="72611344",
            apellidos_nombres="ADAMA CHAGUA, MARYORI ALESSANDRA",
            grado_titulo="BACHILLER EN EDUCACIÓN",
            especialidad="EDUCACIÓN INICIAL",
            nivel="INICIAL",
            anio_ingreso="2018",
            anio_egreso="2022",
        )

    def test_str(self):
        self.assertIn("ADAMA CHAGUA", str(self.grad))

    def test_tiene_constancia_false(self):
        self.assertFalse(self.grad.tiene_constancia)

    def test_tiene_constancia_true(self):
        self.grad.resolucion_acta = "RES-001-2024"
        self.assertTrue(self.grad.tiene_constancia)


class GraduateSearchAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        Graduate.objects.create(
            dni="72611344",
            apellidos_nombres="ADAMA CHAGUA, MARYORI ALESSANDRA",
            especialidad="EDUCACIÓN INICIAL",
            anio_ingreso="2018",
            anio_egreso="2022",
        )
        Graduate.objects.create(
            apellidos_nombres="ALEJO CORNEJO, GUDEN ALEX",
            especialidad="EDUCACIÓN PRIMARIA",
            anio_ingreso="2015-II",
            anio_egreso="2019-I",
        )

    def test_search_by_dni(self):
        resp = self.client.get("/api/public/graduates/search/", {"dni": "72611344"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 1)
        self.assertEqual(resp.data["results"][0]["dni"], "72611344")

    def test_search_by_name(self):
        resp = self.client.get("/api/public/graduates/search/", {"nombre": "ADAMA"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 1)

    def test_search_by_name_partial(self):
        resp = self.client.get("/api/public/graduates/search/", {"nombre": "ALEJO CORNEJO"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 1)

    def test_search_no_params(self):
        resp = self.client.get("/api/public/graduates/search/")
        self.assertEqual(resp.status_code, 400)

    def test_search_invalid_dni(self):
        resp = self.client.get("/api/public/graduates/search/", {"dni": "123"})
        self.assertEqual(resp.status_code, 400)

    def test_search_no_results(self):
        resp = self.client.get("/api/public/graduates/search/", {"dni": "99999999"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 0)


class GraduateConstanciaAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.grad = Graduate.objects.create(
            dni="72611344",
            apellidos_nombres="ADAMA CHAGUA, MARYORI ALESSANDRA",
            especialidad="EDUCACIÓN INICIAL",
            anio_ingreso="2018",
            anio_egreso="2022",
            resolucion_acta="RES-001-2024",
        )

    def test_constancia_pdf(self):
        resp = self.client.get(f"/api/public/graduates/{self.grad.id}/constancia/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/pdf")

    def test_constancia_not_found(self):
        resp = self.client.get("/api/public/graduates/99999/constancia/")
        self.assertEqual(resp.status_code, 404)