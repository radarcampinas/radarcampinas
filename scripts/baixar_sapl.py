"""Baixa dados públicos da API oficial do SAPL da Câmara de Campinas.

Uso: python baixar_sapl.py <pasta_saida> [endpoint ...]
Cada endpoint vira um arquivo JSONL (um registro por linha). Retoma de onde parou.
"""
import json, sys, time, pathlib, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = "https://sapl.campinas.sp.leg.br/api/"
UA = "radarcampinas-pesquisa/0.1 (dados abertos; uso civico)"
PADRAO = [
    "parlamentares/legislatura", "parlamentares/parlamentar", "parlamentares/mandato",
    "parlamentares/partido", "parlamentares/filiacao", "parlamentares/sessaolegislativa",
    "base/tipoautor", "base/autor", "materia/tipomaterialegislativa",
    "sessao/tiposessaoplenaria", "sessao/tiporesultadovotacao",
    "sessao/sessaoplenaria", "sessao/sessaoplenariapresenca", "sessao/presencaordemdia",
    "sessao/ordemdia", "sessao/expedientemateria", "sessao/registrovotacao",
    "sessao/votoparlamentar", "sessao/justificativaausencia",
    "materia/autoria", "materia/materialegislativa",
]


def get(url, tentativas=6):
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, ConnectionError, json.JSONDecodeError) as e:
            time.sleep(2 * (i + 1))
            erro = e
    raise RuntimeError(f"falhou {url}: {erro}")


def baixar(endpoint, saida):
    arq = saida / (endpoint.replace("/", "__") + ".jsonl")
    primeira = get(f"{BASE}{endpoint}/?page=1&page_size=100&o=id")
    if isinstance(primeira, list):  # alguns endpoints devolvem tudo de uma vez, sem paginação
        with open(arq, "w", encoding="utf-8") as f:
            for it in primeira:
                f.write(json.dumps(it, ensure_ascii=False) + "\n")
        print(f"{endpoint}: {len(primeira)} registros (sem paginação)", flush=True)
        return
    total = primeira["pagination"]["total_pages"]
    n = primeira["pagination"]["total_entries"]
    print(f"{endpoint}: {n} registros, {total} páginas", flush=True)

    def pagina(p):
        d = primeira if p == 1 else get(f"{BASE}{endpoint}/?page={p}&page_size=100&o=id")
        return p, d["results"]

    tmp = arq.with_suffix(".tmp")
    vistos = set(); dup = 0
    with open(tmp, "w", encoding="utf-8") as f, ThreadPoolExecutor(4) as ex:
        for p, res in ex.map(pagina, range(1, total + 1)):
            for it in res:
                if it["id"] in vistos:
                    dup += 1; continue
                vistos.add(it["id"])
                f.write(json.dumps(it, ensure_ascii=False) + "\n")
            if p % 100 == 0:
                print(f"  {endpoint} pág {p}/{total}", flush=True)
    tmp.replace(arq)
    status = "OK" if len(vistos) == n and dup == 0 else "ATENCAO"
    print(f"{endpoint}: concluído [{status}] esperado={n} baixado_unico={len(vistos)} duplicados={dup}", flush=True)


if __name__ == "__main__":
    saida = pathlib.Path(sys.argv[1]); saida.mkdir(parents=True, exist_ok=True)
    eps = sys.argv[2:] or PADRAO
    for ep in eps:
        if (saida / (ep.replace("/", "__") + ".jsonl")).exists():
            print(f"{ep}: já existe, pulando", flush=True); continue
        try:
            baixar(ep, saida)
        except Exception as e:
            print(f"ERRO {ep}: {e}", flush=True)
