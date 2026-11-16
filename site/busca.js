"use strict";
/* Busca por rua/bairro e pedidos que se repetem. Usa dados/busca.json (índice gerado por scripts/gerar_busca.py). */
let BUSCA = null;
const ABREV = [[/\bAV\.?(?=\s)/g, "AVENIDA"], [/\bR\.(?=\s)/g, "RUA"], [/\bAL\.(?=\s)/g, "ALAMEDA"], [/\bTRAV\.?(?=\s)/g, "TRAVESSA"],
  [/\bPCA\.?(?=\s)/g, "PRACA"], [/\bEST\.(?=\s)/g, "ESTRADA"], [/\bROD\.(?=\s)/g, "RODOVIA"], [/\bDRA?\.?(?=\s)/g, "DOUTOR"],
  [/\bPROFA?\.?(?=\s)/g, "PROFESSOR"], [/\bENG\.?(?=\s)/g, "ENGENHEIRO"], [/\bCEL\.?(?=\s)/g, "CORONEL"], [/\bPE\.(?=\s)/g, "PADRE"],
  [/\bJD\.?(?=\s)/g, "JARDIM"], [/\bVL\.?(?=\s)/g, "VILA"], [/\bPQ\.?(?=\s)/g, "PARQUE"], [/\bRES\.(?=\s)/g, "RESIDENCIAL"],
  [/\bSTA\.?(?=\s)/g, "SANTA"], [/\bSTO\.?(?=\s)/g, "SANTO"], [/\bMAL\.?(?=\s)/g, "MARECHAL"], [/\bGEN\.?(?=\s)/g, "GENERAL"]];
const PARADA = new Set(["DE", "DA", "DO", "DOS", "DAS", "E", "NA", "NO"]);
const VIA_NOME = {RUA: "Rua", AVENIDA: "Avenida", PRACA: "Praça", ALAMEDA: "Alameda", TRAVESSA: "Travessa", ESTRADA: "Estrada", RODOVIA: "Rodovia",
  VIADUTO: "Viaduto", CAMINHO: "Caminho", BECO: "Beco", VIELA: "Viela", LARGO: "Largo", RUELA: "Ruela"};

