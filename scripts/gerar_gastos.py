"""Gera site/dados/gastos.json e fornecedores.json a partir das despesas do TCE-SP (data/raw/tce).

Uso: python -I -X utf8 gerar_gastos.py <pasta_raw> <pasta_site>

Só somamos o que o TCE-SP publica. Escolhas nossas (estimativas, descritas na página Transparência):
- "Valor Pago" = soma dos registros com evento "Valor Pago".
- "Entidades da própria Prefeitura" = Município, Camprev, Fumec, Rede Mário Gatti, Setec, FJPO e Câmara. O dinheiro que uma passa para outra
  aparece nas duas pontas, então o "pago a terceiros" tira esses repasses para não contar em dobro.
- Pessoas físicas não aparecem com nome nem CPF: só o total.
"""
import sys as _s, pathlib as _p
_s.path.insert(0, str(_p.Path(__file__).parent))
import privacidade as P
import gzip, json, sys, glob, re, html, pathlib, collections as C

raw, site = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
INTERNOS = {"51885242000140", "06916689000185", "57500902000104", "47018676000176", "49413800000123", "52350980000156"}
TAGS = [("Banco", r"BANCO|CAIXA ECONOMICA|CAIXA ECONÔMICA|\bCEF\b|\bBB\b"),
        ("Justiça, tributos e encargos", r"MINIST[ÉE]RIO DA FAZENDA|RECEITA FEDERAL|INSS|FGTS|TRIBUNAL|FAZENDA|SECRETARIA"),
        ("Benefícios dos servidores", r"VEROCHEQUE|ALELO|SODEXO|TICKET|VALE ")]


def valor(x):
    return float(x["vl_despesa"].replace(".", "").replace(",", "."))


def limpa(nome):
    n = html.unescape(nome or "").replace("ï¿½", "?")
    return P.razao_social(re.sub(r"\s+", " ", n).strip())


def cnpj_de(i):
    m = re.search(r"(\d{14})", i or "")
    return m.group(1) if m else None


por_mes = C.defaultdict(lambda: C.defaultdict(float))
orgao_mes = C.defaultdict(lambda: C.defaultdict(float))
forn = C.defaultdict(lambda: {"pago": 0.0, "n": 0, "nomes": C.Counter(), "orgaos": C.Counter(), "meses": set()})
pf_total, pf_pessoas, registros = 0.0, set(), 0
for arq in sorted(glob.glob(str(raw / "tce" / "despesas_*.json.gz"))):
    ym = arq.split("_")[-2] + "-" + arq.split("_")[-1][:2]
    for x in json.load(gzip.open(arq, "rt", encoding="utf-8")):
        registros += 1
        v = valor(x)
        ev = x["evento"]
        por_mes[ym][ev] += v
        if ev != "Valor Pago":
            continue
        orgao_mes[x["orgao"]][ym] += v
        c = cnpj_de(x["id_fornecedor"]) if x["id_fornecedor"].startswith("CNPJ") else None
        if c is None:
            pf_total += v; pf_pessoas.add(x["id_fornecedor"]); por_mes[ym]["pf"] += v
            continue
        if c in INTERNOS or "CAMARA MUNICIPAL DE CAMPINAS" in limpa(x["nm_fornecedor"]).upper().replace("Â", "A"):
            por_mes[ym]["internos"] += v
        f = forn[c]
        f["pago"] += v; f["n"] += 1; f["nomes"][limpa(x["nm_fornecedor"])] += 1; f["orgaos"][x["orgao"]] += v; f["meses"].add(ym)

meses = sorted(por_mes)


def nome_bom(nomes):
    for n, _ in nomes.most_common():
        if "?" not in n:
            return n
    return nomes.most_common(1)[0][0]


def tag(nome):
    for t, rx in TAGS:
        if re.search(rx, nome.upper()):
            return t
    return None


