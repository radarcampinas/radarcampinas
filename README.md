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
- Agendar no Windows (03:00 todo dia): `powershell -ExecutionPolicy Bypass -File scripts/agendar_windows.ps1`

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
