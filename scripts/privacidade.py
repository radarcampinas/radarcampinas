"""Limpeza de dados pessoais. Usado pelos geradores (gerar_licitacoes.py, gerar_gastos.py) e conferido por auditar_privacidade.py.

O site só deve mostrar dados públicos de agentes públicos e de empresas (CNPJ). Nunca: CPF, RG, endereço residencial,
telefone, e-mail, data de nascimento. O PNCP e o TCE-SP às vezes trazem isso dentro de textos livres ou de razões sociais de
microempreendedores individuais (nome + CPF); aqui tiramos.
"""
import re

HONORIFICO = r"(?:Sr\.?a?|Sra\.?|Dr\.?a?|Dra\.?|sr\.?a?|sra\.?|profissional(?:\s+Dr[a]?\.)?|senhor[a]?)"
NOME = r"(?:[A-ZÀ-Ú][\wÀ-ú'.\-]*(?:\s+(?:d[aeo]s?|e)\s+|\s+)){1,7}[A-ZÀ-Ú][\wÀ-ú'.\-]*"

CPF_FORMATADO = re.compile(r"(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)")
CPF_CRU = re.compile(r"(?<![\d./-])\d{11}(?![\d/-])")  # 11 dígitos soltos (CNPJ tem 14 e vem formatado ou separado)
RG = re.compile(r"\bRG\b[\s.,:nNºo°-]{0,12}[\d][\d.\-]*[\dXx]?", re.I)
CEP = re.compile(r"\bCEP\.?:?\s*\d{2}\.?\d{3}-?\d{3}", re.I)
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
TELEFONE = re.compile(r"\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b")
SITO = re.compile(r"\bsito\s+[àa]s?\s+[^,]*(?:,[^,]*){0,6}?(?=,?\s*doravante|\.\s|$)", re.I)


def texto_livre(t):
    """Limpa um texto livre (objeto de compra ou contrato). Se tiver sinal de pessoa física contratada, tira nome, documentos e endereço."""
    if not t:
        return t
    t = " ".join(t.split())
    pessoal = bool(re.search(r"portador|doravante denominad|\bCPF\s*(?:n|sob)|Carteira de Identidade|\bRG\b|\bsito\b", t, re.I)) and not re.search(r"e-CPF", t)
    if pessoal:
        # contrato de artista: "Contratação do Sr. Fulano, portador ... doravante denominada “EMPRESA”, junto à Orquestra ... para ..."
        m = re.match(r"^(Contrata[çc][ãa]o)\s+d[oa]s?\s+" + HONORIFICO + r"\s+.*?doravante denominad[oa]\s+[“\"]EMPRESA[”\"],?\s*(.*)$", t, re.S)
        if m:
            t = f"{m.group(1)} de artista (pessoa física; nome, documentos e endereço omitidos), {m.group(2)}"
        t = re.sub(r"\b(?:d[oa]s?|o|a)\s+" + HONORIFICO + r"\s+" + NOME, lambda x: x.group(0).split()[0] + " pessoa contratada", t)
        t = SITO.sub("[endereço omitido]", t)
    t = CPF_FORMATADO.sub("[CPF omitido]", t)
    t = RG.sub("RG [omitido]", t)
    t = CEP.sub("CEP [omitido]", t)
    t = EMAIL.sub("[e-mail omitido]", t)
    t = TELEFONE.sub("[telefone omitido]", t)
    t = CPF_CRU.sub("", t)
    return re.sub(r"\s{2,}", " ", re.sub(r"\s+([,.;])", r"\1", t)).strip()


def razao_social(nome):
    """Nome de empresa. Microempreendedores individuais vêm como 'NOME 12345678900' (nome + CPF): tira os números do CPF."""
    if not nome:
        return nome
    n = CPF_FORMATADO.sub("", nome)
    n = CPF_CRU.sub("", n)
    return re.sub(r"\s{2,}", " ", n).strip(" -")
