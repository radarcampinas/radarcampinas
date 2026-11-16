"""Extrai rua e bairro do texto oficial de um pedido e dá a ele um "tipo de pedido".

Regra única, igual para todos os vereadores, só pelo texto da ementa. Sem inteligência artificial:
são expressões regulares simples. Erra em textos fora do padrão; nesses casos o pedido simplesmente
não entra na contagem de repetições (mas continua aparecendo na busca).
"""
import re, unicodedata

ABREV = [  # (padrão, troca) aplicados ao texto já sem acento e em maiúsculas
    (r"\bAV\.?(?=\s)", "AVENIDA"), (r"\bR\.(?=\s)", "RUA"), (r"\bAL\.(?=\s)", "ALAMEDA"),
    (r"\bTRAV\.?(?=\s)", "TRAVESSA"), (r"\bPCA\.?(?=\s)", "PRACA"), (r"\bEST\.(?=\s)", "ESTRADA"),
    (r"\bROD\.(?=\s)", "RODOVIA"), (r"\bDRA?\.?(?=\s)", "DOUTOR"), (r"\bPROFA?\.?(?=\s)", "PROFESSOR"),
    (r"\bENG\.?(?=\s)", "ENGENHEIRO"), (r"\bCEL\.?(?=\s)", "CORONEL"), (r"\bPE\.(?=\s)", "PADRE"),
    (r"\bJD\.?(?=\s)", "JARDIM"), (r"\bVL\.?(?=\s)", "VILA"), (r"\bPQ\.?(?=\s)", "PARQUE"),
    (r"\bRES\.(?=\s)", "RESIDENCIAL"), (r"\bSTA\.?(?=\s)", "SANTA"), (r"\bSTO\.?(?=\s)", "SANTO"),
    (r"\bSAO\b", "SAO"), (r"\bMAL\.?(?=\s)", "MARECHAL"), (r"\bGEN\.?(?=\s)", "GENERAL"),
    (r"\bCAP\.?(?=\s)", "CAPITAO"), (r"\bTEN\.?(?=\s)", "TENENTE"), (r"\bDEP\.?(?=\s)", "DEPUTADO"),
    (r"\bVER\.?(?=\s)", "VEREADOR"), (r"\bPRES\.?(?=\s)", "PRESIDENTE"),
]


def norm(s):
    s = re.sub(r"[‒-―]", " - ", s or "")  # travessão vira hífen antes de tirar acentos
    s = unicodedata.normalize("NFD", (s or "").upper()).encode("ascii", "ignore").decode()
    s = re.sub(r"\s+", " ", s).strip()
    for p, t in ABREV:
        s = re.sub(p, t, s)
    s = re.sub(r"[“”\"'`´]", "", s)
    return s


VIA = r"(?:RUA|AVENIDA|ALAMEDA|TRAVESSA|PRACA|ESTRADA|RODOVIA|VIADUTO|CAMINHO|BECO|VIELA|LARGO|RUELA)"
BAIRRO_INI = r"(?:JARDIM|VILA|PARQUE|RESIDENCIAL|CIDADE|CONJUNTO|BAIRRO|NUCLEO|DISTRITO|LOTEAMENTO|CHACARA|SITIO|VALE|SOUSAS|BARAO GERALDO|CAMBUI|TAQUARAL|GUANABARA|BOTAFOGO|BONFIM|CENTRO|PONTE PRETA|SWIFT|NOVA CAMPINAS|DIC)"
_PARADA = (r"(?=\s*(?:,|;|\(|\s-\s|\sN\s|\sN\.|\sNR\b|\sS/N|\sSN\b|\sESQUINA|\sALTURA|\sEM FRENTE|\sPROXIM|\sPOR TODA"
           r"|\sNO TRECHO|\sTRECHO|\sENTRE\b|\sAO LADO|\sPARALELA|\sTENDO|\sCOM\b|\sPARA\b|\sBEM COMO|\sDEFRONTE|\sNO\s|\sNA\s|\sNOS\s|\sNAS\s"
           r"|\sDA REGIAO|\sSITUAD|\sLOCALIZAD|\sE\s+(?:A\s+)?" + VIA + r"|\s" + BAIRRO_INI + r"\b|\.\s*$|$))")
_RUA = re.compile(r"\b(" + VIA + r")\s+([A-Z0-9][^,;()]*?)" + _PARADA)
_TAIL = re.compile(r"\s-\s+([A-Z0-9][A-Z0-9 .'/]{2,40}?)\s*\.?\s*$")
_BAIRRO_MEIO = re.compile(r"(?:\bBAIRRO\s+|[,-]\s*|\b(?:NO|NA|DO|DA)\s+)((?:" + BAIRRO_INI + r")(?:\s+[A-Z0-9.'/]+){0,5})")
_VIRGULA_FIM = re.compile(r",\s*([A-Z][A-Z ]{3,30}?)\s*\.?\s*$")
_BAIRRO_FIM = re.compile(r"\b(?:NO|NA|DO|DA)\s+((?:BAIRRO\s+)?" + BAIRRO_INI + r"(?:\s+[A-Z0-9.'/]+){0,5})\s*\.?\s*$")


