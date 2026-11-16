"""Gera site/dados/graficos.json: séries para os gráficos (geral e por vereador).

Uso: python -I -X utf8 gerar_graficos.py <pasta_raw> <pasta_site>
Rode depois de gerar_dados.py. Só contagens sobre os dados oficiais; nada de nota ou ranking.
"""
import json, sys, pathlib, collections as C
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from classificar import classificar
import enderecos as E

raw, site = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])


def L(n):
    return [json.loads(l) for l in open(raw / n, encoding="utf-8")]


geral = json.load(open(site / "dados" / "geral.json", encoding="utf-8"))
INICIO, HOJE = geral["meta"]["inicio"], geral["meta"]["gerado_em"]
ano0 = int(INICIO[:4])
fim = HOJE[:7]
meses = []
y, m = ano0, 1
while f"{y}-{m:02d}" <= fim:
    meses.append(f"{y}-{m:02d}")
    m += 1
    if m > 12:
        y, m = y + 1, 1
idx = {k: i for i, k in enumerate(meses)}

tipos = {t["id"]: t["sigla"] for t in L("materia__tipomaterialegislativa.jsonl")}
ESC = {"PLO", "PLC", "PDL", "PRE", "PELOM", "IND", "REQ", "MOC", "EMEND", "EMADI", "EMMOD", "EMSUB", "EMSUP", "EMIMP", "EMMEN", "SUBST"}
mats = [m for m in L("materia__materialegislativa_desde2025.jsonl") if tipos[m["tipo"]] in ESC]
prop_mes = [[0] * 5 for _ in meses]
cat = C.Counter()
for mt in mats:
    g, _ = classificar(tipos[mt["tipo"]], mt["ementa"])
    k = mt["data_apresentacao"][:7]
    if k in idx:
        prop_mes[idx[k]][g] += 1
    if g == 0:
        cat[E.NOMES_CAT[E.categoria(mt["ementa"])]] += 1

ses = {s["id"]: s for s in L("sessao__sessaoplenaria.jsonl")}
pre = L("sessao__sessaoplenariapresenca.jsonl")
com_lista = {p["sessao_plenaria"] for p in pre}
lista = sorted([s for s in ses.values() if s["id"] in com_lista and INICIO <= s["data_inicio"] <= HOJE], key=lambda s: (s["data_inicio"], s["id"]))
sessoes_mes = [0] * len(meses)
for s in lista:
    sessoes_mes[idx[s["data_inicio"][:7]]] += 1
pres_por = C.defaultdict(set)
for p in pre:
    pres_por[p["parlamentar"]].add(p["sessao_plenaria"])

votos = C.Counter()
for v in geral["vereadores"]:
    for k in "FCAXP?":
        votos[k] += v["votos"][k]

por = {}
for v in geral["vereadores"]:
    pid = v["id"]
    tira = "".join("1" if s["id"] in pres_por[pid] else "0" for s in lista)
    pm = [[0, 0] for _ in meses]
    for s in lista:
        i = idx[s["data_inicio"][:7]]
        pm[i][0] += 1
        pm[i][1] += 1 if s["id"] in pres_por[pid] else 0
    pj = json.load(open(site / "dados" / "p" / f"{pid}.json", encoding="utf-8"))
    vm = [[0] * 5 for _ in meses]
    for x in pj:
        k = x["d"][:7]
        if k in idx:
            vm[idx[k]][x["g"]] += 1
    por[str(pid)] = {"tira": tira, "pres_mes": pm, "prop_mes": vm}

# "todos votaram igual": entre os vereadores que votaram sim, não ou abstenção, todos escolheram a mesma opção
vj = json.load(open(site / "dados" / "votos.json", encoding="utf-8"))
por_votacao = C.defaultdict(set)
for pid_, mapa in vj["votos"].items():
    for vid, cod in mapa.items():
        if cod in ("F", "C", "A"):
            por_votacao[vid].add(cod)
nominais = [str(x["id"]) for x in vj["votacoes"]]
iguais = sum(1 for vid in nominais if len(por_votacao[vid]) == 1)
com_voto = sum(1 for vid in nominais if len(por_votacao[vid]) >= 1)
unanimes = {"votacoes": len(nominais), "com_voto_valido": com_voto, "todos_iguais": iguais}

out = {"unanimes": unanimes, "meses": meses, "prop_mes": prop_mes, "sessoes_mes": sessoes_mes,
       "categorias": [[n, c] for n, c in cat.most_common()], "votos_totais": dict(votos),
       "total_propostas": len(mats), "por_vereador": por}
json.dump(out, open(site / "dados" / "graficos.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("meses:", len(meses), "| sessões com lista:", len(lista), "| propostas:", len(mats), "| votos:", dict(votos))
print("tamanho KB:", round((site / "dados" / "graficos.json").stat().st_size / 1024))
