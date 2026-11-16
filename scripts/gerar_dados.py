"""Gera os JSON do site a partir de data/raw (dados baixados da API oficial do SAPL).

Uso: python -I gerar_dados.py <pasta_raw> <pasta_site>
Nada aqui dá nota ou opinião: só contagens e listas copiadas dos registros oficiais.
"""
import json, sys, pathlib, collections as C
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from classificar import classificar, GRUPOS as GRUPOS_PROP, REGRAS
from datetime import date

raw = pathlib.Path(sys.argv[1]); site = pathlib.Path(sys.argv[2])
(site / "dados" / "p").mkdir(parents=True, exist_ok=True)
INICIO = "2025-01-01"  # 19ª legislatura
LEG = 19
HOJE = date.today().isoformat()


def L(nome):
    return [json.loads(l) for l in open(raw / nome, encoding="utf-8")]


parl = {p["id"]: p for p in L("parlamentares__parlamentar.jsonl")}
mand = [m for m in L("parlamentares__mandato.jsonl") if m["legislatura"] == LEG]
partidos = {p["id"]: p for p in L("parlamentares__partido.jsonl")}
filiacoes = L("parlamentares__filiacao.jsonl")
autores = {a["id"]: a for a in L("base__autor.jsonl")}
ses = {s["id"]: s for s in L("sessao__sessaoplenaria.jsonl")}
pres = L("sessao__sessaoplenariapresenca.jsonl")
od = {o["id"]: o for o in L("sessao__ordemdia.jsonl")}
ex = {o["id"]: o for o in L("sessao__expedientemateria.jsonl")}
rv = {r["id"]: r for r in L("sessao__registrovotacao.jsonl")}
votos = L("sessao__votoparlamentar.jsonl")
tipos_res = {t["id"]: t["nome"] for t in L("sessao__tiporesultadovotacao.jsonl")}
tipos_mat = {t["id"]: t for t in L("materia__tipomaterialegislativa.jsonl")}
materias = {m["id"]: m for m in L("materia__materialegislativa_desde2025.jsonl")}

# ---------- vereadores da 19ª legislatura ----------
ids = sorted({m["parlamentar"] for m in mand}, key=lambda i: parl[i]["nome_parlamentar"].lower())
autor_de = {}  # parlamentar -> autor
for a in autores.values():
    if a["tipo"] == 1:
        autor_de[a["object_id"]] = a["id"]


def partido_atual(pid):
    f = [x for x in filiacoes if x["parlamentar"] == pid and not x["data_desfiliacao"]]
    f.sort(key=lambda x: x["data"])
    return partidos[f[-1]["partido"]]["sigla"] if f else None


# ---------- presença ----------
sessoes_lista = {p["sessao_plenaria"] for p in pres}
S = [s for s in ses.values() if s["id"] in sessoes_lista and INICIO <= s["data_inicio"] <= HOJE]
total_sessoes = len(S)
nao_solenes = [x for x in ses.values() if x["tipo"] != "Solene" and INICIO <= x["data_inicio"] <= HOJE]
Sids = {s["id"] for s in S}
ultima_sessao = max(s["data_inicio"] for s in S)
pres_por = C.defaultdict(set)
for p in pres:
    if p["sessao_plenaria"] in Sids:
        pres_por[p["parlamentar"]].add(p["sessao_plenaria"])

# ---------- votações nominais ----------
def sessao_da_votacao(r):
    o = od.get(r["ordem"]) if r["ordem"] else ex.get(r["expediente"])
    return ses.get(o["sessao_plenaria"]) if o else None


NORM = {"Sim": "F", "Não": "C", "Nao": "C", "Abstenção": "A", "Ausente": "X", "Ausente na Votação": "X",
        "Presidente não vota": "P", "Na Presid.": "P"}  # tudo o mais -> "?"
vot_info = {}
for r in rv.values():
    s = sessao_da_votacao(r)
    if s and s["data_inicio"] >= INICIO:
        txt = r["__str__"]
        nome = txt.split("Matéria: ", 1)[1] if "Matéria: " in txt else txt
        m = materias.get(r["materia"])
        vot_info[r["id"]] = {
            "id": r["id"], "d": s["data_inicio"], "n": nome, "m": r["materia"],
            "e": (m["ementa"] if m else None), "r": tipos_res.get(r["tipo_resultado_votacao"], ""),
            "s": r["numero_votos_sim"], "c": r["numero_votos_nao"], "a": r["numero_abstencoes"],
        }
vt_por = C.defaultdict(dict)
for v in votos:
    if v["votacao"] in vot_info:
        vt_por[v["parlamentar"]][v["votacao"]] = NORM.get(v["voto"], "?")
vot_lista = sorted(vot_info.values(), key=lambda x: (x["d"], x["id"]), reverse=True)
votacoes_com_nominal = {i for d in vt_por.values() for i in d}
vot_lista = [v for v in vot_lista if v["id"] in votacoes_com_nominal]
total_votacoes_19 = len(vot_info)

