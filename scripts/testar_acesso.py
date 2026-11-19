"""Teste de acesso às fontes oficiais, para rodar no GitHub Actions (ou em qualquer lugar).

Faz poucas consultas, uma de cada vez, com pausa, e diz se cada fonte respondeu normalmente ou bloqueou.
Cada resultado vira uma anotação do GitHub (::notice / ::error), que pode ser lida sem entrar na conta.
Sai com erro (1) se a API da Câmara (SAPL) estiver bloqueada: sem ela a atualização não funciona.

Uso: python scripts/testar_acesso.py
"""
import json, sys, time, urllib.request, urllib.error
from datetime import date, timedelta

UA = "radarcampinas-teste-acesso/1.0 (dados abertos; uso civico; poucas consultas)"
hoje = date.today()
ini, fim = (hoje - timedelta(days=10)).strftime("%Y%m%d"), hoje.strftime("%Y%m%d")
S = "https://sapl.campinas.sp.leg.br"
TESTES = [
    ("SAPL API: parlamentares", f"{S}/api/parlamentares/parlamentar/?page_size=1", "json"),
    ("SAPL API: matérias recentes (ordem por id)", f"{S}/api/materia/materialegislativa/?o=-id&page_size=5", "json"),
    ("SAPL API: votos (página)", f"{S}/api/sessao/votoparlamentar/?o=-id&page_size=5", "json"),
    ("SAPL API: normas", f"{S}/api/norma/normajuridica/?tipo=1&o=-id&page_size=2", "json"),
    ("SAPL página HTML de matéria", f"{S}/materia/464277", "html"),
    ("PNCP: contratos (10 dias)", f"https://pncp.gov.br/api/consulta/v1/contratos?dataInicial={ini}&dataFinal={fim}&cnpjOrgao=51885242000140&pagina=1&tamanhoPagina=10", "json"),
    ("TCE-SP: despesas (só o começo)", "https://transparencia.tce.sp.gov.br/api/json/despesas/campinas/2026/9", "inicio"),
]
BLOQUEIO = ("waf", "forbidden", "captcha", "access denied", "cloudflare", "request blocked")


def tenta(url, modo):
    t0 = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json, text/html"})
        with urllib.request.urlopen(req, timeout=60) as r:
            corpo = r.read(4000 if modo == "inicio" else 400000)
            return r.status, r.headers.get("Content-Type", ""), corpo, time.time() - t0, ""
    except urllib.error.HTTPError as e:
        try:
            corpo = e.read(2000)
        except Exception:
            corpo = b""
        return e.code, (e.headers.get("Content-Type", "") if e.headers else ""), corpo, time.time() - t0, str(e)
    except Exception as e:
        return 0, "", b"", time.time() - t0, str(e)[:120]


falhas_sapl = 0
linhas = []
for i, (nome, url, modo) in enumerate(TESTES):
    if i:
        time.sleep(3)
    st, ct, corpo, seg, erro = tenta(url, modo)
    texto = corpo[:600].decode("utf-8", "replace").lower()
    bloqueado = st in (401, 403, 429) or any(b in texto for b in BLOQUEIO) and st != 200
    ok = st == 200 and not (modo == "json" and not corpo.lstrip()[:1] in (b"{", b"["))
    if modo == "json" and st == 200:
        try:
            json.loads(corpo.decode("utf-8", "replace"))
        except Exception:
            ok = False if len(corpo) < 400000 else ok  # resposta grande cortada: não é erro
    resumo = f"HTTP {st} | {ct.split(';')[0]} | {len(corpo)} bytes lidos | {seg:.1f}s" + (f" | {erro}" if erro else "")
    if ok:
        nivel, rotulo = "notice", "OK"
    elif bloqueado:
        nivel, rotulo = "error", "BLOQUEADO"
    else:
        nivel, rotulo = "warning", "PROBLEMA"
    if nome.startswith("SAPL API") and not ok:
        falhas_sapl += 1
    linhas.append(f"{rotulo:10} {nome}: {resumo}")
    print(f"::{nivel} title={rotulo} - {nome}::{resumo}")

print("\n=== RESUMO ===")
print("\n".join(linhas))
try:
    ip = urllib.request.urlopen("https://api.ipify.org", timeout=15).read().decode()
    print(f"::notice title=Endereço de saída desta execução::{ip}")
except Exception:
    pass
veredito = "A API da Câmara respondeu normalmente a partir daqui." if not falhas_sapl else f"A API da Câmara FALHOU em {falhas_sapl} de 4 consultas."
print(f"::notice title=Veredito::{veredito}")
sys.exit(1 if falhas_sapl else 0)
