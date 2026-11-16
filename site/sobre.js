"use strict";
/* Página "Sobre": explica em linguagem simples o que é o site, de onde vêm os dados e como ler as marcas. */
function paginaSobre() {
  document.title = "Entenda o site — Radar Campinas";
  const m = GERAL.meta;
  const passo = (n, titulo, txt) => `<li><span class="passo-n">${n}</span><div><b>${titulo}</b><p>${txt}</p></div></li>`;
  const recurso = (icone, cor, titulo, txt, href) => `<a class="card recurso" href="${href}"><span class="tile ${cor}">${ico(icone)}</span><b>${titulo}</b><span>${txt}</span><span class="gver">Abrir ${ico("chev")}</span></a>`;
  $app.innerHTML = `<div class="pag sobre">
    <a class="voltar" href="#/">← Início</a>
    <p class="eyebrow">Entenda o site</p>
    <h1>O que é o Radar Campinas</h1>
    <p class="lede-sobre">Um jeito fácil de ver o que acontece na Câmara de Campinas e nas contas da cidade. Pegamos os dados que os próprios órgãos públicos publicam e organizamos para qualquer pessoa entender, sem precisar saber como funciona a política.</p>

    <h2>Em 3 passos</h2>
    <ol class="passos">
      ${passo(1, "Buscamos os dados oficiais", "Copiamos o que a Câmara Municipal, o Tribunal de Contas (TCE-SP) e o Portal Nacional de Contratações (PNCP) já publicam. Nada é inventado, e não usamos redes sociais nem notícias.")}
      ${passo(2, "Organizamos em palavras simples", "Juntamos presença, votos e propostas de cada vereador, separamos as propostas em grupos fáceis de entender (como pedidos de melhoria e homenagens) e cruzamos os pedidos de cada rua.")}
      ${passo(3, "Mostramos de onde veio cada número", "Em cada informação há uma marca que diz se ela é oficial, se foi calculada por nós ou se é uma estimativa. As propostas, votações e leis têm link para a página oficial.")}
    </ol>

    <h2>O que você encontra aqui</h2>
    <div class="grade recursos">
      ${recurso("users", "c-azul", "Vereadores", "Presença nas sessões, como votou e as propostas de cada um dos 38.", "#/")}
      ${recurso("lei", "c-azul", "O que virou lei", "As leis sancionadas e quem apresentou cada projeto.", "#/leis")}
      ${recurso("warn", "c-ambar", "Pedidos repetidos", "Quando o mesmo pedido volta várias vezes para a mesma rua.", "#/repeticoes")}
      ${recurso("cash", "c-verde", "Gastos", "Quanto a Prefeitura pagou e a quem.", "#/gastos")}
      ${recurso("file", "c-verde", "Licitações", "Compras e contratos da Prefeitura.", "#/licitacoes")}
    </div>
    <p class="suave" style="margin-top:12px">Na página inicial você também pode digitar o nome de uma rua ou bairro e ver tudo o que foi pedido para lá, e acompanhar o salariômetro dos vereadores.</p>

    <h2>O que o site não faz</h2>
    <ul class="nao-faz">
      <li><b>Não dá nota nem opina.</b> Não dizemos quem é bom ou ruim. Mostramos os dados e você tira suas conclusões.</li>
      <li><b>Não prova irregularidade.</b> Um pedido repetido, uma licitação ou um gasto alto não significam, sozinhos, que algo está errado.</li>
      <li><b>Não é um site oficial.</b> É uma leitura dos dados públicos. Para o texto completo, use sempre o link para a fonte oficial.</li>
    </ul>

    <h2>Como ler as marcas</h2>
    <p class="suave">Cada informação tem um ícone redondo. Passe o mouse ou toque nele para ler o significado.</p>
    <ul class="marcas">${Object.keys(SELOS).map(k => `<li>${selo(k)}<span><b>${SELOS[k].nome}</b>${SELOS[k].curto}</span></li>`).join("")}</ul>

    <h2>Perguntas rápidas</h2>
    <details class="mais-info"><summary>Os dados estão atualizados?</summary><p>Os dados foram copiados em ${dataBR(m.gerado_em)}. A presença vai até a sessão de ${dataBR(m.ultima_sessao_com_lista)}. Quando os órgãos publicam novidades, nossa cópia fica atrás até a próxima atualização.</p></details>
    <details class="mais-info"><summary>Posso confiar nos números?</summary><p>Comparamos o que calculamos com outras fontes oficiais sempre que existe uma (por exemplo, a presença com o relatório da Câmara). O que não deu para conferir fica marcado como “não confirmado”. A página <a href="#/transparencia">Transparência</a> mostra o que bate, o que não bate e os erros nossos que já corrigimos.</p></details>
    <details class="mais-info"><summary>Por que alguns vereadores têm poucas presenças?</summary><p>Alguns assumiram como suplentes no meio do mandato ou saíram. O cadastro da Câmara não informa as datas com precisão, por isso não calculamos porcentagem e avisamos quando a pessoa só aparece nas listas a partir de certo momento.</p></details>
    <details class="mais-info"><summary>Quero ler o documento original. Como faço?</summary><p>Toque no título de uma proposta, de uma votação ou de uma lei: o link abre a página oficial dela no site da Câmara. Compras e contratos abrem no PNCP, e os pagamentos têm link para o portal do TCE-SP.</p></details>

    <details class="mais-info"><summary>Encontrei um erro. O que faço?</summary><p>Use o link <b>Reportar erro</b> no rodapé: ele abre um formulário já com a página preenchida. Veja também a página <a href="#/privacidade">Privacidade e termos</a>.</p></details>

    <p style="margin-top:28px"><a class="btn-sec" href="#/">Ver os vereadores ${ico("chev")}</a></p>
  </div>`;
}
