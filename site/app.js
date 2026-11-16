"use strict";
const SAPL = "https://sapl.campinas.sp.leg.br";
const API = SAPL + "/api";
const $app = document.getElementById("app");
let GERAL = null, VOTOS = null, GRAF = null;
const cachePropostas = {};
function relatorioPresenca() {
  const f = new Date(GERAL.meta.gerado_em + "T12:00:00"), d = String(f.getDate()).padStart(2, "0") + "/" + String(f.getMonth() + 1).padStart(2, "0") + "/" + f.getFullYear();
  return `${SAPL}/sistema/relatorios/presenca?legislatura=19&sessao_legislativa=112&data_inicio_0=01/01/2025&data_inicio_1=${d}&pesquisar=Pesquisar`;
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const dataBR = iso => iso ? iso.split("-").reverse().join("/") : "—";
const nf = n => Number(n).toLocaleString("pt-BR");
const ext = (href, txt) => `<a class="n" href="${esc(href)}" target="_blank" rel="noopener">${txt}</a>`;
const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}

async function iniciar() {
  try {
    [GERAL, GRAF] = await Promise.all([json("dados/geral.json"), json("dados/graficos.json")]);
    await Promise.all([carregarVerificacao(), carregarRecentes(), carregarAfast(), carregarAtualizacao()]);
    document.getElementById("rodape").innerHTML = rodape();
    document.getElementById("dataTopo").innerHTML = `Atualizado em <b>${quandoAtualizou()}</b>`;
    rotear();
  } catch (e) {
    $app.innerHTML = `<p>Não foi possível carregar os dados. Tente de novo em instantes.</p>`;
  }
}
window.addEventListener("hashchange", rotear);

