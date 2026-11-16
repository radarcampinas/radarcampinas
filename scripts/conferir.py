"""Refaz as conferências e grava site/dados/verificacao.json (a página "Transparência" lê este arquivo).

Uso: python -I -X utf8 conferir.py <pasta_raw> <pasta_site> <pasta_data>
Precisa de: data/relatorio_presenca_sessao_oficial.html, data/relatorio_presenca_ordemdia_oficial.html,
data/amostra_atas.json e data/atas/*.txt (veja README). Consulta a internet só para as páginas /sessao/ID/presenca.
"""
import json, re, sys, html, pathlib, unicodedata, urllib.request, urllib.parse, collections as C
from datetime import date

raw, site, data = (pathlib.Path(a) for a in sys.argv[1:4])
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from enderecos import extrair


def L(n):
    return [json.loads(l) for l in open(raw / n, encoding="utf-8")]


def N(s):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFD", (s or "").lower()).encode("ascii", "ignore").decode()).strip(" .")


geral = json.load(open(site / "dados" / "geral.json", encoding="utf-8"))
meus = {v["nome"]: v for v in geral["vereadores"]}
INICIO, HOJE = geral["meta"]["inicio"], geral["meta"]["gerado_em"]
parl = {p["id"]: p["nome_parlamentar"] for p in L("parlamentares__parlamentar.jsonl")}
ses = {s["id"]: s for s in L("sessao__sessaoplenaria.jsonl")}
out = {"gerado_em": HOJE}


