/* ============================================================================
   PADRÃO DE GRÁFICO DE BARRA DO PORTAL (Renan, 09/09/2026)
   Ele comparou o Painel KM com a Visão Financeira e ficou com o desenho do KM:
   "quero um padrão universal para gráficos de barra nos nossos painéis".

   O que este arquivo faz em TODO gráfico de barra do portal:
   · barra sem borda, topo levemente arredondado e espessura com teto;
   · nada de grade no eixo das categorias;
   · barra ROTULADA e sem linha por cima ⇒ o eixo de valor SOME. O número já
     está na barra, o eixo vira ruído (é o que o Painel KM faz);
   · barra com linha de comparação (remunerado, orçado, meta) ⇒ o eixo de valor
     FICA, porque é ele que dá a régua da linha — e a linha vai tracejada;
   · folga de 12% acima do pico, senão o gráfico parece alto e vazio.

   O que ele NÃO faz: mexer em cor. Cor é significado (verde favorável,
   vermelho desfavorável, cheia no recorte em foco) e mora na lógica de cada
   painel. Aqui é só a forma.

   POR QUE ENVELOPAR O CONSTRUTOR E NÃO USAR UM PLUGIN (bug real, 09/09/2026):
   no `beforeInit` o Chart.js JÁ mesclou os defaults dele dentro do config, e
   `scales.y.grid.display` chega valendo `true` mesmo quando o painel não pediu
   nada. Não há como separar escolha do painel de default, e qualquer regra
   vira atropelo. Envelopando o construtor a gente vê o config CRU: preenche-se
   só o que está em branco e o painel que declarou continua mandando. (Mexer no
   `chart.options`, que é um resolvedor com proxies, além de não valer, estoura
   a pilha quando copiado com Object.assign.)

   Como usar: incluir DEPOIS do Chart.js e ANTES do script que monta o gráfico.
   ========================================================================== */
(function () {
  if (typeof Chart === 'undefined' || Chart.__barraPadrao) return;

  // ── forma da barra (defaults: o painel que declarou o seu continua com ele)
  const dsBar = Chart.defaults.datasets.bar;
  dsBar.borderRadius = 4;
  dsBar.borderSkipped = false;   // arredonda só o topo; a base fica na linha
  dsBar.borderWidth = 0;
  dsBar.maxBarThickness = 54;

  const vazio = v => v === undefined || v === null;
  const sub = (o, k) => (o[k] = o[k] || {});

  function padroniza(cfg) {
    if (!cfg || typeof cfg !== 'object') return cfg;
    const ds = (cfg.data && cfg.data.datasets) || [];
    const temBarra = cfg.type === 'bar' || ds.some(d => d && d.type === 'bar');
    if (!temBarra) return cfg;

    const o = sub(cfg, 'options');
    const sc = sub(o, 'scales');
    const horizontal = o.indexAxis === 'y';
    const cat = horizontal ? 'y' : 'x';          // eixo das categorias
    const val = horizontal ? 'x' : 'y';          // eixo dos valores

    // datalabels ligado no gráfico inteiro ou em alguma série
    const dl = (o.plugins && o.plugins.datalabels) || null;
    const rotulado = !!(dl && dl.display !== false)
      || ds.some(d => d && d.datalabels && d.datalabels.display !== false);
    const temLinha = ds.some(d => d && d.type === 'line');

    const gCat = sub(sub(sc, cat), 'grid');
    if (vazio(gCat.display)) gCat.display = false;

    const eV = sub(sc, val);
    const gVal = sub(eV, 'grid');
    if (rotulado && !temLinha) {
      if (vazio(gVal.display)) gVal.display = false;
      const tVal = sub(eV, 'ticks');
      if (vazio(eV.display) && vazio(tVal.display)) tVal.display = false;
      const bVal = sub(eV, 'border');
      if (vazio(bVal.display)) bVal.display = false;
    }
    if (vazio(eV.max) && vazio(eV.suggestedMax) && vazio(eV.grace)) eV.grace = '12%';

    // respiro para o rótulo que fica FORA da barra não sair cortado na moldura
    if (rotulado && typeof o.layout !== 'number') {
      const pad = sub(sub(o, 'layout'), 'padding');
      if (typeof pad === 'object') {
        if (horizontal) { if (vazio(pad.right)) pad.right = 34; }
        else if (vazio(pad.top)) pad.top = 18;
      }
    }

    // linha de comparação sobre barras é sempre tracejada
    ds.forEach(d => { if (d && d.type === 'line' && vazio(d.borderDash)) d.borderDash = [6, 4]; });
    return cfg;
  }

  const Original = Chart;
  function ChartPadrao(item, cfg) { return new Original(item, padroniza(cfg)); }
  ChartPadrao.prototype = Original.prototype;      // instanceof continua valendo
  Object.setPrototypeOf(ChartPadrao, Original);    // register/defaults/getChart…
  ChartPadrao.__barraPadrao = true;
  window.Chart = ChartPadrao;
})();
