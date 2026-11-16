"use strict";
/* Visão da cidade inteira: grupos de propostas (com "ver todas"), propostas mais recentes e bairros mais citados. */
let REC = null, LOCAIS = null;
const TIPO_NOME = {IND: "Indicação", REQ: "Requerimento", MOC: "Moção", PLO: "Projeto de lei", PLC: "Projeto de lei complementar", PDL: "Projeto de decreto legislativo",
  PRE: "Projeto de resolução", PELOM: "Mudança na Lei Orgânica", EMEND: "Emenda", EMADI: "Emenda aditiva", EMMOD: "Emenda modificativa", EMSUB: "Emenda substitutiva",
  EMSUP: "Emenda supressiva", EMIMP: "Emenda impositiva", EMMEN: "Emenda de mensagem aditiva", SUBST: "Substitutivo"};

let AFAST = null;
async function carregarAfast() { try { AFAST = await json("dados/afastamentos.json"); } catch (e) { AFAST = null; } }
async function carregarRecentes() { try { REC = await json("dados/recentes.json"); } catch (e) { REC = null; } }
async function carregarLocais() { if (!LOCAIS) { try { LOCAIS = await json("dados/locais.json"); } catch (e) { LOCAIS = {bairros: [], ruas: []}; } } return LOCAIS; }

function linksAutores(nomes, ids) {
  return nomes.map((n, i) => GERAL.vereadores.some(v => v.id === ids[i]) ? `<a href="#/v/${ids[i]}">${esc(n)}</a>` : esc(n)).join(", ");
}

function blocoGrupos() {
  if (!REC) return "";
  const m = GERAL.meta;
  return `<section style="padding-top:36px">
    <div class="cabecalho"><div><h2>O que os vereadores propuseram</h2><div class="suave">Os mesmos cinco grupos para todos. Toque num grupo para ler as propostas da cidade inteira, uma por uma.</div></div>${selo("estimativa", "grupos por regra nossa")}</div>
    <div class="grade grupos-cartoes">${m.grupos.map((g, i) => `<a class="card gcard" href="#/grupo/${i}">
      <span class="dot" style="background:${CORES_G[i]}"></span><span class="gn-nome">${esc(g.nome)}</span>
      <span class="num gcount">${nf(REC.por_grupo[i])}</span><span class="suave gdesc">${esc(g.desc)}</span><span class="gver">Ver todas ${ico("chev")}</span></a>`).join("")}</div>
    <p class="suave" style="font-size:.82rem">Só entram propostas com pelo menos um vereador como autor (${nf(REC.total)} de ${nf(GRAF.total_propostas)}). As enviadas só pela Prefeitura ou por comissões ficam de fora.</p>
  </section>`;
}

function blocoRecentes() {
  if (!REC) return "";
  const m = GERAL.meta;
  const itens = REC.recentes.slice(0, 8).map(p => `<div class="item"><div class="cab"><span class="dot" style="background:${CORES_G[p.g]}"></span> ${esc(m.grupos[p.g].nome)} · ${dataBR(p.d)} · ${esc(TIPO_NOME[p.s] || p.s)}</div>
    <div class="tit"><a href="${SAPL}/materia/${p.i}" target="_blank" rel="noopener">${esc(p.n)}</a></div>
    <div class="ementa">${esc(p.e.length > 220 ? p.e.slice(0, 220) + "…" : p.e)}</div>
    <div class="res suave">Por ${linksAutores(p.a, p.ap)}</div></div>`).join("");
  return `<div class="card" style="flex:7 1 520px">
    <div class="cabecalho"><div><h3>As propostas mais recentes da cidade</h3><div class="suave">Texto, data e autor copiados do registro oficial</div></div>${selo("oficial")}</div>${itens}</div>`;
}

function blocoBairros(l) {
  const top = (l && l.bairros ? l.bairros : []).slice(0, 10);
  return `<div class="card" style="flex:5 1 340px">
    <div class="cabecalho"><div><h3>Bairros mais citados</h3><div class="suave">Pedidos de melhoria que citam o bairro. Toque para ver tudo que foi pedido.</div></div>${selo("estimativa", "bairro lido do texto")}</div>
    <div class="chips-locais">${top.map(([n, c]) => `<a class="chip-local" href="#/busca/${encodeURIComponent(n)}">${esc(n)} <b>${nf(c)}</b></a>`).join("")}</div>
    <p class="suave" style="font-size:.82rem">A leitura do bairro é feita por um programa e pode errar: veja “Transparência”. Citar um bairro muitas vezes não diz se ele é bem ou mal atendido.</p></div>`;
}

