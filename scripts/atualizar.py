"""Atualização diária dos dados do Radar Campinas (feita para rodar de madrugada).

Uso: python -I -X utf8 scripts/atualizar.py [--semanal] [--so-baixar] [--so-gerar] [--limite-consultas N] [--horas H]

O que faz, em ordem:
  1. Baixa SÓ O QUE É NOVO do SAPL (Câmara), do TCE-SP e do PNCP, devagar (uma consulta por vez, com pausa).
  2. Guarda uma cópia de site/dados, regera os arquivos do site e confere se nada piorou; se algo falhar, devolve a cópia.
  3. Grava um resumo em data/logs/ultima.json e o relato do dia em data/logs/atualizacao_AAAA-MM-DD.log.

Cuidados com os servidores:
  - uma consulta por vez, com pausa de ~1,5 a 3 s entre elas (e mais longa se o servidor pedir);
  - 429 (muitas consultas): espera o tempo pedido e tenta de novo; 3 seguidos = para tudo e tenta na noite seguinte;
  - 403 (bloqueio): para IMEDIATAMENTE, sem insistir;
  - limite de consultas e de horas por execução (padrão: 6000 consultas, 4 horas);
  - trava para não rodar duas vezes ao mesmo tempo.
Com --semanal também refaz coisas mais pesadas (atos de suplência e Mesa da Câmara).
"""
import argparse, gzip, json, os, pathlib, random, shutil, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import date, datetime, timedelta

RAIZ = pathlib.Path(__file__).resolve().parent.parent
RAW, SITE, LOGS = RAIZ / "data" / "raw", RAIZ / "site", RAIZ / "data" / "logs"
SAPL = "https://sapl.campinas.sp.leg.br/api/"
UA = "radarcampinas-atualizacao/1.0 (dados abertos; uso civico; consulta lenta, 1 por vez)"
INICIO = "2025-01-01"

# endpoints do SAPL: pequenos (refeitos inteiros) e grandes (só o que é novo, pelo id)
PEQUENOS = ["parlamentares/legislatura", "parlamentares/parlamentar", "parlamentares/mandato", "parlamentares/partido", "parlamentares/filiacao",
            "parlamentares/sessaolegislativa", "base/tipoautor", "base/autor", "materia/tipomaterialegislativa", "sessao/tiposessaoplenaria",
            "sessao/tiporesultadovotacao"]
GRANDES = ["sessao/sessaoplenaria", "sessao/sessaoplenariapresenca", "sessao/presencaordemdia", "sessao/ordemdia", "sessao/expedientemateria",
           "sessao/registrovotacao", "sessao/votoparlamentar", "sessao/justificativaausencia", "materia/autoria"]
ORGAOS_PNCP = ["51885242000140", "47018676000176", "57500902000104", "06916689000185", "49413800000123", "52350980000156"]


class Bloqueado(Exception):
    pass


class Cliente:
    """Faz as consultas uma a uma, com pausa, respeitando limites e parando ao primeiro sinal de bloqueio."""

    def __init__(self, limite, prazo, pausa=(1.5, 3.0)):
        self.limite, self.prazo, self.pausa, self.n, self.seguidos429, self.ultimo = limite, prazo, pausa, 0, 0, 0.0

    def _esperar(self):
        faltam = self.ultimo + random.uniform(*self.pausa) - time.time()
        if faltam > 0:
            time.sleep(faltam)

    def json(self, url, tentativas=5, timeout=120, bruto=False):
        for i in range(tentativas):
            if self.n >= self.limite:
                raise Bloqueado(f"limite de {self.limite} consultas por execução atingido (continua na próxima noite)")
            agora = time.time()
            if self.ultimo and agora - self.ultimo > 600:  # mais de 10 min sem consulta: o computador provavelmente foi suspenso
                self.prazo += agora - self.ultimo
                log(f"   o computador ficou {int((agora - self.ultimo) / 60)} min parado (suspensão); esse tempo não conta no limite de horas")
                self.ultimo = agora
            if agora > self.prazo:
                raise Bloqueado("tempo máximo da execução atingido (continua na próxima noite)")
            self._esperar()
            self.n += 1
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    corpo = r.read()
                self.ultimo = time.time(); self.seguidos429 = 0
                if bruto:
                    return corpo
                return json.loads(corpo.decode("utf-8", "replace")) if corpo.strip() else None
            except urllib.error.HTTPError as e:
                self.ultimo = time.time()
                if e.code == 403:
                    raise Bloqueado(f"403 (bloqueio) em {url[:90]}: paro agora e não insisto")
                if e.code == 204:
                    return None
                if e.code in (429, 503):
                    self.seguidos429 += 1
                    if self.seguidos429 >= 3:
                        raise Bloqueado("3 respostas seguidas pedindo para diminuir o ritmo (429/503): paro por hoje")
                    try:
                        espera = int(e.headers.get("Retry-After", "")) if e.headers.get("Retry-After") else 60 * self.seguidos429
                    except ValueError:
                        espera = 60 * self.seguidos429
                    espera = min(max(espera, 30), 600)
                    log(f"   HTTP {e.code}; espero {espera}s")
                    time.sleep(espera)
                else:
                    log(f"   HTTP {e.code} em {url[:90]}; tento de novo")
                    time.sleep(5 * (i + 1))
            except Exception as e:
                self.ultimo = time.time()
                log(f"   erro de rede ({str(e)[:70]}); tento de novo")
                time.sleep(8 * (i + 1))
        raise RuntimeError("falhou: " + url[:120])


