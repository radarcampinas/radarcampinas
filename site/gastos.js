"use strict";
/* Página "Gastos": o que a Prefeitura e suas entidades pagaram, segundo o TCE-SP (dados/gastos.json e dados/fornecedores.json). */
let GASTOS = null, FORN = null;
const TCE_URL = "https://transparencia.tce.sp.gov.br/municipio/campinas";
const COR_GASTO = ["#1D4ED8", "#8A97A8", "#E8A100"];
async function carregarGastos() { if (!GASTOS) GASTOS = await json("dados/gastos.json"); return GASTOS; }
async function carregarFornecedores() { if (!FORN) FORN = await json("dados/fornecedores.json"); return FORN; }
const fmtCnpj = c => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const nomeOrgao = o => titulo(o.replace(/PREVID\.SOCIAL DO MUNIC\.DE CPS-CAMPREV/, "Previdência Social do Município (Camprev)").replace(/P-EDUCÇÃO/, "para Educação").replace(/ - FUMEC/, " (Fumec)").replace(/ - SETEC/, " (Setec)").replace(/ - FJPO/, " (FJPO)")).replace(/\bDe\b/g, "de");
const tagHtml = t => t ? `<span class="tag">${esc(t)}</span>` : "";

async function paginaGastos() {
  document.title = "Gastos — Radar Campinas";
  $app.innerHTML = `<div class="pag"><a class="voltar" href="#/">← Início</a><h1>Para onde vai o dinheiro</h1><p class="carregando">Carregando…</p></div>`;
  const g = await carregarGastos();
  const n = g.meses.length, sal = VERIF && VERIF.salario;
  const primeiro = mesLongo(g.meses[0]), ultimo = mesLongo(g.meses[n - 1]);
  const orgaos = g.por_orgao.map(o => [nomeOrgao(o.orgao), Math.round(o.pago)]);
  const cam = g.camara;
  const subs = sal ? sal.cadeiras * sal.valor_mensal * n : null;
  const serie = g.meses.map((_, i) => [g.terceiros_mes[i], g.internos_mes[i], g.pf_mes[i]]);
  const nomesSerie = ["Empresas e entidades de fora", "Entre entidades da própria Prefeitura", "Pessoas físicas"];
  $app.innerHTML = `<div class="pag"><a class="voltar" href="#/">← Início</a>
    <p class="eyebrow">Dinheiro público</p>
    <h1>Para onde vai o dinheiro da Prefeitura</h1>
    <p style="font-size:1.1rem;max-width:760px">Quanto foi <strong>pago</strong> e a quem, de ${primeiro} a ${ultimo}, segundo o Portal de Transparência do Tribunal de Contas do Estado (TCE-SP). Cobre a Prefeitura, a Câmara e as entidades ligadas a elas.</p>
    <div class="aviso" role="note">${ico("warn")}<div><strong>Pago não quer dizer gasto ruim, nem irregular.</strong>
      Esta página mostra quanto foi pago e a quem. Ela não diz se o serviço foi bom, necessário ou barato, e não mostra o que foi comprado em cada pagamento.</div></div>
    ${selos(selo("oficial", "cada pagamento (TCE-SP)"), selo("calculado", "somas"), selo("estimativa", "o que é “entre entidades” e as etiquetas dos maiores"), selo("naoconfirmado", "totais: sem segunda fonte"))}

    <div class="grade">
      ${kpi({icone: "cash", cor: "c-azul", num: ext(TCE_URL, reaisCurto(g.pago_total)), rotulo: `pago em ${n} meses (soma de todos os registros)`, nota: `Inclui R$ ${(g.internos_total / 1e9).toFixed(2).replace(".", ",")} bi que uma entidade da Prefeitura repassou para outra: esse dinheiro aparece nas duas pontas.`, selos: selo("calculado")})}
      ${kpi({icone: "file", cor: "c-verde", num: ext(TCE_URL, reaisCurto(g.terceiros_total)), rotulo: "pago a empresas e entidades de fora", nota: `${nf(g.n_pj_terceiros)} CNPJs diferentes. Inclui bancos, tributos e benefícios de servidores.`, selos: selo("estimativa")})}
      ${kpi({icone: "users", cor: "c-ambar", num: ext(TCE_URL, reaisCurto(g.pf.total)), rotulo: "pago a pessoas físicas", nota: `${nf(g.pf.pessoas)} pessoas. Não mostramos nome nem CPF.`, selos: selo("calculado")})}
      ${kpi({icone: "vote", cor: "c-roxo", num: ext(TCE_URL, reaisCurto(cam.pago_total)), rotulo: "pago pela Câmara Municipal", nota: "Tudo o que a Câmara pagou, não só os salários dos vereadores.", selos: selo("calculado")})}
    </div>

    <div class="grade" style="margin-top:20px">
      <div class="card" style="flex:7 1 520px">
        <div class="cabecalho"><div><h3>Pago por mês</h3><div class="suave">De ${primeiro} a ${ultimo}. Passe o dedo ou o mouse numa barra para ver o valor.</div></div>${selo("calculado")}</div>
        ${barrasEmpilhadas(serie, g.meses, 220, "Barras empilhadas com o valor pago por mês", COR_GASTO, reaisCurto)}
        <div class="legendas">${nomesSerie.map((nm, i) => `<span class="legrow"><span class="dot" style="background:${COR_GASTO[i]}"></span>${nm}</span>`).join("")}</div>
        <p class="suave" style="font-size:.82rem">Os repasses entre entidades (cinza) são a parte do dinheiro que passa da Prefeitura para a própria previdência, autarquias e Câmara. Contar tudo junto somaria o mesmo dinheiro duas vezes.</p>
      </div>
      <div class="card" style="flex:5 1 340px">
        <div class="cabecalho"><div><h3>Pago por entidade</h3><div class="suave">Soma bruta de cada uma, com repasses entre elas</div></div>${selo("calculado")}</div>
        ${barrasH(orgaos)}
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <div class="cabecalho"><div><h2>A Câmara Municipal</h2><div class="suave">O que a Câmara pagou, mês a mês, segundo o TCE-SP</div></div>${selos(selo("calculado"), selo("estimativa", "salários dos vereadores"))}</div>
      ${barrasSimples(cam.pago_mes, g.meses, 150, "#0A8A8A", "Valor pago pela Câmara por mês")}
      ${sal ? `<p>Os salários dos ${nf(sal.cadeiras)} vereadores (${BRL(sal.valor_mensal).replace(",00", "")} cada) somam, nesses ${n} meses, cerca de <strong>${reaisCurto(subs)}</strong>:
        <strong>${(subs / cam.pago_total * 100).toFixed(1).replace(".", ",")}%</strong> do que a Câmara pagou no período (${reaisCurto(cam.pago_total)}). O restante são outras despesas da Casa; esta base não detalha o que são.
        <a href="#/transparencia/i-gastos">Como calculamos</a></p>` : ""}
    </div>

    <div class="card" style="margin-top:20px">
      <div class="cabecalho"><div><h2>Maiores valores pagos a empresas e entidades</h2><div class="suave">Sem as entidades da própria Prefeitura. As 20 maiores somam <strong>${(g.top20_parte * 100).toFixed(0)}%</strong> do que foi pago a empresas e entidades de fora.</div></div>${selos(selo("oficial", "valores"), selo("estimativa", "etiquetas"))}</div>
      <div style="overflow-x:auto"><table><thead><tr><th>#</th><th>Quem recebeu</th><th style="text-align:right">Pago</th><th style="text-align:right">Pagamentos</th></tr></thead><tbody>
      ${g.top.slice(0, 30).map((x, i) => `<tr><td>${i + 1}</td><td><strong style="color:var(--ink)">${esc(titulo(x.nome))}</strong> ${tagHtml(x.tag)}<br><span class="lbl">${fmtCnpj(x.cnpj)} · mais pago por ${esc(nomeOrgao(x.orgao))}</span></td>
        <td class="num">${ext(TCE_URL, reaisCurto(x.pago))}</td><td class="num">${nf(x.n)}</td></tr>`).join("")}</tbody></table></div>
      <p class="suave" style="font-size:.85rem">Estar na lista não é irregularidade: entre os maiores há bancos, tributos, empresas de benefícios dos servidores, o Tribunal de Justiça e consórcios. A etiqueta é lida do nome por um programa nosso. Partes dos nomes vêm com caracteres quebrados da fonte e aparecem com “?”.</p>
    </div>

    <div class="card" style="margin:20px 0 12px">
      <div class="cabecalho"><div><h2>Buscar quem recebeu</h2><div class="suave">Digite parte do nome ou o CNPJ. Entram empresas e entidades que receberam R$ 20 mil ou mais no período.</div></div>${selo("oficial")}</div>
      <label class="campo-simples"><span class="lbl">Nome ou CNPJ</span><input type="search" id="fq" class="simples" placeholder="Ex.: ambulância, construtora, 46068425…"></label>
      <p class="suave" id="fn"></p><div id="fl"></div><button class="mais" id="fm" hidden>Mostrar mais</button>
    </div>
    <details class="caixa"><summary>De onde vêm estes números e quais os limites</summary>
      <p>Fonte: <a href="${TCE_URL}" target="_blank" rel="noopener">Portal de Transparência Municipal do TCE-SP</a>, que recebe os dados da própria Prefeitura. Baixamos ${nf(g.registros)} registros de ${primeiro} a ${ultimo}.
      “Pago” é a soma dos registros com evento “Valor Pago”. O TCE-SP ainda não tinha publicado os meses depois de ${ultimo}.</p>
      <p>Não encontramos uma segunda fonte para conferir os totais. Veja os limites na <a href="#/transparencia/i-gastos">página Transparência</a>.</p></details></div>`;
  carregarFornecedores().then(F => {
    const el = document.getElementById("fl"); if (!el) return;
    const desenhar = r => `<div class="item"><div class="tit">${esc(titulo(r[0]))} ${tagHtml(r[7])}</div>
      <div class="res"><strong class="num">${ext(TCE_URL, BRL(r[2]).replace(",00", ""))}</strong> em ${nf(r[3])} ${r[3] === 1 ? "pagamento" : "pagamentos"} · ${mesLongo(r[4])} a ${mesLongo(r[5])}</div>
      <div class="lbl">${fmtCnpj(r[1])} · mais pago por ${esc(nomeOrgao(r[6]))}</div></div>`;
    const atualizar = () => {
      const q = normBusca(document.getElementById("fq").value).replace(/[./-]/g, ""), toks = q.split(" ").filter(t => t.length >= 2);
      const sel = toks.length ? F.filter(r => { const x = normBusca(r[0]) + " " + r[1]; return toks.every(t => x.includes(t)); }) : F;
      document.getElementById("fn").textContent = toks.length ? `${nf(sel.length)} ${sel.length === 1 ? "resultado" : "resultados"}.` : `Do maior para o menor valor pago. ${nf(F.length)} empresas e entidades.`;
      lista(el, document.getElementById("fm"), sel, desenhar, 20);
    };
    document.getElementById("fq").addEventListener("input", atualizar);
    atualizar();
  });
}

