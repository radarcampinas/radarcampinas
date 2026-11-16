"use strict";
/* Página "O que virou lei": leis e leis complementares sancionadas desde 2025 e quem apresentou o projeto (dados/leis.json, de scripts/gerar_leis.py). */
let LEIS = null;
const ORIGEM_NOME = {V: "Vereadores", E: "Prefeito (Executivo)", M: "Mesa da Câmara", "?": "Sem projeto ligado", O: "Outros"};
const ORIGEM_COR = {V: "#1E8E4E", E: "#1D4ED8", M: "#6D3FC4", "?": "#8A97A8", O: "#8A97A8"};

async function carregarLeis() {
  if (!LEIS) {
    LEIS = await json("dados/leis.json");
    LEIS.itens.forEach(l => { l._n = normBusca(l.e + " " + l.n); });
  }
  return LEIS;
}

const nomeVer = id => { const v = GERAL.vereadores.find(x => x.id === id); return v ? v.nome : "?"; };

/* cartão de número para a página inicial (preenche #leis-slot) */
async function kpiLeisInicio() {
  const slot = document.getElementById("leis-slot");
  if (!slot) return;
  try {
    const L = await carregarLeis();
    if (!document.getElementById("leis-slot")) return;
    const o = L.por_origem;
    slot.innerHTML = kpi({icone: "lei", cor: "c-azul", num: `<a class="n" href="#/leis" title="Ver as leis">${nf(L.n)}</a>`, extra: "leis", rotulo: "sancionadas desde 01/01/2025",
      selos: selo("oficial", "cada lei e seu autor") + selo("calculado", "contagens"),
      viz: pilhaH(["V", "E", "M", "?"].map(k => ({v: o[k] || 0, c: ORIGEM_COR[k]})), "Origem das leis: vereadores, Prefeito, Mesa") + miniLeg(["V", "E", "M"].filter(k => o[k]).map(k => [ORIGEM_COR[k], `${nf(o[k])} ${k === "V" ? "de vereadores" : k === "E" ? "do Prefeito" : "da Mesa"}`])),
      nota: "Leis e leis complementares publicadas no sistema da Câmara. Decretos e outros atos não entram."});
  } catch (e) { slot.innerHTML = ""; }
}

/* cartão de número para a página do vereador (preenche #leis-v) */
async function kpiLeisVereador(id) {
  const slot = document.getElementById("leis-v");
  if (!slot) return;
  try {
    const L = await carregarLeis();
    const s = document.getElementById("leis-v");
    if (!s) return;
    const [tot, prim] = L.por_vereador[String(id)] || [0, 0];
    s.innerHTML = kpi({icone: "lei", cor: "c-azul", num: tot ? `<a class="n" href="#/leis/${id}" title="Ver as leis">${nf(tot)}</a>` : "0", extra: tot === 1 ? "lei" : "leis", rotulo: "projetos seus que viraram lei, como autor ou coautor",
      selos: selo("oficial", "autoria de cada lei") + selo("calculado", "contagem"),
      nota: `${nf(prim)} como primeiro autor. Quantidade não mede o trabalho: boa parte das leis é nome de rua ou data comemorativa.`});
  } catch (e) { slot.innerHTML = ""; }
}