_log_arq = None


def log(msg):
    linha = f"{datetime.now():%H:%M:%S} {msg}"
    print(linha, flush=True)
    if _log_arq:
        with open(_log_arq, "a", encoding="utf-8") as f:
            f.write(linha + "\n")


def ler_jsonl(arq):
    if not arq.exists():
        return []
    return [json.loads(l) for l in open(arq, encoding="utf-8") if l.strip()]


def gravar_jsonl(arq, itens):
    tmp = arq.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        for it in itens:
            f.write(json.dumps(it, ensure_ascii=False) + "\n")
    tmp.replace(arq)


def nome_arq(ep):
    return RAW / (ep.replace("/", "__") + ".jsonl")


def paginar(c, url_base, descendente=False):
    """Percorre as páginas de um endpoint do SAPL. Sempre com o=id (sem isso a API repete e perde registros)."""
    p = 1
    ordem = "-id" if descendente else "id"
    while True:
        d = c.json(f"{url_base}{'&' if '?' in url_base else '?'}o={ordem}&page_size=100&page={p}")
        if isinstance(d, list):
            yield d, 1, 1
            return
        yield d["results"], p, d["pagination"]["total_pages"]
        if not d["pagination"]["next_page"]:
            return
        p += 1


def baixar_completo(c, ep, extra=""):
    """Refaz um endpoint pequeno por inteiro; só troca o arquivo se terminou."""
    itens, vistos = [], set()
    for res, p, tot in paginar(c, f"{SAPL}{ep}/?{extra}".rstrip("?")):
        for it in res:
            if it["id"] not in vistos:
                vistos.add(it["id"]); itens.append(it)
    anterior = len(ler_jsonl(nome_arq(ep)))
    if anterior and len(itens) < anterior * 0.9:
        raise RuntimeError(f"{ep}: veio {len(itens)} registros e tínhamos {anterior}; não troco o arquivo")
    gravar_jsonl(nome_arq(ep), sorted(itens, key=lambda x: x["id"]))
    log(f"{ep}: {len(itens)} registros (antes {anterior})")


def baixar_novos(c, ep, arq=None, extra="", max_paginas=400):
    """Só o que é novo: lê da página mais recente para trás e para quando chega em ids que já temos."""
    arq = arq or nome_arq(ep)
    atuais = ler_jsonl(arq)
    conhecidos = {x["id"] for x in atuais}
    maior = max(conhecidos) if conhecidos else 0
    novos = {}
    for res, p, tot in paginar(c, f"{SAPL}{ep}/?{extra}".rstrip("?"), descendente=True):
        for it in res:
            if it["id"] not in conhecidos:
                novos[it["id"]] = it
        if not res or min(x["id"] for x in res) <= maior or p >= max_paginas:
            break
    if novos:
        gravar_jsonl(arq, sorted(list(atuais) + list(novos.values()), key=lambda x: x["id"]))
    log(f"{ep}: {len(novos)} novos (total {len(atuais) + len(novos)})")
    return len(novos)