/* ---------- página "todas as propostas de um grupo" ---------- */
async function paginaGrupo(gi) {
  const g = GERAL.meta.grupos[gi];
  if (!g) { $app.innerHTML = `<p>Grupo não encontrado. <a href="#/">Voltar</a></p>`; return; }
  document.title = `${g.nome} — Radar Campinas`;
  $app.innerHTML = `<div class="pag"><a class="voltar" href="#/">← Início</a><h1>${esc(g.nome)}</h1><p class="carregando">Carregando as propostas (arquivo grande, só na primeira vez)…</p></div>`;
  await carregarBusca();
  const regras = GERAL.meta.regras;
  const todos = BUSCA.pedidos.filter(p => p.g === gi);
  const vers = new Set(todos.flatMap(p => p.a));
  const tiposG = [...new Set(todos.map(p => p.s))].sort((a, b) => todos.filter(p => p.s === b).length - todos.filter(p => p.s === a).length);
  const estado = {tipo: "todos", q: "", aut: ""};
  const autoresOpc = [...vers].sort((a, b) => BUSCA.nomes[a].localeCompare(BUSCA.nomes[b], "pt-BR"));
  $app.innerHTML = `<div class="pag"><a class="voltar" href="#/">← Início</a>
    <p class="eyebrow">Propostas da cidade</p>
    <h1><span class="dot" style="background:${CORES_G[gi]};width:18px;height:18px;border-radius:6px;vertical-align:middle;margin-right:10px"></span>${esc(g.nome)}</h1>
    <p style="font-size:1.05rem;max-width:760px">${esc(g.desc)}</p>
    ${selos(selo("oficial", "texto, data e autor"), selo("estimativa", "o grupo é regra nossa"))}
    <div class="grade" style="margin:8px 0 20px">
      ${kpi({icone: "file", cor: "c-ambar", num: nf(todos.length), rotulo: "propostas neste grupo", nota: `desde ${dataBR(GERAL.meta.inicio)}, com pelo menos um vereador como autor`, selos: selo("calculado")})}
      ${kpi({icone: "users", cor: "c-azul", num: nf(vers.size), rotulo: "vereadores aparecem como autores", nota: "Quem apresenta mais propostas não é, por isso, melhor ou pior.", selos: selo("calculado")})}
    </div>
    <details class="caixa"><summary>Por que uma proposta cai neste grupo</summary>${textoRegra()}</details>
    <div class="card" style="margin-top:16px">
      <div class="filtros-linha"><label class="campo-simples"><span class="lbl">Buscar no texto</span><input type="search" id="gq" class="simples" placeholder="Ex.: poda, escola, praça…"></label>
      <label class="campo-simples"><span class="lbl">Vereador</span><select id="ga" class="simples"><option value="">Todos</option>${autoresOpc.map(a => `<option value="${a}">${esc(BUSCA.nomes[a])}</option>`).join("")}</select></label></div>
      <div class="filtros" id="gf"></div><p class="suave" id="gn"></p><div id="gl"></div><button class="mais" id="gm" hidden>Mostrar mais</button>
    </div></div>`;
  const opcoes = [["todos", `Todos os tipos (${nf(todos.length)})`], ...tiposG.map(s => [s, `${BUSCA.tipos[s] || TIPO_NOME[s] || s} (${nf(todos.filter(p => p.s === s).length)})`])];
  const desenhar = p => `<div class="item"><div class="cab">${dataBR(p.d)} · ${esc(BUSCA.tipos[p.s] || TIPO_NOME[p.s] || p.s)}${p.a.length > 1 ? ` · com mais ${p.a.length - 1} autor${p.a.length > 2 ? "es" : ""}` : ""}</div>
    <div class="tit"><a href="${SAPL}/materia/${p.i}" target="_blank" rel="noopener">${esc(p.n)}</a></div>
    <div class="ementa">${esc(p.e.length > 400 ? p.e.slice(0, 400) + "…" : p.e)}</div>
    <div class="res">Por ${autoresHtml(p.a)}</div><div class="suave" style="font-size:.85rem">Por que está aqui: ${esc(regras[p.r].t)}</div></div>`;
  const atualizar = () => {
    const tokens = normBusca(estado.q).split(" ").filter(t => t.length >= 2 && !PARADA.has(t));
    const sel = todos.filter(p => (estado.tipo === "todos" || p.s === estado.tipo) && (!estado.aut || p.a.includes(+estado.aut)) && tokens.every(t => p._n.includes(t)));
    document.getElementById("gn").textContent = `${nf(sel.length)} ${sel.length === 1 ? "proposta" : "propostas"} com esse filtro.`;
    lista(document.getElementById("gl"), document.getElementById("gm"), sel, desenhar, 20);
  };
  chips(document.getElementById("gf"), opcoes, {get v() { return estado.tipo; }, set v(x) { estado.tipo = x; }}, atualizar);
  document.getElementById("gq").addEventListener("input", e => { estado.q = e.target.value; atualizar(); });
  document.getElementById("ga").addEventListener("change", e => { estado.aut = e.target.value; atualizar(); });
  atualizar();
}