/* vitrine na página inicial: números vêm do verificacao.json (gerado por scripts/conferir.py) */
function blocoDinheiro() {
  const V = VERIF;
  if (!V || !V.gastos) return "";
  const sal = V.salario;
  const subs = sal ? sal.cadeiras * sal.valor_mensal * V.gastos.meses : 0;
  return `<section class="dinheiro-cartoes" style="padding:0 0 8px">
    <div class="cabecalho"><div><h2>Dinheiro público</h2><div class="suave">Quanto a Prefeitura pagou e o que ela abriu para comprar, segundo o TCE-SP e o PNCP.</div></div>${selos(selo("oficial"), selo("calculado"))}</div>
    <div class="grade">
      <a class="card" href="#/gastos"><span class="lbl">Gastos · ${mesLongo(V.gastos.primeiro)} a ${mesLongo(V.gastos.ultimo)}</span><span class="valor">${reaisCurto(V.gastos.terceiros_total)}</span>
        <span>pagos a empresas e entidades de fora (sem contar repasses entre entidades da Prefeitura)</span><span class="gver" style="color:var(--blue);font-weight:600">Ver para onde vai ${ico("chev")}</span></a>
      ${V.licitacoes ? `<a class="card" href="#/licitacoes"><span class="lbl">Licitações e contratos · PNCP</span><span class="valor">${nf(V.licitacoes.compras)} compras</span>
        <span>e ${nf(V.licitacoes.contratos)} contratos da Prefeitura e entidades ligadas, com valor, objeto e link para o processo</span><span class="gver" style="color:var(--blue);font-weight:600">Ver licitações ${ico("chev")}</span></a>` : ""}
      <a class="card" href="#/gastos"><span class="lbl">A Câmara Municipal</span><span class="valor">${reaisCurto(V.gastos.camara_pago || 0)}</span>
        <span>pagos pela Câmara no período. Os salários dos vereadores (estimativa) são ${V.gastos.camara_pago ? (subs / V.gastos.camara_pago * 100).toFixed(1).replace(".", ",") : "?"}% disso.</span><span class="gver" style="color:var(--blue);font-weight:600">Ver detalhes ${ico("chev")}</span></a>
    </div></section>`;
}
