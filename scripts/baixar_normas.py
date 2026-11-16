"""Baixa as leis (Lei, Lei Complementar, Emenda à Lei Orgânica) desde 2025 do SAPL para data/raw/norma__leis.jsonl.

Uso: python -I -X utf8 baixar_normas.py <pasta_raw> [data_inicial]
Cada linha é o registro oficial, sem mudança. Para cada lei baixa também o texto da matéria ligada (se houver)."""
import json, sys, pathlib, urllib.request, time

raw = pathlib.Path(sys.argv[1]); inicio = sys.argv[2] if len(sys.argv) > 2 else "2025-01-01"
B = "https://sapl.campinas.sp.leg.br/api/"
def get(u):
    for i in range(5):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(B + u, headers={"User-Agent": "radarcampinas"}), timeout=90))
        except Exception as e:
            time.sleep(2 + i * 3)
    raise SystemExit("falhou: " + u)
vistos = {}
for t in (1, 2, 9):
    p = 1
    while True:
        d = get(f"norma/normajuridica/?tipo={t}&data__gte={inicio}&page_size=100&o=id&page={p}")
        for n in d["results"]:
            vistos[n["id"]] = n
        if not d["pagination"]["next_page"]:
            break
        p += 1
with open(raw / "norma__leis.jsonl", "w", encoding="utf-8") as f:
    for n in sorted(vistos.values(), key=lambda n: n["id"]):
        f.write(json.dumps(n, ensure_ascii=False) + "\n")
print(len(vistos), "leis")

# matéria ligada a cada lei (o projeto que deu origem) e seus autores
from concurrent.futures import ThreadPoolExecutor
ids = sorted({n["materia"] for n in vistos.values() if n["materia"]})
def uma(i):
    m = get(f"materia/materialegislativa/{i}/")
    a, p = [], 1
    while True:
        d = get(f"materia/autoria/?materia={i}&page_size=100&o=id&page={p}")
        a += d["results"]
        if not d["pagination"]["next_page"]:
            break
        p += 1
    return {"materia": m, "autoria": a}
with ThreadPoolExecutor(4) as ex:
    res = list(ex.map(uma, ids))
with open(raw / "norma__materias.jsonl", "w", encoding="utf-8") as f:
    for r in res:
        f.write(json.dumps(r, ensure_ascii=False) + chr(10))
print(len(res), "matérias de origem")
