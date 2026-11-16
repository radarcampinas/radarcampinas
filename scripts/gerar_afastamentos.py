"""Gera site/dados/afastamentos.json: atos oficiais que explicam quem assumiu, saiu ou foi cassado, e a Mesa Diretora.

Uso: python -I -X utf8 gerar_afastamentos.py <pasta_raw> <pasta_site>

Fonte: API do SAPL (normas jurídicas desde 01/01/2025 e composição da Mesa). O programa lê o texto oficial de cada ato
com expressões regulares simples e liga os nomes aos vereadores. O que não for ligado a ninguém vai para "sem_vinculo",
para revisão. O resumo em palavras simples (campo "r") é nosso; o texto oficial (campo "e") é copiado sem mudar.
"""
import json, re, sys, pathlib, unicodedata, urllib.request, urllib.parse

raw, site = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
B = "https://sapl.campinas.sp.leg.br/api/"
INICIO = json.load(open(site / "dados" / "geral.json", encoding="utf-8"))["meta"]["inicio"]


def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(B + u, headers={"User-Agent": "radarcampinas"}), timeout=90))


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").upper()).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip()


parl = {json.loads(l)["id"]: json.loads(l) for l in open(raw / "parlamentares__parlamentar.jsonl", encoding="utf-8")}
meus = {v["id"]: v for v in json.load(open(site / "dados" / "geral.json", encoding="utf-8"))["vereadores"]}

# ---------- Mesa Diretora ----------
CARGOS = {1: "Presidente", 2: "Presidente em exercício", 4: "1º Vice-Presidente", 5: "2º Vice-Presidente", 6: "1º Secretário",
          7: "2º Secretário", 9: "3º Secretário", 10: "4º Secretário", 11: "Corregedor", 12: "Corregedor Substituto", 13: "Presidente (licenciado)"}
mesas = get("parlamentares/mesadiretora/?page_size=100&o=id")["results"]
mesa_atual = [m for m in mesas if m["data_inicio"] <= INICIO <= m["data_fim"] or m["data_inicio"] >= INICIO][-1]
comp = get(f"parlamentares/composicaomesa/?mesa_diretora={mesa_atual['id']}&page_size=100&o=id")["results"]
mesa = {str(c["parlamentar"]): CARGOS.get(c["cargo"], str(c["cargo"])) for c in comp}

# ---------- atos oficiais ----------
achados = {}
for kw in ["SUPLENTE", "CASSAÇÃO", "RENÚNCIA", "INVESTIDURA", "AFASTAMENTO", "EXTINÇÃO", "LICENÇA"]:
    p = 1
    while True:
        d = get(f"norma/normajuridica/?data__gte={INICIO}&ementa__icontains={urllib.parse.quote(kw)}&page_size=100&o=id&page={p}")
        for n in d["results"]:
            achados[n["id"]] = n
        if not d["pagination"]["next_page"]:
            break
        p += 1
ruido = ("FUNCIONÁRIO", "FUNCIONÁRIA", "GABINETE", "SERVIDOR", "FISCAL DO", "COMISSÃO PROCESSANTE", "SUBSÍDIO DESTINADO", "TRANSPORTE")
atos = [n for n in achados.values()
        if re.match(r"(Ato da Presidência|Decreto Legislativo|Resolução)", n["__str__"])
        and not any(r in n["ementa"].upper() for r in ruido)
        and re.search(r"VEREADOR|MANDATO|SUPLENTE", n["ementa"].upper())]
atos.sort(key=lambda n: (n["data"], n["id"]))

# nomes que identificam cada parlamentar nos textos
def variantes(p):
    v = {norm(p["nome_parlamentar"]), norm(p["nome_completo"])}
    pal = norm(p["nome_completo"]).split()
    if len(pal) >= 2:
        v.add(" ".join(pal[:2]))
    return {x for x in v if len(x.split()) >= 2 or len(x) >= 3}


VAR = {pid: variantes(p) for pid, p in parl.items()}


def quem(trecho):
    t = norm(trecho)
    return [pid for pid, vs in VAR.items() if any(re.search(r"\b" + re.escape(x) + r"\b", t) for x in vs)]


def pessoa_mais_especifica(trecho):
    c = quem(trecho)
    if len(c) > 1:  # vale quem tem o nome mais longo no trecho
        c.sort(key=lambda pid: -max(len(x) for x in VAR[pid] if re.search(r"\b" + re.escape(x) + r"\b", norm(trecho))))
    return c[:1]


eventos, sem_vinculo = {}, []
def add(pid, ato, rotulo, tipo):
    eventos.setdefault(str(pid), []).append({"d": ato["data"], "t": tipo, "r": rotulo, "e": " ".join(ato["ementa"].split()), "n": ato["id"], "nome": ato["__str__"]})


