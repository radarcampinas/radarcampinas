"use strict";
/* Página "Licitações": compras e contratos publicados no PNCP pela Prefeitura e entidades ligadas (dados/licitacoes.json e contratos.json). */
let LIC = null, CONT = null;
async function carregarLic() {
  if (!LIC) {
    [LIC, CONT] = await Promise.all([json("dados/licitacoes.json"), json("dados/contratos.json")]);
    LIC.itens.forEach(r => { r._n = normBusca(r[5] + " " + r[8] + " " + r[2]); });
    CONT.itens.forEach(r => { r._n = normBusca(r[4] + " " + r[2] + " " + r[1]); });
  }
  return [LIC, CONT];
}
const dataCurtaIso = d => d ? dataBR(d.slice(0, 10)) : "—";
const valorOuTraco = v => v ? BRL(v).replace(",00", "") : "—";

async function paginaLicitacoes(qInicial) {
  document.title = "Licitações — Radar Campinas";
  $app.innerHTML = `<div class="pag"><a class="voltar" href="#/">← Início</a><h1>Licitações e contratos</h1><p class="carregando">Carregando…</p></div>`;
  const [L, C_] = await carregarLic();
  const m = GERAL.meta;
  const meses = L.por_mes.map(x => x[0]);
  const orgaosL = L.orgaos;
  $app.innerHTML = `<div class="pag"><a class="voltar" href="#/">← Início</a>
    <p class="eyebrow">Dinheiro público</p>
    <h1>O que a Prefeitura abriu para comprar e contratar</h1>
    <p style="font-size:1.1rem;max-width:780px">Compras, licitações e contratos publicados no PNCP (Portal Nacional de Contratações Públicas) pela Prefeitura e pelas entidades ligadas a ela, desde ${dataBR(m.inicio)}.</p>
    <div class="aviso" role="note">${ico("warn")}<div><strong>Licitação ou contrato não prova irregularidade, nem prova que o serviço foi feito.</strong>
      O valor mostrado é o da compra ou do contrato, não necessariamente o que já foi pago (para isso, veja <a href="#/gastos">Gastos</a>). O PNCP pode não ter todas as compras: nem tudo é publicado lá.</div></div>
    ${selos(selo("oficial", "cada compra e cada contrato (PNCP)"), selo("calculado", "somas e contagens"), selo("estimativa", "a busca por texto no objeto"))}
    <div class="grade">
      ${kpi({icone: "file", cor: "c-azul", num: nf(L.n), rotulo: "compras e licitações publicadas", nota: `Pregões, dispensas, inexigibilidades e outras modalidades de ${orgaosL.length} órgãos.`, selos: selo("calculado")})}
      ${kpi({icone: "cash", cor: "c-verde", num: reaisCurto(L.valor_homologado), rotulo: "valor homologado nessas compras", nota: `Valor estimado: ${reaisCurto(L.valor_estimado)}. Homologado é o valor final da compra, não o já pago.`, selos: selo("calculado")})}
      ${kpi({icone: "vote", cor: "c-ambar", num: nf(C_.n), rotulo: "contratos assinados", nota: C_.n ? `Valor global somado: ${reaisCurto(C_.valor_total)}.${C_.fora_do_padrao ? ` ${nf(C_.fora_do_padrao)} contrato(s) com valor acima de R$ 1 bilhão (possível erro de digitação ou valor de muitos anos) não entrou(ram) na soma e aparece(m) marcado(s) na lista.` : ""}` : "Nenhum contrato baixado.", selos: selo("calculado")})}
    </div>
    <div class="grade" style="margin-top:20px">
      <div class="card" style="flex:7 1 520px"><div class="cabecalho"><div><h3>Compras publicadas por mês</h3><div class="suave">Número de compras e licitações publicadas no PNCP</div></div>${selo("calculado")}</div>
        ${barrasSimples(L.por_mes.map(x => x[1]), meses, 170, "#1D4ED8", "Compras publicadas por mês")}</div>
      <div class="card" style="flex:5 1 340px"><div class="cabecalho"><div><h3>Por modalidade</h3><div class="suave">Quantas compras de cada tipo</div></div>${selo("calculado")}</div>
        ${barrasH(L.modalidades.map(x => [x.nome, x.n]))}
        <p class="suave" style="font-size:.82rem">Inexigibilidade e dispensa são compras sem concorrência, previstas em lei para casos específicos. Estar nessas modalidades não indica irregularidade.</p></div>
    </div>
    <div class="card" style="margin:20px 0 12px">
      <div class="filtros" id="lt" role="tablist"></div>
      <div class="filtros-linha">
        <label class="campo-simples"><span class="lbl">Buscar no objeto, no fornecedor ou na unidade</span><input type="search" id="lq" class="simples" placeholder="Ex.: recapeamento, ambulância, merenda, Jardim Londres" value="${esc(qInicial || "")}"></label>
        <label class="campo-simples" id="lmw"><span class="lbl">Modalidade</span><select id="lm" class="simples"><option value="">Todas</option>${L.modalidades.map(x => `<option>${esc(x.nome)}</option>`).join("")}</select></label>
        <label class="campo-simples"><span class="lbl">Entidade</span><select id="lo" class="simples"><option value="">Todas</option>${orgaosL.map(o => `<option>${esc(o)}</option>`).join("")}</select></label>
        <label class="campo-simples"><span class="lbl">Ordem</span><select id="ls" class="simples"><option value="data">Mais recentes</option><option value="valor">Maiores valores</option></select></label>
      </div>
      <p class="suave" id="ln"></p><div id="ll"></div><button class="mais" id="lmais" hidden>Mostrar mais</button>
    </div>
    <p class="suave" style="font-size:.85rem">Fonte: <a href="https://pncp.gov.br" target="_blank" rel="noopener">PNCP</a>, em ${dataBR(m.gerado_em)}. Veja os limites na <a href="#/transparencia/i-licitacoes">página Transparência</a>.</p></div>`;
  const est = {aba: "compras"};
  const desenhaL = r => `<div class="item"><div class="cab">${dataCurtaIso(r[1])} · ${esc(r[3])} · <span class="tag">${esc(r[4])}</span> · ${esc(r[2])}</div>
    <div class="tit">${esc(r[5])}</div>
    <div class="res">Homologado: <strong class="num">${valorOuTraco(r[7])}</strong>${r[11] ? ` <span class="tag" style="border-color:#9B1C1C;color:#7F1616">valor acima de R$ 1 bi: não somado</span>` : ""} · Estimado: ${valorOuTraco(r[6])}${r[10] ? " · registro de preços" : ""}</div>
    <div class="lbl">${esc(r[8])} · ${r[9] ? ext(r[9], "Abrir no PNCP") : esc(r[0])}</div></div>`;
  const desenhaC = r => `<div class="item"><div class="cab">Assinado em ${dataCurtaIso(r[0])} · ${esc(r[1])}</div>
    <div class="tit">${esc(r[2])}${r[3] ? ` <span class="lbl">${fmtCnpj(r[3])}</span>` : ""}</div>
    <div class="ementa">${esc(r[4])}</div>
    <div class="res">Valor: <strong class="num">${valorOuTraco(r[5])}</strong>${r[10] ? ` <span class="tag" style="border-color:#9B1C1C;color:#7F1616">valor acima de R$ 1 bi: não somado</span>` : ""}${r[6] ? ` · Vigência: ${dataCurtaIso(r[6])} a ${dataCurtaIso(r[7])}` : ""}</div>
    <div class="lbl">${ext(r[8], "Abrir no PNCP")}</div></div>`;
  const atualizar = () => {
    const q = normBusca(document.getElementById("lq").value), toks = q.split(" ").filter(t => t.length >= 2 && !PARADA.has(t));
    const orgao = document.getElementById("lo").value, mod = document.getElementById("lm").value, ord = document.getElementById("ls").value;
    document.getElementById("lmw").style.display = est.aba === "compras" ? "" : "none";
    const base = est.aba === "compras" ? L.itens : C_.itens, iV = est.aba === "compras" ? 7 : 5, iO = est.aba === "compras" ? 2 : 1;
    let sel = base.filter(r => (!toks.length || toks.every(t => r._n.includes(t))) && (!orgao || r[iO] === orgao) && (!mod || est.aba !== "compras" || r[3] === mod));
    sel = ord === "valor" ? sel.slice().sort((a, b) => b[iV] - a[iV]) : sel;
    const iF = est.aba === "compras" ? 11 : 10;
    const soma = sel.reduce((a, r) => a + (r[iF] ? 0 : (r[iV] || 0)), 0);
    document.getElementById("ln").textContent = `${nf(sel.length)} ${est.aba === "compras" ? "compras" : "contratos"}${sel.length ? ` · soma ${est.aba === "compras" ? "homologada" : "dos valores"}: ${reaisCurto(soma)}` : ""}.`;
    lista(document.getElementById("ll"), document.getElementById("lmais"), sel, est.aba === "compras" ? desenhaL : desenhaC, 20);
  };
  const abas = [["compras", `Compras e licitações (${nf(L.n)})`], ["contratos", `Contratos (${nf(C_.n)})`]];
  chips(document.getElementById("lt"), abas, {get v() { return est.aba; }, set v(x) { est.aba = x; }}, atualizar);
  ["lq", "lm", "lo", "ls"].forEach(i => document.getElementById(i).addEventListener(i === "lq" ? "input" : "change", atualizar));
  atualizar();
}