function normBusca(s) {
  s = String(s || "").replace(/[‒-―]/g, " - ").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim() + " ";
  for (const [re, t] of ABREV) s = s.replace(re, t);
  return s.replace(/[“”"'`´]/g, "").trim();
}
const titulo = s => s.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
  .replace(/\b(Da|De|Do|Das|Dos|E)\b/g, x => x.toLowerCase());
const AVISO = `<div class="aviso" role="note">${ico("warn")}<div><strong>Pedido repetido não prova que a Prefeitura ignorou.</strong>
  O pedido pode ter sido atendido e o problema voltou; pode ter sido atendido só em parte; pode vir de vereadores ou moradores diferentes
  falando da mesma coisa; ou a resposta pode não estar registrada. Este site mostra <strong>só o que foi pedido</strong>, não o que a Prefeitura fez depois.</div></div>`;

const COR_CAT = ["#1D4ED8", "#0A8A8A", "#C2410C", "#6D3FC4", "#E8A100", "#8A97A8"];
/* linha do tempo: um círculo por data, uma linha por tipo de pedido */
function linhaDoTempo(grupos, titulo_) {
  const t0 = Date.UTC(2025, 0, 1), t1 = Date.UTC(+GERAL.meta.gerado_em.slice(0, 4), +GERAL.meta.gerado_em.slice(5, 7) - 1, +GERAL.meta.gerado_em.slice(8, 10));
  const pos = s => { const [y, m, d] = s.split("-").map(Number); return Math.round((Date.UTC(y, m - 1, d) - t0) / (t1 - t0) * 1000) / 10; };
  const linhas = grupos.map((g, i) => {
    const cont = {}; g.datas.forEach(d => { cont[d] = (cont[d] || 0) + 1; });
    const bolas = Object.keys(cont).map(d => { const n = cont[d], s = 10 + (n - 1) * 5; return `<i title="${dataBR(d)}: ${n} ${n === 1 ? "pedido" : "pedidos"}" style="left:${pos(d)}%;top:${13 - s / 2 - 2}px;width:${s}px;height:${s}px;margin-left:-${s / 2 + 2}px;background:${COR_CAT[i % COR_CAT.length]}"></i>`; }).join("");
    return `<div class="linha-tempo"><div class="nome"><b>${esc(BUSCA.categorias[g.c])}</b><span class="lbl">${nf(g.n)} pedidos · ${nf(g.dias)} datas</span></div><div class="pista">${bolas}</div></div>`;
  }).join("");
  const eixo = ["2025-01-01", "2025-04-01", "2025-07-01", "2025-10-01", "2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"].filter(d => Date.UTC(...d.split("-").map((x, i) => i === 1 ? +x - 1 : +x)) < t1)
    .map(d => `<span style="left:${pos(d)}%">${mesLongo(d.slice(0, 7))}</span>`).join("");
  return `<div class="card" style="margin-top:20px"><div class="cabecalho"><div><h3>Quando cada pedido foi feito</h3><div class="suave">${esc(titulo_)}. Cada círculo é uma data; círculo maior = mais de um pedido no mesmo dia.</div></div>${selos(selo("oficial", "datas"), selo("estimativa", "tipo de pedido"))}</div>
    <div style="margin-top:14px">${linhas}<div class="linha-tempo eixo-l"><div class="nome">.</div><div class="pista eixo" style="height:18px">${eixo}</div></div></div></div>`;
}
function quemPediu(achados) {
  const c = {};
  achados.forEach(p => p.a.forEach(a => { c[a] = (c[a] || 0) + 1; }));
  const lista_ = Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([a, n]) => [BUSCA.nomes[a], n]);
  const mais = Object.keys(c).length - lista_.length;
  return `<div class="card"><div class="cabecalho"><div><h3>Quem pediu</h3><div class="suave">Pedidos nesta busca, por vereador</div></div>${selo("calculado")}</div>
    ${barrasH(lista_)}
    <p class="suave" style="font-size:.82rem">${mais > 0 ? `Mais ${mais} vereadores com menos pedidos. ` : ""}Quem apresenta mais pedidos não é, por isso, melhor ou pior. A conta só mostra quem pediu.</p></div>`;
}

async function carregarBusca() {
  if (BUSCA) return BUSCA;
  BUSCA = await json("dados/busca.json");
  BUSCA.porId = new Map();
  for (const p of BUSCA.pedidos) { p._n = normBusca(p.e); BUSCA.porId.set(p.i, p); }
  for (const g of BUSCA.repeticoes) g._n = normBusca(g.rua + " " + (g.bairro || ""));
  return BUSCA;
}

function autoresHtml(ids, contagem) {
  const por = contagem || ids.map(a => [a, 1]);
  return por.map(([a, n]) => {
    const pid = BUSCA.pids[a], nome = esc(BUSCA.nomes[a]);
    const ok = GERAL.vereadores.some(v => v.id === pid);
    return `${ok ? `<a href="#/v/${pid}">${nome}</a>` : nome}${contagem ? ` (${n})` : ""}`;
  }).join(", ");
}

function nomeLocal(g) {
  const via = g.rua.split(" ")[0], resto = g.rua.split(" ").slice(1).join(" ");
  const rua = `${VIA_NOME[via] || titulo(via)} ${titulo(g.q || resto)}`;
  const bairro = g.bairro ? (g.bq ? titulo(g.bq) : titulo(g.bairro)) : null;
  return bairro ? `${rua}, ${bairro}` : rua;
}

const dataCurta = d => dataBR(d);

function cartaoRepeticao(g) {
  const pedidos = g.ids.map(i => BUSCA.porId.get(i));
  const cat = BUSCA.categorias[g.c];
  const datas = [...new Map(pedidos.map(p => [p.d, p])).values()];
  const contaN = nf(g.n);
  return `<div class="cartao"><div class="cab">${esc(cat)} · ${selo("estimativa", "tipo de pedido e local lidos por programa; pode errar")}</div>
    <div class="tit">${esc(nomeLocal(g))}</div>
    <p style="margin:6px 0"><span class="grande-num" style="font-size:1.8rem">${contaN}</span> ${g.n === 1 ? "pedido" : "pedidos"} em
    <strong>${nf(g.dias)}</strong> datas diferentes, de ${dataCurta(g.datas[0])} a ${dataCurta(g.datas[g.datas.length - 1])}.</p>
    <p class="suave" style="margin:4px 0">Contagem: ${selo("calculado", "contagem feita por nós")}. Datas oficiais (toque para abrir o pedido): ${datas.map(p => `<a class="datachip" href="${SAPL}/materia/${p.i}" target="_blank" rel="noopener">${dataCurta(p.d)}</a>`).join(" ")}</p>
    <p style="margin:4px 0">Pedido por: ${autoresHtml(null, g.por)}</p>
    <details><summary>Ver os ${nf(g.n)} pedidos</summary>${pedidos.map(itemPedido).join("")}</details></div>`;
}

function itemPedido(p) {
  const tipo = TIPO_NOME[p.s] || p.s;
  return `<div class="item"><div class="cab">${dataCurta(p.d)} · ${tipo}${p.c != null ? " · " + esc(BUSCA.categorias[p.c]) : ""}</div>
    <div class="tit"><a href="${SAPL}/materia/${p.i}" target="_blank" rel="noopener">${esc(p.n)}</a></div>
    <div class="ementa">${esc(p.e.length > 400 ? p.e.slice(0, 400) + "…" : p.e)}</div>
    <div class="res">Pedido por: ${autoresHtml(p.a)}</div></div>`;
}

/* ---------- página de resultados ---------- */
async function paginaBusca(q) {
  document.title = `${q} — Radar Campinas`;
  $app.innerHTML = `<a class="voltar" href="#/">← Início</a><h1>Pedidos para “${esc(q)}”</h1><p class="carregando">Carregando os pedidos (arquivo grande, só na primeira vez)…</p>`;
  await carregarBusca();
  const tokens = normBusca(q).split(" ").filter(t => t.length >= 2 && !PARADA.has(t));
  if (!tokens.length) { $app.innerHTML = `<a class="voltar" href="#/">← Início</a><h1>Busca</h1><p>Digite pelo menos uma palavra do nome da rua ou do bairro.</p>`; return; }
  const achados = BUSCA.pedidos.filter(p => tokens.every(t => p._n.includes(t)));
  const reps = BUSCA.repeticoes.filter(g => tokens.every(t => g._n.includes(t)));
  const vereadores = new Set(achados.flatMap(p => p.a));
  const datas = achados.map(p => p.d).sort();
  const ruaTempo = reps.length ? reps.filter(g => g.rua === reps[0].rua && g.bairro === reps[0].bairro).slice(0, 4) : [];
  $app.innerHTML = `<div class="cab-pessoa"><div class="in"><a class="voltar" href="#/">← Início</a>
      <p class="lbl" style="font-size:.85rem;margin:0">Busca por rua ou bairro</p>
      <h1 style="font-size:clamp(1.8rem,4vw,2.5rem)">Pedidos para “${esc(q)}”</h1>
      ${caixaBusca(q).replace('style="margin-top:24px;max-width:640px"', 'style="margin-top:14px;max-width:680px"')}</div></div>
    <section class="pag">
    ${AVISO}
    ${achados.length ? `<div class="grade">
      ${kpi({icone: "file", cor: "c-ambar", num: nf(achados.length), rotulo: achados.length === 1 ? "pedido encontrado" : "pedidos encontrados", nota: `Indicações, requerimentos, moções, projetos de lei e emendas.`, selos: selo("oficial")})}
      ${kpi({icone: "users", cor: "c-azul", num: nf(vereadores.size), rotulo: vereadores.size === 1 ? "vereador fez pedidos" : "vereadores fizeram pedidos", nota: `De ${dataCurta(datas[0])} a ${dataCurta(datas[datas.length - 1])}`, selos: selo("calculado")})}
      ${kpi({icone: "repeat", cor: "c-roxo", num: nf(reps.length), rotulo: "tipos de pedido que voltaram", nota: `Mesma rua e mesmo tipo, em ${BUSCA.min_repetido} datas diferentes ou mais`, selos: selo("estimativa")})}
    </div>`
      : `<p>Nenhum pedido encontrado. Tente só o nome da rua, sem “rua” ou número, ou o nome do bairro.</p>`}
    ${ruaTempo.length ? `<div class="grade" style="margin-top:0">${linhaDoTempo(ruaTempo, nomeLocal(ruaTempo[0])).replace('class="card" style="margin-top:20px"', 'class="card" style="margin-top:20px;flex:7 1 560px;min-width:0"')}<div style="flex:5 1 360px;margin-top:20px;min-width:0">${quemPediu(achados)}</div></div>` : (achados.length ? `<div style="margin-top:20px">${quemPediu(achados)}</div>` : "")}
    ${reps.length ? `<div class="cabecalho" style="margin-top:32px"><div><h2>Pedidos que voltaram várias vezes</h2><div class="suave">Mesmo tipo de pedido, na mesma rua, em ${BUSCA.min_repetido} datas diferentes ou mais. <a href="#/repeticoes">Como contamos</a></div></div>${selo("estimativa", "o que conta como repetido é regra nossa")}</div>
      <div class="cartoes">${reps.map(cartaoRepeticao).join("")}</div>`
      : achados.length ? `<p class="suave" style="margin-top:24px">Nenhum tipo de pedido se repetiu ${BUSCA.min_repetido} vezes ou mais para esta busca.</p>` : ""}
    ${achados.length ? `<div class="card" style="margin:28px 0 12px"><div class="cabecalho"><div><h2>Todos os pedidos</h2><div class="suave">Texto, data e autor copiados do registro oficial</div></div>${selo("oficial")}</div><div class="filtros" id="fb"></div><div id="lb"></div><button class="mais" id="mb" hidden>Mostrar mais</button></div>` : ""}
    </section>`;
  ligarCaixaBusca();
  if (!achados.length) return;
  cartaoLicitacoesDoLugar(tokens, q).then(h => { if (!h) return; const alvo = document.querySelector(".cartoes"); if (alvo) alvo.insertAdjacentHTML("afterend", h); else { const c = document.getElementById("lb"); if (c) c.closest(".card").insertAdjacentHTML("beforebegin", h); } });
  const nomesCat = BUSCA.categorias, atual = {v: "todos"};
  const cats = [...new Set(achados.filter(p => p.c != null).map(p => p.c))].sort((a, b) => a - b);
  const opcoes = [["todos", `Todos (${nf(achados.length)})`], ...cats.map(c => [String(c), `${nomesCat[c]} (${nf(achados.filter(p => p.c === c).length)})`])];
  const atualizar = () => lista(document.getElementById("lb"), document.getElementById("mb"),
    atual.v === "todos" ? achados : achados.filter(p => String(p.c) === atual.v), itemPedido, 20);
  if (cats.length > 1) chips(document.getElementById("fb"), opcoes, atual, atualizar); else document.getElementById("fb").remove();
  atualizar();
}

/* ---------- página de repetições ---------- */
async function paginaRepeticoes() {
  document.title = "Pedidos repetidos — Radar Campinas";
  $app.innerHTML = `<a class="voltar" href="#/">← Início</a><h1>Pedidos que voltam para a mesma rua</h1><p class="carregando">Carregando…</p>`;
  await carregarBusca();
  const n = BUSCA.min_repetido;
  $app.innerHTML = `<div class="pag"><a class="voltar" href="#/">← Início</a><p class="eyebrow">Pedidos repetidos</p><h1>Pedidos que voltam para a mesma rua</h1>
    ${AVISO}
    ${selos(selo("estimativa", "o que conta como repetido e a leitura de rua, bairro e tipo de pedido são regras nossas"), selo("oficial", "data, autor e texto de cada pedido"), selo("calculado", "contagens"))}
    <details class="caixa"><summary>Como contamos</summary>
      <p>Usamos só as <strong>Indicações</strong> (pedidos de obra ou serviço ao prefeito) apresentadas desde ${dataBR(GERAL.meta.inicio)}.
      Um programa lê o texto oficial de cada uma e tira dele a <strong>rua</strong>, o <strong>bairro</strong> e o <strong>tipo de pedido</strong> (por palavras-chave: “poda”, “tapa-buraco”, “limpeza”…).
      Se o mesmo tipo de pedido aparece para a mesma rua em <strong>${n} datas diferentes ou mais</strong>, mostramos como repetido.
      Vários pedidos no mesmo dia contam como uma data só.</p>
      <p>A regra é a mesma para todos os vereadores. Limites: texto fora do padrão (sem rua ou com nome diferente) não entra na contagem, mas aparece na busca;
      ruas de nome muito curto (como “Rua 2”) só contam quando o bairro aparece; grafias diferentes da mesma rua podem separar pedidos que deveriam ficar juntos.
      Os números podem ser maiores do que mostramos, nunca de propósito menores por causa de quem pediu.</p></details>
    <p>${nf(BUSCA.repeticoes.length)} combinações de rua e tipo de pedido se repetiram ${n} vezes ou mais.</p>
    <div class="filtros" id="fr"></div><div class="cartoes" id="lr"></div><button class="mais" id="mr" hidden>Mostrar mais</button></div>`;
  const atual = {v: "todos"};
  const cats = [...new Set(BUSCA.repeticoes.map(g => g.c))].sort((a, b) => a - b);
  const opcoes = [["todos", "Todos os tipos"], ...cats.map(c => [String(c), `${BUSCA.categorias[c]} (${nf(BUSCA.repeticoes.filter(g => g.c === c).length)})`])];
  const atualizar = () => lista(document.getElementById("lr"), document.getElementById("mr"),
    atual.v === "todos" ? BUSCA.repeticoes : BUSCA.repeticoes.filter(g => String(g.c) === atual.v), cartaoRepeticao, 10);
  chips(document.getElementById("fr"), opcoes, atual, atualizar);
  atualizar();
}

function caixaBusca(valor) {
  return `<form class="buscaform" id="form-busca" role="search" style="margin-top:24px;max-width:640px"><label for="q-rua">O que foi pedido para a sua rua ou bairro?</label>
    <div class="linha"><div class="campo-w"><div class="campo">${ico("search")}<input type="search" id="q-rua" role="combobox" aria-expanded="false" aria-controls="sugest" aria-autocomplete="list" placeholder="Ex.: Avenida Ibirapuera, Jardim Londres" autocomplete="off" value="${esc(valor || "")}"></div><ul class="sugest" id="sugest" role="listbox" hidden></ul></div><button class="btn" type="submit">Buscar pedidos</button></div></form>
    ${valor ? "" : `<p class="sugestoes">Experimente: <a href="#/busca/ibirapuera">Ibirapuera</a> · <a href="#/busca/jardim%20londres">Jardim Londres</a> · <a href="#/busca/parque%20valen%C3%A7a">Parque Valença</a>.
    Ou veja os <a href="#/repeticoes">pedidos que voltam várias vezes para a mesma rua</a>.</p>`}`;
}
function ligarCaixaBusca() {
  const form = document.getElementById("form-busca"), campo = document.getElementById("q-rua"), ul = document.getElementById("sugest");
  form.addEventListener("submit", e => {
    e.preventDefault();
    const q = campo.value.trim();
    if (q) location.hash = "#/busca/" + encodeURIComponent(q);
  });
  /* sugestões de bairros e ruas ao digitar (lista lida do texto das indicações; só ajuda a escrever) */
  let ativo = -1, itens = [];
  const fechar = () => { ul.hidden = true; campo.setAttribute("aria-expanded", "false"); ativo = -1; campo.removeAttribute("aria-activedescendant"); };
  const marcar = () => { [...ul.children].forEach((li, i) => { li.setAttribute("aria-selected", i === ativo); if (i === ativo) campo.setAttribute("aria-activedescendant", li.id); }); };
  const escolher = i => { campo.value = itens[i].nome; fechar(); form.requestSubmit(); };
  const abrir = async () => {
    const q = normBusca(campo.value), tokens = q.split(" ").filter(t => t.length >= 2 && !PARADA.has(t));
    if (q.length < 2 || !tokens.length) { fechar(); return; }
    const l = await carregarLocais();
    const acha = (lista_, tipo) => lista_.filter(([n]) => { const x = normBusca(n); return tokens.every(t => x.includes(t)); }).slice(0, 6).map(([n, c]) => ({nome: n, c, tipo}));
    itens = [...acha(l.bairros, "Bairro"), ...acha(l.ruas, "Rua")].sort((a, b) => b.c - a.c).slice(0, 8);
    if (!itens.length) { fechar(); return; }
    ul.innerHTML = itens.map((it, i) => `<li role="option" id="sug-${i}" aria-selected="false" data-i="${i}"><span>${esc(it.nome)}</span><small>${it.tipo} · ${nf(it.c)} ${it.c === 1 ? "pedido" : "pedidos"}</small></li>`).join("");
    ul.hidden = false; campo.setAttribute("aria-expanded", "true"); ativo = -1;
  };
  campo.addEventListener("input", abrir);
  campo.addEventListener("keydown", e => {
    if (ul.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); ativo = (ativo + 1) % itens.length; marcar(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); ativo = (ativo - 1 + itens.length) % itens.length; marcar(); }
    else if (e.key === "Enter" && ativo >= 0) { e.preventDefault(); escolher(ativo); }
    else if (e.key === "Escape") fechar();
  });
  ul.addEventListener("mousedown", e => { const li = e.target.closest("li"); if (li) { e.preventDefault(); escolher(+li.dataset.i); } });
  campo.addEventListener("blur", () => setTimeout(fechar, 120));
}
