"""Confere se algum dado pessoal foi parar no site. Sai com erro (código 1) se achar, e a atualização diária NÃO publica.

Uso: python -I -X utf8 auditar_privacidade.py <pasta_site>

Procura em todos os .json, .js e .html: CPF (com pontos), CPF solto (11 dígitos) nos arquivos de gastos e compras, RG,
e-mail, telefone, CEP e a palavra "sito à" (endereço de residência em contratos).
"""
import pathlib, re, sys

site = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "site")
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import privacidade as P

# arquivos vindos do PNCP/TCE-SP: ali, 11 dígitos soltos costumam ser CPF
ESTRITOS = {"licitacoes.json", "contratos.json", "fornecedores.json", "gastos.json"}
PADROES = {"CPF": P.CPF_FORMATADO, "RG": re.compile(r"\bRG\b[\s.,:nNºo°-]{0,12}\d{1,3}\.?\d{3}", re.I), "e-mail": P.EMAIL,
           "telefone": P.TELEFONE}
# CEP e "sito à" só importam nas compras e contratos (ali indicavam a residência de uma pessoa contratada); nos pedidos de obra do vereador
# o CEP é de rua pública e faz parte do texto oficial.
PADROES_ESTRITOS = {"CEP": P.CEP, "endereço residencial (sito à)": re.compile(r"\bsito\s+[àa]\b", re.I)}
# o e-mail de contato do projeto, escolhido de propósito em site/config.js, é permitido (qualquer outro e-mail continua bloqueado)
_cfg = (site / "config.js").read_text(encoding="utf-8") if (site / "config.js").exists() else ""
_m = re.search(r'contatoEmail\s*:\s*"([^"]+)"', _cfg)
PERMITIDOS = {_m.group(1).strip().lower()} if _m else set()
achados = []
for f in sorted(list(site.rglob("*.json")) + list(site.rglob("*.js")) + list(site.rglob("*.html"))):
    if "partidos" in f.parts:
        continue
    t = f.read_text(encoding="utf-8", errors="replace")
    pad = dict(PADROES)
    if f.name in ESTRITOS:
        pad.update(PADROES_ESTRITOS)
        pad["11 dígitos (possível CPF)"] = re.compile(r"(?<![\d./,:-])(?<!\"\d)\b\d{11}\b(?![\d/,.-])(?!\d)")
    for nome, rx in pad.items():
        for m in rx.finditer(t):
            if nome.startswith("11 dígitos") and re.match(r"^\d{11}$", m.group(0)):
                ctx = t[max(0, m.start() - 12): m.start()]
                if re.search(r"[\d.]\s?$", ctx) or re.search(r"\d,$", ctx):  # parte de número maior (valores em reais, ids)
                    continue
            if nome == "e-mail" and (m.group(0).lower() in PERMITIDOS or m.group(0).lower().endswith("@exemplo.com")):
                continue
            if f.name == "app.js" and nome == "e-mail":
                continue
            achados.append((f.relative_to(site), nome, t[max(0, m.start() - 40): m.end() + 20].replace("\n", " ")))
if achados:
    print(f"{len(achados)} possíveis dados pessoais encontrados:")
    for a, n, c in achados[:40]:
        print(f"  [{n}] {a}: …{c}…")
    sys.exit(1)
print("auditoria de privacidade: nada encontrado")