camara_cnpjs = {c for c, f in forn.items() if "CAMARA MUNICIPAL DE CAMPINAS" in nome_bom(f["nomes"]).upper().replace("Â", "A")}
internos = INTERNOS | camara_cnpjs
lista = []
for c, f in forn.items():
    nm = nome_bom(f["nomes"])
    lista.append({"nome": nm, "cnpj": c, "pago": round(f["pago"], 2), "n": f["n"], "de": min(f["meses"]), "ate": max(f["meses"]),
                  "orgao": f["orgaos"].most_common(1)[0][0], "interno": c in internos, "tag": tag(nm)})
terceiros = sorted([x for x in lista if not x["interno"]], key=lambda x: -x["pago"])

pago_mes = [round(por_mes[m]["Valor Pago"], 2) for m in meses]
internos_mes = [round(por_mes[m]["internos"], 2) for m in meses]
camara_nome = next((o for o in orgao_mes if "CÂMARA" in o.upper() or "CAMARA" in o.upper()), None)
total_pago = sum(pago_mes)
terc_total = sum(x["pago"] for x in terceiros)
gastos = {
    "fonte": "Portal de Transparência Municipal do TCE-SP (despesas de Campinas)", "meses": meses, "registros": registros,
    "pago_mes": pago_mes, "liquidado_mes": [round(por_mes[m]["Valor Liquidado"], 2) for m in meses],
    "empenhado_mes": [round(por_mes[m]["Empenhado"], 2) for m in meses],
    "internos_mes": internos_mes, "terceiros_mes": [round(a - b, 2) for a, b in zip(pago_mes, internos_mes)],
    "pf_mes": [round(por_mes[m]["pf"], 2) for m in meses], "pf": {"pessoas": len(pf_pessoas), "total": round(pf_total, 2)},
    "pago_total": round(total_pago, 2), "internos_total": round(sum(internos_mes), 2),
    "por_orgao": sorted([{"orgao": o, "pago": round(sum(m.values()), 2)} for o, m in orgao_mes.items()], key=lambda x: -x["pago"]),
    "camara": {"orgao": camara_nome, "pago_mes": [round(orgao_mes[camara_nome].get(m, 0), 2) for m in meses] if camara_nome else [],
               "pago_total": round(sum(orgao_mes[camara_nome].values()), 2) if camara_nome else 0},
    "top": terceiros[:60],
    "n_pj_terceiros": len(terceiros), "top20_parte": round(sum(x["pago"] for x in terceiros[:20]) / (terc_total or 1), 3),
    "terceiros_total": round(terc_total, 2),
    "por_tag": {t: round(sum(x["pago"] for x in terceiros if x["tag"] == t), 2) for t in ("Banco", "Justiça, tributos e encargos", "Benefícios dos servidores")},
}
json.dump(gastos, open(site / "dados" / "gastos.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
busca = [[x["nome"], x["cnpj"], round(x["pago"]), x["n"], x["de"], x["ate"], x["orgao"], x["tag"]] for x in terceiros if x["pago"] >= 20000]
json.dump(busca, open(site / "dados" / "fornecedores.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("registros:", registros, "| meses:", meses[0], "a", meses[-1])
print("pago total (bi):", round(total_pago / 1e9, 2), "| entre entidades da Prefeitura (bi):", round(sum(internos_mes) / 1e9, 2),
      "| pessoas físicas (bi):", round(pf_total / 1e9, 2), "| terceiros PJ (bi):", round(terc_total / 1e9, 2))
print("PJ terceiros:", len(terceiros), "| no arquivo de busca (>= R$ 20 mil):", len(busca), "| top20 = %.0f%% do pago a PJ terceiros" % (gastos["top20_parte"] * 100))
print("Câmara (pago, TCE-SP):", gastos["camara"]["pago_total"] / 1e6, "mi")
for x in terceiros[:15]:
    print(f"  {x['pago']/1e6:>8.1f} mi | {x['nome'][:55]} | {x['tag'] or ''}")
