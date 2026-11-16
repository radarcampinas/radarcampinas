"""Gera páginas estáticas para o Google encontrar (o site principal usa endereços com '#', que o Google ignora).

Uso: python -I -X utf8 scripts/gerar_paginas.py <pasta_site>   (variável RADAR_BASE troca o endereço base do site)

Cria dentro de site/:
  vereador/<nome>/  vereadores/  bairro/<nome>/  bairros/  grupo/<nome>/  leis/  pedidos-repetidos/  gastos/  licitacoes/  sobre/
  sitemap.xml  robots.txt
Cada página tem título, descrição, endereço canônico, pré-visualização para redes e um resumo em HTML puro (só números e textos
oficiais já presentes nos dados do site), com um botão para a versão completa e interativa. Nada de dados pessoais: usa só os JSON de site/dados.
"""
import html, json, os, pathlib, re, shutil, sys, unicodedata
from datetime import date

SITE = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "site")
BASE = os.environ.get("RADAR_BASE", "https://radarcampinas.github.io/radarcampinas/").rstrip("/") + "/"
SAPL = "https://sapl.campinas.sp.leg.br"
D = SITE / "dados"
ld = lambda n: json.load(open(D / n, encoding="utf-8"))
G, GR, LEIS, LOC, BUS, GAS, LIC = ld("geral.json"), ld("graficos.json"), ld("leis.json"), ld("locais.json"), ld("busca.json"), ld("gastos.json"), ld("licitacoes.json")
try:
    AF = ld("afastamentos.json")
except Exception:
    AF = {"mesa": {"cargos": {}}}
META = G["meta"]
_cfg = (SITE / "config.js").read_text(encoding="utf-8") if (SITE / "config.js").exists() else ""
_pega = lambda k: (re.search(k + r'\s*:\s*"([^"]*)"', _cfg) or [None, ""])[1].strip()
GC, EMAIL = _pega("goatcounter"), _pega("contatoEmail")
if not re.fullmatch(r"[A-Za-z0-9-]{2,40}", GC or ""):
    GC = ""
if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", EMAIL or ""):
    EMAIL = ""
HOJE = date.today().isoformat()
esc = lambda s: html.escape(str(s if s is not None else ""), quote=True)


def nf(n):
    return f"{int(round(n)):,}".replace(",", ".")


def dbr(d):
    return f"{d[8:10]}/{d[5:7]}/{d[:4]}" if d and len(d) >= 10 else ""


def slug(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def semac(s):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().upper()).strip()


LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="none" stroke="#7FA2FF" stroke-width="2"/><circle cx="16" cy="16" r="8" fill="none" stroke="#7FA2FF" stroke-width="2" opacity="0.6"/><path d="M16 16L26 8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="16" r="2.4" fill="#fff"/></svg>'
ICONE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2314213D'/%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%23fff' stroke-width='2.5'/%3E%3Ccircle cx='16' cy='16' r='2.8' fill='%23fff'/%3E%3Cpath d='M16 16l7-7' stroke='%23fff' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E"
paginas = []  # (caminho relativo, prioridade)


def pagina(caminho, titulo, descricao, corpo, spa, extra_head=""):
    """caminho: 'vereador/ailton/' ; spa: rota do site interativo, ex. '#/v/311'."""
    prof = "../" * caminho.strip("/").count("/") + "../" if caminho.strip("/") else ""
    prof = "../" * (caminho.strip("/").count("/") + 1)
    url = BASE + caminho
    nav = "".join(f'<a href="{prof}{h}">{t}</a>' for h, t in [("vereadores/", "Vereadores"), ("leis/", "O que virou lei"), ("gastos/", "Gastos"), ("licitacoes/", "Licitações"), ("pedidos-repetidos/", "Pedidos repetidos"), ("bairros/", "Bairros"), ("sobre/", "Sobre")])
    GCSCRIPT = (f'<script data-goatcounter="https://{GC}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>' + chr(10)) if GC else ""
    contato = f' · <a href="mailto:{esc(EMAIL)}">Contato</a>' if EMAIL else ""
    t = f"{titulo} | Radar Campinas"
    doc = f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(t)}</title>
