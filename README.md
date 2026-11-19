# Radar Campinas

Site estático com presença, votos e propostas dos vereadores de Campinas (19ª legislatura, desde 2025),
só com dados da API pública do SAPL: https://sapl.campinas.sp.leg.br/api/

## Atualizar os dados
```bash
python -I scripts/baixar_sapl.py data/raw          # cadastros, sessões, presença, votos (retoma de onde parou)
python -I scripts/baixar_materias.py data/raw      # matérias apresentadas desde 2025-01-01
python -I scripts/gerar_dados.py data/raw site     # gera site/dados/*.json (vereadores, votos, propostas)
python -I scripts/gerar_busca.py data/raw site     # gera site/dados/busca.json (busca por rua/bairro e repetições)
python -I -X utf8 scripts/gerar_graficos.py data/raw site   # gera site/dados/graficos.json (séries dos gráficos)
python -I -X utf8 scripts/baixar_tce.py data/raw/tce              # despesas mensais do TCE-SP (um arquivo por mês)
python -I -X utf8 scripts/gerar_gastos.py data/raw site           # site/dados/gastos.json e fornecedores.json
python -I -X utf8 scripts/baixar_pncp.py data/raw/pncp 20250101   # compras e contratos do PNCP (devagar: a API limita consultas; rode UMA instância)
python -I -X utf8 scripts/gerar_licitacoes.py data/raw site       # site/dados/licitacoes.json e contratos.json
python -I -X utf8 scripts/baixar_normas.py data/raw              # leis desde 2025 e os projetos que as originaram
python -I -X utf8 scripts/gerar_leis.py data/raw site            # site/dados/leis.json (página "O que virou lei")
python -I -X utf8 scripts/gerar_afastamentos.py data/raw site   # atos de suplência/cassação e Mesa: site/dados/afastamentos.json (usa a internet)
python -I -X utf8 scripts/conferir.py data/raw site data   # (o valor do salário está em data/fontes/resolucao_1000_2023.pdf)
python -I -X utf8 scripts/conferir.py data/raw site data   # refaz as conferências: site/dados/verificacao.json (página Transparência)
```
Para refazer um endpoint, apague o `.jsonl` correspondente em `data/raw`.

## Páginas para o Google
```bash
python -I -X utf8 scripts/gerar_paginas.py site   # vereador/, bairro/, grupo/, leis/, gastos/..., sitemap.xml e robots.txt
```
O site principal usa endereços com `#`, que o Google ignora; estas páginas estáticas (com título, descrição e resumo em HTML) são o que o Google indexa. A atualização diária já roda este passo. Para mudar o endereço base (domínio próprio): `RADAR_BASE=https://meudominio.com.br/ python ... gerar_paginas.py site`.
Páginas de grupos e bairros NÃO mostram o texto das propostas (pode citar nomes de pessoas e endereços): só número, data, tipo e link oficial.

## Atualização diária (de madrugada)
```bash
python -I -X utf8 scripts/atualizar.py            # baixa só o que é novo, regera o site e confere
python -I -X utf8 scripts/atualizar.py --semanal  # inclui atos de suplência e Mesa (aos domingos)
```
- Consulta devagar: uma por vez, pausa de ~1,5 a 3 s; 429 espera e tenta de novo; 3 seguidos ou 403 = para e tenta na noite seguinte; limite de 6000 consultas e 4 h por execução.
- Só baixa o que é novo (SAPL pelo id, TCE-SP dos 2 últimos meses, PNCP dos últimos 45 dias) e rebaixa uma janela recente para pegar edições.
- Antes de regerar, guarda `site/dados` em `data/backup_dados`; se algo falhar ou os números diminuírem, devolve a cópia.
- Privacidade: `privacidade.py` tira CPF, RG, endereço residencial, telefone e e-mail dos textos do PNCP/TCE-SP; `auditar_privacidade.py` confere o site inteiro e, se achar algo, a atualização não publica.
- Relato do dia: `data/logs/atualizacao_AAAA-MM-DD.log`; resumo: `data/logs/ultima.json`.
- `--publicar`: depois de gerar e conferir, envia só `site/` ao GitHub (commit + push); o agendamento do Windows já usa essa opção. Precisa do login do Git guardado.
- Durante a atualização o programa pede ao Windows para não suspender o computador, e o tempo em que ele ficou suspenso não conta no limite de horas.
- `--pular-se-atualizado`: para a tarefa agendada. Não faz nada se hoje já deu certo, se o servidor pediu para diminuir o ritmo hoje (429/403) ou se já houve 4 tentativas hoje (estado em `data/logs/estado.json`).
- Agendar no Windows (03:00 + a cada hora até 15:00 + ao entrar no Windows, para refazer se o computador reiniciou): `powershell -ExecutionPolicy Bypass -File scripts/agendar_windows.ps1`

## Atualização no GitHub Actions (alternativa ao agendador do Windows)
`.github/workflows/atualizacao-noturna.yml` roda todo dia às 03:00 (Brasília), igual ao `atualizar.py --publicar`, e dispara a publicação do site.
- Os dados brutos ficam num pacote **criptografado** (`scripts/dados_cripto.py`, GnuPG AES-256): no cache do GitHub entre as noites e, como reserva, na branch `semente`.
- A senha é o segredo `DADOS_SENHA` (Settings > Secrets and variables > Actions). No seu computador ela fica em `data/segredos/DADOS_SENHA.txt` (fora do git). Guarde também num gerenciador de senhas.
- Para renovar a branch `semente` (a cada mês, por exemplo): `DADOS_SENHA=... python scripts/dados_cripto.py cifrar raw.tar.gz.gpg` e envie para a branch `semente`.
- Teste de acesso às fontes pelo GitHub: `.github/workflows/teste-acesso.yml`.
- Se usar o GitHub Actions, DESLIGUE a tarefa do Windows (ou rode só à mão), para os dois não publicarem ao mesmo tempo.

## Ver o site
```bash
node scripts/servir.js site 8768
```
Abra http://127.0.0.1:8768/ (o `http.server` do Python 3.14 travou com arquivos maiores que ~255 KB neste computador).

## Cuidados com a API
- Sempre use `o=id` na paginação; sem isso as páginas repetem e perdem registros.
- Página máxima: 100 registros.
- `registrovotacao.data_hora` é quase sempre inválido; a data vem da sessão.
- Cadastro de mandatos não tem datas confiáveis de entrada e saída; por isso o site não calcula porcentagem de presença.
