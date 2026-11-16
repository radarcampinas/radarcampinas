"""Regra única para agrupar propostas. Vale igual para todos os vereadores.

A regra olha só duas coisas do registro oficial: o TIPO da matéria (sigla) e as PRIMEIRAS PALAVRAS
da ementa (o texto oficial). Não olha autor, partido, bairro nem opinião. A primeira regra que
combina decide o grupo. Se nenhuma combina, vai para "Outros".
"""
import re, unicodedata

GRUPOS = [
    {"nome": "Pedidos de melhoria", "desc": "Pedem obras e serviços ao prefeito: tapar buraco, podar árvore, limpar praça, instalar iluminação. Quase todos citam uma rua ou bairro."},
    {"nome": "Perguntas e cobranças", "desc": "Pedem informações ao governo ou chamam um secretário à Câmara para explicar."},
    {"nome": "Homenagens", "desc": "Parabéns, pêsames, título de cidadão, medalhas, nome de rua ou praça e datas comemorativas."},
    {"nome": "Propostas de lei", "desc": "Projetos para criar ou mudar leis, decretos e regras da Câmara."},
    {"nome": "Outros", "desc": "Tudo o que não cabe nos grupos acima: protestos e apoios (moções), pedidos internos da Câmara, mudanças em projetos (emendas)."},
]

# (grupo, texto simples da regra)
REGRAS = [
    (2, "Texto oficial começa com “Concede” (título, medalha, diploma)."),                       # 0
    (2, "Texto oficial pede voto de aplauso, congratulação ou pesar."),                          # 1
    (2, "Texto oficial dá nome a rua, praça ou prédio (“Denomina…”)."),                          # 2
    (2, "Projeto de lei que cria um dia, semana ou evento no calendário oficial."),              # 3
    (2, "Pede reunião solene (ou entrega direta) de título, diploma ou honraria."),                                 # 4
    (1, "Requerimento ou pedido que começa pedindo informações ou esclarecimentos."),            # 5
    (1, "Pede a convocação de um secretário para explicar algo à Câmara."),                      # 6
    (0, "É uma Indicação: pedido de obra ou serviço ao prefeito."),                              # 7
    (3, "É um projeto de lei, de lei complementar, de decreto legislativo, de resolução ou mudança da Lei Orgânica."),  # 8
    (4, "Não se encaixa em nenhuma regra acima."),                                               # 9
]


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").upper()).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip()


_CAL = re.compile(r"\b(DIA|SEMANA|MES|DECADA)\b|CALENDARIO OFICIAL|DATA COMEMORATIVA|DATAS COMEMORATIVAS")


def classificar(sigla, ementa):
    """Devolve (indice_do_grupo, indice_da_regra)."""
    e = norm(ementa)
    ini = e[:45]
    if sigla == "PDL" and re.match(r"(CONCEDE|DIPLOMA DE)\b", e):
        return 2, 0
    if re.search(r"\bVOTOS? DE\b|\bAPLAUSOS?\b|\bMANIFESTACAO DE PESAR\b", ini) and sigla in ("REQ", "MOC", "IND"):
        return 2, 1
    if re.match(r"(RE)?DENOMINA\b|REQUER (QUE )?SEJA DENOMINADA\b", e):
        return 2, 2
    if sigla == "PLO" and re.match(r"(INSTITUI|INCLUI|CRIA)\b", e) and _CAL.search(e):
        return 2, 3
    if sigla == "REQ" and (("REUNIAO SOLENE" in e and re.search(r"TITULO|DIPLOMA|MEDALHA", e)) or "ENTREGA DE HONRARIA" in e):
        return 2, 4
    if re.match(r"(REQUER|REQUE|SOLICITA|REQUERIMENTO)( DE)? (DE )?(INFORMAC|ESCLARECIMENT)", e):
        return 1, 5
    if re.match(r"REQUER (A )?CONVOCACAO\b", e):
        return 1, 6
    if sigla == "IND":
        return 0, 7
    if sigla in ("PLO", "PLC", "PELOM", "PDL", "PRE"):
        return 3, 8
    return 4, 9