# ---------- propostas ----------
GRUPOS = [
    ("Leis e normas", "Propostas que criam ou mudam regras.", [
        ("PLO", "Projeto de lei", "Propõe uma lei nova ou muda uma lei que já existe."),
        ("PLC", "Projeto de lei complementar", "Propõe uma lei sobre temas que exigem mais votos para serem aprovados."),
        ("PDL", "Projeto de decreto legislativo", "Propõe um ato da Câmara que não depende do prefeito, como homenagens e títulos."),
        ("PRE", "Projeto de resolução", "Propõe uma regra interna da Câmara."),
        ("PELOM", "Mudança na Lei Orgânica", "Propõe mudar a Lei Orgânica, a “constituição” do município."),
    ]),
    ("Sugestões e pedidos", "Não criam lei: pedem ou sugerem algo.", [
        ("IND", "Indicação", "Sugere ao prefeito uma obra, serviço ou providência. Ele não é obrigado a atender."),
        ("REQ", "Requerimento", "Pede uma informação ou providência, ou um procedimento dentro da Câmara."),
    ]),
    ("Homenagens e manifestações", "", [
        ("MOC", "Moção", "Manifesta aplauso, protesto ou apelo. Não cria obrigação para ninguém."),
    ]),
    ("Mudanças em outros projetos", "", [
        ("EMEND", "Emenda", "Sugere mudar o texto de um projeto que já está na Câmara."),
        ("EMADI", "Emenda aditiva", "Sugere acrescentar algo ao texto de um projeto."),
        ("EMMOD", "Emenda modificativa", "Sugere trocar um trecho do texto de um projeto."),
        ("EMSUB", "Emenda substitutiva", "Sugere trocar o texto de um projeto por outro."),
        ("EMSUP", "Emenda supressiva", "Sugere tirar um trecho do texto de um projeto."),
        ("EMIMP", "Emenda impositiva", "Indica onde aplicar uma parte do orçamento do município."),
        ("EMMEN", "Emenda de mensagem aditiva", "Sugere acrescentar algo a um projeto enviado pelo prefeito."),
        ("SUBST", "Substitutivo", "Propõe um texto novo no lugar do texto de um projeto."),
    ]),
]
sigla_para_tipo_ids = C.defaultdict(set)
for t in tipos_mat.values():
    sigla_para_tipo_ids[t["sigla"]].add(t["id"])
tipo_info = {}
for gi, (g, _, itens) in enumerate(GRUPOS):
    for sigla, nome, expl in itens:
        for tid in sigla_para_tipo_ids[sigla]:
            tipo_info[tid] = {"sigla": sigla, "nome": nome, "expl": expl, "g": gi}

prop_por = C.defaultdict(list)
for m in materias.values():
    ti = tipo_info.get(m["tipo"])
    if not ti:
        continue
    for a in m["autores"]:
        au = autores.get(a)
        if au and au["tipo"] == 1:
            prop_por[au["object_id"]].append((m, ti))

# ---------- saída ----------
SAPL = "https://sapl.campinas.sp.leg.br"
pessoas = []
for pid in ids:
    p = parl[pid]
    mm = [m for m in mand if m["parlamentar"] == pid]
    datas = sorted(pres_por[pid] and [ses[s]["data_inicio"] for s in pres_por[pid]])
    c = C.Counter(vt_por[pid].values())
    props = sorted(prop_por[pid], key=lambda x: (x[0]["data_apresentacao"], x[0]["id"]), reverse=True)
    cls = [classificar(ti["sigla"], m["ementa"]) for m, ti in props]
    por_grupo = C.Counter(g for g, _ in cls)
    pessoas.append({
        "id": pid, "nome": p["nome_parlamentar"], "nome_completo": p["nome_completo"],
        "partido": partido_atual(pid), "ativo": p["ativo"], "foto": p["fotografia"],
        "titular": any(m["titular"] for m in mm),
        "autor_id": autor_de.get(pid),
        "presenca": {"presente": len(pres_por[pid]), "primeira": datas[0] if datas else None,
                     "ultima": datas[-1] if datas else None},
        "votos": {"F": c["F"], "C": c["C"], "A": c["A"], "X": c["X"], "P": c["P"], "?": c["?"],
                  "total": sum(c.values())},
        "propostas": {"total": len(props), "por_grupo": [por_grupo[i] for i in range(len(GRUPOS_PROP))]},
    })
    json.dump(
        [{"i": m["id"], "s": ti["sigla"], "t": ti["nome"], "g": g, "r": r, "d": m["data_apresentacao"], "n": m["__str__"],
          "e": m["ementa"], "co": len([a for a in m["autores"] if autores.get(a, {}).get("tipo") == 1])}
         for (m, ti), (g, r) in zip(props, cls)],
        open(site / "dados" / "p" / f"{pid}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

meta = {
    "gerado_em": HOJE, "inicio": INICIO, "ultima_sessao_com_lista": ultima_sessao,
    "total_sessoes_com_lista": total_sessoes, "sessoes_nao_solenes": len(nao_solenes), "total_votacoes_desde_inicio": total_votacoes_19,
    "total_votacoes_nominais": len(vot_lista),
    "materias_baixadas": len(materias), "grupos": GRUPOS_PROP, "regras": [{"g": g, "t": t} for g, t in REGRAS],
    "api": SAPL + "/api",
}
json.dump({"meta": meta, "vereadores": pessoas}, open(site / "dados" / "geral.json", "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
json.dump({"votacoes": vot_lista, "votos": {str(pid): vt_por[pid] for pid in ids}},
          open(site / "dados" / "votos.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(json.dumps(meta, ensure_ascii=False, indent=1))
for pz in pessoas:
    print(f"{pz['nome']:<22} pres={pz['presenca']['presente']:>3} votos={pz['votos']['total']:>3} props={pz['propostas']['total']:>4}")