/* usado pela busca por rua: compras e contratos que citam o lugar no texto */
async function cartaoLicitacoesDoLugar(tokens, q) {
  try {
    const [L, C_] = await carregarLic();
    const c = L.itens.filter(r => tokens.every(t => r._n.includes(t))), k = C_.itens.filter(r => tokens.every(t => r._n.includes(t)));
    if (!c.length && !k.length) return "";
    const topo = c.slice(0, 4).map(r => `<div class="item"><div class="cab">${dataCurtaIso(r[1])} · ${esc(r[3])} · ${esc(r[2])}</div><div class="tit">${esc(r[5].length > 240 ? r[5].slice(0, 240) + "…" : r[5])}</div>
      <div class="res">Homologado: <strong class="num">${valorOuTraco(r[7])}</strong> ${r[9] ? "· " + ext(r[9], "Abrir no PNCP") : ""}</div></div>`).join("");
    return `<div class="card" style="margin-top:20px"><div class="cabecalho"><div><h3>O que a Prefeitura licitou ou contratou citando “${esc(q)}”</h3>
      <div class="suave">${nf(c.length)} compras e ${nf(k.length)} contratos no PNCP têm esse nome no texto.</div></div>${selo("estimativa", "ligação por texto, pode errar")}</div>${topo}
      <p style="margin:8px 0 0"><a href="#/licitacoes/${encodeURIComponent(q)}">Ver todas as compras e contratos que citam “${esc(q)}”</a></p>
      <p class="suave" style="font-size:.82rem">Isto é só uma busca pelo nome no texto da compra. Não prova que a compra atende ao pedido de nenhum vereador, nem que o serviço foi feito.</p></div>`;
  } catch (e) { return ""; }
}
