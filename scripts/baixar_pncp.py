"""Baixa contratações (licitações, dispensas...) e contratos dos órgãos municipais de Campinas no PNCP.

Uso: python -I -X utf8 baixar_pncp.py <pasta_saida> [data_inicial AAAAMMDD]
Fonte: https://pncp.gov.br/api/consulta/v1  (aberta, sem login; limita a taxa de consultas: o script espera e tenta de novo).
Grava pncp_contratacoes.jsonl e pncp_contratos.jsonl.
"""
import json, sys, time, pathlib, urllib.request, urllib.error
from datetime import date, timedelta

saida = pathlib.Path(sys.argv[1]); saida.mkdir(parents=True, exist_ok=True)
INICIO = sys.argv[2] if len(sys.argv) > 2 else "20250101"
MODO = sys.argv[3] if len(sys.argv) > 3 else "tudo"  # "contratacoes", "contratos" ou "tudo"
FIM = date.today().strftime("%Y%m%d")
BASE = "https://pncp.gov.br/api/consulta/v1/"
ORGAOS = {"51885242000140": "Município de Campinas", "47018676000176": "Rede Mário Gatti", "57500902000104": "Fumec",
          "06916689000185": "Camprev", "49413800000123": "Setec", "52350980000156": "Fundação José Pedro de Oliveira"}
MODALIDADES = range(1, 14)


def get(url, tentativas=8):
    for i in range(tentativas):
        try:
            time.sleep(1.2)  # educado com o limite de consultas
            r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "radarcampinas-pesquisa/0.1", "Accept": "application/json"}), timeout=120)
            corpo = r.read()
            return json.loads(corpo) if corpo.strip() else {"data": [], "totalPaginas": 0}
        except urllib.error.HTTPError as e:
            if e.code == 204:
                return {"data": [], "totalPaginas": 0}
            espera = 40 if e.code == 429 else 6 * (i + 1)
            print(f"   HTTP {e.code}; espero {espera}s", flush=True)
            time.sleep(espera)
        except Exception as e:
            print(f"   erro {str(e)[:60]}; tento de novo", flush=True)
            time.sleep(6 * (i + 1))
    raise RuntimeError("falhou " + url)


def paginas(url_base):
    p = 1
    while True:
        d = get(f"{url_base}&pagina={p}&tamanhoPagina=50")
        for x in d.get("data", []):
            yield x
        if p >= (d.get("totalPaginas") or 0):
            break
        p += 1


def janelas(dias):
    d0 = date(int(INICIO[:4]), int(INICIO[4:6]), int(INICIO[6:]))
    while d0 <= date.today():
        d1 = min(d0 + timedelta(days=dias - 1), date.today())
        yield d0, d1
        d0 = d1 + timedelta(days=1)


if MODO in ("tudo", "contratacoes"):
  with open(saida / "pncp_contratacoes.jsonl", "w", encoding="utf-8") as f:
    total = 0
    for cnpj, nome in ORGAOS.items():
        for d0, d1 in janelas(180):  # a API só aceita períodos de até 365 dias
            for mod in MODALIDADES:
                n = 0
                for x in paginas(f"{BASE}contratacoes/publicacao?dataInicial={d0:%Y%m%d}&dataFinal={d1:%Y%m%d}&codigoModalidadeContratacao={mod}&cnpj={cnpj}"):
                    f.write(json.dumps(x, ensure_ascii=False) + chr(10)); n += 1
                if n:
                    print(f"contratações {nome} {d0}..{d1} modalidade {mod}: {n}", flush=True)
                total += n
    print("contratações total:", total, flush=True)

if MODO in ("tudo", "contratos"):
  with open(saida / "pncp_contratos.jsonl", "w", encoding="utf-8") as f:
      total = 0
      ini = date(int(INICIO[:4]), int(INICIO[4:6]), int(INICIO[6:]))
      for cnpj, nome in ORGAOS.items():
          d0 = ini
          while d0 <= date.today():
              d1 = min(d0 + timedelta(days=89), date.today())
              n = 0
              for x in paginas(f"{BASE}contratos?dataInicial={d0:%Y%m%d}&dataFinal={d1:%Y%m%d}&cnpjOrgao={cnpj}"):
                  f.write(json.dumps(x, ensure_ascii=False) + "\n"); n += 1
              total += n
              print(f"contratos {nome} {d0}..{d1}: {n}", flush=True)
              d0 = d1 + timedelta(days=1)
      print("contratos total:", total, flush=True)
print("concluído", flush=True)
