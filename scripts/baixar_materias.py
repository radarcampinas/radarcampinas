"""Baixa matérias legislativas apresentadas desde uma data (padrão 2025-01-01)."""
import json, sys, pathlib
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from baixar_sapl import get, BASE

desde = sys.argv[2] if len(sys.argv) > 2 else "2025-01-01"
saida = pathlib.Path(sys.argv[1]); saida.mkdir(parents=True, exist_ok=True)
q = f"materia/materialegislativa/?data_apresentacao__gte={desde}&o=id&page_size=100"
p1 = get(BASE + q + "&page=1")
total, n = p1["pagination"]["total_pages"], p1["pagination"]["total_entries"]
print(f"{n} matérias, {total} páginas", flush=True)
vistos = {}
with ThreadPoolExecutor(3) as ex:
    for res in ex.map(lambda p: p1["results"] if p == 1 else get(BASE + q + f"&page={p}")["results"], range(1, total + 1)):
        for it in res: vistos[it["id"]] = it
with open(saida / "materia__materialegislativa_desde2025.jsonl", "w", encoding="utf-8") as f:
    for it in vistos.values(): f.write(json.dumps(it, ensure_ascii=False) + "\n")
print(f"concluído [{'OK' if len(vistos)==n else 'ATENCAO'}] esperado={n} unico={len(vistos)}", flush=True)
