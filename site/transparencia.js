"use strict";
/* Marcas de transparência e a página "Transparência". Os números vêm de dados/verificacao.json (gerado por scripts/conferir.py). */
let VERIF = null;

const SELOS = {
  oficial: {icone: "t-dot", nome: "Oficial", curto: "Copiado do registro oficial da Câmara, sem alteração."},
  calculado: {icone: "t-plus", nome: "Calculado", curto: "Conta feita por nós em cima de dados oficiais."},
  conferido: {icone: "t-check", nome: "Conferido", curto: "Comparado com outra fonte oficial."},
  estimativa: {icone: "t-approx", nome: "Estimativa", curto: "Uma regra ou programa nosso lê o texto. Pode errar."},
  naoconfirmado: {icone: "t-q", nome: "Não confirmado", curto: "Não conseguimos conferir com uma segunda fonte."},
};

function selo(tipo, texto) {
  const s = SELOS[tipo], dica = s.nome + (texto ? ": " + texto : " — " + s.curto);
  return `<a class="selo selo-ic selo-${tipo}" href="#/transparencia/m-${tipo}" title="${esc(dica)}" aria-label="${esc(dica)}"><svg class="ic" aria-hidden="true"><use href="#${s.icone}"/></svg></a>`;
}
/* selo com nome escrito: só para a legenda e a página Transparência */
function seloComNome(tipo) {
  const s = SELOS[tipo];
  return `<a class="selo selo-${tipo}" href="#/transparencia/m-${tipo}" title="${esc(s.curto)}"><svg class="ic" aria-hidden="true"><use href="#${s.icone}"/></svg><span><strong>${esc(s.nome)}</strong></span></a>`;
}
/* uma linha pequena com os cinco símbolos e seus nomes; os detalhes ficam na página Transparência */
function legendaCompacta() {
  return `<div class="legenda-ic" role="note" aria-label="Legenda das marcas"><span class="lbl">Legenda</span>${Object.keys(SELOS).map(k => `<a href="#/transparencia/m-${k}" title="${esc(SELOS[k].curto)}"><span class="selo selo-ic selo-${k}"><svg class="ic" aria-hidden="true"><use href="#${SELOS[k].icone}"/></svg></span>${SELOS[k].nome}</a>`).join("")}</div>`;
}
const selos = (...itens) => `<div class="selos">${itens.join("")}</div>`;

async function carregarVerificacao() {
  try { VERIF = await json("dados/verificacao.json"); } catch (e) { VERIF = null; }
}
const vf = (a, b) => VERIF ? `${nf(VERIF[a][b])}` : "?";

function legendaSelos() {
  return `<ul class="legenda">${Object.entries(SELOS).map(([k, s]) => `<li>${seloComNome(k)} <span class="suave">${esc(s.curto)}</span></li>`).join("")}</ul>`;
}