def renovar_janela(c, ep, arq, filtro):
    """Rebaixa os registros de uma janela recente (para pegar edições) e troca pelos que já tínhamos."""
    atuais = {x["id"]: x for x in ler_jsonl(arq)}
    n = 0
    for res, p, tot in paginar(c, f"{SAPL}{ep}/?{filtro}"):
        for it in res:
            if atuais.get(it["id"]) != it:
                n += 1
            atuais[it["id"]] = it
    gravar_jsonl(arq, sorted(atuais.values(), key=lambda x: x["id"]))
    log(f"{ep} ({filtro}): {n} novos ou alterados")


def atualizar_sapl(c):
    for ep in PEQUENOS:
        baixar_completo(c, ep)
    for ep in GRANDES:
        baixar_novos(c, ep)
    mat = RAW / "materia__materialegislativa_desde2025.jsonl"
    baixar_novos(c, "materia/materialegislativa", mat, f"data_apresentacao__gte={INICIO}")
    renovar_janela(c, "materia/materialegislativa", mat, f"data_apresentacao__gte={date.today() - timedelta(days=14)}")
    renovar_janela(c, "sessao/sessaoplenaria", nome_arq("sessao/sessaoplenaria"), f"data_inicio__gte={date.today() - timedelta(days=30)}")


def atualizar_leis(c):
    leis = {}
    for t in (1, 2, 9):
        for res, p, tot in paginar(c, f"{SAPL}norma/normajuridica/?tipo={t}&data__gte={INICIO}"):
            for n in res:
                leis[n["id"]] = n
    gravar_jsonl(RAW / "norma__leis.jsonl", sorted(leis.values(), key=lambda n: n["id"]))
    arq = RAW / "norma__materias.jsonl"
    tem = {r["materia"]["id"]: r for r in ler_jsonl(arq)}
    faltam = sorted({n["materia"] for n in leis.values() if n["materia"]} - set(tem))
    for i in faltam:
        m = c.json(f"{SAPL}materia/materialegislativa/{i}/")
        a = []
        for res, p, tot in paginar(c, f"{SAPL}materia/autoria/?materia={i}"):
            a += res
        tem[i] = {"materia": m, "autoria": a}
    gravar_jsonl(arq, [tem[i] for i in sorted(tem)])
    log(f"leis: {len(leis)} (projetos de origem novos: {len(faltam)})")


def atualizar_tce(c):
    pasta = RAW / "tce"; pasta.mkdir(parents=True, exist_ok=True)
    hoje = date.today()
    ant = (hoje.replace(day=1) - timedelta(days=1))
    meses = []
    a, m = 2025, 1
    while (a, m) <= (hoje.year, hoje.month):
        meses.append((a, m)); m += 1
        if m > 12:
            a, m = a + 1, 1
    for a, m in meses:
        arq = pasta / f"despesas_{a}_{m:02d}.json.gz"
        recente = (a, m) in [(hoje.year, hoje.month), (ant.year, ant.month)]
        if arq.exists() and not recente:
            continue
        corpo = c.json(f"https://transparencia.tce.sp.gov.br/api/json/despesas/campinas/{a}/{m}", timeout=300, bruto=True)
        dados = json.loads(corpo.decode("utf-8", "replace")) if corpo and corpo.strip() else []
        if not dados:
            log(f"TCE {a}/{m:02d}: sem dados ainda"); continue
        if arq.exists():
            antes = len(json.load(gzip.open(arq, "rt", encoding="utf-8")))
            if len(dados) < antes:
                log(f"TCE {a}/{m:02d}: veio {len(dados)} e tínhamos {antes}; mantenho o que tinha"); continue
        tmp = arq.with_suffix(".tmp")
        with gzip.open(tmp, "wt", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False)
        tmp.replace(arq)
        log(f"TCE {a}/{m:02d}: {len(dados)} registros")