let ATUAL = null;
async function carregarAtualizacao() { try { ATUAL = await json("dados/atualizacao.json"); } catch (e) { ATUAL = null; } }
/* "14/11/2026 às 03:12" (a hora só aparece quando a atualização automática registrou) */
function quandoAtualizou() {
  const em = ATUAL && ATUAL.em ? ATUAL.em : GERAL.meta.gerado_em;
  const dia = dataBR(em.slice(0, 10)), hora = em.length >= 16 ? em.slice(11, 16) : "";
  return hora ? `${dia} às ${hora}` : dia;
}
/* "há 2 horas" / "há 3 dias" / "hoje" */
function haQuanto() {
  const em = ATUAL && ATUAL.em ? ATUAL.em : null;
  if (!em) {
    const d = Math.round((new Date(new Date().toDateString()) - new Date(GERAL.meta.gerado_em + "T00:00:00")) / 864e5);
    return d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`;
  }
  const min = Math.max(0, Math.round((Date.now() - new Date(em).getTime()) / 6e4));
  if (min < 2) return "agora há pouco";
  if (min < 60) return `há ${min} minutos`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}
function linhaAoVivo() {
  const m = GERAL.meta, V = VERIF || {};
  const f = [`Câmara até a sessão de ${dataBR(m.ultima_sessao_com_lista)}`];
  if (V.gastos) f.push(`Gastos (TCE-SP) até ${mesLongo(V.gastos.ultimo)}`);
  if (V.licitacoes) f.push(`Licitações (PNCP) até ${dataBR(V.licitacoes.ultima)}`);
  const em = ATUAL && ATUAL.em ? ATUAL.em : m.gerado_em + "T00:00:00";
  const dias = Math.floor((Date.now() - new Date(em).getTime()) / 864e5);
  if (dias >= 3) {
    return `<p class="ao-vivo atrasado" role="status"><span class="pulso" aria-hidden="true"></span><b>Atenção: os dados não são atualizados há ${dias} dias</b> · última atualização ${quandoAtualizou()}. Algumas informações podem estar desatualizadas. <span class="suave">· ${f.join(" · ")}</span></p>`;
  }
  return `<p class="ao-vivo"><span class="pulso" aria-hidden="true"></span><b>Dados atualizados ${haQuanto()}</b> · ${quandoAtualizou()} <span class="suave">· ${f.join(" · ")}</span></p>`;
}

function rodape() {
  const m = GERAL.meta;
  return `${linhaAoVivo()}${botaoApoio()}<p>Dados oficiais da Câmara Municipal de Campinas (<a href="${SAPL}" target="_blank" rel="noopener">sapl.campinas.sp.leg.br</a>),
  copiados da API pública em ${dataBR(m.gerado_em)}. Presença conferida até a sessão de ${dataBR(m.ultima_sessao_com_lista)}.</p>
  <p>Este site não dá nota, não compara vereadores e não opina. Cada informação tem uma marca: <strong>Oficial</strong>, <strong>Calculado</strong>, <strong>Conferido</strong>,
  <strong>Estimativa</strong> ou <strong>Não confirmado</strong>. Os grupos de propostas, os tipos de pedido e a leitura de rua e bairro são regras nossas, não classificação oficial da Câmara.
  O texto de cada proposta (em letras maiúsculas) é copiado do registro oficial. <a href="#/transparencia">Veja a página Transparência</a>: fontes, conferências, o que não conseguimos confirmar e os erros nossos que já corrigimos.</p>
  <p class="suave">Logos dos partidos: Wikimedia Commons, arquivos marcados como domínio público.</p>
  <p class="rodape-links"><a href="#/privacidade">Privacidade e termos</a> · <a href="#/sobre">Entenda o site</a> · <a href="https://github.com/radarcampinas/radarcampinas/issues/new" target="_blank" rel="noopener" data-reportar>Reportar erro</a></p>`;
}

function marcarNav(rota) {
  document.querySelectorAll("#nav a").forEach(a => { if (a.dataset.r === rota) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
}

function rotear() {
  window.scrollTo(0, 0);
  atualizarLinkReportar();
  pararSalariometro();
  const m = location.hash.match(/^#\/v\/(\d+)/);
  if (m) { marcarNav("inicio"); return paginaVereador(+m[1]); }
  const b = location.hash.match(/^#\/busca\/(.+)/);
  if (b) { marcarNav("busca"); return paginaBusca(decodeURIComponent(b[1])); }
  if (location.hash === "#/repeticoes") { marcarNav("repeticoes"); return paginaRepeticoes(); }
  const le = location.hash.match(/^#\/leis(?:\/(\d+))?$/);
  if (le) { marcarNav("leis"); return paginaLeis(le[1] ? +le[1] : 0); }
  if (location.hash === "#/privacidade") { marcarNav("privacidade"); return paginaPrivacidade(); }
  if (location.hash === "#/sobre") { marcarNav("sobre"); return paginaSobre(); }
  if (location.hash === "#/gastos") { marcarNav("gastos"); return paginaGastos(); }
  const lc = location.hash.match(/^#\/licitacoes(?:\/(.+))?$/);
  if (lc) { marcarNav("licitacoes"); return paginaLicitacoes(lc[1] ? decodeURIComponent(lc[1]) : ""); }
  const gr = location.hash.match(/^#\/grupo\/(\d)$/);
  if (gr) { marcarNav("inicio"); return paginaGrupo(+gr[1]); }
  const t = location.hash.match(/^#\/transparencia(?:\/(.+))?$/);
  if (t) { marcarNav("transparencia"); return paginaTransparencia(t[1]); }
  marcarNav("inicio");
  paginaInicial();
}

/* ---------------- página inicial ---------------- */
function paginaInicial() {
  document.title = "Radar Campinas — o que fazem os vereadores";
  const m = GERAL.meta, g = GRAF;
  const totMes = g.prop_mes.map(s => s.reduce((a, b) => a + b, 0));
  const porGrupo = [0, 1, 2, 3, 4].map(i => g.prop_mes.reduce((a, s) => a + s[i], 0));
  const nomesG = m.grupos.map(x => x.nome);
  const totP = porGrupo.reduce((a, b) => a + b, 0);
  const vt = g.votos_totais, votosP = [["A favor", "F", "#1E8E4E"], ["Ausente", "X", "#8A97A8"], ["Contra", "C", "#C62828"], ["Presidiu a votação", "P", "#6D3FC4"], ["Se absteve", "A", "#E8A100"], ["Sem registro válido", "?", "#14213D"]];
  const nominais = m.total_votacoes_nominais, todas = m.total_votacoes_desde_inicio;
  $app.innerHTML = `
    <div class="topo-entenda"><p class="eyebrow" style="margin:0">Câmara Municipal de Campinas · 19ª legislatura</p><a class="btn-entenda" href="#/sobre">${ico("info")} Entenda o site em 1 minuto</a></div>
    ${legendaCompacta()}

    ${painelSalariometro()}

    <section class="hero hero-compacto">
      <div class="esq">
        <h1>O que cada vereador faz, com dados oficiais.</h1>
        <p class="lede">Presença, votos e propostas desde ${dataBR(m.inicio)}. Sem nota e sem opinião.</p>
        ${caixaBusca()}
      </div>
    </section>

    <section style="padding-top:8px">
      <div class="grade">
        ${kpi({icone: "users", cor: "c-azul", num: nf(GERAL.vereadores.length), rotulo: "mandatos na 19ª legislatura", selos: selo("oficial"),
          viz: miniLeg([["#14213D", `${nf(GERAL.vereadores.filter(v => v.ativo).length)} em exercício`], ["#8A97A8", `${nf(GERAL.vereadores.filter(v => !v.ativo).length)} fora do exercício`]]),
          nota: "Inclui suplentes e quem saiu. O cadastro não tem datas confiáveis de entrada e saída."})}
        ${kpi({icone: "cal", cor: "c-verde", num: nf(m.total_sessoes_com_lista), rotulo: "sessões com lista de presença", selos: selo("conferido", `presença: ${vf("presenca_relatorio", "iguais")} de ${vf("presenca_relatorio", "comparados")} iguais ao relatório da Câmara`),
          viz: sparkline(g.sessoes_mes, "#116B38", "Sessões com lista de presença por mês", 200, 44),
          nota: `de ${nf(m.sessoes_nao_solenes)} sessões que não são solenes. A presença bate ${vf("presenca_relatorio", "iguais")} a ${vf("presenca_relatorio", "comparados")} com o relatório da Câmara.`})}
        ${kpi({icone: "vote", cor: "c-roxo", num: nf(nominais), rotulo: "votações com o voto de cada vereador", selos: selo("naoconfirmado", "sem segunda fonte"),
          viz: pilhaH([{v: nominais, c: "#6D3FC4"}, {v: todas - nominais, c: "#DDE4EE"}], `${nominais} votações com voto individual de ${todas}`) + miniLeg([["#6D3FC4", `${nf(nominais)} com voto individual`], ["#DDE4EE", `${nf(todas - nominais)} sem`]]),
          nota: `de ${nf(todas)} votações desde ${dataBR(m.inicio)}. Nas demais, o sistema não guarda como cada um votou.`})}
        ${kpi({icone: "file", cor: "c-ambar", num: nf(g.total_propostas), rotulo: "propostas apresentadas", selos: selo("calculado") + selo("conferido", `autoria: ${vf("autoria", "iguais")} de ${vf("autoria", "comparados")} iguais à tabela oficial`),
          viz: sparkline(totMes, "#1D4ED8", "Propostas por mês", 200, 44),
          nota: `desde ${dataBR(m.inicio)}. A contagem por autor bate ${vf("autoria", "iguais")} a ${vf("autoria", "comparados")} com a tabela oficial de autoria.`})}
        <div id="leis-slot" style="display:contents"></div>
      </div>
    </section>

    ${blocoDinheiro()}

    ${secaoPropostasCidade()}

    <section style="padding-top:28px">
      <div class="grade">
        <div class="card" style="flex:7 1 520px">
          <div class="cabecalho"><h3>Propostas por mês</h3>${selo("estimativa", "grupos por regra nossa")}</div>
          ${barrasEmpilhadas(g.prop_mes, g.meses, 200, "Barras empilhadas com o número de propostas por mês e por grupo")}
          ${legendaGrupos(nomesG)}
        </div>
        <div class="card" style="flex:5 1 340px">
          <div class="cabecalho"><h3>O que mais se pede nos bairros</h3>${selo("estimativa")}</div>
          ${barrasH(g.categorias.slice(0, 8))}
        </div>
      </div>
      <div class="grade" style="margin-top:20px">
        <div class="card" style="flex:5 1 340px">
          <div class="cabecalho"><h3>Votos registrados</h3>${selo("naoconfirmado")}</div>
          ${pilhaH(votosP.map(x => ({v: vt[x[1]], c: x[2]})), "Barra com a divisão dos votos registrados por tipo")}
          <div class="leg" style="display:flex;flex-direction:column;gap:9px;margin-top:16px">${votosP.slice(0, 4).map(x => `<div class="legrow"><span class="dot" style="background:${x[2]}"></span><span class="nm">${x[0]}</span><b class="num">${nf(vt[x[1]])}</b></div>`).join("")}</div>
          <p style="margin:14px 0 0"><strong class="num" style="font-size:1.6rem">${g.unanimes ? Math.round(g.unanimes.todos_iguais / g.unanimes.votacoes * 100) : "?"} de cada 100</strong> votações: todos votaram igual ${selo("calculado", `${g.unanimes ? nf(g.unanimes.todos_iguais) : "?"} de ${g.unanimes ? nf(g.unanimes.votacoes) : "?"} votações com voto individual`)}</p>
        </div>
        <div id="bairros-slot" class="card" style="flex:7 1 520px"><h3>Bairros mais citados</h3><p class="carregando">Carregando…</p></div>
      </div>
      <div class="grade" style="margin-top:20px">${blocoRecentes()}</div>
    </section>

    <section style="padding:36px 0 16px">
      <div class="cabecalho"><h2>Vereadores</h2></div>
      <input type="search" class="simples" id="busca" placeholder="Buscar vereador pelo nome ou partido" aria-label="Buscar vereador pelo nome ou partido">
      <div class="filtros" id="fp" aria-label="Filtrar por partido"></div>
      <ul class="vgrid" id="lista"></ul>
    </section>`;
  ligarCaixaBusca();
  iniciarSalariometro();
  kpiLeisInicio();
  cartaoProblemaQueNaoSome();
  carregarLocais().then(l => { const s = document.getElementById("bairros-slot"); if (s) s.outerHTML = blocoBairros(l); });
  const lista = document.getElementById("lista");
  const estado = {partido: "todos", q: ""};
  const partidos = [...new Set(GERAL.vereadores.map(v => v.partido || "Sem partido"))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const desenhar = () => {
    const t = semAcento(estado.q.trim());
    lista.innerHTML = GERAL.vereadores
      .filter(v => (estado.partido === "todos" || (v.partido || "Sem partido") === estado.partido) && (!t || semAcento(v.nome + " " + v.nome_completo + " " + (v.partido || "")).includes(t)))
      .map(cartaoVereador)
      .join("") || `<li class="suave" style="padding:12px 0">Nenhum vereador encontrado.</li>`;
  };
  const opcoesP = [["todos", `Todos (${GERAL.vereadores.length})`], ...partidos.map(p => [p, `${p} (${GERAL.vereadores.filter(v => (v.partido || "Sem partido") === p).length})`, null, logoDe(p)])];
  chips(document.getElementById("fp"), opcoesP, {get v() { return estado.partido; }, set v(x) { estado.partido = x; }}, desenhar);
  desenhar();
  document.getElementById("busca").addEventListener("input", e => { estado.q = e.target.value; desenhar(); });
}

const LOGOS_PARTIDO = new Set(["cidad", "mdb", "pcdob", "pl", "pode", "pp", "psb", "psd", "psol", "pt", "repub", "uniao"]);
const logoDe = p => { const k = semAcento(p || "").replace(/\s/g, ""); return LOGOS_PARTIDO.has(k) ? `partidos/${k}.png` : null; };
const logoMini = p => { const u = logoDe(p); return u ? `<img class="bandeira-mini" src="${u}" alt="" width="16" height="16" loading="lazy" onerror="this.remove()">` : ""; };

function cartaoVereador(v) {
  const m = GERAL.meta, cargo = AFAST && AFAST.mesa.cargos[String(v.id)], gv = GRAF.por_vereador[String(v.id)];
  const pres = v.presenca.presente, tot = m.total_sessoes_com_lista, pr = v.propostas, vt = v.votos;
  const primeira = gv ? gv.tira.indexOf("1") : -1;
  const antes = gv ? (primeira < 0 ? gv.tira.length : primeira) : 0;
  const nomesG = m.grupos.map(x => x.nome.split(" ")[0]);
  const partes = pr.por_grupo.map((n, i) => ({v: n, c: CORES_G[i]}));
  const topo = pr.por_grupo.map((n, i) => [n, i]).sort((x, y) => y[0] - x[0])[0];
  return `<li><a class="vcard vc2" href="#/v/${v.id}">
    <span class="vc-topo">${foto(v, "")}<span><span class="nome">${esc(v.nome)}</span>
      <span class="sub">${logoMini(v.partido)}${esc(v.partido || "Partido não informado")} · ${v.ativo ? "Em exercício" : "Fora do exercício"}${cargo ? ` · ${esc(cargo)} da Mesa` : ""}</span></span></span>
    <span class="vc-pres"><span class="anel-pres" style="--p:${tot ? Math.min(100, pres / tot * 100).toFixed(1) : 0}%" aria-hidden="true"><b>${ico("cal")}</b></span>
      <span class="txt"><b class="num">${nf(pres)} de ${nf(tot)}</b> sessões<small>${antes > 0 ? `${nf(antes)} sessões antes da 1ª presença` : "presenças na lista oficial"}</small></span></span>
    <span class="vc-duas"><span><b class="num">${nf(pr.total)}</b><small>propostas</small></span><span><b class="num" style="color:${COR_VOTO.F}">${nf(vt.F)}</b><small>votos a favor</small></span><span><b class="num" style="color:${COR_VOTO.C}">${nf(vt.C)}</b><small>votos contra</small></span></span>
    ${pr.total ? `<span class="vc-prop">${pilhaH(partes, "Propostas por grupo")}<small>${topo[0] ? `Mais: ${esc(nomesG[topo[1]].toLowerCase())} (${nf(topo[0])})` : ""}</small></span>` : ""}
    <span class="vc-ver">Ver detalhes ›</span></a></li>`;
}

function foto(v, cls) {
  return v.foto ? `<img class="foto ${cls}" src="${esc(v.foto)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'foto ${cls}',textContent:'${esc(iniciais(v.nome))}'}))">` : `<span class="foto ${cls}">${esc(iniciais(v.nome))}</span>`;
}

/* ---------------- página do vereador ---------------- */
const ROTULO_VOTO = {F: "A favor", C: "Contra", A: "Se absteve", X: "Ausente", P: "Presidiu a votação", "?": "Sem registro válido"};
const COR_VOTO = {F: "#1E8E4E", C: "#C62828", X: "#8A97A8", A: "#E8A100", P: "#6D3FC4", "?": "#14213D"};
const FILTRO_VOTO = {F: "voto=Sim", C: "voto=N%C3%A3o", A: "voto=Absten%C3%A7%C3%A3o", X: "voto=Ausente", P: "voto=Presidente%20n%C3%A3o%20vota"};

async function paginaVereador(id) {
  const v = GERAL.vereadores.find(x => x.id === id);
  if (!v) { $app.innerHTML = `<p>Vereador não encontrado. <a href="#/">Voltar</a></p>`; return; }
  document.title = `${v.nome} — Radar Campinas`;
  $app.innerHTML = `<p class="carregando pag">Carregando…</p>`;
  if (!VOTOS) VOTOS = await json("dados/votos.json");
  const m = GERAL.meta, g = GRAF, gv = g.por_vereador[String(id)];
  const pres = v.presenca, vt = v.votos, pr = v.propostas;
  const votosDele = VOTOS.votos[id] || {};
  const nomesG = m.grupos.map(x => x.nome);

  const primeira = gv.tira.indexOf("1");
  const nPres = (gv.tira.match(/1/g) || []).length;
  const nFalta = gv.tira.slice(primeira < 0 ? gv.tira.length : primeira).split("").filter(c => c === "0").length;
  const nAntes = primeira < 0 ? gv.tira.length : primeira;
  const tira = gv.tira.split("").map((c, i) => `<i class="${c === "1" ? "p" : (i < primeira || primeira < 0 ? "" : "f")}"></i>`).join("");
  const mesesComSessao = g.meses.map((k, i) => ({k, i})).filter(x => gv.pres_mes[x.i][0] > 0);
  const maxS = Math.max(1, ...gv.pres_mes.map(x => x[0]));
  const presMes = `<div class="barras" style="height:170px" role="img" aria-label="Sessões com lista e sessões com presença, mês a mês">${mesesComSessao.map(({k, i}) => `<div class="col" title="${mesLongo(k)}: presente em ${gv.pres_mes[i][1]} de ${gv.pres_mes[i][0]}"><div class="dupla"><i style="height:${(gv.pres_mes[i][0] / maxS * 150).toFixed(1)}px;background:#D5DDE8"></i><i style="height:${(gv.pres_mes[i][1] / maxS * 150).toFixed(1)}px;background:#116B38"></i></div><span class="m">${mesLongo(k)}</span></div>`).join("")}</div><div class="barras-fim"></div>`;

  const votosK = ["F", "C", "X", "A", "P", "?"].filter(k => vt[k] || ["F", "C", "X", "A"].includes(k));
  const legVotos = votosK.map(k => `<div class="legrow"><span class="dot" style="background:${COR_VOTO[k]}"></span><span class="nm">${ROTULO_VOTO[k]}${k === "P" ? ' <span class="lbl">(o presidente não vota)</span>' : ""}</span><b class="num">${vt[k] ? `<a class="n" href="#lista-voto" data-voto="${k}" title="Ver essas votações na lista abaixo">${nf(vt[k])}</a>` : "0"}</b></div>`).join("");
  const pctF = vt.total ? Math.round(vt.F / vt.total * 100) : 0;
  const cargoMesa = AFAST && AFAST.mesa.cargos[String(id)];
  const evs = ((AFAST && AFAST.eventos[String(id)]) || []).slice().sort((a, b) => a.d.localeCompare(b.d));
  const cardAfast = evs.length ? `<div class="card" style="margin-top:20px">
      <div class="cabecalho"><h3>Situação do mandato</h3>${selos(selo("oficial", "texto do ato oficial"), selo("estimativa", "resumo em palavras simples"))}</div>
      ${evs.map(ev => `<div class="situacao"><span class="quando">${dataBR(ev.d)}</span><b>${esc(ev.r)}</b>
        <details class="mais-info" style="margin-top:2px"><summary>Ver o texto do ato</summary><div class="ementa" style="margin-top:6px">${esc(ev.e)}</div><div class="res">${ext(`${SAPL}/norma/${ev.n}`, esc(ev.nome) + " (abrir na Câmara)")}</div></details></div>`).join("")}
    </div>` : "";

  const vizPres = tiraMini(gv.tira, primeira);
  const vizVotos = pilhaH(votosK.map(k => ({v: vt[k], c: COR_VOTO[k]})), "Divisão dos votos por tipo") + miniLeg(votosK.filter(k => vt[k]).slice(0, 4).map(k => [COR_VOTO[k], `${nf(vt[k])} ${ROTULO_VOTO[k].toLowerCase()}`]));
  const vizProp = pilhaH(pr.por_grupo.map((n, i) => ({v: n, c: CORES_G[i]})), "Divisão das propostas por grupo") + miniLeg(pr.por_grupo.map((n, i) => n ? [CORES_G[i], `${nf(n)} ${nomesG[i].split(" ")[0].toLowerCase()}`] : null).filter(Boolean).slice(0, 4));

  $app.innerHTML = `
    <div class="cab-pessoa"><div class="in">
      <a class="voltar" href="#/">← Todos os vereadores</a>
      <div class="ficha">${foto(v, "grande")}<div class="txt">
        <h1 style="font-size:clamp(1.8rem,4vw,2.6rem)">${esc(v.nome)}</h1>
        <div style="margin-top:4px">${logoMini(v.partido)}<strong style="color:var(--ink)">${esc(v.partido || "Partido não informado")}</strong> · ${v.ativo ? "Em exercício" : "Fora do exercício"}${cargoMesa ? ` · <strong style="color:var(--ink)">${esc(cargoMesa)} da Mesa</strong>` : ""}</div>
        ${selos(selo("oficial", "nome, foto, partido e situação"), selo("conferido", `partido e situação: ${vf("partido", "iguais")} de ${vf("partido", "comparados")} iguais ao relatório oficial`))}
      </div>
      <a class="btn-sec" href="${SAPL}/parlamentar/${v.id}" target="_blank" rel="noopener">Página oficial ${ico("ext")}</a></div>
      ${v.ativo ? "" : `<div class="caixa" style="margin-bottom:0">Fora do exercício no cadastro oficial. ${evs.length ? "Veja “Situação do mandato” abaixo." : "Não achamos o motivo nos atos da Câmara."}</div>`}
    </div></div>

    <section class="pag">
      ${legendaCompacta()}
      <div class="grade" style="margin-top:14px">
        ${kpi({icone: "cal", cor: "c-verde", num: ext(relatorioPresenca(), nf(pres.presente)), extra: `de ${ext(`${SAPL}/sessao/pesquisar-sessao`, nf(m.total_sessoes_com_lista))} sessões`, rotulo: "presença nas sessões", selos: selo("calculado", "contagem de sessões") + selo("conferido", `${vf("presenca_relatorio", "iguais")} de ${vf("presenca_relatorio", "comparados")} iguais ao relatório oficial`), viz: vizPres,
          nota: "Cada quadradinho é uma sessão com lista de presença: verde = presente; vazio claro = antes da primeira presença registrada; contorno vermelho = sem presença registrada depois da primeira."})}
        ${kpi({icone: "vote", cor: "c-roxo", num: `<a class="n" href="#lista-voto" data-voto="todos" title="Ver as votações abaixo">${nf(vt.total)}</a>`, extra: "votos", rotulo: "registrados em votações com voto de cada vereador", selos: selo("calculado") + selo("naoconfirmado", "votos individuais sem segunda fonte"), viz: vizVotos})}
        ${kpi({icone: "file", cor: "c-ambar", num: `<a class="n" href="#grupos-prop" data-rolar="sec-propostas" title="Ir para as propostas">${nf(pr.total)}</a>`, extra: pr.total === 1 ? "proposta" : "propostas", rotulo: `como autor ou coautor desde ${dataBR(m.inicio)}`, selos: selo("calculado") + selo("conferido", `${vf("autoria", "iguais")} de ${vf("autoria", "comparados")} iguais à tabela oficial de autoria`), viz: vizProp})}
        <div id="leis-v" style="display:contents"></div>
        ${VERIF && VERIF.salario ? kpi({icone: "cash", cor: "c-verde", num: ext(VERIF.salario.norma.pagina, BRL(VERIF.salario.valor_mensal).replace(",00", "")), extra: "por mês", rotulo: "salário bruto (subsídio)", selos: selo("oficial", "Resolução nº 1.000/2023"), nota: "Igual para todos os vereadores, fixado em lei para 2025–2028. Valor bruto, antes de descontos."}) : ""}
      </div>
      ${cardAfast}

      <details class="secao" id="sec-presenca">
        <summary><span class="tile c-verde">${ico("cal")}</span><span class="st"><b>Presença nas sessões</b><small>Linha do tempo, mês a mês e como o número é calculado</small></span></summary>
        <div class="secao-corpo">
          <div class="cabecalho"><h3>Linha do tempo das sessões</h3>${selos(selo("calculado"), selo("conferido", `${vf("presenca_relatorio", "iguais")} de ${vf("presenca_relatorio", "comparados")} iguais ao relatório`))}</div>
          <div class="tira" role="img" aria-label="${gv.tira.length} quadrados, um por sessão: ${nPres} com presença, ${nFalta} sem presença depois da primeira e ${nAntes} antes da primeira presença registrada">${tira}</div>
          <div class="legendas">
            <span class="legrow"><span class="dot" style="background:#116B38"></span>Presente (${nPres})</span>
            <span class="legrow"><span class="dot" style="background:#fff;border:2px solid #9B1C1C"></span>Sem presença depois da primeira (${nFalta})</span>
            <span class="legrow"><span class="dot" style="background:#E8EDF4"></span>Antes da primeira presença (${nAntes})</span>
          </div>
          <h3 style="margin-top:24px">Mês a mês</h3>
          ${presMes}
          <details class="mais-info"><summary>Como esse número é calculado</summary>
            <p>É o número de sessões em que o nome aparece na lista de presença, entre ${dataBR(m.inicio)} e ${dataBR(m.ultima_sessao_com_lista)}. As sessões solenes não têm lista, e ${nf(m.sessoes_nao_solenes - m.total_sessoes_com_lista)} sessões não solenes também ficaram sem lista no sistema.
            O relatório oficial da Câmara usa essas ${nf(m.sessoes_nao_solenes)} sessões como base; o número de presenças dele é igual ao nosso.</p>
            <p class="suave">Não mostramos porcentagem: o cadastro oficial não informa com precisão quando cada pessoa assumiu ou saiu. O número grande leva ao relatório oficial “Presença nas sessões”.
            Em ${vf("atas", "amostra")} atas em PDF sorteadas, ${vf("atas", "iguais")} tinham lista idêntica à do sistema e ${VERIF ? nf(VERIF.atas.diferentes.length) : "?"} diferiam; as duas fontes saem do mesmo sistema da Câmara. <a href="#/transparencia/i-presenca">Detalhes</a></p>
          </details>
        </div>
      </details>

      <details class="secao" id="sec-votos">
        <summary><span class="tile c-roxo">${ico("vote")}</span><span class="st"><b>Como votou</b><small>Divisão dos votos e votação por votação</small></span></summary>
        <div class="secao-corpo">
          <div class="cabecalho"><h3>Nas ${nf(vt.total)} votações com registro</h3>${selos(selo("oficial", "cada voto e resultado"), selo("naoconfirmado", "votos individuais"))}</div>
          <div class="rosca-w">
            ${rosca(votosK.map(k => ({v: vt[k], c: COR_VOTO[k]})), `${pctF}%`, "a favor", 140, `Rosca com a divisão dos votos de ${v.nome}`)}
            <div class="leg">${legVotos}</div>
          </div>
          <h3 style="margin-top:26px">Votação por votação</h3>
          <div class="filtros" id="filtros-voto"></div>
          <div id="lista-voto"></div>
          <button class="mais" id="mais-voto" hidden>Mostrar mais</button>
          <details class="mais-info"><summary>Por que só ${nf(m.total_votacoes_nominais)} votações?</summary>
            <p>Desde ${dataBR(m.inicio)} a Câmara fez ${nf(m.total_votacoes_desde_inicio)} votações. Só em ${nf(m.total_votacoes_nominais)} o voto de cada vereador foi registrado. Nas outras, o sistema não guarda como cada um votou: provavelmente são votações simbólicas, mas o sistema não explica.
            Em ${VERIF ? nf(VERIF.votos.resumo_diverge) : "?"} votações com voto individual, a soma dos votos é diferente do total oficial. <a href="#/transparencia/i-votos">Detalhes</a></p>
          </details>
        </div>
      </details>

      <details class="secao" id="sec-propostas">
        <summary><span class="tile c-ambar">${ico("file")}</span><span class="st"><b>Propostas apresentadas</b><small>Por mês, por grupo e a leitura de cada uma</small></span></summary>
        <div class="secao-corpo">
          <div class="secao-quad">
            <div style="flex:7 1 460px"><div class="cabecalho"><h3>Por mês</h3>${selo("estimativa", "grupos por regra nossa")}</div>
              ${barrasEmpilhadas(gv.prop_mes, g.meses, 170, "Barras empilhadas de propostas por mês e por grupo")}</div>
            <div style="flex:5 1 300px"><div class="cabecalho"><h3>Por grupo</h3>${selo("estimativa")}</div>
              ${pilhaH(pr.por_grupo.map((n, i) => ({v: n, c: CORES_G[i]})), "Divisão das propostas por grupo")}
              <div style="display:flex;flex-direction:column;gap:9px;margin-top:16px">${nomesG.map((n, i) => `<div class="legrow"><span class="dot" style="background:${CORES_G[i]}"></span><span class="nm">${esc(n)}</span><b class="num">${nf(pr.por_grupo[i])}</b></div>`).join("")}</div></div>
          </div>
          <h3 style="margin-top:26px">Leia as propostas, grupo por grupo</h3>
          <div id="grupos-prop"></div>
          <details class="mais-info"><summary>Como agrupamos e o que fica de fora</summary>
            ${textoRegra()}
            <p class="suave">Aqui entram só os tipos mais comuns de proposta. Ofícios, atas e documentos administrativos ficam de fora.</p>
            <p class="suave">Os votos e as propostas vêm da API pública da Câmara. Cada votação e cada proposta da lista tem o link para a página oficial dela.</p>
          </details>
        </div>
      </details>
    </section>`;

  kpiLeisVereador(id);
  montarVotos(v, votosDele);
  montarPropostas(v);
  const abre = idSec => { const d = document.getElementById(idSec); if (d) d.open = true; return d; };
  document.querySelectorAll("a[data-voto]").forEach(l => l.addEventListener("click", e => {
    e.preventDefault();
    const sec = abre("sec-votos");
    const b = document.querySelector(`#filtros-voto button[data-k="${l.dataset.voto}"]`);
    if (b) b.click();
    if (sec) sec.scrollIntoView({behavior: "smooth", block: "start"});
  }));
  document.querySelectorAll("a[data-rolar]").forEach(l => l.addEventListener("click", e => { e.preventDefault(); const sec = abre(l.dataset.rolar); if (sec) sec.scrollIntoView({behavior: "smooth", block: "start"}); }));
}

