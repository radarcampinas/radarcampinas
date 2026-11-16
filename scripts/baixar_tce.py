"""Baixa as despesas mensais de Campinas do Portal de Transparência Municipal do TCE-SP.

Uso: python -I -X utf8 baixar_tce.py <pasta_saida> [ano_inicio] [mes_inicio]
Grava um .json.gz por mês (data/raw/tce/despesas_AAAA_MM.json.gz). Pula meses já baixados e para quando um mês vier vazio.
Fonte: https://transparencia.tce.sp.gov.br/api/json/despesas/campinas/<ano>/<mes>
"""
import gzip, json, sys, time, pathlib, urllib.request
from datetime import date

saida = pathlib.Path(sys.argv[1]); saida.mkdir(parents=True, exist_ok=True)
a0 = int(sys.argv[2]) if len(sys.argv) > 2 else 2025
m0 = int(sys.argv[3]) if len(sys.argv) > 3 else 1
hoje = date.today()


def baixa(ano, mes, tentativas=5):
    u = f"https://transparencia.tce.sp.gov.br/api/json/despesas/campinas/{ano}/{mes}"
    for i in range(tentativas):
        try:
            b = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "radarcampinas-pesquisa/0.1"}), timeout=240).read()
            return json.loads(b.decode("utf-8", "replace"))
        except Exception as e:
            print(f"  tentativa {i + 1} falhou: {str(e)[:80]}", flush=True)
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"falhou {ano}/{mes}")


ano, mes = a0, m0
while (ano, mes) <= (hoje.year, hoje.month):
    arq = saida / f"despesas_{ano}_{mes:02d}.json.gz"
    if arq.exists():
        print(f"{ano}/{mes:02d}: já existe", flush=True)
    else:
        d = baixa(ano, mes)
        if not d:
            print(f"{ano}/{mes:02d}: vazio, parando (a fonte ainda não publicou)", flush=True)
            break
        with gzip.open(arq, "wt", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False)
        print(f"{ano}/{mes:02d}: {len(d)} registros", flush=True)
        time.sleep(2)
    mes += 1
    if mes > 12:
        ano, mes = ano + 1, 1
print("concluído", flush=True)
