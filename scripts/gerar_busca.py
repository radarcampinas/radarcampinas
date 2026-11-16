"""Gera site/dados/busca.json: índice de pedidos por rua e bairro, e a tabela de repetições.

Uso: python -I gerar_busca.py <pasta_raw> <pasta_site>

Repetição = o mesmo tipo de pedido (Indicações), na mesma rua (e no mesmo bairro, quando o texto informa),
apresentado em pelo menos 3 DATAS diferentes. Vários pedidos no mesmo dia contam como uma data só, porque
costumam ser pedidos diferentes feitos de uma vez. Regra única para todos. Não mostra o que a Prefeitura respondeu.
"""
import json, sys, pathlib, re, collections as C
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from enderecos import extrair, categoria, NOMES_CAT, norm
from classificar import classificar

raw = pathlib.Path(sys.argv[1]); site = pathlib.Path(sys.argv[2])
MIN_REPETIDO = 3
TIPOS_BUSCA = {"PLO", "PLC", "PDL", "PRE", "PELOM", "IND", "REQ", "MOC", "EMEND", "EMADI", "EMMOD", "EMSUB", "EMSUP", "EMIMP", "EMMEN", "SUBST"}


def L(n):
    return [json.loads(l) for l in open(raw / n, encoding="utf-8")]


tipos = {t["id"]: t for t in L("materia__tipomaterialegislativa.jsonl")}
autores = {a["id"]: a for a in L("base__autor.jsonl")}
parl = {p["id"]: p["nome_parlamentar"] for p in L("parlamentares__parlamentar.jsonl")}
mats = L("materia__materialegislativa_desde2025.jsonl")

nomes_p, idx_p = [], {}
def pid(parlamentar_id):
    if parlamentar_id not in idx_p:
        idx_p[parlamentar_id] = len(nomes_p); nomes_p.append([parlamentar_id, parl[parlamentar_id]])
    return idx_p[parlamentar_id]

regs = []
for m in mats:
    t = tipos[m["tipo"]]; sg = t["sigla"]
    if sg not in TIPOS_BUSCA or not (m["ementa"] or "").strip():
        continue
    aut = sorted({pid(autores[a]["object_id"]) for a in m["autores"] if a in autores and autores[a]["tipo"] == 1})
    if not aut:
        continue
    g, rg = classificar(sg, m["ementa"])
    rua, bairro = extrair(m["ementa"]) if sg == "IND" else (None, None)
    regs.append({"i": m["id"], "d": m["data_apresentacao"], "s": sg, "g": g, "r": rg, "n": m["__str__"],
                 "e": " ".join(m["ementa"].split()), "a": aut, "rua": rua, "bai": bairro,
                 "c": categoria(m["ementa"]) if sg == "IND" and g == 0 else None})
def trecho_original(ementa, nome, pular=0):
    """Nome como está escrito (com acento) no texto oficial. Serve para exibir e para o link de busca oficial."""
    alvo = nome.split()[pular:]
    pal = ementa.split()
    npal = [norm(re.sub(r"[.,;:()]", "", w)) for w in pal]
    for i in range(len(npal) - len(alvo) + 1):
        if npal[i:i + len(alvo)] == alvo:
            return " ".join(re.sub(r"[.,;:()]+$", "", w) for w in pal[i:i + len(alvo)])
    return None


regs.sort(key=lambda r: (r["d"], r["i"]), reverse=True)

# ---- repetição: agrupar por rua; o bairro separa ruas de mesmo nome ----
por_rua = C.defaultdict(list)
for r in regs:
    if r["c"] is not None and r["rua"]:
        por_rua[r["rua"]].append(r)
grupos = []
for rua, lst in por_rua.items():
    nome_curto = len(rua.split()) <= 2          # "RUA 02", "RUA QUATRO": nome genérico
    bairros = {r["bai"] for r in lst if r["bai"]}
    for r in lst:
        # bairro efetivo: o do texto; se faltar e a rua só aparece com um bairro, usa esse
        r["_b"] = r["bai"] or (next(iter(bairros)) if len(bairros) == 1 else None)
    cel = C.defaultdict(list)
    for r in lst:
        if nome_curto and not r["_b"]:
            continue                             # nome genérico sem bairro: não dá para saber de qual rua é
        cel[(r["_b"], r["c"])].append(r)
    for (b, c), rs in cel.items():
        if len({r["d"] for r in rs}) >= MIN_REPETIDO:
            rs.sort(key=lambda r: r["d"])
            cont = C.Counter(a for r in rs for a in r["a"])
            bq = next((t for t in (trecho_original(r["e"], b) for r in rs) if t), None) if b else None
            q = next((t for t in (trecho_original(r["e"], rua, 1) for r in rs) if t), None)
            grupos.append({"rua": rua, "bairro": b, "c": c, "n": len(rs), "dias": len({r["d"] for r in rs}), "ids": [r["i"] for r in rs],
                           "datas": [r["d"] for r in rs], "q": q, "bq": bq, "por": sorted(cont.items(), key=lambda x: -x[1])})
