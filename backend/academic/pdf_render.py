from playwright.sync_api import sync_playwright
import traceback

def html_to_pdf_bytes(html: str) -> bytes:
    """
    HTML -> PDF con Playwright (robusto).
    - Evita 'networkidle' (causa cuelgues)
    - Bloquea requests externas
    - Timeout controlado
    """
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ],
            )
            try:
                page = browser.new_page()
                page.set_default_timeout(30000)  # 30s

                # Bloquea recursos externos (google fonts, cdn, etc.)
                def block_external(route):
                    url = route.request.url.lower()
                    if url.startswith("http://") or url.startswith("https://"):
                        return route.abort()
                    return route.continue_()

                page.route("**/*", block_external)

                # IMPORTANTE: 'load' es más estable que 'networkidle'
                page.set_content(html, wait_until="load")

                pdf_bytes = page.pdf(
                    format="A4",
                    print_background=True,
                    prefer_css_page_size=True,
                    margin={"top": "10mm", "bottom": "10mm", "left": "10mm", "right": "10mm"},
                )
                return pdf_bytes
            finally:
                browser.close()
    except Exception as e:
        traceback.print_exc()
        raise RuntimeError(f"Playwright PDF error: {e}")
