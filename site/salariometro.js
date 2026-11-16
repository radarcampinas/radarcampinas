"use strict";
/* Salariômetro: estimativa de quanto já foi pago em subsídios aos vereadores desde a posse, atualizada a cada segundo.
   Valor mensal: Resolução nº 1.000/2023 (oficial). Número de cadeiras e período: ver dados/verificacao.json (campo "salario"). */
let TIMER_SALARIO = null;
const BRL = n => n.toLocaleString("pt-BR", {style: "currency", currency: "BRL"});
const DESLOC = 3 * 3600e3; // Campinas: UTC-3 (sem horário de verão)

/* Devolve o total estimado em reais e quanto entra por segundo, em "agora". */
function salarioEm(agora, s) {
  const [a0, m0] = s.inicio.split("-").map(Number);
  const t = new Date(agora.getTime() - DESLOC);
  const ca = t.getUTCFullYear(), cm = t.getUTCMonth() + 1;
  const mesesCheios = (ca - a0) * 12 + (cm - m0);
  const ini = Date.UTC(ca, cm - 1, 1), fim = Date.UTC(ca, cm, 1);
  const fracao = (t.getTime() - ini) / (fim - ini);
  const porMes = s.valor_mensal * s.cadeiras;
  return {total: porMes * (mesesCheios + fracao), porSegundo: porMes / ((fim - ini) / 1000), porMes, mesesCheios, fracao};
}

function painelSalariometro() {
  const s = VERIF && VERIF.salario;
  if (!s) return "";
  const x = salarioEm(new Date(), s);
  return `<section class="salario" aria-labelledby="sal-titulo">
    <div class="sal-topo"><span class="sal-eyebrow">${ico("cash")} Salariômetro</span>
      <span class="sal-selos">${selo("oficial", `${BRL(s.valor_mensal).replace(",00", "")} por mês`)}${selo("estimativa", "total e cadeiras")}</span></div>
    <h2 id="sal-titulo">Salário pago aos ${nf(s.cadeiras)} vereadores desde a posse</h2>
    <div class="sal-valor" id="sal-total" role="img" aria-label="Cerca de ${(x.total / 1e6).toFixed(1).replace(".", ",")} milhões de reais, e subindo">${BRL(x.total)}</div>
    <p class="sal-sub">e subindo agora · estimativa: ${nf(s.cadeiras)} salários de ${BRL(s.valor_mensal).replace(",00", "")} por mês desde ${dataBR(s.inicio)}</p>
    <div class="sal-taxas">
      <div><b id="sal-seg">${BRL(x.porSegundo)}</b><span>por segundo</span></div>
      <div><b id="sal-hora">${BRL(x.porSegundo * 3600)}</b><span>por hora</span></div>
      <div><b id="sal-dia">${BRL(x.porSegundo * 86400)}</b><span>por dia</span></div>
      <div><b id="sal-mes">${BRL(x.porMes)}</b><span>por mês, todos os vereadores</span></div>
    </div>
    <details class="sal-como"><summary>Como esse número é calculado</summary>
      <p><strong>O valor de cada salário é oficial:</strong> a <a href="${esc(s.norma.pagina)}" target="_blank" rel="noopener">${esc(s.norma.nome)}</a> fixou o subsídio em ${BRL(s.valor_mensal)} por mês para a legislatura 2025–2028, igual para todos, a partir de 01/01/2025.
      Não encontramos, no sistema da Câmara, nenhuma revisão desse valor depois dela.</p>
      <p><strong>O total é uma estimativa nossa:</strong> ${nf(s.cadeiras)} salários por mês, contados em proporção ao tempo que passou desde a posse. É o valor <em>bruto</em>, antes de descontos.
      Não inclui o 13º subsídio nem as férias com adicional de 1/3 (<a href="${esc(s.extras.pagina)}" target="_blank" rel="noopener">${esc(s.extras.nome)}</a>), nem verba de gabinete ou outros pagamentos.</p>
      <p><strong>O número de cadeiras (${nf(s.cadeiras)}) é dedução nossa:</strong> não achamos uma norma que o diga, mas ${nf(s.votacoes_com_cadeiras)} das ${nf(s.votacoes_total)} votações com voto individual registram exatamente ${nf(s.cadeiras)} vereadores.
      Quando um suplente assume, a conta continua com ${nf(s.cadeiras)} salários: uma cadeira, um salário.</p>
      <p class="suave">Isto não diz se o salário é justo ou injusto. É só o custo registrado em lei. <a href="#/transparencia/i-salario">Ver na página Transparência</a></p>
    </details>
  </section>`;
}

function iniciarSalariometro() {
  pararSalariometro();
  const s = VERIF && VERIF.salario;
  if (!s || !document.getElementById("sal-total")) return;
  const pinta = () => {
    const x = salarioEm(new Date(), s);
    const el = document.getElementById("sal-total");
    if (!el) { pararSalariometro(); return; }
    el.textContent = BRL(x.total);
    document.getElementById("sal-seg").textContent = BRL(x.porSegundo);
    document.getElementById("sal-hora").textContent = BRL(x.porSegundo * 3600);
    document.getElementById("sal-dia").textContent = BRL(x.porSegundo * 86400);
    document.getElementById("sal-mes").textContent = BRL(x.porMes);
  };
  const espera = 1000 - (Date.now() % 1000); // alinha com a virada do segundo
  TIMER_SALARIO = setTimeout(() => { pinta(); TIMER_SALARIO = setInterval(pinta, 1000); }, espera);
}
function pararSalariometro() {
  if (TIMER_SALARIO) { clearTimeout(TIMER_SALARIO); clearInterval(TIMER_SALARIO); TIMER_SALARIO = null; }
}