def _limpa(s):
    s = re.sub(r"\s+", " ", s).strip(" .-")
    s = re.sub(r"^(?:BAIRRO)\s+", "", s)
    return s


def extrair(ementa):
    """Devolve (rua, bairro). Qualquer um pode ser None."""
    e = norm(ementa)[:300]
    rua = bairro = None
    m = _RUA.search(e)
    if m:
        nome = _limpa(m.group(2))
        if nome and not re.match(r"(?:(?:LOCALIZAD|SITUAD|EXISTENTE|PUBLIC|PRINCIPAL|MENCIONAD)[A-Z]*|(?:ONDE|QUE|UMA?|ESSA|ESTA|E|OU)\b)", nome):
            rua = f"{m.group(1)} {nome}"
    t = _TAIL.search(e)
    if t:
        b = _limpa(t.group(1))
        if len(b.split()) <= 6 and not re.search(r"\b(RUA|AVENIDA|ENTRE|TRECHO|PROXIM|ESQUINA)\b", b):
            bairro = b
    if not bairro:
        t = _BAIRRO_FIM.search(e)
        if t:
            bairro = _limpa(t.group(1))
    if not bairro:  # "...no bairro Jardim X, ..." no meio do texto: vale o último que aparecer
        achados = list(_BAIRRO_MEIO.finditer(e))
        if achados:
            b = re.split(r"\s(?:NO|NA|NOS|NAS|E|COM|PARA|QUE|POR|EM|DE FRENTE)\b|[,;(]", achados[-1].group(1))[0]
            b = _limpa(b)
            if 1 <= len(b.split()) <= 6:
                bairro = b
    if not bairro:  # último trecho depois de vírgula, sem número: ", SAO BERNARDO."
        t = _VIRGULA_FIM.search(e)
        if t:
            b = _limpa(t.group(1))
            if not re.search(r"\d|\b(RUA|AVENIDA|ENTRE|TRECHO|ALTURA|PROXIM|ESQUINA|FRENTE|LADO|NUMERO|REGIAO)\b", b) and 1 <= len(b.split()) <= 4:
                bairro = b
    if rua and bairro and rua.endswith(" " + bairro):
        rua = rua[: -len(bairro) - 1]
    return rua, bairro


# Tipos de pedido: a primeira palavra-chave que aparecer no começo do texto decide. Igual para todos.
CATEGORIAS = [
    ("Tapa-buraco e asfalto", r"TAPA[- ]?BURACO|RECAPEAMENTO|PAVIMENTA|ASFALT|BURACO|OPERACAO TAPA"),
    ("Poda, roçada e árvores", r"PODA|ROCADA|CAPINA|MATO\b|EXTRACAO|CORTE DE ARVORE|ARVORE"),
    ("Limpeza e lixo", r"LIMPEZA|LIXO|ENTULHO|LIXEIRA|VARRICAO|DESCARTE|RETIRADA DE"),
    ("Iluminação", r"ILUMINACAO|LAMPADA|POSTE|LUMINARIA|\bLED\b"),
    ("Sinalização e trânsito", r"SINALIZACAO|FAIXA DE PEDESTRE|LOMBADA|REDUTOR|SEMAFORO|TRANSITO|TRAFEGO|ESTACIONAMENTO|SENTIDO UNICO|PLACA"),
    ("Calçadas e acessibilidade", r"CALCADA|PASSEIO|RAMPA|ACESSIBILIDADE|GUIA\b|SARJETA"),
    ("Água, esgoto e drenagem", r"BUEIRO|BOCA DE LOBO|GALERIA|DRENAGEM|ESGOTO|ENCHENTE|ALAGAMENTO|VAZAMENTO|AGUA|CORREGO|EROSAO"),
    ("Segurança", r"GUARDA MUNICIPAL|RONDA|SEGURANCA|CAMERA|VIDEOMONITORAMENTO|POLICIAMENTO"),
    ("Ônibus e transporte", r"ONIBUS|TRANSPORTE|ABRIGO|ITINERARIO|\bLINHA\b"),
    ("Praças, parques e lazer", r"PRACA|PARQUE|PLAYGROUND|ACADEMIA|QUADRA|REVITALIZACAO|CAMPO DE"),
]
OUTROS_PEDIDOS = "Outros pedidos"
NOMES_CAT = [c for c, _ in CATEGORIAS] + [OUTROS_PEDIDOS]


def categoria(ementa):
    e = norm(ementa)[:110]
    melhor, pos = len(CATEGORIAS), 10**6
    for i, (nome, rx) in enumerate(CATEGORIAS):
        m = re.search(rx, e)
        if m and m.start() < pos:  # vale a palavra-chave que aparece primeiro no texto
            melhor, pos = i, m.start()
    return melhor