def atualizar_pncp(c, dias=45):
    pasta = RAW / "pncp"; pasta.mkdir(parents=True, exist_ok=True)
    base = "https://pncp.gov.br/api/consulta/v1/"
    d1, d0 = date.today(), date.today() - timedelta(days=dias)

    def paginas(url):
        p = 1
        while True:
            d = c.json(f"{url}&pagina={p}&tamanhoPagina=50") or {"data": [], "totalPaginas": 0}
            yield from d.get("data", [])
            if p >= (d.get("totalPaginas") or 0):
                return
            p += 1

    arq = pasta / "pncp_contratacoes.jsonl"
    atuais = {x["numeroControlePNCP"]: x for x in ler_jsonl(arq)}; novos = 0
    for cnpj in ORGAOS_PNCP:
        for mod in range(1, 14):
            for x in paginas(f"{base}contratacoes/publicacao?dataInicial={d0:%Y%m%d}&dataFinal={d1:%Y%m%d}&codigoModalidadeContratacao={mod}&cnpj={cnpj}"):
                novos += x["numeroControlePNCP"] not in atuais or atuais[x["numeroControlePNCP"]] != x
                atuais[x["numeroControlePNCP"]] = x
    gravar_jsonl(arq, list(atuais.values()))
    log(f"PNCP contratações: {novos} novas ou alteradas (total {len(atuais)})")

    arq = pasta / "pncp_contratos.jsonl"
    atuais = {x["numeroControlePNCP"]: x for x in ler_jsonl(arq)}; novos = 0
    for cnpj in ORGAOS_PNCP:
        for x in paginas(f"{base}contratos?dataInicial={d0:%Y%m%d}&dataFinal={d1:%Y%m%d}&cnpjOrgao={cnpj}"):
            novos += x["numeroControlePNCP"] not in atuais or atuais[x["numeroControlePNCP"]] != x
            atuais[x["numeroControlePNCP"]] = x
    gravar_jsonl(arq, list(atuais.values()))
    log(f"PNCP contratos: {novos} novos ou alterados (total {len(atuais)})")


def rodar(script, *args):
    cmd = [sys.executable, "-I", "-B", "-X", "utf8", str(RAIZ / "scripts" / script), *args]
    r = subprocess.run(cmd, cwd=RAIZ, capture_output=True, text=True, encoding="utf-8", errors="replace")
    saida = (r.stdout or "")[-400:].strip().replace("\n", " | ")
    if r.returncode != 0:
        raise RuntimeError(f"{script} falhou: {(r.stderr or '')[-500:]}")
    log(f"{script}: ok {saida[-160:]}")


def gerar(semanal):
    copia = RAIZ / "data" / "backup_dados"
    if copia.exists():
        shutil.rmtree(copia)
    shutil.copytree(SITE / "dados", copia)
    antes = json.load(open(SITE / "dados" / "geral.json", encoding="utf-8"))
    try:
        passos = [("gerar_dados.py", "data/raw", "site"), ("gerar_busca.py", "data/raw", "site"), ("gerar_graficos.py", "data/raw", "site"),
                  ("gerar_gastos.py", "data/raw", "site"), ("gerar_licitacoes.py", "data/raw", "site"), ("gerar_leis.py", "data/raw", "site"),
                  ("gerar_paginas.py", "site")]  # páginas estáticas, sitemap e robots para o Google (usa os JSON recém-gerados)
        if semanal:
            passos.append(("gerar_afastamentos.py", "data/raw", "site"))
        passos.append(("conferir.py", "data/raw", "site", "data"))
        passos.append(("auditar_privacidade.py", "site"))  # se achar CPF, RG, e-mail, telefone ou endereço residencial, não publica
        for p in passos:
            rodar(*p)
        depois = json.load(open(SITE / "dados" / "geral.json", encoding="utf-8"))
        a, d = antes["meta"], depois["meta"]
        if len(depois["vereadores"]) < len(antes["vereadores"]) or d["total_sessoes_com_lista"] < a["total_sessoes_com_lista"] or d["total_votacoes_nominais"] < a["total_votacoes_nominais"]:
            raise RuntimeError("os números diminuíram em relação a ontem (sessões, votações ou vereadores); desfaço a atualização")
        (SITE / "dados" / "atualizacao.json").write_text(json.dumps({"em": datetime.now().isoformat(timespec="minutes")}), encoding="utf-8")
        log(f"conferência: sessões {a['total_sessoes_com_lista']}→{d['total_sessoes_com_lista']}, votações nominais {a['total_votacoes_nominais']}→{d['total_votacoes_nominais']}")
    except Exception:
        log("ERRO ao gerar: devolvo a cópia de ontem de site/dados")
        shutil.rmtree(SITE / "dados"); shutil.copytree(copia, SITE / "dados")
        raise