grupos.sort(key=lambda g: (-g["dias"], -g["n"], g["rua"]))

saida = {"nomes": [n for _, n in nomes_p], "pids": [p for p, _ in nomes_p], "categorias": NOMES_CAT,
         "min_repetido": MIN_REPETIDO,
         "tipos": {t["sigla"]: t["descricao"] for t in tipos.values()},
         "pedidos": [{k: r[k] for k in ("i", "d", "s", "g", "r", "n", "e", "a", "rua", "bai", "c")} for r in regs],
         "repeticoes": grupos}
json.dump(saida, open(site / "dados" / "busca.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# ---- lugares para sugestão ao digitar e "mais citados" ----
def bonito(t):
    pequenas = {"de", "da", "do", "das", "dos", "e", "em", "na", "no"}
    return " ".join(w.lower() if i and w.lower() in pequenas else (w[:1].upper() + w[1:].lower()) for i, w in enumerate(t.split()))

VIA_NOME = {"RUA": "Rua", "AVENIDA": "Avenida", "PRACA": "Praça", "ALAMEDA": "Alameda", "TRAVESSA": "Travessa", "ESTRADA": "Estrada",
            "RODOVIA": "Rodovia", "VIADUTO": "Viaduto", "CAMINHO": "Caminho", "BECO": "Beco", "VIELA": "Viela", "LARGO": "Largo", "RUELA": "Ruela"}
cb, cr, db, dr = C.Counter(), C.Counter(), {}, {}
for r in regs:
    if r["s"] != "IND":
        continue
    if r["bai"]:
        cb[r["bai"]] += 1
        if r["bai"] not in db:
            db[r["bai"]] = trecho_original(r["e"], r["bai"])
    if r["rua"]:
        cr[r["rua"]] += 1
        if r["rua"] not in dr:
            dr[r["rua"]] = trecho_original(r["e"], r["rua"], 1)
bairros = [[bonito(db.get(b) or b), n] for b, n in cb.most_common() if n >= 3]
def nome_rua(x):
    via = x.split()[0]
    return bonito(f"{VIA_NOME.get(via, via)} {dr.get(x) or ' '.join(x.split()[1:])}")


ruas = [[nome_rua(x), n] for x, n in cr.most_common() if n >= 3 and len(x.split()) >= 2 and not x.split()[-1].isdigit() and len(" ".join(x.split()[1:])) >= 5]
json.dump({"bairros": bairros, "ruas": ruas, "nota": "Lidos por programa do texto das indicações; contam pedidos que citam o lugar."},
          open(site / "dados" / "locais.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
rec = [{"i": r["i"], "d": r["d"], "s": r["s"], "g": r["g"], "n": r["n"], "e": r["e"], "a": [nomes_p[a][1] for a in r["a"]], "ap": [nomes_p[a][0] for a in r["a"]]} for r in regs[:40]]
por_grupo = C.Counter(r["g"] for r in regs)
json.dump({"recentes": rec, "por_grupo": [por_grupo[i] for i in range(5)], "total": len(regs)},
          open(site / "dados" / "recentes.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("locais: bairros", len(bairros), "| ruas", len(ruas), "| recentes", len(rec))
print("pedidos no índice:", len(regs), "| tamanho:", round((site / "dados" / "busca.json").stat().st_size / 1e6, 1), "MB")
print("pedidos com rua:", sum(1 for r in regs if r["rua"]), "| grupos repetidos (>=%d):" % MIN_REPETIDO, len(grupos),
      "| pedidos dentro de repetições:", len({i for g in grupos for i in g["ids"]}))
for g in grupos[:8]:
    print(" ", g["dias"], "datas /", g["n"], "pedidos:", g["rua"], "|", g["bairro"], "|", NOMES_CAT[g["c"]], "|", g["datas"][0], "->", g["datas"][-1])