function paginaTransparencia(ancora) {
  document.title = "Transparência — Radar Campinas";
  const V = VERIF, m = GERAL.meta;
  if (!V) { $app.innerHTML = `<a class="voltar" href="#/">← Início</a><h1>Transparência</h1><p>Não foi possível carregar o arquivo de conferências.</p>`; return; }
  const at = V.atas, dif = at.diferentes;
  const nome = n => titulo(n);
  const chipsN = lista => lista.length ? lista.map(n => `<span class="chip">${esc(nome(n))}</span>`).join("") : `<span class="suave">Nenhum nome</span>`;
  const linhaDif = d => `<div class="card dif"><div class="disp" style="font-size:1.2rem;font-weight:700">${dataBR(d.data)} <span class="suave" style="font-family:Roboto,sans-serif;font-weight:500">${esc(d.tipo)}</span></div>
    <div class="lbl" style="margin-top:12px">Só na ata</div><div>${chipsN(d.so_ata)}</div>
    <div class="lbl" style="margin-top:12px">Só no sistema</div><div>${chipsN(d.so_sistema)}</div>
    <p style="margin:14px 0 0;font-size:.92rem"><a href="${esc(d.ata_pdf)}" target="_blank" rel="noopener">Ata em PDF</a> · <a href="${esc(d.pagina)}" target="_blank" rel="noopener">Página da sessão</a></p></div>`;
  const R = [
    ["Presença nas sessões", "iguais ao relatório oficial", "Relatório “Presença nas sessões” da Câmara.", V.presenca_relatorio.iguais, V.presenca_relatorio.comparados],
    ["Presença na Ordem do Dia", "iguais ao relatório oficial", "Mesmo relatório, com as Ordens do Dia.", V.presenca_ordemdia.iguais, V.presenca_ordemdia.comparados],
    ["Partido e situação", "iguais ao relatório oficial", "Partido e campo “ativo” de cada vereador.", V.partido.iguais, V.partido.comparados],
    ["Propostas por autor", "iguais à tabela de autoria", "Contagem refeita sem o campo de autores da matéria.", V.autoria.iguais, V.autoria.comparados],
    ["Páginas das sessões", "iguais à API", "Lista de presentes em /sessao/ID/presenca.", V.pagina_sessao.iguais, V.pagina_sessao.amostra],
    ["Atas em PDF", "com lista igual", `Sessões sorteadas. ${nf(at.nomes_divergentes)} nomes divergentes em ${nf(at.registros_comparados)} registros.`, at.iguais, at.amostra],
    ["Resumo dos votos", "votações com soma igual ao total oficial", "Soma dos votos individuais contra o total da Câmara.", V.votos.resumo_confere, V.votos.resumo_confere + V.votos.resumo_diverge],
  ];
  const aneis = R.map(r => { const p = r[4] ? Math.round(r[3] / r[4] * 1000) / 10 : 0, cor = p >= 100 ? "#116B38" : "#8A5300";
    return `<div class="card anel"><div class="topa">${rosca([{v: p, c: cor}, {v: 100 - p, c: "#E3E9F1"}], `${String(p).replace(".", ",")}%`, "", 76, `${r[0]}: ${r[3]} de ${r[4]}`)}
    <div><div class="num grande">${nf(r[3])}</div><div class="lbl">de ${nf(r[4])} ${esc(r[1])}</div></div></div>
    <div style="font-weight:600;color:var(--ink)">${esc(r[0])}</div><div class="lbl">${esc(r[2])}</div></div>`; }).join("");
  const item = (id, titulo_, selosHtml, linhas) => `<section class="tcard" id="${id}"><h3>${titulo_}</h3>${selosHtml}<dl>${linhas.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></section>`;

  $app.innerHTML = `<div class="pag"><a class="voltar" href="#/">← Início</a>
  <p class="eyebrow">Transparência</p>
  <h1>De onde vem cada número, e o que não conseguimos confirmar.</h1>
  <p style="font-size:1.1rem;max-width:760px">Aqui está tudo o que fizemos com os dados, o que conseguimos conferir, o que não conseguimos e os erros nossos que já corrigimos.
  Os números desta página são recalculados por um programa (<code>scripts/conferir.py</code>) em ${dataBR(V.gerado_em)}.</p>

  <h2 id="marcas" style="margin-top:28px">As cinco marcas</h2>
  <p class="suave">Toda informação importante tem uma marca com o nome escrito e um símbolo, não só a cor. Toque numa marca para voltar aqui.</p>
  <div class="marcas-grade">
  <div class="tcard" id="m-oficial">${seloComNome("oficial")}<p>O que está escrito é o que a Câmara registrou: nome, partido, foto, texto de cada proposta, data, quem votou e como. Não mudamos nada.</p></div>
  <div class="tcard" id="m-calculado">${seloComNome("calculado")}<p>Contas nossas: quantas sessões a pessoa frequentou, quantos votos de cada tipo, quantas propostas. A conta é simples e dá para refazer com os dados oficiais.</p></div>
  <div class="tcard" id="m-conferido">${seloComNome("conferido")}<p>Comparamos o número com outra fonte oficial (por exemplo, o relatório de presença da própria Câmara). O texto da marca diz com o quê e quantos casos bateram. “Conferido” não quer dizer que a Câmara não errou: quer dizer que o nosso número é igual ao dela.</p></div>
  <div class="tcard" id="m-estimativa">${seloComNome("estimativa")}<p>Um programa nosso lê o texto das propostas e decide o grupo, o tipo de pedido, a rua e o bairro. É uma regra, não uma classificação oficial, e erra em alguns casos. Quando vemos o erro, corrigimos e anotamos abaixo.</p></div>
  <div class="tcard" id="m-naoconfirmado">${seloComNome("naoconfirmado")}<p>Não encontramos uma segunda fonte para checar. O dado pode estar certo, mas só temos a palavra do sistema da Câmara.</p></div>
  </div>

  <h2 style="margin-top:32px">O que conferimos</h2>
  <p class="suave">Quantos casos ficaram iguais à outra fonte.</p>
  <div class="aneis">${aneis}</div>
  <div class="caixa" style="display:flex;gap:12px"><span style="color:var(--blue)">${ico("warn")}</span><p style="margin:0;font-size:.92rem"><strong>Atenção:</strong> o relatório, a API e as páginas das sessões saem do mesmo sistema da Câmara. Elas confirmam que a nossa conta está certa, não que o registro da Câmara está certo. As atas dizem, no rodapé, que a lista foi feita a partir do mesmo sistema, então também não são totalmente independentes.</p></div>

  <h2 style="margin-top:32px">O que mostramos e como foi feito</h2>
  ${item("i-vereadores", "Vereadores: nome, foto, partido, situação", selos(selo("oficial"), selo("conferido", `partido e situação: ${vf("partido", "iguais")} de ${vf("partido", "comparados")} iguais ao relatório oficial`)), [
    ["Fonte", "Cadastro de parlamentares, mandatos e filiações da API do SAPL."],
    ["Limite", "“Em exercício” é o campo <em>ativo</em> do cadastro. As datas de início e fim de mandato não são confiáveis (por exemplo, quem assumiu como suplente aparece com mandato desde 01/01/2025), por isso usamos os atos oficiais para explicar quem saiu ou assumiu (veja o item sobre mandatos abaixo)."]])}
  ${item("i-presenca", "Presença nas sessões", selos(selo("calculado", "contagem nossa"), selo("conferido", `${vf("presenca_relatorio", "iguais")} de ${vf("presenca_relatorio", "comparados")} iguais ao relatório oficial`)), [
    ["Fonte", "Lista de presença de cada sessão (API <code>sessaoplenariapresenca</code>)."],
    ["Como contamos", `Quantas sessões (sem repetir) têm o nome da pessoa na lista, de ${dataBR(m.inicio)} até hoje.`],
    ["Conferência", `Relatório oficial “Presença nas sessões” (${V.presenca_relatorio.periodo}): ${vf("presenca_relatorio", "iguais")} de ${vf("presenca_relatorio", "comparados")} vereadores com o mesmo número. Presença na Ordem do Dia: ${vf("presenca_ordemdia", "iguais")} de ${vf("presenca_ordemdia", "comparados")}. Páginas oficiais das sessões: ${vf("pagina_sessao", "iguais")} de ${vf("pagina_sessao", "amostra")} iguais.
      <br><strong>Atenção:</strong> essas fontes saem do mesmo sistema da Câmara. Confirmam que nossa conta está certa, não que o registro da Câmara está certo.`],
    ["Atas em PDF", `${at.iguais} de ${at.amostra} atas sorteadas têm lista de presentes igual à do sistema; ${dif.length} diferem (${nf(at.nomes_divergentes)} nomes em ${nf(at.registros_comparados)} registros, ${(at.taxa_divergencia * 100).toFixed(1).replace(".", ",")}%). As atas dizem que a lista foi feita a partir do sistema da Câmara, então também não são totalmente independentes.`],
    ["Por que não mostramos porcentagem", `O relatório oficial usa ${nf(V.presenca_relatorio.sessoes_base_oficial)} sessões como base; nós usamos ${nf(V.presenca_relatorio.sessoes_com_lista_nossa)}, só as que têm lista de presença. As 6 de diferença são extraordinárias de 08/05/2025 sem lista. O relatório ainda calcula a porcentagem com datas de mandato que o cadastro não informa direito (por isso mostra, por exemplo, 8,9% para quem só assumiu em setembro de 2026). Preferimos não mostrar porcentagem.`]])}
  ${item("i-votos", "Como votou", selos(selo("oficial", "cada voto e cada resultado"), selo("calculado", "totais por tipo de voto"), selo("naoconfirmado", "votos individuais sem segunda fonte")), [
    ["Fonte", "Votos individuais (<code>votoparlamentar</code>) e resultado das votações (<code>registrovotacao</code>)."],
    ["O que falta", `Só ${nf(V.votos.votacoes_nominais)} das ${nf(V.votos.votacoes_desde_inicio)} votações desde ${dataBR(m.inicio)} têm o voto de cada vereador registrado. Dizemos que as outras são “simbólicas” por dedução nossa: o sistema não explica o motivo.`],
    ["Conferência interna", `Em todo o histórico baixado (${nf(V.votos.resumo_confere + V.votos.resumo_diverge)} votações com voto individual), a soma dos votos é igual ao total oficial em ${nf(V.votos.resumo_confere)}; em ${nf(V.votos.resumo_diverge)} a soma é diferente. Desde ${dataBR(m.inicio)}: em ${nf(V.votos.votaram_sem_constar_na_presenca)} casos alguém votou sem constar na lista de presença da sessão, e ${nf(V.votos.sessoes_nominais_sem_lista)} sessões com voto individual não têm lista de presença.`],
    ["Por que “não confirmado”", "Não achamos outra fonte oficial para o voto de cada vereador. As atas dizem só o resultado da votação."],
    ["Nossa conta", "Juntamos as grafias do mesmo voto (“Não” e “Nao”; “Ausente” e “Ausente na Votação”; “Presidente não vota” e “Na Presid.”). Valores vazios ou inválidos ficam em “sem registro válido”."]])}
  ${item("i-propostas", "Propostas apresentadas (total)", selos(selo("calculado", "contagem nossa"), selo("conferido", `${vf("autoria", "iguais")} de ${vf("autoria", "comparados")} iguais à tabela oficial de autoria`), selo("oficial", "texto de cada proposta")), [
    ["Fonte", `Matérias legislativas apresentadas desde ${dataBR(m.inicio)} (${nf(m.materias_baixadas)} baixadas) e seus autores.`],
    ["Como contamos", "Contamos cada proposta de que a pessoa é autora ou coautora, nos tipos mais comuns (projetos, indicações, requerimentos, moções, emendas). Ofícios, atas e documentos administrativos ficam de fora. Se há vários autores, a proposta conta para cada um."],
    ["Conferência", "Refizemos a contagem pela tabela oficial de autorias, sem usar o campo de autores da matéria: deu o mesmo número para todos."]])}
  ${V.salario ? item("i-salario", "Salariômetro e salário dos vereadores", selos(selo("oficial", `${BRL(V.salario.valor_mensal).replace(",00", "")} por mês`), selo("estimativa", "total desde a posse e número de cadeiras"), selo("calculado", "conta por segundo")), [
    ["Fonte do valor", `<a href="${esc(V.salario.norma.pagina)}" target="_blank" rel="noopener">${esc(V.salario.norma.nome)}</a> (<a href="${esc(V.salario.norma.pdf)}" target="_blank" rel="noopener">texto em PDF</a>): subsídio de ${BRL(V.salario.valor_mensal)} por mês, igual para todos, a partir de ${dataBR(V.salario.inicio)}. Valor bruto: o próprio texto manda descontar impostos e encargos. O vereador que preside a sessão não recebe adicional.`],
    ["Como calculamos o total", `${nf(V.salario.cadeiras)} salários por mês, em proporção ao tempo desde ${dataBR(V.salario.inicio)}, atualizado a cada segundo no seu navegador. É uma estimativa: não inclui 13º subsídio nem férias com 1/3 (<a href="${esc(V.salario.extras.pagina)}" target="_blank" rel="noopener">${esc(V.salario.extras.nome)}</a>), nem verba de gabinete ou outros pagamentos.`],
    ["Número de cadeiras", `Não encontramos norma que diga quantas são. Deduzimos ${nf(V.salario.cadeiras)} porque ${nf(V.salario.votacoes_com_cadeiras)} de ${nf(V.salario.votacoes_total)} votações com voto individual registram exatamente ${nf(V.salario.cadeiras)} vereadores.`],
    ["Conferência", "O valor foi lido à mão no texto da norma. Procuramos, no sistema da Câmara, revisões do subsídio feitas depois e não achamos nenhuma. Isso não prova que não exista: o Portal da Transparência da Câmara pode ter folha de pagamento com valores reais, que não consultamos."],
    ["Limite", "O contador não sabe se algum vereador esteve afastado sem receber, nem se houve pagamento retroativo ou desconto. Também não diz se o valor é justo: só mostra o custo registrado em lei."]]) : ""}
  ${AFAST ? item("i-mandatos", "Quem assumiu, saiu ou foi cassado, e a Mesa Diretora", selos(selo("oficial", "texto de cada ato e cargo na Mesa"), selo("estimativa", "resumo em palavras simples lido do texto")), [
    ["Fonte", "Atos da Presidência e decretos legislativos da Câmara desde " + dataBR(m.inicio) + " (API de normas do SAPL) e a composição da Mesa Diretora " + esc(AFAST.mesa.titulo.replace("Mesa Diretora ", "")) + "."],
    ["Como lemos", `Um programa procura nos ${nf(AFAST.atos_lidos)} atos sobre mandato (convocação de suplente, renúncia, cassação, investidura em secretaria) o nome de quem saiu e de quem entrou. Os nomes são ligados aos vereadores pelo nome parlamentar ou pelo nome completo. ${AFAST.sem_vinculo.length ? nf(AFAST.sem_vinculo.length) + " ato(s) ficaram sem vínculo." : "Nenhum ato ficou sem vínculo a alguém."}`],
    ["O que isso explica", "Por que Zé Carlos e Vini Oliveira não constam em exercício (renúncia e cassação), por que Eduardo Magoga também não (foi para uma secretaria), e por que Ailton da Farmácia, Mineiro do Espetinho e Tak têm presenças que começam depois (assumiram como suplentes). Cabo Müller e Evelyn do PT foram convocados só para uma sessão cada."],
    ["Limite", `O ato diz quando alguém foi convocado ou saiu, mas não diz quando voltou. Luiz Cirilo, por exemplo, foi nomeado secretário em 05/05/2025 e aparece como em exercício hoje: não achamos o ato da volta. Quem foi chamado como suplente só para uma sessão pode não estar na nossa lista: ${AFAST.fora_da_lista.map(x => `${esc(x.nome)} (${nf(x.presencas)} presenças, ${nf(x.votos)} votos)`).join("; ")} aparecem nos registros sem mandato cadastrado nesta legislatura e não entram nos números do site.`]]) : ""}
  ${item("i-cidade", "Propostas da cidade, bairros mais citados e “votaram igual”", selos(selo("oficial", "texto, data e autor"), selo("estimativa", "grupos e bairros"), selo("calculado", "contagens")), [
    ["Lista da cidade inteira", "Cada grupo mostra todas as propostas que têm pelo menos um vereador como autor. As que só vieram da Prefeitura ou de comissões ficam de fora, por isso os números são menores que o total geral de propostas."],
    ["Bairros mais citados", "Contamos quantas indicações citam cada bairro. O bairro é lido do texto por um programa (mesma regra da busca) e pode errar. Citar muito um bairro não diz se ele é bem ou mal atendido."],
    ["Sugestões ao digitar", "A lista de bairros e ruas vem das próprias indicações. Serve só para ajudar a escrever; a busca continua sendo por texto."],
    ["“Votaram igual”", `Entre as ${nf(GRAF.unanimes.votacoes)} votações com voto individual, contamos aquelas em que todos os vereadores que votaram sim, não ou abstenção escolheram a mesma opção: ${nf(GRAF.unanimes.todos_iguais)}. Ausentes e quem presidiu a sessão ficam de fora da conta. Só vale para votações com voto individual registrado.`],
    ["Filtro por partido", "O partido é o atual no cadastro. A lista continua em ordem alfabética: não ordenamos vereadores por faltas nem por propostas."]])}
  ${item("i-leis", "O que virou lei", selos(selo("oficial", "cada lei, data, texto e autores do projeto"), selo("calculado", "contagens"), selo("estimativa", "o tipo de cada lei")), [
    ["Fonte", `Normas jurídicas do tipo Lei, Lei Complementar e Emenda à Lei Orgânica no <a href="${SAPL}/norma/pesquisar" target="_blank" rel="noopener">sistema da Câmara</a>, desde ${dataBR(m.inicio)}. Cada lei está ligada ao projeto que a originou, e os autores vêm do registro de autoria desse projeto.`],
    ["Quem propôs", "“Vereadores” quando algum autor do projeto é parlamentar; “Prefeito” quando o autor é o Executivo; “Mesa” quando é a Mesa da Câmara. O mesmo projeto pode ter vários autores, e cada um é contado. Quem propôs o projeto não é, sozinho, quem fez a lei acontecer: ela foi votada pelos vereadores e sancionada pelo Prefeito."],
    ["Tipo da lei (estimativa)", "Uma regra nossa, igual para todas, olha as primeiras palavras do texto oficial (por exemplo, “Denomina rua…” vira “Nome de rua, praça ou local”). Pode errar; “Outras leis” é o que não coube nas outras regras."],
    ["Limites", "Decretos, portarias e leis sem projeto ligado no sistema podem ficar de fora ou aparecer como “sem projeto ligado”. Projetos apresentados antes de 2025 aparecem se a lei saiu depois. Não mostramos projetos que ainda não viraram lei nem os vetados."]]) }
  ${V.gastos ? item("i-gastos", "Gastos: quanto a Prefeitura pagou e a quem", selos(selo("oficial", "cada pagamento (TCE-SP)"), selo("calculado", "somas"), selo("estimativa", "“entre entidades” e etiquetas dos maiores"), selo("naoconfirmado", "totais: sem segunda fonte")), [
    ["Fonte", `<a href="${TCE_URL}" target="_blank" rel="noopener">Portal de Transparência Municipal do TCE-SP</a>, que recebe os dados da Prefeitura. Baixamos ${nf(V.gastos.registros)} registros de ${mesLongo(V.gastos.primeiro)} a ${mesLongo(V.gastos.ultimo)} (${nf(V.gastos.meses)} meses${V.gastos.sem_buracos ? ", sem mês faltando" : ", com meses faltando"}).`],
    ["Como somamos", "“Pago” é a soma dos registros com evento “Valor Pago”. Valores empenhados e liquidados não entram nos totais mostrados."],
    ["Repasses entre entidades (estimativa)", "Prefeitura, previdência (Camprev), Fumec, Rede Mário Gatti, Setec, FJPO e Câmara se pagam entre si. Esse dinheiro aparece nas duas pontas, então separamos o que uma entidade pagou à outra do que foi pago a quem é de fora. A lista de entidades é nossa e pode estar incompleta."],
    ["Pessoas físicas", "Não mostramos nome nem CPF: só o total pago e o número de pessoas."],
    ["Conferência", `Os totais mensais somam o total geral (${V.gastos.soma_confere ? "confere" : "não confere"}). Não achamos outra fonte oficial para conferir os valores pagos. Cruzamento com contratos do PNCP: ${nf(V.gastos.fornecedores_contratos_no_tce[0])} de ${nf(V.gastos.fornecedores_contratos_no_tce[1])} fornecedores com contrato também aparecem pagos no TCE-SP.`],
    ["Limites", "Parte dos nomes vem com caracteres quebrados da fonte (aparecem com “?”). O registro não diz o que foi comprado. Entre os maiores recebedores há bancos, tributos, o Tribunal de Justiça e empresas de benefícios dos servidores, e estar na lista não é irregularidade. Quando o TCE-SP publica um mês novo, o total sobe: nossa cópia é de " + dataBR(m.gerado_em) + "."]]) : ""}
  ${V.licitacoes ? item("i-licitacoes", "Licitações e contratos", selos(selo("oficial", "cada compra e contrato (PNCP)"), selo("calculado", "somas e contagens"), selo("estimativa", "busca por texto e ligação com ruas")), [
    ["Fonte", `PNCP (Portal Nacional de Contratações Públicas), consulta aberta. Órgãos: ${esc(V.licitacoes.orgaos.join(", "))}. Baixamos ${nf(V.licitacoes.compras)} compras e ${nf(V.licitacoes.contratos)} contratos desde ${dataBR(m.inicio)}.`],
    ["Valores", "“Homologado” é o valor final da compra; “estimado”, o previsto. Nenhum dos dois é o que já foi pago: para isso, veja a página Gastos."],
    ["Cobertura", "Nem tudo é publicado no PNCP, e a data de publicação pode vir depois da compra. Não conferimos se há compras que faltam."],
    ["Busca por rua ou bairro", "Na busca, mostramos compras e contratos que citam o mesmo nome no texto. É uma ligação por texto: pode juntar coisas sem relação e perder outras. Não prova que a compra atende a nenhum pedido de vereador, nem que o serviço foi feito."],
    ["Valores acima de R$ 1 bilhão", `${V.gastos && V.gastos.contratos_acima_1bi && V.gastos.contratos_acima_1bi.length ? V.gastos.contratos_acima_1bi.map(c => `${esc(titulo(c.fornecedor))}: contrato de ${BRL(c.valor).replace(",00", "")} no PNCP; no TCE-SP esse CNPJ recebeu ${BRL(c.pago_no_tce).replace(",00", "")} em todo o período`).join("; ") + ". Marcamos esses valores e não os somamos: podem ser erro de digitação ou valor de muitos anos. Não corrigimos nada." : "Nenhum."}`],
    ["Conferência", `Números de controle repetidos: ${V.licitacoes.ids_unicos ? "nenhum" : "há repetição"}. Contratos sem nome (pessoa física) aparecem sem identificação.`]]) : ""}
  ${item("i-grupos", "Grupos de propostas (melhoria, perguntas, homenagens, leis, outros)", selos(selo("estimativa", "regra nossa")), [
    ["Regra", "A mesma para todos: olha o tipo do documento e as primeiras palavras do texto oficial. A lista de regras está em “Como agrupamos as propostas”, em cada página de vereador."],
    ["Conferência", "Não existe classificação oficial para comparar. Cada proposta mostra a regra que a colocou no grupo e leva ao texto completo."],
    ["Limite", "Exemplo: abaixo-assinados enviados por moradores ficam em “Outros”, mesmo quando pedem uma obra."]])}
  ${item("i-busca", "Busca por rua ou bairro e pedidos repetidos", selos(selo("oficial", "texto do pedido, data e autor"), selo("estimativa", "rua, bairro e tipo de pedido lidos por programa"), selo("estimativa", "o que conta como repetido")), [
    ["Como lemos", `Um programa procura a rua e o bairro no texto de cada indicação e dá a ela um tipo de pedido (poda, tapa-buraco, limpeza…). Encontra a rua em ${(V.extracao.com_rua * 100).toFixed(0)}% e o bairro em ${(V.extracao.com_bairro * 100).toFixed(0)}% das ${nf(V.extracao.indicacoes)} indicações.`],
    ["Conferência", `Só uma amostra lida à mão por nós (${V.extracao.amostra_manual.n} pedidos): ${V.extracao.amostra_manual.erros_claros_rua_ou_bairro} erros claros de rua ou bairro e ${V.extracao.amostra_manual.erros_claros_tipo_de_pedido} de tipo de pedido. A amostra é pequena; a margem de erro é grande.`],
    ["O que é repetido", `Mesmo tipo de pedido, na mesma rua (e bairro, quando o texto diz), em ${BUSCA ? BUSCA.min_repetido : 3} datas diferentes ou mais. Vários pedidos no mesmo dia contam como uma data só. Esse corte é escolha nossa.`],
    ["Importante", "Pedido repetido não prova que a Prefeitura ignorou. Não sabemos o que a Prefeitura respondeu ou fez."]])}

  <h2 id="divergencias">Diferenças que encontramos</h2>
  <p>Nas atas em PDF de ${nf(at.amostra)} sessões sorteadas, estas ${dif.length} tiveram lista diferente da do sistema. Não sabemos qual está certa: pode ser presença no começo e saída antes da votação, ou erro de registro.</p>
  <div class="grade">${dif.map(linhaDif).join("")}</div>
  <p class="suave">Nas duas primeiras, as pessoas que só o sistema lista aparecem votando, e as que só a ata lista aparecem como “Ausente” nas votações.</p>

  <h2 id="nao-confirmado" style="margin-top:32px">O que não conseguimos confirmar</h2>
  <ul>
    <li>Os votos individuais de cada vereador (não há segunda fonte).</li>
    <li>As datas exatas em que cada pessoa assumiu, saiu ou voltou: os atos dizem quando alguém foi convocado, mas não quando retornou.</li>
    <li>Se a lista de presença do sistema está certa em todas as sessões: conferimos ${at.amostra} atas, não todas.</li>
    <li>Rua, bairro e tipo de pedido lidos por programa: conferimos só uma amostra de ${V.extracao.amostra_manual.n} pedidos.</li>
    <li>Se um pedido foi atendido ou se a Prefeitura respondeu. Não olhamos isso.</li>
    <li>Que a votação sem voto individual seja “simbólica”: é a explicação mais provável, mas o sistema não diz.</li>
    <li>Sessões depois de ${dataBR(m.gerado_em)} e qualquer registro que a Câmara altere depois da nossa cópia.</li>
  </ul>

  <h2 id="correcoes" style="margin-top:32px">Erros nossos que já corrigimos</h2>
  <div>${(V.correcoes || []).map(c => `<div class="linha-corr"><div><strong>${esc(c.data)}</strong> — ${esc(c.o_que)}<br><span class="suave">${esc(c.efeito)}</span></div></div>`).join("")}</div>

  <h2 id="fonte" style="margin-top:32px">De onde vêm os dados</h2>
  <p>Tudo foi copiado em ${dataBR(m.gerado_em)} da API pública do SAPL da Câmara: (sapl.campinas.sp.leg.br/api).
  O programa que baixa confere se a quantidade recebida é igual ao total informado pela Câmara.</p>
  <table><thead><tr><th>Dado</th><th>Câmara informa</th><th>Baixamos</th></tr></thead><tbody>
  ${V.downloads.map(d => `<tr><td>${esc(d.endpoint)}</td><td>${nf(d.esperado)}</td><td>${nf(d.baixado)} ${d.ok ? "" : "⚠"}</td></tr>`).join("")}
  </tbody></table>
  <p class="suave">A tabela mostra os downloads grandes da última rodada. Os cadastros pequenos (parlamentares, mandatos, partidos, filiações, autores, sessões) foram conferidos pela mesma regra.</p></div>`;
  if (ancora) { const el = document.getElementById(ancora); if (el) setTimeout(() => el.scrollIntoView(), 50); }
}
