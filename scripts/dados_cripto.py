"""Empacota e criptografa (ou abre) os dados brutos que a atualização noturna precisa entre uma execução e outra.

Uso:
  DADOS_SENHA=... python scripts/dados_cripto.py cifrar  <arquivo.gpg>
  DADOS_SENHA=... python scripts/dados_cripto.py decifrar <arquivo.gpg> [--destino PASTA]

O pacote tem data/raw, data/atas, data/fontes, os relatórios oficiais em HTML e a amostra de atas (nada de logs nem backups).
Criptografia: GnuPG, AES-256 com senha (derivada com 65 milhões de iterações). A senha vem SÓ da variável DADOS_SENHA.
Os dados brutos têm textos do PNCP com CPF, RG e endereços de pessoas contratadas: por isso só podem ser guardados cifrados.
"""
import os, pathlib, shutil, subprocess, sys, tarfile, tempfile

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ITENS = ["data/raw", "data/atas", "data/fontes", "data/amostra_atas.json",
         "data/relatorio_presenca_ordemdia_oficial.html", "data/relatorio_presenca_sessao_oficial.html"]


def gpg():
    g = shutil.which("gpg")
    if g:
        return g
    for p in (r"C:\Program Files\Git\usr\bin\gpg.exe", r"C:\Program Files (x86)\Git\usr\bin\gpg.exe"):
        if os.path.exists(p):
            return p
    sys.exit("gpg não encontrado (no GitHub ele já vem instalado; no Windows vem com o Git).")


def senha():
    s = os.environ.get("DADOS_SENHA", "")
    if len(s) < 24:
        sys.exit("defina a variável DADOS_SENHA (senha longa, com pelo menos 24 caracteres).")
    return s


def rodar_gpg(args, entrada, saida):
    r = subprocess.run([gpg(), "--batch", "--yes", "--quiet", "--pinentry-mode", "loopback", "--passphrase-fd", "0", *args, "-o", str(saida), str(entrada)],
                       input=(senha() + "\n").encode(), capture_output=True)
    if r.returncode != 0:
        sys.exit("gpg falhou: " + r.stderr.decode("utf-8", "replace")[-300:])


def cifrar(saida):
    with tempfile.TemporaryDirectory() as t:
        tgz = pathlib.Path(t) / "pacote.tar.gz"
        n = 0
        with tarfile.open(tgz, "w:gz", compresslevel=6) as tf:
            for it in ITENS:
                p = RAIZ / it
                if not p.exists():
                    print(f"  (não existe, pulando: {it})")
                    continue
                tf.add(p, arcname=it, filter=lambda x: None if x.name.endswith((".tmp", ".lock")) else x)
                n += 1
        rodar_gpg(["--symmetric", "--cipher-algo", "AES256", "--compress-algo", "none", "--s2k-mode", "3", "--s2k-count", "65011712"], tgz, saida)
        print(f"pacote: {n} itens | compactado {tgz.stat().st_size / 1e6:.1f} MB | cifrado {pathlib.Path(saida).stat().st_size / 1e6:.1f} MB -> {saida}")


def decifrar(entrada, destino):
    destino = pathlib.Path(destino)
    with tempfile.TemporaryDirectory() as t:
        tgz = pathlib.Path(t) / "pacote.tar.gz"
        rodar_gpg(["--decrypt"], entrada, tgz)
        with tarfile.open(tgz, "r:gz") as tf:
            for m in tf.getmembers():  # só aceita caminhos de dentro de data/ (sem ../ nem caminho absoluto)
                alvo = (destino / m.name).resolve()
                if not str(alvo).startswith(str((destino / "data").resolve())):
                    sys.exit(f"caminho suspeito no pacote: {m.name}")
            try:
                tf.extractall(destino, filter="data")
            except TypeError:
                tf.extractall(destino)
    print(f"dados abertos em {destino / 'data'}")


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) >= 2 and a[0] == "cifrar":
        cifrar(a[1])
    elif len(a) >= 2 and a[0] == "decifrar":
        d = a[a.index("--destino") + 1] if "--destino" in a else RAIZ
        decifrar(a[1], d)
    else:
        sys.exit(__doc__)
