"use strict";
/* Botão discreto "Apoie no Apoia.se" (rodapé). O pagamento acontece no Apoia.se: o site não guarda nem mostra dados de quem apoia nem de quem recebe. */

function botaoApoio() {
  const u = ((window.APOIO || {}).apoiaSeUrl || "").trim();
  if (!/^https:\/\/(www\.)?apoia\.se\/[\w-]+/i.test(u)) return "";
  return `<p class="apoio"><a class="apoio-btn" href="${esc(u)}" target="_blank" rel="noopener">${ico("heart")} Apoie no Apoia.se</a></p>`;
}