for a in atos:
    e = norm(a["ementa"]); feito = False
    m = re.search(r"INVESTIDURA DO VEREADOR (.+?) NO CARGO DE SECRETARIO", e)
    if m:
        for pid in pessoa_mais_especifica(m.group(1)):
            add(pid, a, "Passou a ocupar cargo de secretário municipal; o suplente foi convocado.", "saida"); feito = True
    m = re.search(r"RENUNCIA DO SENHOR (.+?)(?:,| CONFORME)", e)
    if m:
        for pid in pessoa_mais_especifica(m.group(1)):
            add(pid, a, "Renunciou ao mandato.", "saida"); feito = True
    m = re.search(r"CASSACAO DO MANDATO DO SENHOR (?:VEREADOR )?(?:DO MUNICIPIO DE CAMPINAS )?(.+?)(?:,| CONFORME| NOS TERMOS)", e)
    if m and a["__str__"].startswith("Decreto Legislativo"):
        for pid in pessoa_mais_especifica(m.group(1)):
            add(pid, a, "Teve o mandato cassado.", "saida"); feito = True
    elif m:
        feito = True  # o Ato só repete a cassação para convocar o suplente; o Decreto é o registro da cassação
    m = re.search(r"CONVOCA(?:DO|R) (?:O|A) (?:PRIMEIR[OA]|SEGUND[OA]|TERCEIR[OA]) SUPLENTE (?:DO|DA) (?:PARTIDO )?(?:[^,]*?), (?:O EXCELENTISSIMO SENHOR )?(.+?)(?:,| PARA TOMAR POSSE)", e)
    if m:
        unica = "UNICA E EXCLUSIVAMENTE" in e
        dia = re.search(r"(?:REUNIAO ORDINARIA|SESSAO DE JULGAMENTO)[^.]*?DO DIA (\d{1,2}[º°]? DE [A-Z]+ DE \d{4})|DIA (\d{1,2}[º°]? DE [A-Z]+ DE \d{4})", e)
        for pid in pessoa_mais_especifica(m.group(1)):
            if unica:
                add(pid, a, "Suplente convocado só para uma sessão" + (f" ({(dia.group(1) or dia.group(2)).lower()})." if dia else "."), "so_sessao")
            else:
                add(pid, a, "Suplente que assumiu a cadeira.", "assumiu")
            feito = True
    if not feito:
        sem_vinculo.append({"id": a["id"], "nome": a["__str__"], "ementa": a["ementa"][:300]})

# quem aparece em votos e presenças desde o início mas não está na lista de vereadores do site
ses = {json.loads(l)["id"]: json.loads(l) for l in open(raw / "sessao__sessaoplenaria.jsonl", encoding="utf-8")}
fora = {}
for l in open(raw / "sessao__sessaoplenariapresenca.jsonl", encoding="utf-8"):
    pr = json.loads(l)
    if pr["parlamentar"] not in meus and ses[pr["sessao_plenaria"]]["data_inicio"] >= INICIO:
        fora.setdefault(pr["parlamentar"], {"pres": set(), "votos": 0})["pres"].add(pr["sessao_plenaria"])
od = {json.loads(l)["id"]: json.loads(l) for l in open(raw / "sessao__ordemdia.jsonl", encoding="utf-8")}
ex = {json.loads(l)["id"]: json.loads(l) for l in open(raw / "sessao__expedientemateria.jsonl", encoding="utf-8")}
rvt = {json.loads(l)["id"]: json.loads(l) for l in open(raw / "sessao__registrovotacao.jsonl", encoding="utf-8")}
for l in open(raw / "sessao__votoparlamentar.jsonl", encoding="utf-8"):
    v = json.loads(l)
    if v["parlamentar"] in meus:
        continue
    r = rvt[v["votacao"]]; o = od.get(r["ordem"]) if r["ordem"] else ex.get(r["expediente"])
    if o and ses[o["sessao_plenaria"]]["data_inicio"] >= INICIO:
        fora.setdefault(v["parlamentar"], {"pres": set(), "votos": 0})["votos"] += 1
fora_lista = [{"id": k, "nome": parl[k]["nome_parlamentar"], "presencas": len(v["pres"]), "votos": v["votos"]} for k, v in fora.items()]

out = {"mesa": {"titulo": mesa_atual["__str__"], "cargos": mesa}, "eventos": eventos, "fora_da_lista": fora_lista,
       "sem_vinculo": sem_vinculo, "atos_lidos": len(atos), "gerado_em": json.load(open(site / "dados" / "geral.json", encoding="utf-8"))["meta"]["gerado_em"]}
json.dump(out, open(site / "dados" / "afastamentos.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("Mesa:", mesa_atual["__str__"], {parl[int(k)]["nome_parlamentar"]: v for k, v in mesa.items()})
print("atos lidos:", len(atos), "| com vínculo a pessoas:", sum(len(v) for v in eventos.values()), "| sem vínculo:", len(sem_vinculo))
for pid, evs in eventos.items():
    nome = parl[int(pid)]["nome_parlamentar"]
    dentro = "na lista" if int(pid) in meus else "FORA da lista desta legislatura"
    for ev in evs:
        print(f"  {nome} ({dentro}) | {ev['d']} | {ev['r']} | {ev['nome']}")
for s in sem_vinculo:
    print("  SEM VÍNCULO:", s["nome"], "|", s["ementa"][:160])
