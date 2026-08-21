"""Tests de infraestructura compartida."""
from django.test import RequestFactory, TestCase

from common.proxy_https import ForzarHttpsDetrasDelProxy


def _vista(request):
    """Devuelve lo que veria cualquier vista al armar una URL de media."""
    return {
        "url": request.build_absolute_uri("/media/teachers/photos/foto.jpg"),
        "seguro": request.is_secure(),
    }


class ForzarHttpsTest(TestCase):
    """Sin esto, si nginx no reenvia X-Forwarded-Proto, las URLs de media
    salen en http:// y el navegador las reporta como Mixed Content."""

    def setUp(self):
        self.rf = RequestFactory()

    def _pedir(self, activo):
        mw = ForzarHttpsDetrasDelProxy(_vista)
        mw.activo = activo
        return mw(self.rf.get("/api/x", HTTP_HOST="sis.iesppallende.edu.pe"))

    def test_activo_emite_https(self):
        r = self._pedir(True)
        self.assertTrue(r["seguro"])
        self.assertTrue(r["url"].startswith("https://"), r["url"])
        # Y sin puerto pegado, que romperia el enlace.
        self.assertNotIn(":80", r["url"])

    def test_apagado_no_toca_nada(self):
        r = self._pedir(False)
        self.assertFalse(r["seguro"])
        self.assertTrue(r["url"].startswith("http://"), r["url"])