/* Início: "Propostas para a cidade inteira" (grupos clicáveis) + "O problema que não some" (pedidos repetidos) */
function secaoPropostasCidade() {
  if (!REC) return "";
  const m = GERAL.meta, tot = REC.total;
  return `<section style="padding-top:44px">
    <div class="cabecalho"><h2>Propostas para a cidade inteira</h2>${selos(selo("oficial", "cada proposta"), selo("estimativa", "os grupos são regra nossa"))}</div>
    <div class="grade">
      <div class="card" style="flex:6 1 380px">
        <div class="grande-num" style="font-size:3.1rem;line-height:1.05">${nf(tot)}</div>
        <div class="t" style="font-weight:600;color:var(--ink)">propostas de vereadores desde ${dataBR(m.inicio)}</div>
        <p class="suave" style="margin:4px 0 0">Homenagem ou trabalho? Toque num grupo para ler cada proposta.</p>
        ${pilhaH(REC.por_grupo.map((n, i) => ({v: n, c: CORES_G[i]})), "Propostas por grupo")}
        <div class="picks">${m.grupos.map((g, i) => `<a class="pick" href="#/grupo/${i}"><span class="dot" style="background:${CORES_G[i]}"></span><span class="nm">${esc(g.nome)}</span><b class="num">${nf(REC.por_grupo[i])}</b>${ico("chev")}</a>`).join("")}</div>
      </div>
      <div id="rep-slot" class="card destaque-rep" style="flex:6 1 380px"><p class="carregando">Carregando…</p></div>
    </div>
  </section>`;
}

async function cartaoProblemaQueNaoSome() {
  const slot = document.getElementById("rep-slot");
  if (!slot) return;
  try {
    await carregarBusca();
    const s = document.getElementById("rep-slot");
    if (!s) return;
    const top = BUSCA.repeticoes.slice(0, 3);
    s.innerHTML = `<div class="cabecalho" style="margin-bottom:6px"><span class="eyebrow" style="margin:0">Só aqui</span>${selos(selo("estimativa", "rua e tipo de pedido lidos por programa"), selo("calculado", "contagem"))}</div>
      <h3 style="font-size:1.5rem">O problema que não some</h3>
      <p style="margin:8px 0">Quando o mesmo pedido volta várias vezes para a mesma rua, o problema pode continuar lá. O site da Câmara não mostra isso: cruzamos os pedidos um por um.</p>
      <div class="grande-num" style="font-size:2.6rem;line-height:1.1">${nf(BUSCA.repeticoes.length)}</div>
      <div class="t" style="font-weight:600;color:var(--ink);margin-bottom:10px">combinações de rua e pedido em ${BUSCA.min_repetido} datas ou mais</div>
      ${top.map(g => `<a class="rep-linha" href="#/busca/${encodeURIComponent(nomeLocal(g).split(",")[0])}"><span><b>${esc(nomeLocal(g))}</b><small>${esc(BUSCA.categorias[g.c])}</small></span><b class="num">${nf(g.dias)}×</b></a>`).join("")}
      <p style="margin:12px 0 4px"><a href="#/repeticoes" class="btn-sec">Ver todos os pedidos repetidos ${ico("chev")}</a></p>
      <p class="suave" style="font-size:.82rem;margin:8px 0 0">Pedido repetido não prova que a Prefeitura ignorou: pode ter sido atendido e o problema voltou.</p>`;
  } catch (e) { slot.innerHTML = ""; }
}
