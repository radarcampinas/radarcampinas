"""Gera site/dados/licitacoes.json e contratos.json a partir do que foi baixado do PNCP (data/raw/pncp).

Uso: python -I -X utf8 gerar_licitacoes.py <pasta_raw> <pasta_site>

Só reorganiza o que o PNCP publica. Pessoas físicas (fornecedores individuais) aparecem sem nome.
"""
import json, sys, pathlib, collections as C
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import privacidade as P  # tira CPF, RG, endereço residencial etc. dos textos livres e das razões sociais

raw, site = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
ORGAOS = {"51885242000140": "Prefeitura", "47018676000176": "Rede Mário Gatti", "57500902000104": "Fumec",
          "06916689000185": "Camprev", "49413800000123": "Setec", "52350980000156": "FJPO"}


def lê(nome):
    p = raw / "pncp" / nome
    return [json.loads(l) for l in open(p, encoding="utf-8")] if p.exists() else []


def curto(t, n=320):
    t = P.texto_livre(t or "")
    return t if len(t) <= n else t[: n - 1] + "…"


def link(num, tipo):
    # número de controle: CNPJ-1-SEQUENCIAL/ANO  ->  /app/editais/CNPJ/ANO/SEQUENCIAL
    try:
        cnpj, _, resto = num.split("-", 2)
        seq, ano = resto.split("/")
        return f"https://pncp.gov.br/app/{tipo}/{cnpj}/{ano}/{int(seq)}"
    except Exception:
        return None


# ---------- licitações e compras ----------
vistos, itens = set(), []
for x in lê("pncp_contratacoes.jsonl"):
    num = x.get("numeroControlePNCP")
    if not num or num in vistos:
        continue
    vistos.add(num)
    itens.append([num, (x.get("dataPublicacaoPncp") or "")[:10], ORGAOS.get(x["orgaoEntidade"]["cnpj"], x["orgaoEntidade"]["razaoSocial"]),
                  x.get("modalidadeNome") or "", x.get("situacaoCompraNome") or "", curto(x.get("objetoCompra")),
                  x.get("valorTotalEstimado") or 0, x.get("valorTotalHomologado") or 0,
                  (x["unidadeOrgao"].get("nomeUnidade") or "").title(), link(num, "editais"), 1 if x.get("srp") else 0, 0])
itens.sort(key=lambda r: r[1], reverse=True)


def marca_fora_do_padrao(linhas, i_valor, i_flag):
    """Valor muito alto: R$ 1 bilhão ou mais. Não é corrigido: só marcado e não somado (pode ser erro de digitação ou valor de muitos anos)."""
    n = 0
    for r in linhas:
        if r[i_valor] >= 1e9:
            r[i_flag] = 1; n += 1
    return n


fora_l = marca_fora_do_padrao(itens, 7, 11)
por_mod = C.defaultdict(lambda: [0, 0.0])
por_mes = C.Counter()
for r in itens:
    por_mod[r[3]][0] += 1; por_mod[r[3]][1] += 0 if r[11] else r[7]; por_mes[r[1][:7]] += 1
lic = {"fonte": "PNCP (Portal Nacional de Contratações Públicas)", "orgaos": sorted(set(ORGAOS.values())), "n": len(itens),
       "valor_homologado": round(sum(r[7] for r in itens if not r[11]), 2), "valor_estimado": round(sum(r[6] for r in itens if not r[11]), 2), "fora_do_padrao": fora_l,
       "modalidades": sorted(({"nome": k, "n": v[0], "valor": round(v[1], 2)} for k, v in por_mod.items()), key=lambda d: -d["n"]),
       "por_mes": sorted(por_mes.items()),
       "campos": ["numero_pncp", "data", "orgao", "modalidade", "situacao", "objeto", "valor_estimado", "valor_homologado", "unidade", "link", "srp", "fora_do_padrao"],
       "itens": itens}
json.dump(lic, open(site / "dados" / "licitacoes.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# ---------- contratos ----------
vistos, cont = set(), []
for x in lê("pncp_contratos.jsonl"):
    chave = (x.get("numeroControlePNCP") or "") + "|" + str(x.get("anoContrato")) + "|" + str(x.get("sequencialContrato")) + "|" + x["orgaoEntidade"]["cnpj"]
    if chave in vistos:
        continue
    vistos.add(chave)
    pf = (x.get("tipoPessoa") or "").upper() == "PF"
    cnpj_o = x["orgaoEntidade"]["cnpj"]
    cont.append([x.get("dataAssinatura") or "", ORGAOS.get(cnpj_o, x["orgaoEntidade"]["razaoSocial"]),
                 "Pessoa física" if pf else P.razao_social((x.get("nomeRazaoSocialFornecedor") or "").strip()), "" if pf else (x.get("niFornecedor") or ""),
                 curto(x.get("objetoContrato")), x.get("valorGlobal") or 0, x.get("dataVigenciaInicio") or "", x.get("dataVigenciaFim") or "",
                 f"https://pncp.gov.br/app/contratos/{cnpj_o}/{x.get('anoContrato')}/{x.get('sequencialContrato')}", 1 if pf else 0, 0])
cont.sort(key=lambda r: r[0], reverse=True)
fora_c = marca_fora_do_padrao(cont, 5, 10)
por_forn = C.defaultdict(float)
for r in cont:
    if not r[9] and r[3] and not r[10]:
        por_forn[(r[2], r[3])] += r[5]
ct = {"fonte": "PNCP (Portal Nacional de Contratações Públicas)", "n": len(cont), "valor_total": round(sum(r[5] for r in cont if not r[10]), 2), "fora_do_padrao": fora_c,
      "pf": sum(r[9] for r in cont),
      "campos": ["assinatura", "orgao", "fornecedor", "cnpj", "objeto", "valor", "vigencia_inicio", "vigencia_fim", "link", "pf", "fora_do_padrao"],
      "top_fornecedores": [[n, c, round(v, 2)] for (n, c), v in sorted(por_forn.items(), key=lambda x: -x[1])[:20]],
      "itens": cont}
json.dump(ct, open(site / "dados" / "contratos.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("licitações/compras:", lic["n"], "| valor homologado (mi):", round(lic["valor_homologado"] / 1e6, 1), "| modalidades:", [(m["nome"], m["n"]) for m in lic["modalidades"]])
print("valores fora do padrão (marcados e não somados): compras", fora_l, "| contratos", fora_c)
print("contratos:", ct["n"], "| valor total (mi):", round(ct["valor_total"] / 1e6, 1), "| de pessoas físicas:", ct["pf"])