<meta name="description" content="{esc(descricao)}">
<link rel="canonical" href="{esc(url)}">
<meta name="theme-color" content="#0E1A33">
<meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="Radar Campinas">
<meta property="og:title" content="{esc(t)}"><meta property="og:description" content="{esc(descricao)}"><meta property="og:url" content="{esc(url)}">
<meta property="og:image" content="{BASE}og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="{ICONE}">
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{prof}style.css">
{extra_head}{GCSCRIPT}</head>
<body>
<header class="topo"><a class="marca" href="{BASE}">{LOGO}Radar Campinas</a><nav aria-label="Principal">{nav}</nav><span class="data">Dados de {dbr(META['gerado_em'])}</span></header>
<main class="pag" style="max-width:900px;margin:0 auto;padding:24px 16px 40px">
{corpo}
<p style="margin:28px 0 0"><a class="btn-sec" href="{BASE}{spa}">Ver a página completa e interativa ›</a></p>
</main>
<footer class="rodape"><p class="ao-vivo"><b>Dados atualizados em {dbr(META['gerado_em'])}</b> · Câmara até a sessão de {dbr(META['ultima_sessao_com_lista'])}</p>
<p>Site independente e <b>não oficial</b>, com dados da Câmara Municipal de Campinas, do TCE-SP e do PNCP. Não damos nota nem opinião: cada informação tem link para a fonte oficial.</p>
<p class="rodape-links"><a href="{BASE}#/privacidade">Privacidade e termos</a> · <a href="{BASE}#/sobre">Entenda o site</a> · <a href="https://github.com/radarcampinas/radarcampinas/issues/new?template=erro-nos-dados.md" target="_blank" rel="noopener">Reportar erro</a>{contato}</p></footer>
</body>
</html>
"""
    arq = SITE / caminho / "index.html" if caminho else SITE / "index.html"
    arq.parent.mkdir(parents=True, exist_ok=True)
    arq.write_text(doc, encoding="utf-8")
    paginas.append(caminho)


def cartoes(itens):
    return '<div class="grade" style="margin:16px 0">' + "".join(f'<div class="card" style="flex:1 1 200px"><div class="grande-num" style="font-size:2.2rem;line-height:1.1">{n}</div><div style="font-weight:600;color:var(--ink)">{r}</div></div>' for n, r in itens) + "</div>"


def lista_ul(itens):
    return '<ul style="padding-left:20px;display:flex;flex-direction:column;gap:8px">' + "".join(f"<li>{i}</li>" for i in itens) + "</ul>"


# limpa as pastas geradas antes (para não sobrar página de vereador que saiu)
for p in ["vereador", "vereadores", "bairro", "bairros", "grupo", "leis", "pedidos-repetidos", "gastos", "licitacoes", "sobre"]:
    shutil.rmtree(SITE / p, ignore_errors=True)

# ---------------- vereadores ----------------
gnomes = [g["nome"] for g in META["grupos"]]
leis_v = LEIS["por_vereador"]
slugs, usados = {}, set()
for v in sorted(G["vereadores"], key=lambda v: v["nome"]):
    s = slug(v["nome"])
    if s in usados:
        s = f"{s}-{v['id']}"
    usados.add(s); slugs[v["id"]] = s
tot_s = META["total_sessoes_com_lista"]
for v in G["vereadores"]:
    s, pr, vt, pres = slugs[v["id"]], v["propostas"], v["votos"], v["presenca"]
    cargo = AF["mesa"]["cargos"].get(str(v["id"]))
    nleis = (leis_v.get(str(v["id"])) or [0, 0])[0]
    part = v.get("partido") or "sem partido"
    situ = "em exercício" if v["ativo"] else "fora do exercício"
    titulo = f"{v['nome']} ({part}) — vereador de Campinas"
    if len(titulo) > 52:
        titulo = f"{v['nome']} — vereador de Campinas"
    desc = f"Veja a presença ({nf(pres['presente'])} de {nf(tot_s)} sessões), os {nf(vt['total'])} votos registrados e as {nf(pr['total'])} propostas de {v['nome']} na Câmara de Campinas, com dados oficiais."
    grupos_txt = [f"{esc(gnomes[i])}: <b>{nf(n)}</b>" for i, n in enumerate(pr["por_grupo"]) if n]
    corpo = f"""<p class="eyebrow">Vereador de Campinas</p>