# ---------- relatório oficial de presença ----------
def tabela_oficial(arq):
    h = open(data / arq, encoding="utf-8", errors="replace").read()
    t = re.findall(r"<table.*?</table>", h, re.S)[0]
    linhas = {}
    for r in re.findall(r"<tr.*?</tr>", t, re.S):
        c = [html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", x))).strip() for x in re.findall(r"<t[dh][^>]*>.*?</t[dh]>", r, re.S)]
        if len(c) >= 6 and c[1] in ("Sim", "Não"):
            linhas[c[0].split(" / ")[0]] = c
    txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>|<style.*?</style>|<table.*?</table>", "", h, flags=re.S)))
    m = re.search(r"SESS.ES: (\d+) - ORDENS DO DIA: (\d+)", txt)
    return linhas, int(m.group(1)), int(m.group(2))


rel, den_sessoes, _ = tabela_oficial("relatorio_presenca_sessao_oficial.html")
iguais = [n for n in meus if n in rel and int(rel[n][3]) == meus[n]["presenca"]["presente"]]
out["presenca_relatorio"] = {
    "comparados": len(meus), "iguais": len(iguais), "periodo": f"01/01/2025 a 14/11/2026",
    "sessoes_base_oficial": den_sessoes, "sessoes_com_lista_nossa": geral["meta"]["total_sessoes_com_lista"],
    "diferentes": [n for n in meus if n not in iguais]}
out["partido"] = {"comparados": len(meus), "iguais": sum(1 for n in meus if n in rel and rel[n][0].split(" / ")[1] == meus[n]["partido"])}
out["ativo"] = {"comparados": len(meus), "iguais": sum(1 for n in meus if n in rel and (rel[n][2] == "Sim") == meus[n]["ativo"])}

relod, _, den_od = tabela_oficial("relatorio_presenca_ordemdia_oficial.html")
pod = C.defaultdict(set)
for p in L("sessao__presencaordemdia.jsonl"):
    s = ses[p["sessao_plenaria"]]
    if INICIO <= s["data_inicio"] <= HOJE:
        pod[parl[p["parlamentar"]]].add(p["sessao_plenaria"])
out["presenca_ordemdia"] = {"comparados": len(relod), "iguais": sum(1 for n, c in relod.items() if len(pod[n]) == int(c[5]))}

# ---------- atas em PDF e páginas oficiais das sessões ----------
pre = C.defaultdict(set)
for p in L("sessao__sessaoplenariapresenca.jsonl"):
    pre[p["sessao_plenaria"]].add(N(parl[p["parlamentar"]]))
nomes_ok = {N(n) for n in parl.values()}
amostra = json.load(open(data / "amostra_atas.json", encoding="utf-8"))
dif, registros, divergentes, ilegiveis = [], 0, 0, []
for a in amostra:
    t = re.sub(r"\s+", " ", open(data / "atas" / f"{a['id']}.txt", encoding="utf-8").read())
    m = re.search(r"VEREADORES PRESENTES\d*:\s*(?:Senhores|Senhoras|Senhor|Senhora)?\s*(.*?)\.\s*(?:ABERTURA|Às|AS )", t)
    if not m:
        ilegiveis.append(a["id"]); continue
    ata = {N(x) for x in re.split(r",\s*|\s+e\s+(?=[A-ZÁÉÍÓÚ])", m.group(1)) if x.strip()}
    api = pre[a["id"]]
    registros += len(api)
    so_ata, so_api = sorted(ata - api), sorted(api - ata)
    divergentes += len(so_ata) + len(so_api)
    if so_ata or so_api:
        dif.append({"id": a["id"], "data": a["data"], "tipo": a["tipo"], "so_ata": so_ata, "so_sistema": so_api,
                    "ata_pdf": "https://sapl.campinas.sp.leg.br" + urllib.parse.quote(a["ata"]),
                    "pagina": f"https://sapl.campinas.sp.leg.br/sessao/{a['id']}/presenca"})
out["atas"] = {"amostra": len(amostra), "lidas": len(amostra) - len(ilegiveis), "iguais": len(amostra) - len(ilegiveis) - len(dif),
               "diferentes": dif, "registros_comparados": registros, "nomes_divergentes": divergentes,
               "taxa_divergencia": round(divergentes / registros, 4) if registros else None,
               "nota": "O rodapé de cada ata diz que a lista foi feita a partir do sistema da Câmara: não é fonte totalmente independente."}

iguais_pg = 0
for a in amostra:
    try:
        h = urllib.request.urlopen(urllib.request.Request(f"https://sapl.campinas.sp.leg.br/sessao/{a['id']}/presenca", headers={"User-Agent": "radarcampinas-verificacao"}), timeout=60).read().decode("utf-8", "replace")
        tt = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>|<style.*?</style>", "", h, flags=re.S))))
        i = tt.find("Parlamentares presentes"); blk = tt[i:]
        j = min([blk.find(x) for x in ("Parlamentares ausentes", "Desenvolvido pelo") if blk.find(x) > 0] or [len(blk)])
        pg = {N(x.split(" / ")[0]) for x in re.findall(r"- ([^/]+?) / ", blk[:j])}
        iguais_pg += pg == pre[a["id"]]
    except Exception:
        pass
out["pagina_sessao"] = {"amostra": len(amostra), "iguais": iguais_pg}

# ---------- propostas: campo "autores" x tabela oficial de autoria ----------
autores = {a["id"]: a for a in L("base__autor.jsonl")}
tipos = {t["id"]: t["sigla"] for t in L("materia__tipomaterialegislativa.jsonl")}
mats = {m["id"]: m for m in L("materia__materialegislativa_desde2025.jsonl")}
ESC = {"PLO", "PLC", "PDL", "PRE", "PELOM", "IND", "REQ", "MOC", "EMEND", "EMADI", "EMMOD", "EMSUB", "EMSUP", "EMIMP", "EMMEN", "SUBST"}
aut = C.defaultdict(set)
for a in L("materia__autoria.jsonl"):
    m = mats.get(a["materia"])
    if m and tipos[m["tipo"]] in ESC:
        au = autores.get(a["autor"])
        if au and au["tipo"] == 1:
            aut[au["object_id"]].add(a["materia"])
out["autoria"] = {"comparados": len(meus), "iguais": sum(1 for v in meus.values() if len(aut[v["id"]]) == v["propostas"]["total"])}

# ---------- votos ----------
od = {o["id"]: o for o in L("sessao__ordemdia.jsonl")}
ex = {o["id"]: o for o in L("sessao__expedientemateria.jsonl")}
rv = {r["id"]: r for r in L("sessao__registrovotacao.jsonl")}


def sessao_de(r):
    o = od.get(r["ordem"]) if r["ordem"] else ex.get(r["expediente"])
    return o["sessao_plenaria"] if o else None


votos = L("sessao__votoparlamentar.jsonl")
cont = C.defaultdict(C.Counter)
for v in votos:
    cont[v["votacao"]][v["voto"]] += 1
ok = bad = 0
for i, c in cont.items():
    r = rv[i]
    t = (c["Sim"], c["Não"] + c["Nao"], c["Abstenção"])
    if t == (r["numero_votos_sim"], r["numero_votos_nao"], r["numero_abstencoes"]):
        ok += 1
    else:
        bad += 1
votou, nominais_sessoes = C.defaultdict(set), set()
for v in votos:
    s = sessao_de(rv[v["votacao"]])
    if s and ses[s]["data_inicio"] >= INICIO:
        nominais_sessoes.add(s)
        if v["voto"] in ("Sim", "Não", "Nao", "Abstenção"):
            votou[s].add(v["parlamentar"])
pre_ids = C.defaultdict(set)
for p in L("sessao__sessaoplenariapresenca.jsonl"):
    pre_ids[p["sessao_plenaria"]].add(p["parlamentar"])
out["votos"] = {"votacoes_desde_inicio": geral["meta"]["total_votacoes_desde_inicio"], "votacoes_nominais": geral["meta"]["total_votacoes_nominais"],
                "resumo_confere": ok, "resumo_diverge": bad,
                "votaram_sem_constar_na_presenca": sum(len(votou[s] - pre_ids[s]) for s in nominais_sessoes if s in pre_ids),
                "sessoes_nominais_sem_lista": sum(1 for s in nominais_sessoes if s not in pre_ids),
                "segunda_fonte": False}

# ---------- salário (salariômetro) ----------
# O valor vem da Resolução nº 1.000/2023 (texto lido à mão em data/fontes/). O número de cadeiras não aparece
# em nenhuma norma que achamos: deduzimos do registro de votação (quantos vereadores têm voto em cada votação).
quem_votou = C.defaultdict(set)
for v in votos:
    s = sessao_de(rv[v["votacao"]])
    if s and ses[s]["data_inicio"] >= INICIO:
        quem_votou[v["votacao"]].add(v["parlamentar"])
tamanhos = C.Counter(len(x) for x in quem_votou.values())
cadeiras = tamanhos.most_common(1)[0][0]
out["salario"] = {
    "valor_mensal": 17800, "cadeiras": cadeiras, "inicio": INICIO,
    "votacoes_com_cadeiras": tamanhos[cadeiras], "votacoes_total": sum(tamanhos.values()),
    "norma": {"id": 53154, "nome": "Resolução nº 1.000, de 19 de abril de 2023", "pagina": "https://sapl.campinas.sp.leg.br/norma/53154",
              "pdf": "https://sapl.campinas.sp.leg.br/media/sapl/public/normajuridica/2023/53154/53154_texto_integral.pdf"},
    "extras": {"id": 53213, "nome": "Lei Complementar nº 412, de 4 de maio de 2023", "pagina": "https://sapl.campinas.sp.leg.br/norma/53213"},
    "revisao_posterior": False,
}

# ---------- gastos (TCE-SP) e licitações (PNCP) ----------
import gzip as _gz, glob as _glob
def _dados(n):
    p = site / "dados" / n
    return json.load(open(p, encoding="utf-8")) if p.exists() else None


gasto, lic, ctr = _dados("gastos.json"), _dados("licitacoes.json"), _dados("contratos.json")
if gasto:
    meses_ok = gasto["meses"]
    esperados = []
    a, m_ = int(meses_ok[0][:4]), int(meses_ok[0][5:])
    while f"{a}-{m_:02d}" <= meses_ok[-1]:
        esperados.append(f"{a}-{m_:02d}"); m_ += 1
        if m_ > 12:
            a, m_ = a + 1, 1
    cnpj_pagos = set(); pago_cnpj = {}
    for arq in _glob.glob(str(raw / "tce" / "despesas_*.json.gz")):
        for x in json.load(_gz.open(arq, "rt", encoding="utf-8")):
            if x["evento"] == "Valor Pago" and x["id_fornecedor"].startswith("CNPJ"):
                _c = re.search(r"(\d{14})", x["id_fornecedor"]).group(1)
                cnpj_pagos.add(_c); pago_cnpj[_c] = pago_cnpj.get(_c, 0) + float(x["vl_despesa"].replace(".", "").replace(",", "."))
    forn_ctr = {r[3] for r in (ctr["itens"] if ctr else []) if r[3] and not r[9]}
    out["gastos"] = {"registros": gasto["registros"], "meses": len(meses_ok), "primeiro": meses_ok[0], "ultimo": meses_ok[-1],
                     "sem_buracos": meses_ok == esperados, "pago_total": gasto["pago_total"], "soma_confere": abs(sum(gasto["pago_mes"]) - gasto["pago_total"]) < 1,
                     "fornecedores_contratos_no_tce": [len(forn_ctr & cnpj_pagos), len(forn_ctr)],
                     "camara_pago": gasto["camara"]["pago_total"], "terceiros_total": gasto["terceiros_total"], "internos_total": gasto["internos_total"],
                     "segunda_fonte_dos_totais": False,
                     "contratos_acima_1bi": [{"fornecedor": r[2], "valor": r[5], "pago_no_tce": round(pago_cnpj.get(r[3], 0), 2)} for r in (ctr["itens"] if ctr else []) if r[10]]}
if lic:
    out["licitacoes"] = {"compras": lic["n"], "contratos": ctr["n"] if ctr else 0, "valor_homologado": lic["valor_homologado"],
                         "ids_unicos": len({r[0] for r in lic["itens"]}) == lic["n"], "orgaos": lic["orgaos"],
                         "primeira": min((r[1] for r in lic["itens"]), default=""), "ultima": max((r[1] for r in lic["itens"]), default="")}

# ---------- extração de rua e bairro ----------
ind = [m for m in mats.values() if tipos[m["tipo"]] == "IND"]
R = [extrair(m["ementa"]) for m in ind]
out["extracao"] = {"indicacoes": len(ind), "com_rua": round(sum(1 for r in R if r[0]) / len(ind), 3), "com_bairro": round(sum(1 for r in R if r[1]) / len(ind), 3),
                   "amostra_manual": {"n": 40, "erros_claros_rua_ou_bairro": 3, "erros_claros_tipo_de_pedido": 1,
                                      "nota": "Lida à mão por quem fez o site, em 14/11/2026. Amostra pequena: margem de erro grande."}}

# ---------- downloads ----------
baixas = []
for arq in ("download.log", "materias.log"):
    p = data / arq
    if p.exists():
        for l in open(p, encoding="utf-8", errors="replace"):
            m = re.search(r"(\S+): conclu\S+ \[(\w+)\] esperado=(\d+) baixado_unico=(\d+)", l)
            if m:
                baixas.append({"endpoint": m.group(1), "esperado": int(m.group(3)), "baixado": int(m.group(4)), "ok": m.group(2) == "OK"})
            m = re.search(r"conclu\S+ \[(\w+)\] esperado=(\d+) unico=(\d+)", l)
            if m:
                baixas.append({"endpoint": "materia/materialegislativa (desde 2025)", "esperado": int(m.group(2)), "baixado": int(m.group(3)), "ok": m.group(1) == "OK"})
out["downloads"] = baixas

# Registro de erros nossos que já foram achados e corrigidos (mantido à mão; mostrado na página Transparência).
out["correcoes"] = [
    {"data": "14/11/2026", "o_que": "A API da Câmara repete e perde registros ao paginar sem ordenação (a presença veio com 37.450 registros únicos em 44.013 linhas).",
     "efeito": "Passamos a pedir sempre ordenado por id e a conferir se a contagem baixada é igual ao total informado. Todos os downloads fecharam."},
    {"data": "14/11/2026", "o_que": "O site dizia que quase todas as sessões extraordinárias não têm lista de presença.",
     "efeito": "Errado: 19 de 25 têm. Só as solenes (86) e 6 extraordinárias de 08/05/2025 não têm. Texto corrigido."},
    {"data": "14/11/2026", "o_que": "Um erro no nosso programa que lê a rua no texto criava ruas falsas (como “Praça Situada”) e, ao ser consertado, passou a rejeitar ruas verdadeiras (como “Avenida das Amoreiras”).",
     "efeito": "Corrigido e refeito. Os pedidos repetidos passaram de 737 para 724 combinações."},
    {"data": "14/11/2026", "o_que": "Vários pedidos diferentes feitos no mesmo dia para o mesmo lugar apareciam como pedido repetido.",
     "efeito": "Agora só conta como repetido o mesmo tipo de pedido em pelo menos 3 datas diferentes."},
]

json.dump(out, open(site / "dados" / "verificacao.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in out.items() if k not in ("downloads",)}, ensure_ascii=False, indent=1)[:3500])
print("downloads registrados:", len(baixas), "| todos ok:", all(b["ok"] for b in baixas))
