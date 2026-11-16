"use strict";
/* Página "Privacidade e termos" e o link "Reportar erro" (leva às Issues do GitHub com a página atual já preenchida). */
const REPO_ISSUES = "https://github.com/radarcampinas/radarcampinas/issues/new";

function urlReportarErro() {
  const pagina = location.href;
  const corpo = `**Página onde vi o erro:** ${pagina}\n\n**O que está errado:**\n\n\n**Qual seria o certo / onde posso conferir (link oficial):**\n\n\n_Não escreva dados pessoais (CPF, telefone, endereço) neste formulário: ele é público._`;
  return `${REPO_ISSUES}?template=erro-nos-dados.md&title=${encodeURIComponent("Erro nos dados: ")}&body=${encodeURIComponent(corpo)}`;
}

/* mantém o link do rodapé apontando para a página em que a pessoa está */
function atualizarLinkReportar() {
  document.querySelectorAll("a[data-reportar]").forEach(a => { a.href = urlReportarErro(); });
}

/* ---- medição de visitas (só se SITE.goatcounter estiver preenchido) ---- */
function medirPagina() {
  if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({path: location.pathname + location.hash});
}
function iniciarMedicao() {
  const cod = ((window.SITE || {}).goatcounter || "").trim();
  if (!/^[a-z0-9-]{2,40}$/i.test(cod) || document.getElementById("gc-script")) return;
  window.goatcounter = {no_onload: true, allow_local: false};
  const s = document.createElement("script");
  s.id = "gc-script"; s.async = true; s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = `https://${cod}.goatcounter.com/count`;
  s.onload = medirPagina;
  document.head.appendChild(s);
}
const emailContato = () => { const e = ((window.SITE || {}).contatoEmail || "").trim(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : ""; };
const temMedicao = () => /^[a-z0-9-]{2,40}$/i.test(((window.SITE || {}).goatcounter || "").trim());

function paginaPrivacidade() {
  document.title = "Privacidade e termos — Radar Campinas";
  $app.innerHTML = `<div class="pag sobre">
    <a class="voltar" href="#/">← Início</a>
    <p class="eyebrow">Privacidade e termos</p>
    <h1>Privacidade e termos de uso</h1>
    <p class="lede-sobre">Em resumo: o site não pede cadastro, não usa cookies e não guarda dados de quem o visita. Mostramos só informações públicas.</p>

    <h2>O que o site coleta</h2>
    <ul class="nao-faz">
      <li><b>Nada seu.</b> Não há cadastro, login, formulário nem cookies do site. ${temMedicao() ? 'Contamos quantas pessoas visitam cada página com o <b>GoatCounter</b>, uma ferramenta que não usa cookies e foi feita para não identificar quem visita (só contagens, como página, país e tipo de aparelho).' : 'Não medimos visitas com ferramentas de rastreamento.'}</li>
      <li><b>Servidores de terceiros veem o seu acesso.</b> Como qualquer site, o endereço de internet (IP) de quem acessa pode ser registrado por quem entrega os arquivos: o <b>GitHub</b> (onde o site está hospedado), o <b>Google Fonts</b> (que entrega a fonte das letras), o site da <b>Câmara Municipal</b> (de onde vêm as fotos dos vereadores)${temMedicao() ? ' e o <b>GoatCounter</b> (contagem de visitas)' : ''}. Cada um tem a sua própria política de privacidade.</li>
      <li><b>Links para fora.</b> Ao clicar em um link para a Câmara, o TCE-SP, o PNCP ou o Apoia.se, você sai deste site e passa a valer a política do site de destino.</li>
    </ul>

    <h2>Que informações aparecem aqui</h2>
    <ul class="nao-faz">
      <li><b>Só dados públicos</b> de órgãos oficiais: Câmara Municipal de Campinas, Tribunal de Contas do Estado de São Paulo (TCE-SP) e Portal Nacional de Contratações Públicas (PNCP).</li>
      <li><b>Não mostramos</b> CPF, RG, endereço de residência, telefone, e-mail nem data de nascimento. Antes de cada atualização, um programa confere o site inteiro procurando esse tipo de dado, e a atualização não é publicada se achar algum.</li>
      <li><b>Pessoas físicas</b> que recebem pagamentos públicos aparecem somadas, sem nome. Empresas aparecem com o nome registrado no CNPJ.</li>
      <li>Os textos oficiais das propostas são copiados como estão no registro da Câmara. Eles podem citar nomes e ruas, porque é assim que o documento original foi publicado.</li>
    </ul>

    <h2>Quer corrigir ou tirar algo?</h2>
    <p>Se encontrar um erro, ou se alguma informação sua aparecer aqui e você achar que não devia, use o botão <a href="${urlReportarErro()}" target="_blank" rel="noopener" data-reportar>Reportar erro</a>. Ele abre um formulário no GitHub (é preciso ter uma conta gratuita lá). <b>Não escreva dados pessoais no formulário: ele é público.</b>${emailContato() ? ` Se preferir não usar o GitHub, escreva para <a href="mailto:${emailContato()}">${emailContato()}</a>.` : ''}</p>
    <p class="suave">Quando o erro é do próprio documento oficial, o caminho é pedir a correção ao órgão que o publicou. Os erros nossos que já corrigimos ficam anotados na página <a href="#/transparencia">Transparência</a>.</p>

    <h2>Termos de uso</h2>
    <ul class="nao-faz">
      <li><b>Este site não é oficial</b> e não tem ligação com a Câmara, a Prefeitura, partidos ou candidatos. É uma leitura independente de dados públicos.</li>
      <li><b>Não damos nota nem opinião</b> e não afirmamos que alguém agiu bem ou mal, nem que houve irregularidade.</li>
      <li><b>Pode haver erros.</b> Os números são calculados a partir de dados oficiais e algumas classificações são estimativas (as marcas mostram quais). Para qualquer decisão importante, confira o documento original pelo link que acompanha cada informação.</li>
      <li><b>Os dados podem estar atrasados.</b> Mostramos a data da última atualização no rodapé de todas as páginas.</li>
      <li>O site é oferecido <b>sem garantia</b>, e os responsáveis não respondem por decisões tomadas com base nele.</li>
    </ul>

    <h2>Apoio financeiro</h2>
    <p>O site é gratuito e não tem anúncios. Quem quiser pode apoiar pelo <b>Apoia.se</b>. O pagamento acontece lá: este site não recebe nem guarda dados de quem apoia.</p>
    <p class="suave" style="margin-top:28px"><a class="btn-sec" href="#/">Voltar ao início ${ico("chev")}</a></p>
  </div>`;
}