async function paginaLeis(vid) {
  document.title = "O que virou lei — Radar Campinas";
  $app.innerHTML = `<div class="pag"><a class="voltar" href="#/">← Início</a><h1>O que virou lei</h1><p class="carregando">Carregando…</p></div>`;
  const L = await carregarLeis();
  const o = L.por_origem, meses = L.por_mes.map(x => x[0]);
  const comLei = GERAL.vereadores.filter(v => L.por_vereador[String(v.id)]).sort((a, b) => L.por_vereador[String(b.id)][0] - L.por_vereador[String(a.id)][0] || a.nome.localeCompare(b.nome, "pt-BR"));
  $app.innerHTML = `<div class="pag"><a class="voltar" href="#/">← Início</a>
    <p class="eyebrow">Projetos que deram certo</p>
    <h1>O que virou lei</h1>
    <p style="font-size:1.1rem;max-width:720px">Leis sancionadas em Campinas desde ${dataBR(GERAL.meta.inicio)} e quem apresentou o projeto.</p>
    ${legendaCompacta()}
    <div class="grade" style="margin-top:14px">
      ${kpi({icone: "lei", cor: "c-azul", num: nf(L.n), rotulo: "leis e leis complementares", selos: selo("oficial") + selo("calculado", "contagem"), nota: "Só entram leis que passaram pela Câmara. Decretos e portarias não são leis aprovadas pelos vereadores."})}
      ${kpi({icone: "users", cor: "c-verde", num: nf(o.V || 0), rotulo: "vieram de projetos de vereadores", selos: selo("oficial", "autoria") + selo("calculado"),
        viz: pilhaH(["V", "E", "M", "?"].map(k => ({v: o[k] || 0, c: ORIGEM_COR[k]})), "Origem das leis") + miniLeg(["V", "E", "M", "?"].filter(k => o[k]).map(k => [ORIGEM_COR[k], `${nf(o[k])} ${ORIGEM_NOME[k].toLowerCase()}`]))})}
      ${kpi({icone: "file", cor: "c-ambar", num: nf(o.E || 0), rotulo: "vieram de projetos do Prefeito", selos: selo("oficial", "autoria") + selo("calculado"), nota: "O Prefeito (Executivo) também propõe leis: orçamento, reajustes, programas e mudanças de estrutura da Prefeitura."})}
    </div>

    <div class="grade" style="margin-top:24px">
      <div class="card" style="flex:7 1 480px"><div class="cabecalho"><h3>Leis por mês</h3>${selo("calculado")}</div>
        ${barrasSimples(L.por_mes.map(x => x[1]), meses, 170, "#1D4ED8", "Leis sancionadas por mês")}</div>
      <div class="card" style="flex:5 1 320px"><div class="cabecalho"><h3>Que tipo de lei</h3>${selo("estimativa", "tipo definido por regra nossa")}</div>
        ${barrasH(L.tipos.map((t, i) => [t, L.por_tipo[i]]))}</div>
    </div>

    <details class="secao" id="sec-leis-ver" style="margin-top:24px">
      <summary><span class="tile c-verde">${ico("users")}</span><span class="st"><b>Leis por vereador</b><small>Como autor ou coautor do projeto</small></span></summary>
      <div class="secao-corpo">
        ${barrasH(comLei.map(v => [v.nome, L.por_vereador[String(v.id)][0]]), "#1E8E4E")}
        <p class="suave" style="margin-top:12px">Quantidade não mede o trabalho de ninguém: muitas leis são nome de rua ou data comemorativa, e o mesmo projeto pode ter vários autores. Quem não aparece não teve projeto sancionado desde ${dataBR(GERAL.meta.inicio)}.</p>
      </div>
    </details>

    <div class="card" style="margin:24px 0 12px">
      <div class="filtros" id="lo2" aria-label="Filtrar por origem"></div>
      <div class="filtros-linha">
        <label class="campo-simples"><span class="lbl">Buscar no texto da lei</span><input type="search" id="lq2" class="simples" placeholder="Ex.: animais, escola, praça"></label>
        <label class="campo-simples"><span class="lbl">Tipo de lei</span><select id="lt2" class="simples"><option value="todos">Todos os tipos</option>${L.tipos.map((t, i) => `<option value="${i}">${esc(t)} (${nf(L.por_tipo[i])})</option>`).join("")}</select></label>
        <label class="campo-simples"><span class="lbl">Vereador</span><select id="lv2" class="simples"><option value="">Todos</option>${GERAL.vereadores.slice().sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map(v => `<option value="${v.id}">${esc(v.nome)}</option>`).join("")}</select></label>
      </div>
      <p class="suave" id="ln2"></p><div id="ll2"></div><button class="mais" id="lmais2" hidden>Mostrar mais</button>
    </div>
    <p class="suave" style="font-size:.85rem">Fonte: <a href="${SAPL}/norma/pesquisar" target="_blank" rel="noopener">normas jurídicas do sistema da Câmara</a>, em ${dataBR(GERAL.meta.gerado_em)}. <a href="#/transparencia/i-leis">Como fizemos e limites</a></p></div>`;

  const est = {o: "todas", t: "todos"};
  const desenha = l => {
    const nomes = [...l.v.map(id => `<a href="#/v/${id}">${esc(nomeVer(id))}</a>`), ...l.x.map(esc)];
    const autoria = l.o === "E" ? "Prefeito (Executivo)" : l.o === "M" ? "Mesa da Câmara" : nomes.length ? nomes.join(", ") : "não informada";
    return `<div class="item"><div class="cab">${dataBR(l.d)} · <span class="tag">${esc(l.t)}</span> · ${esc(L.tipos[l.k])}</div>
      <div class="tit"><a href="${SAPL}/norma/${l.i}" target="_blank" rel="noopener">${esc(l.n)}</a></div>
      <div class="ementa">${esc(l.e.length > 260 ? l.e.slice(0, 260) + "…" : l.e)}</div>
      <div class="res"><strong>Quem propôs:</strong> ${autoria}</div>
      ${l.m ? `<div class="lbl">Projeto: <a href="${SAPL}/materia/${l.m}" target="_blank" rel="noopener">${esc(l.mn)}</a>${l.dias != null ? ` · apresentado em ${dataBR(l.md)}, virou lei ${l.dias <= 0 ? "no mesmo dia" : `${nf(l.dias)} dias depois`}` : ""}</div>` : ""}</div>`;
  };
  const atualizar = () => {
    const toks = normBusca(document.getElementById("lq2").value).split(" ").filter(t => t.length >= 2 && !PARADA.has(t));
    const vid2 = +document.getElementById("lv2").value;
    const sel = L.itens.filter(l => (est.o === "todas" || l.o === est.o) && (est.t === "todos" || l.k === +est.t) && (!vid2 || l.v.includes(vid2)) && toks.every(t => l._n.includes(t))).slice().reverse();
    document.getElementById("ln2").textContent = `${nf(sel.length)} ${sel.length === 1 ? "lei" : "leis"}, da mais recente para a mais antiga.`;
    lista(document.getElementById("ll2"), document.getElementById("lmais2"), sel, desenha, 15);
  };
  chips(document.getElementById("lo2"), [["todas", `Todas (${nf(L.n)})`], ...["V", "E", "M"].filter(k => o[k]).map(k => [k, `${ORIGEM_NOME[k]} (${nf(o[k])})`])], {get v() { return est.o; }, set v(x) { est.o = x; }}, atualizar);
  document.getElementById("lt2").addEventListener("change", e => { est.t = e.target.value; atualizar(); });
  document.getElementById("lq2").addEventListener("input", atualizar);
  document.getElementById("lv2").addEventListener("change", atualizar);
  if (vid) { document.getElementById("lv2").value = String(vid); }
  atualizar();
}