<h1>{esc(v['nome'])}</h1>
<p style="font-size:1.1rem"><b>{esc(part)}</b> · {situ}{(' · ' + esc(cargo) + ' da Mesa') if cargo else ''}</p>
{cartoes([(f"{nf(pres['presente'])} de {nf(tot_s)}", "sessões com presença registrada"), (nf(vt['total']), "votos registrados"), (nf(pr['total']), "propostas apresentadas"), (nf(nleis), "projetos que viraram lei")])}
<h2>Como votou</h2>
<p>Dos {nf(vt['total'])} votos registrados: <b>{nf(vt.get('F', 0))}</b> a favor, <b>{nf(vt.get('C', 0))}</b> contra, <b>{nf(vt.get('A', 0))}</b> abstenções e <b>{nf(vt.get('X', 0))}</b> ausências. Só entram votações em que o voto de cada vereador foi registrado no sistema da Câmara.</p>
<h2>Propostas apresentadas</h2>
<p>{nf(pr['total'])} propostas desde {dbr(META['inicio'])}, separadas em grupos por uma regra igual para todos os vereadores: {'; '.join(grupos_txt)}.</p>
<h2>Como ler estes números</h2>
{lista_ul(["Presença: sessões em que o nome aparece na lista de presença oficial. Não calculamos porcentagem, porque o cadastro da Câmara não informa com precisão quando cada pessoa assumiu ou saiu.", "Os números são calculados por nós a partir de dados oficiais e conferidos com o relatório de presença da Câmara. Os grupos de propostas são uma estimativa.", f'Fonte: <a href="{SAPL}/parlamentar/{v["id"]}" target="_blank" rel="noopener">página oficial de {esc(v["nome"])} na Câmara</a>.'])}"""
    ld_json = json.dumps({"@context": "https://schema.org", "@type": "Person", "name": v["nome"], "jobTitle": "Vereador de Campinas", "worksFor": {"@type": "GovernmentOrganization", "name": "Câmara Municipal de Campinas"}, "url": BASE + f"vereador/{s}/"}, ensure_ascii=False)
    pagina(f"vereador/{s}/", titulo, desc, corpo, f"#/v/{v['id']}", f'<script type="application/ld+json">{ld_json}</script>\n')

linhas = [f'<a href="{BASE}vereador/{slugs[v["id"]]}/"><b>{esc(v["nome"])}</b></a> ({esc(v.get("partido") or "sem partido")}) · {nf(v["propostas"]["total"])} propostas · {nf(v["presenca"]["presente"])} de {nf(tot_s)} sessões' for v in sorted(G["vereadores"], key=lambda v: v["nome"])]
pagina("vereadores/", "Vereadores de Campinas: presença e votos", f"Lista dos {len(G['vereadores'])} vereadores da 19ª legislatura de Campinas, com presença nas sessões, votos e propostas de cada um, só com dados oficiais.",
       f'<p class="eyebrow">19ª legislatura</p><h1>Vereadores de Campinas</h1><p>Os {len(G["vereadores"])} mandatos da 19ª legislatura (desde {dbr(META["inicio"])}), em ordem alfabética. Inclui suplentes e quem saiu.</p>{lista_ul(linhas)}', "#/")

# ---------------- grupos de propostas ----------------
pedidos = BUS["pedidos"]
nome_v = {p: n for n, p in zip(BUS["nomes"], BUS["pids"])}
for gi, g in enumerate(META["grupos"]):
    sel = sorted([p for p in pedidos if p["g"] == gi], key=lambda p: p["d"], reverse=True)[:25]
    li = [f'{dbr(p["d"])} · <a href="{SAPL}/materia/{p["i"]}" target="_blank" rel="noopener">{esc(p["n"])}</a> (texto completo na Câmara)' for p in sel]
    total = GR_total = sum(1 for p in pedidos if p["g"] == gi)
    pagina(f"grupo/{slug(g['nome'])}/", f"{g['nome']} — propostas dos vereadores", f"{nf(total)} propostas do grupo “{g['nome']}” apresentadas pelos vereadores de Campinas desde {dbr(META['inicio'])}, com link para cada uma na Câmara.",
           f'<p class="eyebrow">Grupo de propostas</p><h1>{esc(g["nome"])}</h1><p>{esc(g["desc"])}</p><p><b>{nf(total)}</b> propostas com vereador como autor desde {dbr(META["inicio"])}. Os grupos seguem uma regra nossa, igual para todos (estimativa).</p><h2>As mais recentes</h2>{lista_ul(li)}<p class="suave">O texto de cada proposta fica na página oficial da Câmara (link ao lado do número).</p>', f"#/grupo/{gi}")

# ---------------- bairros ----------------
por_bairro = {}
for p in pedidos:
    if p.get("bai"):
        por_bairro.setdefault(semac(p["bai"]), []).append(p)
bairros = []
for nome, qtd in LOC["bairros"][:250]:
    ps = por_bairro.get(semac(nome), [])
    if len(ps) < 3:
        continue
    bairros.append((nome, len(ps)))
    cats = {}
    for p in ps:
        cats[BUS["categorias"][p["c"]]] = cats.get(BUS["categorias"][p["c"]], 0) + 1
    topc = sorted(cats.items(), key=lambda x: -x[1])[:6]
    rec = sorted(ps, key=lambda p: p["d"], reverse=True)[:12]
    li = [f'{dbr(p["d"])} · <a href="{SAPL}/materia/{p["i"]}" target="_blank" rel="noopener">{esc(p["n"])}</a> · {esc(BUS["categorias"][p["c"]])}' for p in rec]
    s = slug(nome)
    pagina(f"bairro/{s}/", (f"Pedidos no bairro {nome}, Campinas" if len(nome) <= 30 else f"{nome}: pedidos, Campinas"), f"{nf(len(ps))} pedidos dos vereadores de Campinas citam o bairro {nome}. Veja os tipos de pedido mais comuns e os mais recentes, com link para a Câmara.",
           f'<p class="eyebrow">Pedidos por bairro</p><h1>{esc(nome)}</h1><p><b>{nf(len(ps))}</b> indicações e outros pedidos dos vereadores citam este bairro desde {dbr(META["inicio"])}. O bairro é lido do texto oficial por um programa e pode errar (estimativa).</p><h2>O que mais se pediu</h2>{lista_ul([f"{esc(c)}: <b>{nf(n)}</b>" for c, n in topc])}<h2>Pedidos mais recentes</h2>{lista_ul(li)}<p class="suave">Pedido repetido ou muitos pedidos não provam que a Prefeitura ignorou o problema.</p>', f"#/busca/{re.sub(' ', '%20', nome)}")
pagina("bairros/", "Bairros de Campinas mais citados nos pedidos", "Os bairros de Campinas que mais aparecem nos pedidos dos vereadores, com o número de pedidos e link para o que foi pedido em cada um.",
       f'<p class="eyebrow">Pedidos por bairro</p><h1>Bairros mais citados</h1><p>Bairros que aparecem nos pedidos dos vereadores. A contagem é feita por um programa que lê o texto oficial (estimativa).</p>{lista_ul([f"<a href=\"{BASE}bairro/{slug(n)}/\"><b>{esc(n)}</b></a>: {nf(q)} pedidos" for n, q in sorted(bairros, key=lambda x: -x[1])])}', "#/")

# ---------------- leis ----------------
itens = sorted(LEIS["itens"], key=lambda l: l["d"], reverse=True)[:40]
li = [f'{dbr(l["d"])} · <a href="{SAPL}/norma/{l["i"]}" target="_blank" rel="noopener">{esc(l["n"])}</a>: {esc(l["e"][:170])}{"…" if len(l["e"]) > 170 else ""}' for l in itens]
o = LEIS["por_origem"]
pagina("leis/", "O que virou lei em Campinas", f"{nf(LEIS['n'])} leis e leis complementares sancionadas em Campinas desde {dbr(META['inicio'])}: {nf(o.get('V', 0))} de projetos de vereadores e {nf(o.get('E', 0))} do Prefeito.",
       f'<p class="eyebrow">Leis sancionadas</p><h1>O que virou lei em Campinas</h1>{cartoes([(nf(LEIS["n"]), "leis e leis complementares"), (nf(o.get("V", 0)), "de projetos de vereadores"), (nf(o.get("E", 0)), "de projetos do Prefeito")])}<h2>As mais recentes</h2>{lista_ul(li)}', "#/leis")

# ---------------- pedidos repetidos ----------------
rep = BUS["repeticoes"][:30]
li = [f'<b>{esc(r.get("q") or r["rua"].title())}{", " + esc(r.get("bq") or r["bairro"].title()) if (r.get("bq") or r.get("bairro")) else ""}</b> · {esc(BUS["categorias"][r["c"]])}: {nf(r["n"])} pedidos em {nf(r["dias"])} datas ({dbr(r["datas"][0])} a {dbr(r["datas"][-1])})' for r in rep]
pagina("pedidos-repetidos/", "Pedidos repetidos para a mesma rua", f"{nf(len(BUS['repeticoes']))} combinações de rua e tipo de pedido se repetiram {BUS['min_repetido']} vezes ou mais nos pedidos dos vereadores de Campinas. Repetição não prova que a Prefeitura ignorou.",
       f'<p class="eyebrow">Pedidos repetidos</p><h1>Pedidos que voltam para a mesma rua</h1><p><b>Pedido repetido não prova que a Prefeitura ignorou o problema.</b> O pedido pode ter sido atendido e o problema voltado, ou ser de moradores diferentes. Contamos quando o mesmo tipo de pedido aparece para a mesma rua em {BUS["min_repetido"]} datas diferentes ou mais (regra nossa, estimativa).</p><p><b>{nf(len(BUS["repeticoes"]))}</b> combinações encontradas. As 30 com mais pedidos:</p>{lista_ul(li)}', "#/repeticoes")

# ---------------- gastos e licitações ----------------
MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
ml = lambda k: f"{MESES[int(k[5:7]) - 1]}/{k[:4]}"


def reais(v):
    return f"R$ {v / 1e9:.2f} bilhões".replace(".", ",") if v >= 1e9 else f"R$ {v / 1e6:.1f} milhões".replace(".", ",")


po = sorted(GAS["por_orgao"], key=lambda x: -x["pago"])[:8]
ext = GAS["terceiros_total"]
li_o = [f'{esc(x["orgao"])}: <b>{reais(x["pago"])}</b>' for x in po]
pagina("gastos/", "Gastos da Prefeitura de Campinas", f"A Prefeitura de Campinas e suas entidades pagaram {reais(ext)} a empresas e entidades de fora entre {ml(GAS['meses'][0])} e {ml(GAS['meses'][-1])}, segundo o TCE-SP. Veja por órgão.",
       f'<p class="eyebrow">Dinheiro público</p><h1>Gastos da Prefeitura de Campinas</h1><p>Pagamentos registrados no Portal de Transparência Municipal do TCE-SP, de {ml(GAS["meses"][0])} a {ml(GAS["meses"][-1])}.</p>{cartoes([(reais(ext), "pagos a empresas e entidades de fora (sem contar repasses entre entidades da Prefeitura)"), (nf(GAS["registros"]), "registros analisados")])}<h2>Total pago por órgão (inclui repasses entre as entidades)</h2>{lista_ul(li_o)}<p class="suave">Somas feitas por nós sobre os dados do TCE-SP. Não mostramos nomes de pessoas físicas. Estar na lista de pagamentos não indica irregularidade.</p>', "#/gastos")

mods = sorted(LIC["modalidades"], key=lambda x: -x["n"])[:8]
li_m = [f'{esc(m["nome"])}: <b>{nf(m["n"])}</b>' for m in mods]
pagina("licitacoes/", "Licitações e contratos de Campinas", f"{nf(LIC['n'])} compras e licitações publicadas no PNCP pela Prefeitura de Campinas e entidades ligadas desde {dbr(META['inicio'])}, com valores, objeto e link.",
       f'<p class="eyebrow">Dinheiro público</p><h1>Licitações e contratos</h1><p>Compras, licitações e contratos publicados no PNCP (Portal Nacional de Contratações Públicas) pela Prefeitura e entidades ligadas.</p>{cartoes([(nf(LIC["n"]), "compras e licitações"), (reais(LIC["valor_homologado"]), "valor homologado")])}<h2>Por modalidade</h2>{lista_ul(li_m)}<p class="suave">Licitação ou contrato não prova irregularidade nem que o serviço foi feito.</p>', "#/licitacoes")

pagina("sobre/", "O que é este site", "Um jeito fácil de ver o que acontece na Câmara de Campinas e nas contas da cidade, com dados oficiais, sem nota e sem opinião.",
       '<p class="eyebrow">Entenda o site</p><h1>O que é o Radar Campinas</h1><p style="font-size:1.15rem">Um jeito fácil de ver o que acontece na Câmara de Campinas e nas contas da cidade. Pegamos os dados que os próprios órgãos públicos publicam e organizamos para qualquer pessoa entender.</p><ul style="padding-left:20px;display:flex;flex-direction:column;gap:8px"><li><b>Buscamos os dados oficiais</b> da Câmara Municipal, do TCE-SP e do PNCP.</li><li><b>Organizamos em palavras simples:</b> presença, votos, propostas, leis, gastos e licitações.</li><li><b>Mostramos de onde veio cada número</b>, com link para a página oficial.</li><li><b>Não damos nota nem opinião</b> e este site não é oficial.</li></ul>', "#/sobre")

# ---------------- sitemap e robots ----------------
urls = [("", "1.0")] + [(p, "0.9" if p in ("vereadores/", "leis/", "gastos/", "licitacoes/", "pedidos-repetidos/") else "0.7" if p.startswith("vereador/") else "0.6") for p in paginas]
(SITE / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"<url><loc>{BASE}{p}</loc><lastmod>{META['gerado_em']}</lastmod><priority>{pr}</priority></url>\n" for p, pr in urls) + "</urlset>\n", encoding="utf-8")
(SITE / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {BASE}sitemap.xml\n", encoding="utf-8")
print(f"{len(paginas)} páginas estáticas (vereadores {len(G['vereadores'])}, bairros {len(bairros)}, grupos {len(META['grupos'])}) + sitemap.xml e robots.txt | base {BASE}")
