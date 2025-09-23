from pathlib import Path

PDF_HEADER = b"%PDF-1.4\n% minimal\n"
PDF_BODY = b"1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"

def write_dummy_pdf(path: Path, title: str = "Reporte"):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(PDF_HEADER)
        f.write(b"% " + title.encode("utf-8", "ignore") + b"\n")
        f.write(PDF_BODY)
