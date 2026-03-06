import csv
import json
import os
import sys

# ✅ RUTAS ROBUSTAS (independiente de dónde ejecutes el script)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CSV_PATH = os.path.join(BASE_DIR, "Lista_Ubigeos_INEI.csv")
OUT_PATH = os.path.join(BASE_DIR, "ubigeo_pe.json")

def norm(s: str) -> str:
    return (s or "").strip().upper()

def main():
    if not os.path.exists(CSV_PATH):
        print(f"ERROR: No existe {CSV_PATH}")
        sys.exit(1)

    ub = {}

    # ✅ OJO: tu archivo viene separado por ;
    with open(CSV_PATH, "r", encoding="utf-8-sig", newline="") as f:
        sample = f.read(2048)
        f.seek(0)

        delim = ";" if ";" in sample and sample.count(";") >= sample.count(",") else ","

        reader = csv.DictReader(f, delimiter=delim)

        headers = [h.strip() for h in (reader.fieldnames or [])]

        # Si por alguna razón vino en un solo header "A;B;C", lo partimos a mano
        if len(headers) == 1 and ";" in headers[0]:
            f.seek(0)
            reader2 = csv.reader(f, delimiter=";")
            headers = next(reader2)
            headers = [h.strip() for h in headers]

            def get_row_dict(r):
                return {headers[i]: (r[i].strip() if i < len(r) else "") for i in range(len(headers))}

            rows_iter = (get_row_dict(r) for r in reader2)
        else:
            rows_iter = reader

        hmap = {h.lower(): h for h in headers}

        def pick(*cands):
            for c in cands:
                if c.lower() in hmap:
                    return hmap[c.lower()]
            return None

        col_ubigeo = pick("UBIGEO_INEI", "UBIGEO", "CODIGO_UBIGEO", "IDUBIGEO", "COD_UBIGEO")
        col_dep = pick("DEPARTAMENTO", "DEPARTAMENTO_INEI", "DEPARTAMENTO NOMBRE", "DEPARTAMENTO_NOMBRE")
        col_prov = pick("PROVINCIA", "PROVINCIA_INEI")
        col_dist = pick("DISTRITO", "DISTRITO_INEI")

        if not (col_ubigeo and col_dep and col_prov and col_dist):
            print("ERROR: No pude detectar columnas necesarias en el CSV.")
            print("Headers detectados:", headers)
            sys.exit(1)

        for row in rows_iter:
            code6 = (row.get(col_ubigeo) or "").strip()
            if not code6.isdigit() or len(code6) != 6:
                continue

            dep_code = code6[:2]
            prov_code = code6[:4]
            dist_code = code6

            dep_name = norm(row.get(col_dep))
            prov_name = norm(row.get(col_prov))
            dist_name = norm(row.get(col_dist))

            if dep_code not in ub:
                ub[dep_code] = {"name": dep_name, "provinces": {}}

            provs = ub[dep_code]["provinces"]
            if prov_code not in provs:
                provs[prov_code] = {"name": prov_name, "districts": {}}

            provs[prov_code]["districts"][dist_code] = dist_name

    # ordenar estable
    ub_sorted = {}
    for dep_code in sorted(ub.keys()):
        dep = ub[dep_code]
        provs_sorted = {}
        for prov_code in sorted(dep["provinces"].keys()):
            prov = dep["provinces"][prov_code]
            d_sorted = {k: prov["districts"][k] for k in sorted(prov["districts"].keys())}
            provs_sorted[prov_code] = {"name": prov["name"], "districts": d_sorted}
        ub_sorted[dep_code] = {"name": dep["name"], "provinces": provs_sorted}

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(ub_sorted, f, ensure_ascii=False, indent=2)

    print(f"OK ✅ generado {OUT_PATH}")
    print(f"Departamentos: {len(ub_sorted)}")

if __name__ == "__main__":
    main()
