"""Gera site/dados/leis.json: leis e leis complementares sancionadas desde 2025 e quem apresentou o projeto.

Uso: python -I -X utf8 gerar_leis.py <pasta_raw> <pasta_site>
Fonte: SAPL (norma/normajuridica ligada à matéria de origem + autoria da matéria). Oficial: lei, data, texto, matéria e autores.
Nosso (estimativa): o tipo da lei (regra pelas primeiras palavras da ementa, igual para todos)."""
import json, re, sys, pathlib, collections, datetime

raw, site = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
rd = lambda f: [json.loads(l) for l in open(raw / f, encoding="utf-8")]
leis = rd("norma__leis.jsonl")
orig = {r["materia"]["id"]: r for r in rd("norma__materias.jsonl")}
autores = {a["id"]: a for a in rd("base__autor.jsonl")}
ver = {v["id"] for v in json.load(open(site / "dados" / "geral.json", encoding="utf-8"))["vereadores"]}

TIPOS = ["Nome de rua, praça ou local", "Data, semana ou campanha", "Reconhecimento (utilidade pública e similares)", "Muda uma lei que já existe", "Terrenos e bens públicos", "Outras leis"]
REGRAS = [
    (r"^(DENOMINA|DÁ (O )?NOME|ATRIBUI (O )?NOME|CONFERE (O )?NOME|OFICIALIZA)", 0),
    (r"^INSTITUI,? ?(NO [^,]{0,60},? )?(O |A |OS |AS )?(DIA|SEMANA|MÊS|MES|CAMPANHA|DATA|ANO|JORNADA|DECÊNIO|SETEMBRO|OUTUBRO|NOVEMBRO|AGOSTO|MAIO|JULHO|ABRIL|JUNHO|MARÇO|FEVEREIRO|JANEIRO|DEZEMBRO)|^INSTITUI.*(CALENDÁRIO|NO CALENDÁRIO)|^INCLUI.*CALENDÁRIO", 1),
    (r"^DECLARA (DE )?(ÓRGÃO|ENTIDADE|UTILIDADE|PATRIM|BEM|ESPAÇO|ATIVIDADE|CAPITAL|O |A )", 2),
    (r"^(ALTERA|REVOGA|INCLUI|ACRESCENTA|DÁ NOVA REDAÇÃO|ESTABELECE NOVA|MODIFICA|REVIGORA|RESTABELECE)", 3),
    (r"^(DESAFETA|DESINCORPORA|AUTORIZA.{0,80}(ALIENAR|DOAR|DOAÇÃO|CESSÃO|PERMUTA|CONCEDER DIREITO REAL)|DISPÕE SOBRE.{0,60}(IMÓVEIS?|ÁREA|TERRENO))", 4),
]
def tipo_de(e):
    e = e.upper().strip()
    for r, k in REGRAS:
        if re.search(r, e):
            return k
    return 5

NOME = {1: "Lei", 2: "Lei Complementar", 9: "Emenda à Lei Orgânica"}
itens, por_v, por_origem, por_tipo = [], collections.defaultdict(lambda: [0, 0]), collections.Counter(), collections.Counter()
por_mes = collections.Counter()
for n in sorted(leis, key=lambda n: (n["data"], n["id"])):
    o = orig.get(n["materia"]) if n["materia"] else None
    vs, outros, origem = [], [], "?"
    if o:
        tipos = set()
        for a in o["autoria"]:
            au = autores.get(a["autor"])
            if not au:
                continue
            tipos.add(au["tipo"])
            if au["tipo"] == 1:
                pid = au["object_id"]
                (vs if pid in ver else outros).append(pid if pid in ver else au["nome"])
                if pid in ver:
                    por_v[pid][0] += 1
                    por_v[pid][1] += 1 if a["primeiro_autor"] else 0
        origem = "V" if 1 in tipos else "E" if 4 in tipos else "M" if 5 in tipos else "O"
    k = tipo_de(n["ementa"])
    d_apres = o["materia"]["data_apresentacao"] if o else None
    dias = (datetime.date.fromisoformat(n["data"]) - datetime.date.fromisoformat(d_apres)).days if d_apres else None
    itens.append({"i": n["id"], "n": n["__str__"], "d": n["data"], "e": n["ementa"], "k": k, "o": origem, "v": vs, "x": outros,
                  "m": n["materia"], "mn": o["materia"]["__str__"] if o else None, "md": d_apres, "dias": dias, "t": NOME[n["tipo"]]})
    por_origem[origem] += 1; por_tipo[k] += 1; por_mes[n["data"][:7]] += 1
out = {"gerado_em": datetime.date.today().isoformat(), "n": len(itens), "tipos": TIPOS, "por_tipo": [por_tipo[i] for i in range(len(TIPOS))],
       "por_origem": dict(por_origem), "por_mes": sorted(por_mes.items()), "por_vereador": {str(k): v for k, v in por_v.items()}, "itens": itens}
json.dump(out, open(site / "dados" / "leis.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(itens), "leis | origem", dict(por_origem), "| tipos", out["por_tipo"], "| vereadores com lei", len(por_v))
sem = [i for i in itens if i["o"] == "V" and not i["v"]]
print("projetos de vereador sem vereador da 19ª:", len(sem))