function lista(el, botao, itens, desenhar, passo = 15) {
  let n = passo;
  const render = () => {
    el.innerHTML = itens.slice(0, n).map(desenhar).join("") || `<p class="suave">Nada a mostrar.</p>`;
    botao.hidden = n >= itens.length;
    botao.textContent = `Mostrar mais (${nf(itens.length - n)} restantes)`;
  };
  botao.onclick = () => { n += passo; render(); };
  render();
}

function chips(el, opcoes, atual, aoMudar) {
  const desenhar = () => {
    el.innerHTML = opcoes.map(([k, t, cor, img]) => `<button aria-pressed="${k === atual.v}" data-k="${esc(k)}"${cor ? ` class="cv" style="--c:${cor}"` : ""}>${img ? `<img class="bandeira" src="${esc(img)}" alt="" width="20" height="20" loading="lazy" onerror="this.remove()">` : ""}${esc(t)}</button>`).join("");
    el.querySelectorAll("button").forEach(b => b.onclick = () => { atual.v = b.dataset.k; desenhar(); aoMudar(); });
  };
  desenhar();
}

function montarVotos(v, votosDele) {
  const todos = VOTOS.votacoes.filter(x => votosDele[x.id] !== undefined).map(x => ({...x, voto: votosDele[x.id]}));
  const atual = {v: "todos"};
  const contagem = k => todos.filter(x => x.voto === k).length;
  const opcoes = [["todos", `Todas (${nf(todos.length)})`], ...["F", "C", "A", "X", "P", "?"].filter(k => contagem(k)).map(k => [k, `${ROTULO_VOTO[k]} (${nf(contagem(k))})`, COR_VOTO[k]])];
  const el = document.getElementById("lista-voto"), btn = document.getElementById("mais-voto");
  const desenhar = x => {
    const r = semAcento(x.r || ""), aprov = r.includes("aprovad"), rejeit = r.includes("rejeitad");
    const ao = !aprov && !rejeit ? "" : ((x.voto === "F" && aprov) || (x.voto === "C" && rejeit)) ? "com o resultado" : ((x.voto === "F" && rejeit) || (x.voto === "C" && aprov)) ? "contra o resultado" : "";
    const tot = x.s + x.c + x.a;
    const barra = tot ? `<div class="pilha-h mini-pilha" role="img" aria-label="${x.s} a favor, ${x.c} contra, ${x.a} abstenções"><i style="width:${x.s / tot * 100}%;background:${COR_VOTO.F}"></i><i style="width:${x.c / tot * 100}%;background:${COR_VOTO.C}"></i><i style="width:${x.a / tot * 100}%;background:${COR_VOTO.A}"></i></div>` : "";
    return `<div class="item voto-${x.voto}"><div class="cab">${dataBR(x.d)} · ${esc(x.r || "resultado não informado")}</div>
    <div class="tit"><a href="${SAPL}/materia/${x.m}" target="_blank" rel="noopener">${esc(x.n)}</a></div>
    <div class="res"><span class="voto-tag v-${x.voto}">${ROTULO_VOTO[x.voto]}</span>${ao ? ` <span class="suave">· votou ${ao}</span>` : ""}</div>
    ${barra}<div class="lbl">${nf(x.s)} a favor · ${nf(x.c)} contra · ${nf(x.a)} abstenções</div>
    ${x.e ? `<details class="mais-info" style="margin-top:6px"><summary>Ver do que se trata</summary><div class="ementa" style="margin-top:6px">${esc(x.e.length > 400 ? x.e.slice(0, 400) + "…" : x.e)}</div></details>` : ""}</div>`;
  };
  const atualizar = () => lista(el, btn, atual.v === "todos" ? todos : todos.filter(x => x.voto === atual.v), desenhar);
  if (!todos.length) { el.innerHTML = `<p class="suave">Nenhuma votação com voto registrado para esta pessoa.</p>`; document.getElementById("filtros-voto").remove(); return; }
  chips(document.getElementById("filtros-voto"), opcoes, atual, atualizar);
  atualizar();
}

