"use strict";
/* Peças visuais reutilizáveis: ícones, cartões de número, gráficos feitos com HTML e CSS (sem biblioteca). */
const CORES_G = ["#1D4ED8", "#0A8A8A", "#E8A100", "#6D3FC4", "#8A97A8"];
const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const ico = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const nfp = n => Number(n).toLocaleString("pt-BR");

function rotuloMes(chave, i, todos) {
  if (i % 3 !== 0) return "";
  const [a, m] = chave.split("-");
  return NOMES_MES[+m - 1] + (m === "01" || i === 0 ? "/" + a.slice(2) : "");
}
function mesLongo(chave) {
  const [a, m] = chave.split("-");
  return NOMES_MES[+m - 1] + "/" + a.slice(2);
}

/* barras empilhadas: series[i] = valores do mês i (um por grupo) */
function barrasEmpilhadas(series, meses, altura, aria, cores, fmt) {
  cores = cores || CORES_G; fmt = fmt || nfp;
  const max = Math.max(1, ...series.map(s => s.reduce((a, b) => a + b, 0)));
  const k = (altura - 4) / max;
  const cols = series.map((s, i) => {
    const total = s.reduce((a, b) => a + b, 0);
    const segs = s.map((v, g) => v ? `<div style="height:${(v * k).toFixed(1)}px;background:${cores[g]}"></div>` : "").join("");
    return `<div class="col" title="${mesLongo(meses[i])}: ${fmt(total)}"><div class="pilha">${segs}</div><span class="m">${rotuloMes(meses[i], i)}</span></div>`;
  }).join("");
  return `<div class="barras" style="height:${altura}px" role="img" aria-label="${esc(aria)}">${cols}</div><div class="barras-fim"></div>`;
}

/* barras simples (uma série) */
function barrasSimples(valores, meses, altura, cor, aria) {
  const max = Math.max(1, ...valores);
  const cols = valores.map((v, i) => `<div class="col" title="${mesLongo(meses[i])}: ${nfp(v)}"><div class="pilha"><div style="height:${(v / max * (altura - 4)).toFixed(1)}px;background:${cor}"></div></div><span class="m">${rotuloMes(meses[i], i)}</span></div>`).join("");
  return `<div class="barras" style="height:${altura}px" role="img" aria-label="${esc(aria)}">${cols}</div><div class="barras-fim"></div>`;
}

function legendaGrupos(nomes, valores) {
  return `<div class="legendas">${nomes.map((n, i) => `<span class="legrow"><span class="dot" style="background:${CORES_G[i]}"></span>${esc(n)}${valores ? ` <b class="num">${nfp(valores[i])}</b>` : ""}</span>`).join("")}</div>`;
}

/* rosca: partes = [{v, c}] */
function rosca(partes, centro, centroRot, tam, aria) {
  const tot = partes.reduce((a, p) => a + p.v, 0) || 1;
  let acc = 0;
  const trechos = partes.filter(p => p.v > 0).map(p => { const a = acc / tot * 100; acc += p.v; return `${p.c} ${a.toFixed(2)}% ${(acc / tot * 100).toFixed(2)}%`; }).join(", ");
  return `<div class="rosca" style="width:${tam}px;height:${tam}px;background:conic-gradient(${trechos})" role="img" aria-label="${esc(aria)}"><div><span class="num">${centro}</span><span class="lbl">${centroRot}</span></div></div>`;
}

function barrasH(itens, cor) {
  const max = Math.max(1, ...itens.map(i => i[1]));
  return `<div class="hb">${itens.map(([n, v]) => `<div class="l"><span class="nm">${esc(n)}</span><span class="tr"><i style="width:${(v / max * 100).toFixed(1)}%;background:${cor || "var(--blue)"}"></i></span><b>${nfp(v)}</b></div>`).join("")}</div>`;
}

function pilhaH(partes, aria) {
  const tot = partes.reduce((a, p) => a + p.v, 0) || 1;
  return `<div class="pilha-h" role="img" aria-label="${esc(aria)}">${partes.filter(p => p.v > 0).map(p => `<div style="width:${Math.max(p.v / tot * 100, 0.5).toFixed(2)}%;background:${p.c}"></div>`).join("")}</div>`;
}

function sparkline(arr, cor, aria, w = 120, h = 36) {
  const mx = Math.max(1, ...arr);
  const pts = arr.map((v, i) => (i * w / Math.max(1, arr.length - 1)).toFixed(1) + "," + (h - 3 - v / mx * (h - 6)).toFixed(1)).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(aria)}"><polyline points="${pts}" fill="none" stroke="${cor}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

/* cartão de número */
function kpi(o) {
  const viz = o.viz || o.spark || "";
  return `<div class="card kpi"><div class="topl"><div class="tile ${o.cor}">${ico(o.icone)}</div><div class="selos">${o.selos || ""}</div></div>
    <div class="v"><span>${o.num}${o.extra ? ` <small>${o.extra}</small>` : ""}</span></div>
    <div class="t">${o.rotulo}</div>${viz ? `<div class="kviz">${viz}</div>` : ""}
    ${o.nota ? `<details class="kpi-nota"><summary aria-label="Mais informações">${ico("info")}<span>Entenda</span></summary><div>${o.nota}</div></details>` : ""}</div>`;
}
/* legenda pequena sob o número: [["cor","texto"], ...] */
const miniLeg = itens => `<div class="mini-leg">${itens.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join("")}</div>`;
/* tira de sessões em miniatura: "1" presente, "0" sem presença */
function tiraMini(tira, primeira) {
  return `<div class="tira mini" role="img" aria-label="Uma marca por sessão com lista de presença">${tira.split("").map((c, i) => `<i class="${c === "1" ? "p" : (i < primeira || primeira < 0 ? "" : "f")}"></i>`).join("")}</div>`;
}

const iniciais = nome => nome.split(" ").filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join("").toUpperCase();

/* reais em forma curta: R$ 12,3 mi / R$ 8,9 bi */
function reaisCurto(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return "R$ " + (n / 1e9).toFixed(2).replace(".", ",") + " bi";
  if (a >= 1e6) return "R$ " + (n / 1e6).toFixed(1).replace(".", ",") + " mi";
  if (a >= 1e3) return "R$ " + Math.round(n / 1e3).toLocaleString("pt-BR") + " mil";
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}