def git(*args):
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0")  # nunca ficar esperando senha: se faltar login, falha e registra
    r = subprocess.run(["git", *args], cwd=RAIZ, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args[:2])} falhou: {(r.stderr or r.stdout)[-300:].strip()}")
    return r.stdout


def publicar():
    """Envia só a pasta site/ (e só se mudou) para o GitHub; o GitHub Pages republica sozinho."""
    git("add", "site")
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=RAIZ).returncode == 0:
        log("publicar: nada mudou em site/, não há o que enviar"); return
    git("commit", "-m", f"Atualização dos dados {date.today()}")
    try:
        git("push")
    except RuntimeError as e:
        # outro envio chegou antes (ex.: GitHub Actions). Como site/ é todo regerado, nossa versão recente vence os conflitos (-X theirs no rebase = nosso commit).
        log(f"push recusado ({str(e)[-120:]}); refaço por cima do que chegou e tento de novo")
        git("pull", "--rebase", "--autostash", "-X", "theirs")
        git("push")
    log("publicar: enviado ao GitHub (o site é republicado em 1 a 2 minutos)")


def manter_acordado(ligar):
    """Pede ao Windows para não suspender o computador por inatividade enquanto a atualização roda (ES_CONTINUOUS | ES_SYSTEM_REQUIRED)."""
    try:
        import ctypes
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000001 if ligar else 0x80000000)
    except Exception:
        pass


def _pid_vivo(pid):
    """True se o processo ainda existe (a trava de uma atualização interrompida por reinício não deve bloquear a próxima)."""
    try:
        import ctypes
        k = ctypes.windll.kernel32
        h = k.OpenProcess(0x1000, False, int(pid))  # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return False
        code = ctypes.c_ulong()
        ok = k.GetExitCodeProcess(h, ctypes.byref(code))
        k.CloseHandle(h)
        return bool(ok) and code.value == 259  # STILL_ACTIVE
    except Exception:
        return True  # na dúvida, respeita a trava


ESTADO = LOGS / "estado.json"
MAX_TENTATIVAS_POR_DIA = 4


def _estado():
    hoje = str(date.today())
    try:
        e = json.loads(ESTADO.read_text(encoding="utf-8"))
        if e.get("data") == hoje:
            return e
    except Exception:
        pass
    return {"data": hoje, "tentativas": 0, "concluido": False, "bloqueado": False}


def ja_publicado_hoje():
    """True se o site publicado no GitHub (origin/main) já foi atualizado hoje, por qualquer um (GitHub Actions ou este computador)."""
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0")
    try:
        subprocess.run(["git", "fetch", "-q", "origin", "main"], cwd=RAIZ, timeout=90, capture_output=True, env=env)
        r = subprocess.run(["git", "show", "origin/main:site/dados/atualizacao.json"], cwd=RAIZ, capture_output=True, text=True, encoding="utf-8", timeout=30, env=env)
        texto = r.stdout if r.returncode == 0 else (SITE / "dados" / "atualizacao.json").read_text(encoding="utf-8")
        return str(json.loads(texto).get("em", ""))[:10] == str(date.today())
    except Exception:
        return False  # na dúvida, atualiza