function textoRegra() {
  const m = GERAL.meta;
  return `<p>A mesma regra vale para <strong>todos os vereadores</strong>. Um programa olha só duas coisas do registro oficial:
  o <strong>tipo</strong> do documento e as <strong>primeiras palavras do texto oficial</strong>. Não olha quem é o autor, o partido nem o bairro.
  A primeira regra da lista que combinar decide o grupo.</p>
  <ol>${m.regras.map(r => `<li>${esc(r.t)} <span class="suave">→ ${esc(m.grupos[r.g].nome)}</span></li>`).join("")}</ol>
  <p class="suave">Uma máquina lendo texto erra às vezes. Por isso, em cada proposta aparece a regra que a colocou no grupo, e o link leva ao texto oficial completo.
  Exemplo de limite: abaixo-assinados enviados por moradores ficam em “Outros”, mesmo quando pedem uma obra.</p>`;
}

async function montarPropostas(v) {
  const pr = v.propostas, grupos = GERAL.meta.grupos, regras = GERAL.meta.regras;
  const alvo = document.getElementById("grupos-prop");
  if (!pr.total) { alvo.innerHTML = `<p>Nenhuma proposta desses tipos encontrada desde ${dataBR(GERAL.meta.inicio)}.</p>`; return; }
  alvo.innerHTML = grupos.map((g, gi) => `<details class="grupo" data-g="${gi}"><summary><span class="dot" style="background:${CORES_G[gi]}"></span><span>${esc(g.nome)}</span><span class="gn">${nf(pr.por_grupo[gi])}</span></summary>
    <div class="grupo-corpo">${selos(selo("estimativa", "este grupo é definido por uma regra nossa"))}<p class="suave">${esc(g.desc)}</p>
    <p><strong>${nf(pr.por_grupo[gi])}</strong> ${pr.por_grupo[gi] === 1 ? "proposta" : "propostas"} neste grupo.</p>
    <div class="filtros"></div><div class="lista-g"></div><button class="mais" hidden>Mostrar mais</button></div></details>`).join("");
  alvo.querySelectorAll("details.grupo").forEach(det => {
    const gi = +det.dataset.g;
    if (!pr.por_grupo[gi]) return;
    det.addEventListener("toggle", async () => {
      if (!det.open || det.dataset.pronto) return;
      det.dataset.pronto = "1";
      if (!cachePropostas[v.id]) cachePropostas[v.id] = await json(`dados/p/${v.id}.json`);
      const itens = cachePropostas[v.id].filter(x => x.g === gi);
      const tiposG = [...new Set(itens.map(x => x.t))];
      const atual = {v: "todos"};
      const opcoes = [["todos", `Todas (${nf(itens.length)})`], ...tiposG.map(t => [t, `${t} (${nf(itens.filter(x => x.t === t).length)})`])];
      const el = det.querySelector(".lista-g"), btn = det.querySelector(".mais"), fil = det.querySelector(".filtros");
      const desenhar = x => `<div class="item"><div class="cab">${dataBR(x.d)} · ${esc(x.t)}${x.co > 1 ? ` · com mais ${x.co - 1} autor${x.co > 2 ? "es" : ""}` : ""}</div>
        <div class="tit"><a href="${SAPL}/materia/${x.i}" target="_blank" rel="noopener">${esc(x.n)}</a></div>
        ${x.e ? `<div class="ementa">${esc(x.e.length > 400 ? x.e.slice(0, 400) + "…" : x.e)}</div>` : ""}
        <div class="suave">Por que está aqui: ${esc(regras[x.r].t)}</div></div>`;
      const atualizar = () => lista(el, btn, atual.v === "todos" ? itens : itens.filter(x => x.t === atual.v), desenhar);
      if (tiposG.length > 1) chips(fil, opcoes, atual, atualizar); else fil.remove();
      atualizar();
    });
  });
}

iniciar();
