"""Resumo da atualização para o GitHub Actions: o que deu certo, o que falhou e o motivo.

Escreve (1) anotações do GitHub (::notice / ::warning), que aparecem na página da execução e podem ser lidas sem login pela API
pública, e (2) o resumo em Markdown da execução ($GITHUB_STEP_SUMMARY). Só lê data/logs; não baixa nada.

Uso: python scripts/resumo_ci.py
"""
import glob, json, os, pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
LOGS = RAIZ / "data" / "logs"


def esc(t):
    return str(t).replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def nota(nivel, titulo, msg):
    print(f"::{nivel} title={esc(titulo)}::{esc(msg)[:1500]}")


u = {}
try:
    u = json.loads((LOGS / "ultima.json").read_text(encoding="utf-8"))
except Exception:
    nota("warning", "Sem ultima.json", "o programa de atualização não chegou a gravar o resumo (parou antes ou foi interrompido)")
etapas = u.get("etapas", {})
for nome, v in etapas.items():
    if v != "ok":
        nota("warning", f"Etapa {nome} não terminou bem", v)
if u:
    nota("notice", "Resultado da atualização", f"ok={u.get('ok')} | {u.get('consultas')} consultas | {u.get('minutos')} min | etapas: " + ", ".join(f"{k}={'ok' if v == 'ok' else 'PROBLEMA'}" for k, v in etapas.items()))
    if u.get("erro"):
        nota("warning", "Erro geral", u["erro"])

logs = sorted(glob.glob(str(LOGS / "atualizacao_*.log")))
linhas = []
if logs:
    linhas = pathlib.Path(logs[-1]).read_text(encoding="utf-8", errors="replace").splitlines()
    problemas = [l for l in linhas if any(k in l for k in ("ERRO", "INTERROMPIDO", "HTTP 4", "HTTP 5", "falhou", "pulado", "recusado", "suspensão"))]
    redes = [l for l in linhas if "erro de rede" in l]
    if problemas:
        nota("warning", "Linhas de problema no log", "\n".join(problemas[-12:]))
    if redes:
        nota("notice", "Erros de rede (repetidos sozinhos)", f"{len(redes)} ocorrências; última: {redes[-1][:200]}")

resumo = os.environ.get("GITHUB_STEP_SUMMARY")
if resumo:
    with open(resumo, "a", encoding="utf-8") as f:
        f.write("## Atualização noturna\n\n```json\n" + json.dumps(u, ensure_ascii=False, indent=1) + "\n```\n\n### Fim do log\n\n```\n" + "\n".join(l[:200] for l in linhas[-30:]) + "\n```\n")