def main():
    global _log_arq
    ap = argparse.ArgumentParser()
    ap.add_argument("--semanal", action="store_true", help="inclui atos de suplência e Mesa")
    ap.add_argument("--so-baixar", action="store_true"); ap.add_argument("--so-gerar", action="store_true")
    ap.add_argument("--publicar", action="store_true", help="depois de gerar e conferir, envia site/ para o GitHub (git commit + push)")
    ap.add_argument("--pular-se-atualizado", action="store_true", help="para a tarefa agendada: não faz nada se hoje já deu certo, se o servidor bloqueou hoje ou se já houve %d tentativas hoje" % MAX_TENTATIVAS_POR_DIA)
    ap.add_argument("--limite-consultas", type=int, default=6000); ap.add_argument("--horas", type=float, default=4)
    a = ap.parse_args()
    LOGS.mkdir(parents=True, exist_ok=True)
    _log_arq = LOGS / f"atualizacao_{date.today()}.log"
    trava = RAIZ / "data" / "atualizar.lock"
    if trava.exists() and time.time() - trava.stat().st_mtime < 6 * 3600:
        try:
            dono = int(trava.read_text().strip())
        except Exception:
            dono = 0
        if dono and _pid_vivo(dono):
            print("já existe uma atualização em andamento (trava de um processo ainda ativo); saio."); return 0
        print("trava antiga de uma execução interrompida (ex.: reinício do computador); sigo em frente.")
    est = _estado()
    if a.pular_se_atualizado:
        motivo = "hoje já foi atualizado com sucesso" if est["concluido"] else "o servidor pediu para diminuir o ritmo hoje; tento amanhã" if est["bloqueado"] else f"já houve {est['tentativas']} tentativas hoje" if est["tentativas"] >= MAX_TENTATIVAS_POR_DIA else ""
        if motivo:
            log(f"pulado: {motivo}"); return 0
        if ja_publicado_hoje():
            est["concluido"] = True
            ESTADO.write_text(json.dumps(est), encoding="utf-8")
            log("pulado: o site publicado no GitHub já foi atualizado hoje (a atualização do GitHub Actions ou de outro computador serve)"); return 0
    est["tentativas"] += 1
    ESTADO.write_text(json.dumps(est), encoding="utf-8")
    trava.write_text(str(os.getpid()))
    manter_acordado(True)
    inicio = time.time(); resumo = {"inicio": datetime.now().isoformat(timespec="seconds"), "ok": False, "etapas": {}}
    c = Cliente(a.limite_consultas, inicio + a.horas * 3600)
    try:
        if not a.so_gerar:
            for nome, f in [("sapl", atualizar_sapl), ("leis", atualizar_leis), ("tce", atualizar_tce), ("pncp", atualizar_pncp)]:
                try:
                    f(c); resumo["etapas"][nome] = "ok"
                except Bloqueado as e:
                    resumo["etapas"][nome] = f"interrompida: {e}"; log(f"INTERROMPIDO ({nome}): {e}")
                    break  # não insisto: o resto fica para a próxima noite
                except Exception as e:
                    resumo["etapas"][nome] = f"erro: {e}"; log(f"ERRO ({nome}): {e}")
        if not a.so_baixar:
            sapl_ok = a.so_gerar or resumo["etapas"].get("sapl") == "ok"
            if sapl_ok:
                gerar(a.semanal); resumo["etapas"]["gerar"] = "ok"
                if a.publicar:
                    try:
                        publicar(); resumo["etapas"]["publicar"] = "ok"
                    except Exception as e:
                        resumo["etapas"]["publicar"] = f"erro: {e}"; log(f"ERRO ao publicar: {e}")
            else:
                resumo["etapas"]["gerar"] = "não feita: a etapa do SAPL não terminou; o site continua com os dados de ontem"
                log(resumo["etapas"]["gerar"])
        resumo["ok"] = all(v == "ok" for v in resumo["etapas"].values())
    except Exception as e:
        resumo["erro"] = str(e); log(f"ERRO: {e}")
    finally:
        resumo.update({"fim": datetime.now().isoformat(timespec="seconds"), "consultas": c.n, "minutos": round((time.time() - inicio) / 60, 1)})
        (LOGS / "ultima.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=1), encoding="utf-8")
        est["concluido"] = bool(est["concluido"] or (resumo["ok"] and (a.so_gerar or resumo["etapas"].get("sapl") == "ok")))
        est["bloqueado"] = bool(est["bloqueado"] or any("interrompida" in str(v) and ("403" in str(v) or "429/503" in str(v)) for v in resumo["etapas"].values()))  # só bloqueio de verdade; limite de horas/consultas deixa tentar de novo
        ESTADO.write_text(json.dumps(est), encoding="utf-8")
        manter_acordado(False)
        trava.unlink(missing_ok=True)
        log(f"fim: ok={resumo['ok']} consultas={c.n} minutos={resumo['minutos']}")
        for velho in sorted(LOGS.glob("atualizacao_*.log"))[:-30]:
            velho.unlink()
    return 0 if resumo["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
