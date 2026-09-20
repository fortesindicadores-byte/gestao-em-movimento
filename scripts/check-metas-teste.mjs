// ============================================================
// CHECK DE METAS — o motor põe CADA slide na visão e no filtro certos?
//
// O deck é 30 e tantos prints de painel. Slide com o filtro errado é o
// defeito que passa no olho de quem confere: a tela é plausível, os
// números são de outro mês. Este teste existe para pegar exatamente isso.
//
// O que ele NÃO testa: os dados. O sandbox não alcança o Supabase nem o
// Google, então os 11 painéis entram DUBLADOS — um painel de mentira com
// a mesma mecânica do padrão (setVw, filtros ms-*, atualizar). O que se
// mede aqui é o MOTOR: se ele abriu o painel certo, chamou a visão certa,
// marcou o filtro certo e, quando o filtro NÃO existe, se ele reclama em
// vez de entregar um slide bonito e errado.
//
// Uso: node scripts/check-metas-teste.mjs        (precisa do Chromium)
// ============================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const MIME = { '.html':'text/html;charset=utf-8', '.js':'text/javascript', '.css':'text/css',
               '.jpg':'image/jpeg', '.png':'image/png', '.json':'application/json' };

/* ── servidor local do repositório ── */
const srv = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const b = await readFile(join(RAIZ, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(b);
  } catch { res.writeHead(404); res.end('nao'); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

/* ── os dubles ─────────────────────────────────────────────── */
/* O DUBLÊ DO html2canvas É O POSTO DE OBSERVAÇÃO do slide: ele recebe o
   elemento montado, então é aqui que se mede o que o Renan reprovou —
   fundo, fonte, listra, texto truncado, Δ virando aspas. Medir o PNG não
   serviria: a prova é o que está no slide, não a compressão dele. */
const SHIM_H2C = `
window.__slInsp = [];
window.html2canvas = function(el, o){
  /* no PAINEL (iframe) a chamada é a foto: anota o fundo pedido e roda o
     onclone no próprio documento, para ver o que ele faz com o alvo */
  if (window.top !== window) {
    try {
      if (o && typeof o.onclone === 'function') o.onclone(document);
      (window.top.__fotos = window.top.__fotos || []).push({
        alvo: el.id || el.className, bg: o && o.backgroundColor,
        alvoBg: el.style.backgroundColor, temMarca: el.hasAttribute('data-cm-alvo') });
    } catch (e) {}
  }
  try{
    var cs = getComputedStyle(el), li = el.querySelector('.sl-listra');
    var rEl = el.getBoundingClientRect(), rLi = li ? li.getBoundingClientRect() : null;
    var tab = el.querySelector('table.sl-t');
    var cels = tab ? [].slice.call(tab.querySelectorAll('th,td')).map(function(c){ return c.textContent; }) : [];
    window.__slInsp.push({
      cls: el.className,
      fundo: cs.backgroundColor,
      fonte: cs.fontFamily,
      w: el.offsetWidth, h: el.offsetHeight,
      tit: (el.querySelector('.sl-tit')||{}).textContent || '',
      sub: (el.querySelector('.sl-sub')||{}).textContent || '',
      rot: [].slice.call(el.querySelectorAll('.sl-rot')).map(function(r){ return r.textContent; }),
      listra: rLi ? { dir: Math.round(rEl.right - rLi.right), topo: Math.round(rLi.top - rEl.top),
                      larg: +(rLi.width / rEl.width).toFixed(2), alt: Math.round(rLi.height),
                      cor: getComputedStyle(li).backgroundColor } : null,
      nLin: tab ? tab.querySelectorAll('tbody tr').length : 0,
      nCab: tab ? tab.querySelectorAll('th').length : 0,
      cabs: tab ? [].slice.call(tab.querySelectorAll('th')).map(function(c){ return c.textContent; }) : [],
      cels: cels,
      cortado: cels.some(function(t){ return /…|\.\.\.$/.test(t); }),
      transborda: tab ? (tab.scrollWidth > el.offsetWidth + 2) : false,
      nKpi: el.querySelectorAll('.sl-kpi').length,
      nCanvas: el.querySelectorAll('canvas').length,
      nPod: el.querySelectorAll('.sl-pod .p').length,
      img: !!el.querySelector('.sl-mio img'),
      /* ZEBRA: o Renan reprovou "tabela com cor sim cor não". A prova é o fundo
         computado das linhas pares — se ele diferir do das ímpares, a zebra
         voltou. Olhar o CSS não serve: o que conta é o que o slide pinta. */
      zebra: (function(){
        if(!tab) return null;
        var trs = [].slice.call(tab.querySelectorAll('tbody tr')).filter(function(r){ return !r.classList.contains('tot'); });
        if (trs.length < 2) return null;
        var f = function(tr){ var td = tr.querySelector('td'); return td ? getComputedStyle(td).backgroundColor : ''; };
        return f(trs[0]) !== f(trs[1]);
      })(),
      /* CHIPS: a cor do nível da Auditoria e a pílula do ranking */
      setas: tab ? [].slice.call(tab.querySelectorAll('td span')).filter(function(s){ return /[▲▼]/.test(s.textContent); })
        .map(function(s){ return s.textContent.trim() + '=' + getComputedStyle(s).color; }) : [],
      chips: tab ? [].slice.call(tab.querySelectorAll('.sl-chip')).map(function(s){
        var c = getComputedStyle(s);
        return { t: s.textContent, bg: c.backgroundColor, cor: c.color, bloco: c.display === 'block' };
      }) : [],
      /* a foto NÃO pode ir dentro de um card branco (era o "porra branca no
         fundo") e tem de ocupar a página */
      foto: (function(){
        var im = el.querySelector('.sl-mio > div > img'); if (!im || im.closest('.sl-pod')) return null;
        var bx = im.parentNode, c = getComputedStyle(bx), r = im.getBoundingClientRect();
        return { fundo: c.backgroundColor, borda: c.borderTopWidth,
                 larg: Math.round(r.width), alt: Math.round(r.height) };
      })(),
      /* largura das colunas: com TODA coluna curta eu punha width:1% em todas
         e a sobra ia inteira para a primeira — o vão entre UNIDADE e REM */
      larg: (function(){
        if (!tab) return null;
        var th = [].slice.call(tab.querySelectorAll('thead th'));
        if (!th.length) return null;
        var w = tab.getBoundingClientRect().width;
        return { total: Math.round(w),
                 pri: +(th[0].getBoundingClientRect().width / w).toFixed(2),
                 encolhe: th.filter(function(h){ return h.classList.contains('curto'); }).length };
      })(),
      /* quanto da caixa a tabela ocupa: sobra grande = slide meio vazio */
      alturaTab: (function(){
        if (!tab) return null;
        var w = tab.closest('.sl-tw'); if (!w) return null;
        return +(tab.getBoundingClientRect().height / w.clientHeight).toFixed(2);
      })(),
      /* slide que é SÓ a tabela: só nele a sobra de altura vira respiro */
      soTab: !!(el.querySelector('.sl-tw') && !el.querySelector('.sl-card')
                && !el.querySelector('.sl-kpis') && el.querySelectorAll('.sl-tw').length === 1),
      mioPad: (function(){ var m = el.querySelector('.sl-mio'); return m ? getComputedStyle(m).paddingLeft : null; })(),
      fotoEsc: (function(){ var im = el.querySelector('.sl-mio > div > img'); if (!im || im.closest('.sl-pod')) return null;
        var bx = im.parentNode; return { w: parseFloat(im.style.width), h: parseFloat(im.style.height), bw: bx.clientWidth, bh: bx.clientHeight }; })(),
      numFs: (function(){ var td = tab && tab.querySelector('td.sl-n'); return td ? getComputedStyle(td).fontSize : null; })(),
      hero: (function(){
        var h = el.querySelector('.sl-hero'); if (!h) return null;
        var v = h.querySelector('.v'), d = h.querySelector('.d'), l = h.querySelector('.l');
        return { fundo: getComputedStyle(h).backgroundColor,
                 linha: l ? l.textContent : null,
                 linhaEntre: !!(l && v && d && l.getBoundingClientRect().top >= v.getBoundingClientRect().bottom - 2
                                && d.getBoundingClientRect().top >= l.getBoundingClientRect().bottom - 2),
                 alt: Math.round(h.getBoundingClientRect().height),
                 /* deltas AO LADO = começam antes de o valor terminar; EMBAIXO =
                    começam depois da base do valor */
                 aoLado: !!(v && d && d.getBoundingClientRect().top < v.getBoundingClientRect().bottom - 4) };
      })(),
      densa: !!el.querySelector('.sl-kpis.denso'),
      /* MEDIR as colunas, não ler o CSS: o computed de grid-template-columns
         volta "repeat(10, 1fr)" sem resolver e a conta dava UMA coluna. */
      cols: (function(){
        var ks = [].slice.call(el.querySelectorAll('.sl-kpis > .sl-kpi'));
        if (ks.length < 2) return 0;
        var t = ks[0].offsetTop, n = 0;
        for (var i = 0; i < ks.length && ks[i].offsetTop === t; i++) n++;
        return n;
      })(),
      /* o boneco do pódio */
      avatares: [].slice.call(el.querySelectorAll('.sl-pod img.sl-av')).map(function(i){ return i.getAttribute('src'); }),
      brasao: !!el.querySelector('.sl-pod-bras'),
      gleg: [].slice.call(el.querySelectorAll('.sl-gleg span')).map(function(s){ return s.textContent.trim(); }),
      nGraf: el.querySelectorAll('.sl-cv canvas').length,
      nHero: el.querySelectorAll('.sl-hero').length,
      fsTit: tab ? null : parseFloat(getComputedStyle(el.querySelector('.sl-tit')||el).fontSize),
      fsTab: tab ? parseFloat(getComputedStyle(tab).fontSize) : null,
      vazio: !!el.querySelector('.sl-vazio'),
    });
  }catch(e){ window.__slInsp.push({erro: e.message}); }
  var c = document.createElement('canvas'); c.width = 1200; c.height = 700;
  var x = c.getContext('2d'); x.fillStyle = '#EAEAEA'; x.fillRect(0,0,1200,700);
  return Promise.resolve(c);
};`;

/* Chart.js dublado: guarda o config e responde getChart(canvas). Serve aos
   DOIS lados — no painel é dele que o __cm.graf tira os dados; na página é
   por ele que se prova que o gráfico do slide foi desenhado com esses dados
   e com animation:false (a animação era o que deixava o gráfico em branco). */
const SHIM_CHART = `
window.__charts = [];
(function(){
  var reg = new Map();
  function Chart(ctx, cfg){
    this.config = cfg; this.data = cfg.data; this.options = cfg.options || {};
    /* O Chart.js REAL expõe chart.scales.y com a janela resolvida e os ticks
       já rotulados — é de lá que o slide copia o eixo do painel. O dublê
       precisa expor o mesmo, senão o teste validaria um mundo sem eixo. */
    var sc = this.options.scales || {}, self = this;
    this.scales = {};
    Object.keys(sc).forEach(function(k){
      var o = sc[k] || {}, t = [];
      if (isFinite(o.min) && isFinite(o.max))
        for (var n = 0; n <= 4; n++) { var v = o.min + (o.max - o.min) * n / 4;
          t.push({ value: v, label: String(Math.round(v)) + (o.__suf || '') }); }
      self.scales[k] = { min: o.min, max: o.max, options: o, ticks: t };
    });
    var cv = (ctx && ctx.canvas) ? ctx.canvas : ctx;
    if (cv) reg.set(cv, this);
    window.__charts.push(cfg);
    this.destroy = function(){}; this.update = function(){}; this.resize = function(){};
  }
  Chart.getChart = function(cv){ return reg.get(cv) || null; };
  /* quem registra o plugin de rótulo é o slides.js; o teste anota para provar
     que ele foi registrado UMA vez (registrar por gráfico desenhava duas) */
  window.__registrados = [];
  Chart.register = function(p){ window.__registrados.push(p && p.id || String(p)); };
  Chart.defaults = { font:{} };
  window.Chart = Chart;
})();`;

const SHIM_JSPDF = `
window.__pdf = null;
window.jspdf = { jsPDF: function(){
  var o = { pgs: [{}], cheias: 0, txts: [], imgs: 0 };
  window.__pdf = o;
  this.addPage = function(){ o.pgs.push({}); };
  this.setFillColor = function(){}; this.rect = function(){};
  this.setTextColor = function(){}; this.setFont = function(){}; this.setFontSize = function(){};
  this.text = function(t){ o.txts.push(t); };
  this.addImage = function(d,f,x,y,w,h){ o.imgs++; if (w > 13 && h > 7) o.cheias++; };
  this.setDrawColor = function(){}; this.setLineWidth = function(){};
  this.line = function(){ o.linhas = (o.linhas || 0) + 1; };
  this.getTextWidth = function(t){ return String(t).length * 0.06; };
  this.save = function(n){ o.arquivo = n; };
} };`;

const SHIM_PPTX = `
window.__ppt = null;
window.PptxGenJS = function(){
  var o = { slides: [], layout: null };
  window.__ppt = o;
  this.ShapeType = { rect: 'rect' };
  this.defineLayout = function(l){ o.layout = l; };
  this.addSlide = function(){
    var s = { txts: [], imgs: [], shapes: [], tabelas: [] };
    o.slides.push(s);
    return {
      background: null,
      addText: function(t){ s.txts.push(t); },
      addImage: function(i){ s.imgs.push({ x:i.x, y:i.y, w:i.w, h:i.h }); },
      addTable: function(rows, o){ s.tabelas.push({ rows: rows, x:o.x, y:o.y, w:o.w, colW:o.colW }); },
      addShape: function(t,p){ s.shapes.push(t); }
    };
  };
  this.writeFile = function(op){ o.arquivo = op.fileName; return Promise.resolve(); };
};
Object.defineProperty(window.PptxGenJS.prototype, 'layout', { set:function(v){ if(window.__ppt) window.__ppt.usou = v; }, get:function(){ return null; } });`;

/* A tabela `fca` tem uma linha por CAUSA/AÇÃO, não por unidade — PIR com três
   causas é UM recorte com três linhas, e era isso que virava três slides
   iguais. Causa/Ação vazias = unidade que não preencheu: não vira slide. */
const FCAS = [
  { vigencia:'jun/26', unidade:'CGR', projeto:'AS - CGR',   fato:'Combustíveis', fato_desvio:'Desvio: ▲ R$ 120.000 · ▲ -9%', causa:'Consumo acima', acao:'Pauta de consumo', responsavel:'Michel', prazo:'30/09/2026' },
  { vigencia:'jun/26', unidade:'CGR', projeto:'ROTA - CGR', fato:'Combustíveis', fato_desvio:'Desvio: ▲ R$ 90.000 · ▲ -7%', causa:'Km/L abaixo', acao:'Treinar motoristas', responsavel:'Michel', prazo:'30/09/2026' },
  // a Seara: a Árvore dela é OUTRO painel (a Ambev não tem a ANG e saía zerada)
  { vigencia:'jun/26', unidade:'ANG', projeto:'DISTRIBUIÇÃO URBANA - ANG', fato:'Combustíveis', fato_desvio:'Desvio: ▲ R$ 15.349 · ▲ 10%', causa:'R$/L acima', acao:'Renegociar diesel', responsavel:'Paulo', prazo:'30/09/2026' },
  { vigencia:'jun/26', unidade:'CBA T1', projeto:'EMPURRADA - CBA', fato:'Manutenções', fato_desvio:'Desvio: ▲ R$ 55.000 · ▲ -12%', causa:'Carreta desgastada', acao:'Renovar carrocerias', responsavel:'Jean', prazo:'30/09/2026' },
  { vigencia:'jun/26', unidade:'GRL', projeto:'ROTA - GRL', fato:'Manutenções', fato_desvio:'Desvio: ▲ R$ 33.000 · ▲ -4%', causa:'Corretivas', acao:'Antecipar preventivas', responsavel:'Ana', prazo:'30/10/2026' },
  { vigencia:'jun/26', unidade:'FLP', projeto:'ROTA - FLP', fato:'Manutenções', fato_desvio:'Desvio: ▲ R$ 30.000 · ▲ -6%', causa:'Pneu', acao:'Revisar', responsavel:'Ana', prazo:'30/10/2026' },
  // três causas do MESMO recorte: é UM slide, não três
  { vigencia:'jun/26', unidade:'PIR', projeto:'EMPURRADA - PIR', fato:'Manutenções', fato_desvio:'Desvio: ▲ R$ 54.034 · ▲ 27%', causa:'Carroceria', acao:'Validar renovação', responsavel:'Jean', prazo:'30/09/2026' },
  { vigencia:'jun/26', unidade:'PIR', projeto:'EMPURRADA - PIR', fato:'Manutenções', fato_desvio:'Desvio: ▲ R$ 54.034 · ▲ 27%', causa:'Lavação', acao:'Ajuste no R$/km', responsavel:'Jean', prazo:'30/09/2026' },
  { vigencia:'jun/26', unidade:'PIR', projeto:'EMPURRADA - PIR', fato:'Manutenções', fato_desvio:'Desvio: ▲ R$ 54.034 · ▲ 27%', causa:'Frota de venda', acao:'Finalizar manutenção', responsavel:'Jean', prazo:'30/10/2026' },
  // desviou e NÃO preencheu: fica fora do deck
  { vigencia:'jun/26', unidade:'MCC', projeto:'ROTA - MCC', fato:'Manutenções', fato_desvio:'Desvio: ▲ R$ 44.000 · ▲ -8%', causa:'', acao:'—', responsavel:'', prazo:null },
  { vigencia:'mai/26', unidade:'PIR', projeto:'ROTA - PIR', fato:'Pneus', fato_desvio:'Desvio: ▲ R$ 10.000 · ▲ -3%', causa:'x', acao:'y', responsavel:'z', prazo:'01/01/2026' },
];

const SHIM_SB = `
window.supabase = { createClient: function(){
  function consulta(tab){
    var q = { _t: tab, _f: {} };
    ['select','eq','limit','order','in'].forEach(function(m){
      q[m] = function(a,b){ if (m === 'eq') q._f[a] = b; return q; };
    });
    q.maybeSingle = function(){ return Promise.resolve({ data: { is_admin: true }, error: null }); };
    q.then = function(res){
      var d = tab === 'fca' ? ${JSON.stringify(FCAS)} : [];
      return Promise.resolve({ data: d, error: null }).then(res);
    };
    return q;
  }
  return { auth: { getSession: function(){ return Promise.resolve({ data: { session: {
      user: { id:'u1', email:'renan@conlog', user_metadata:{ name:'Renan Fortes' } } } } }); },
      onAuthStateChange: function(){ return { data:{ subscription:{ unsubscribe:function(){} } } }; } },
    from: consulta };
} };`;

/* CADA PAINEL ESCREVE A VIGÊNCIA DE UM JEITO — o dublê reproduz os quatro
   dialetos que existem de verdade no portal, senão o teste valida um mundo
   que não é o do Renan. Foi a 1ª geração real que mostrou isso: três avisos
   de "ms-vig: não achei" nos painéis de km. */
const DIALETO = {
  chave: k => ({ v: k, t: rotCurto(k).toUpperCase() }),          // visao-financeira, rs-por-km
  curto: k => ({ v: rotCurto(k), t: rotCurto(k) }),              // scorecard, resumo-exec, painel-metas, fca
  longo: k => ({ v: mmAaaa(k), t: rotLongo(k) }),                // painel-km, seara-km
  mm:    k => ({ v: mmAaaa(k), t: mmAaaa(k) }),                  // arvore-combustivel
};
const MES3 = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const rotCurto = k => MES3[+k.slice(5, 7) - 1] + '/' + k.slice(2, 4);
const rotLongo = k => MES3[+k.slice(5, 7) - 1] + '/' + k.slice(0, 4);
const mmAaaa   = k => k.slice(5, 7) + '/' + k.slice(0, 4);
const DIAL_DE = { 'visao-financeira':'chave', 'rs-por-km':'chave',
  'scorecard':'curto', 'resumo-executivo':'curto', 'painel-metas':'curto', 'fca-consolidado':'curto',
  'painel-km':'longo', 'seara-km':'longo', 'combustivel/arvore-combustivel':'mm', 'combustivel/seara/arvore':'mm', 'auditorias':'curto',
  'programa-reconhecimento':'curto' };

/* painel dublado: a MESMA mecânica do padrão (setVw, ms-*, atualizar) */
/* DOIS gráficos, como os painéis de verdade têm (Dispersão de KM % + Impacto
   financeiro; Custo Nominal + AV Custo). Com um só, o teste nunca veria que o
   segundo sumia. O 1º traz a régua do painel: eixo de 70 a 110 (não zero),
   formatter próprio ("+12.5%") e rótulo só no dataset 0 — é disso que o slide
   tem de copiar tudo. */
const CHART_NO_PAINEL = `
  (function(){
    if (!window.Chart) return;
    var cv = document.getElementById('g1');
    if (cv) new window.Chart(cv.getContext('2d'), { type:'bar',
      data:{ labels:['jan/26','fev/26','mar/26'],
             datasets:[{ label:'Δ Rem %', data:[12.5, 8.3, 30.7], backgroundColor:'#F9731633',
                         borderColor:'#F97316', borderWidth:1, borderRadius:0, barPercentage:.97 },
                       { label:'Meta 5%', type:'line', data:[5,5,5], borderColor:'#333',
                         pointRadius:[0,0,6], tension:0 }] },
      options:{ plugins:{ legend:{display:false}, datalabels:{
                  display:function(c){ return c.datasetIndex === 0; },
                  formatter:function(v){ return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; } } },
                scales:{ y:{ min:70, max:110, __suf:'%' } } } });
    var cv3 = document.getElementById('g3');
    if (cv3) new window.Chart(cv3.getContext('2d'), { type:'bar',
      data:{ labels:['A','B','C'], datasets:[{ label:'Pontos', data:[30.7, 3210987, 1] }] },
      options:{} });
    var cv4 = document.getElementById('g4');
    if (cv4) new window.Chart(cv4.getContext('2d'), { type:'bar',
      data:{ labels:['jan','fev','mar'],
             datasets:[{ label:'Média Geral', data:[84.6, 86.3, 91.3], backgroundColor:'#F4A100',
                         datalabels:{ anchor:'end', align:'end',
                           formatter:function(v){ return v!=null ? v.toFixed(1) : ''; } } },
                       { label:'Meta 85%', type:'line', data:[85,85,85], borderColor:'#333',
                         datalabels:{display:false} }] },
      options:{ plugins:{ legend:{}, datalabels:{} },
                scales:{ y:{ min:70, max:110, __suf:'%' } } } });
    var cv2 = document.getElementById('g2');
    if (cv2) new window.Chart(cv2.getContext('2d'), { type:'bar',
      data:{ labels:['jan/26','fev/26','mar/26'],
             datasets:[{ label:'Impacto', data:[334550, -487570, 232030], backgroundColor:'#F97316' }] },
      options:{ plugins:{ datalabels:{ formatter:function(v){ return (v/1000).toFixed(2) + 'k'; } } } } });
  })();`;

/* PNG 1×1 de verdade (data URI): o pódio tem de carregar uma imagem que
   DECODIFIQUE, senão o teste não prova nada sobre o boneco. */
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP6zwAAAgUBAScLLXcAAAAASUVORK5CYII=';

function painelDuble(chaves, dialeto, comGate) {
  if (comGate) return `<!doctype html><html><body><div class="app"><div class="cols">
    <div class="gate"><h2>Apenas administradores</h2><p>restrito</p></div></div></div></body></html>`;
  const vigs = chaves.map(DIALETO[dialeto || 'chave']);
  const TAB = () => `<div class="twrap"><table class="dre">
    <thead><tr><th>CONTA</th><th class="num">REM</th><th class="num">REAL</th><th class="num">Δ %</th></tr></thead>
    <tbody>
      <tr><td class="conta">Manutenção de Veículos e Equipamentos</td><td class="num">-0,30</td><td class="num">-0,35</td><td class="num cr" style="color:rgb(255,0,0)">+17%</td></tr>
      <tr><td class="conta">Combustíveis</td><td class="num">-3,09</td><td class="num">-2,83</td><td class="num cg" style="color:rgb(0,179,0)">-8%</td></tr>
      <tr><td class="conta">Pneus Novos</td><td class="num">-0,34</td><td class="num">-0,15</td><td class="num cg" style="color:rgb(0,179,0)">-55%</td></tr>
      <tr><td class="conta">Manutenções</td><td class="num">-0,38</td><td class="num">-0,52</td><td class="num cr" style="color:rgb(255,0,0)">+35%</td></tr>
      <tr class="total"><td class="conta">Total</td><td class="num">-4,67</td><td class="num">-4,22</td><td class="num">-10%</td></tr>
    </tbody></table></div>`;
  /* o HERO do padrão: .fin-hero > div com .hlbl/.hval/.hdel. É o número que
     se lê primeiro e ficava de fora do deck. Dois, como na Visão Financeira. */
  const HERO = () => `<div class="fin-hero">
    <div><div class="hlbl">KM realizado</div><div class="hval">1.34 mi</div>
      <div class="hrem">Km remunerado: <b>1.14 mi</b></div>
      <div class="hdel"><div>Δ Rem<b style="color:rgb(255,0,0)">+202.47k</b></div>
        <div>Δ Rem %<b style="color:rgb(255,0,0)">+17.7%</b></div>
        <div>Balanço de massa<b>—</b></div></div></div>
    <div class="heb"><div class="hlbl">EBITDA</div><div class="hval">5.14 mi (19,7%)</div>
      <div class="hdel"><div>Δ Orç. %<b style="color:rgb(0,179,0)">+16.4%</b></div></div></div>
  </div>`;
  /* O FCA DE VERDADE: UNIDADE/PROJETO/VIGÊNCIA iguais em toda linha (são o
     recorte do slide) e o mesmo FATO repetido, porque as três linhas são do
     mesmo pacote com causas diferentes — foi isso que ele leu como "esse FCA
     repetiu 3 vezes". */
  const FCA_TAB = () => `<div class="twrap"><table class="dre">
    <thead><tr><th>UNIDADE</th><th>PROJETO</th><th>VIGÊNCIA</th><th>FATO</th><th>CAUSA</th>
      <th>AÇÃO</th><th>RESPONSÁVEL</th><th>PRAZO</th><th>STATUS</th></tr></thead><tbody>
    ${[['Validar status renovação das carrocerias','30/09/2026'],
       ['Solicita ajuste no R$/KM','30/09/2026'],
       ['Finaliza manutenção dos carros de vendas','30/10/2026']]
      .map(a=>`<tr><td>PIR</td><td>EMPURRADA</td><td>AGO/26</td>
        <td>Manutenções<br><span style="color:rgb(255,0,0)">▲</span> R$ 54.034 · <span style="color:rgb(255,0,0)">▲</span> 27%<br>Contas:<br>- Manutenção de Carrocerias: <span style="color:rgb(255,0,0)">▲</span> 55K | <span style="color:rgb(255,0,0)">▲</span> 117%<br>- Lavação: <span style="color:rgb(0,179,0)">▼</span> 2,2K | <span style="color:rgb(0,179,0)">▼</span> 100% (saving)</td>
        <td>Frota de carreta desgastada devido ao tempo de uso</td><td>${a[0]}</td>
        <td>JEAN</td><td>${a[1]}</td>
        <td><span style="background:rgb(244,161,0);color:rgb(12,16,23);display:inline-block;padding:3px 10px;border-radius:12px">Em andamento</span></td>
      </tr>`).join('')}
    </tbody></table></div>`;
  const ops = id => vigs.map(v => `<label class="ms-opt"><input type="checkbox" data-v="${v.v}"> ${v.t}<span class="ms-only">only</span></label>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  .vw{display:none} .vw.on{display:block} .card,.tbl-section,.chart-card{min-height:220px;background:#eee}
  body{margin:0;min-height:700px}
  /* a cor do nível da Auditoria é um span de BLOCO preenchendo a célula —
     sem esta regra o teste mediria o CSS do dublê, não o do painel */
  .niv{display:block;border-radius:7px;padding:10px 6px;font-weight:700}
  .uni-card{display:block;background:rgba(0,0,0,.05)}
  .score-pill{display:inline-block;padding:3px 10px;border-radius:12px;font-weight:800}
  .fin-hero{display:flex;align-items:flex-end;gap:20px}
  .hval{font-size:40px;font-weight:800}.hlbl{font-size:12px}
  .hdel{display:flex;gap:16px}.hdel b{display:block;font-weight:800}
  .gleg{display:flex;gap:12px}.gleg i{width:14px;height:0;border-top:2px dashed currentColor;display:inline-block}
  .gleg i.sq{width:9px;height:9px;border:0;background:currentColor}
  .tree-wrap{min-height:300px;background:#111}
  </style></head><body>
  <div class="app"><div class="side"></div><main class="board"><div class="top">
    <div class="tit-sub" id="titSub">pronto</div>
    <div class="ms-wrap" id="ms-vig"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">${ops('ms-vig')}</div></div></div>
    <div class="ms-wrap" id="ms-uni"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">
      ${['CGR','CBA T1','GRL','PIR','FLP','ANG'].map(u=>`<label class="ms-opt"><input type="checkbox" data-v="${u}"> ${u}</label>`).join('')}</div></div></div>
    <div class="ms-wrap" id="ms-proj"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">
      ${['AS - CGR','ROTA - CGR','EMPURRADA - CBA','ROTA - GRL','DISTRIBUIÇÃO URBANA - ANG'].map(u=>`<label class="ms-opt"><input type="checkbox" data-v="${u}"> ${u}</label>`).join('')}</div></div></div>
    <div class="ms-wrap" id="ms-nv3"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">
      ${['AS','ROTA','EMPURRADA'].map(u=>`<label class="ms-opt"><input type="checkbox" data-v="${u}"> ${u}</label>`).join('')}</div></div></div>
    <div class="ms-wrap" id="ms-org"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">
      ${['Custos','RPM'].map(u=>`<label class="ms-opt"><input type="checkbox" data-v="${u}"> ${u}</label>`).join('')}</div></div></div>
    <div class="ms-wrap" id="ms-fato"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">
      ${['Combustíveis','Manutenções','Pneus'].map(u=>`<label class="ms-opt"><input type="checkbox" data-v="${u}"> ${u}</label>`).join('')}</div></div></div>
    <div class="ms-wrap" id="ms-pac"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">
      ${['Combustíveis','Manutenções','Pneus','ICMS'].map(u=>`<label class="ms-opt"><input type="checkbox" data-v="${u}"> ${u}</label>`).join('')}</div></div></div>
  </div><div class="cols">
    <section class="vw on" id="vw-resumo"><div class="card">resumo — texto suficiente para o motor considerar a tela carregada e estável</div>
      ${HERO()}
      <div class="kpis k10" style="display:grid;grid-template-columns:repeat(10,1fr);gap:7px">
        ${Array.from({length:20},(_,i)=>`<div class="kpi"><div class="kl">Indicador ${i+1}</div>`
          +`<div class="kv">${90+i%9}%</div><div class="km">peso ${11-i%9}</div></div>`).join('')}
      </div>
      <div class="gcard"><div class="gt">Pontuação Mensal</div>
        <canvas id="g3" width="600" height="240"></canvas></div>
      <!-- o caso da Evolução: plugin ligado sem formatter e legenda NATIVA -->
      <div class="chart-card"><div class="gt">Evolução Temporal</div>
        <canvas id="g4" width="600" height="240"></canvas></div></section>
    <section class="vw" id="vw-nominal"><div class="card">nominal <span id="ref-pac-v">REM</span>${TAB()}</div></section>
    <section class="vw" id="vw-dispersao">${HERO()}<div class="card">dispersao por unidade${TAB()}
      <div class="gcard"><div class="gt">Dispersão de KM %</div><div class="gs">por vigência</div>
        <div class="gleg"><span><i class="sq"></i> ▲ Rem %</span><span><i></i> Meta (5%)</span></div>
        <canvas id="g1" width="600" height="280"></canvas></div>
      <div class="gcard"><div class="gt">Impacto financeiro</div><div class="gs">por vigência</div>
        <canvas id="g2" width="600" height="280"></canvas></div></div></section>
    <section class="vw" id="vw-tabela"><div class="card">FCA da unidade${FCA_TAB()}</div></section>
    <div class="tbl-section">R$/KM Detalhado <span id="dim-atual">pacote</span>${TAB()}</div>
    <!-- RANKING como no painel: a cor mora num <span> DENTRO do td
         (.score-pill com fundo, .ind-green só com cor) -->
    <div class="tbl-section"><table id="ranking-table"><thead><tr><th>UNIDADE</th><th class="num">DISP.</th><th class="num">PONTOS</th></tr></thead>
      <tbody><tr class="rank-1"><td class="ind-col">CDI MACACU</td>
        <td class="num"><span class="ind-green" style="color:rgb(0,179,0)">98%</span></td>
        <td class="num"><span class="score-pill score-green" style="background:rgb(59,179,59);color:rgb(17,17,17)">97,3</span></td></tr>
      <tr class="rank-2"><td>CDD PELOTAS</td>
        <td class="num"><span class="ind-yellow" style="color:rgb(180,83,9)">88%</span></td>
        <td class="num"><span class="score-pill score-yellow" style="background:rgb(244,161,0);color:rgb(17,17,17)">97,2</span></td></tr>
      <tr class="rank-3"><td>CDD GUARULHOS</td>
        <td class="num"><span class="ind-red" style="color:rgb(255,0,0)">71%</span></td>
        <td class="num"><span class="score-pill score-red" style="background:rgb(255,102,102);color:rgb(17,17,17)">95,0</span></td></tr></tbody></table></div>
    <!-- PÓDIO com o boneco, como o programa-reconhecimento desenha -->
    <!-- a ÁRVORE é um desenho, não tabela nem card: entra como foto -->
    <div class="tree-wrap"><svg class="tree-svg" width="600" height="280"></svg><div class="tree">árvore</div></div>
    <div id="podio-section" class="card" style="background-image:url('${PX}')"><div id="podio-wrap">
      ${['segundo','primeiro','terceiro'].map((cl,i)=>{
        const d=[{n:'Ritcher',u:'CDD PELOTAS',p:'97.2 pts'},{n:'Erick',u:'MACACU',p:'97.3 pts'},{n:'José',u:'CDD GUARULHOS',p:'95.0 pts'}][i];
        return `<div class="podio-slot ${cl}"><div class="avatar-wrap">`
          + `<img class="avatar-img" src="${PX}" alt=""></div>`
          + `<div class="pedestal"><div class="pedestal-place">x</div>`
          + `<div class="pedestal-name">${d.n}</div><div class="pedestal-unit">${d.u}</div>`
          + `<div class="pedestal-score">${d.p}</div></div></div>`;
      }).join('')}
    </div></div>
    <!-- AUDITORIAS: duas tabelas, cor do nível num <span class="niv"> -->
    ${['demarco','dpo'].map(w=>`<div class="tbl-section"><div id="tbl-${w}"><table>
      <thead><tr><th class="uni">UNIDADE</th><th>1H26</th><th>2H26</th></tr></thead><tbody>
      ${[['CDD RIO','Nível 2','#3BB33B','#fff','Nível 4','#EA4335','#fff'],
         ['CDD CUIABA','Nível 3','#F4C20D','#0C1017','Nível 1','#1565C0','#fff']]
        .map(r=>`<tr><td class="uni"><span class="uni-card">${r[0]}</span></td>`
          +`<td><span class="niv" style="background:${r[2]};color:${r[3]}">${r[1]}</span></td>`
          +`<td><span class="niv" style="background:${r[5]};color:${r[6]}">${r[4]}</span></td></tr>`).join('')}
      </tbody></table></div></div>`).join('')}

    <!-- PAINEL DE METAS: a tabela mora num #tbl -->
    <div class="tbl-section"><div id="tbl"><table>
      <thead><tr class="cols"><th class="lft">INDICADOR</th><th>PESO</th><th>META</th><th>REAL</th><th>ATING.</th></tr></thead>
      <tbody>${['Disponibilidade','Preventivas','Pneus','Checklist','Conformidade','Stress Test','CIVF','SLA']
        .map((n,i)=>`<tr><td class="lft ind">${n}</td><td>10</td><td>95</td><td>${90+i}</td>`
          +`<td style="color:rgb(0,179,0);font-weight:700">${95+i}%</td></tr>`).join('')}
      </tbody></table></div></div>
    <div class="ms-wrap" id="ms-vig-wrap"><span class="ms-cnt" id="ms-vig-cnt"></span>
      <div class="ms-panel" id="ms-vig-panel"><div class="ms-list" id="ms-vig-list">
      ${vigs.map(v => `<div class="ms-opt"><input type="checkbox" value="${v.v}"><label>${v.t}</label></div>`).join('')}
      </div></div></div>
    <div class="chart-card"><canvas id="chartTemporal"></canvas></div>
    <pre id="estado"></pre>
  </div></main></div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script>
  ${CHART_NO_PAINEL}
  var EST = { vw:'resumo', filtros:{}, dim:null, ref:'REM', chamou:[], selVig:[] };
  function grava(){ document.getElementById('estado').textContent = JSON.stringify(EST); }
  function setVw(v){ EST.vw = v;
    document.querySelectorAll('.vw').forEach(function(s){ s.classList.toggle('on', s.id === 'vw-' + v); }); grava(); }
  function leFiltros(){
    ['ms-vig','ms-uni','ms-proj','ms-nv3','ms-fato','ms-pac','ms-org'].forEach(function(id){
      var w = document.getElementById(id); if (!w) return;
      EST.filtros[id] = w._sel ? Array.from(w._sel) : [];
    });
  }
  function atualizar(){ EST.chamou.push('atualizar'); leFiltros(); grava(); }
  function run(){ EST.chamou.push('run'); leFiltros(); grava(); }
  function onFilterChange(){ EST.chamou.push('onFilterChange'); leFiltros(); grava(); }
  function renderAll(){ EST.chamou.push('renderAll'); grava(); }
  function setPacoteDim(d){ EST.dim = d; grava(); }
  function setDim(d){ EST.dim = d; document.getElementById('dim-atual').textContent = d; grava(); }
  function togglePacRef(){ EST.ref = EST.ref === 'REM' ? 'ORÇ' : 'REM';
    document.getElementById('ref-pac-v').textContent = EST.ref; grava(); }
  /* como no fca-consolidado: a lista de PROJETOS é recalculada pela unidade
     selecionada. Sem isto o teste não veria a seleção presa entre unidades. */
  (function(){
    var w = document.getElementById('ms-proj');
    var MAP = { 'CGR':['AS - CGR','ROTA - CGR'], 'CBA T1':['EMPURRADA - CBA'], 'GRL':['ROTA - GRL'],
                'PIR':['EMPURRADA - PIR'], 'FLP':['ROTA - FLP'], 'ANG':['DISTRIBUIÇÃO URBANA - ANG'] };
    w._render = function(){
      var u = document.getElementById('ms-uni'), us = u._sel ? Array.from(u._sel) : [];
      var ps = us.length ? us.flatMap(function(x){ return MAP[x] || []; }) : Object.values(MAP).flat();
      var sel = w._sel || new Set();
      w.querySelector('.ms-list').innerHTML = ps.map(function(p){
        return '<label class="ms-opt"><input type="checkbox" data-v="' + p + '"' + (sel.has(p) ? ' checked' : '') + '> ' + p + '</label>'; }).join('');
    };
  })();
  function onlyOpt(k, v){ EST.selVig = [v]; EST.chamou.push('onlyOpt'); grava(); }
  function toggleAll(k){ EST.selVig = []; EST.chamou.push('toggleAll'); grava(); }
  function setSelArr(k, v){ if (k === 'vig') { EST.selVig = v; selVig = v; } grava(); }
  function updateMsBtn(){}
  function toggleIndCols(){ EST.chamou.push('toggleIndCols'); grava(); }
  function aplicaTema(t){ EST.tema = t; document.body.classList.toggle('claro', t === 'light'); grava(); }
  var selVig = [];
  grava();
  <\/script></body></html>`;
}

/* ── o teste ───────────────────────────────────────────────── */
const VIGS_OK = ['2026-06','2026-05','2026-04','2026-03','2026-02','2026-01'];
const VIGS_SEM_JUN = VIGS_OK.filter(k => k !== '2026-06');

let ok = 0, ruim = 0;
const af = (cond, txt, det) => {
  if (cond) { ok++; console.log('  ok   ' + txt); }
  else { ruim++; console.log('  FALHA ' + txt + (det != null ? '  → ' + det : '')); }
};

/* ── a armadilha que já me pegou TRÊS vezes ────────────────────────────────
   O CM_HELPER e o SL_CSS são template literals, e uma crase dentro de um
   COMENTÁRIO fecha a literal — o arquivo vira JS inválido e o painel morre com
   "Unexpected identifier". Não dá para ver lendo: o comentário parece inocente.
   Conferir aqui custa nada e avisa antes de o Renan gerar o deck. */
console.log('\n═══ 0 · crase dentro das template literals (a armadilha recorrente) ═══');
{
  const html = readFileSync(new URL('../check-metas/index.html', import.meta.url), 'utf8');
  const js   = readFileSync(new URL('../check-metas/slides.js',  import.meta.url), 'utf8');
  const entre = (t, ini, fim) => { const i = t.indexOf(ini); if (i < 0) return '';
    const j = t.indexOf(fim, i + ini.length); return j < 0 ? '' : t.slice(i + ini.length, j); };
  const helper = entre(html, 'const CM_HELPER=`', '\n};`;');
  const css    = entre(js,   'const SL_CSS = `', '\n`;\n');
  af(helper.length > 500 && !helper.includes('`'),
     'o CM_HELPER não tem crase dentro (ela fecharia a literal)',
     helper.length + ' chars · ' + (helper.match(/.{0,40}`.{0,40}/s) || [''])[0]);
  af(css.length > 500 && !css.includes('`'),
     'o SL_CSS também não', css.length + ' chars · ' + (css.match(/.{0,40}`.{0,40}/s) || [''])[0]);
  /* E O HELPER TEM DE SER JS VÁLIDO DEPOIS DE PASSAR PELA TEMPLATE LITERAL
     (bug real, 20/09/2026): um "\n" com barra simples dentro de uma regex do
     helper vira uma quebra de linha de verdade e TODO slide morre com
     "Invalid regular expression: missing /". Lendo o arquivo não dá para ver. */
  let helperOk = true, helperErr = '';
  try { new Function(eval('`' + helper + '\n};`')); } catch (e) { helperOk = false; helperErr = e.message; }
  af(helperOk, 'o CM_HELPER é JS válido depois de virar string (as barras das regex estão dobradas)', helperErr);
}

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });

async function abre({ semJunEm = null, gateEm = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  // o build-check registra o service worker e pode recarregar a página no meio
  // do teste ("execution context was destroyed") — fora, não é o que se mede aqui
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/sw.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => {
    const u = r.request().url();
    const body = u.includes('datalabels') ? 'window.ChartDataLabels={id:"datalabels"};'
      : u.includes('chart') ? SHIM_CHART
      : u.includes('html2canvas') ? SHIM_H2C
      : u.includes('jspdf') ? SHIM_JSPDF
      : u.includes('pptxgen') ? SHIM_PPTX
      : u.includes('supabase') ? SHIM_SB
      : '/* nada */';
    r.fulfill({ status: 200, contentType: 'text/javascript', body });
  });
  // todo painel do roteiro entra dublado
  for (const p of ['scorecard','resumo-executivo','visao-financeira','rs-por-km','painel-km',
                   'seara-km','fca-consolidado','combustivel/arvore-combustivel','combustivel/seara/arvore','auditorias',
                   'programa-reconhecimento','painel-metas']) {
    await ctx.route(BASE + '/' + p + '/', r => r.fulfill({ status: 200, contentType: 'text/html;charset=utf-8',
      body: painelDuble(p === semJunEm ? VIGS_SEM_JUN : VIGS_OK, DIAL_DE[p], p === gateEm) }));
  }
  const pg = await ctx.newPage();
  /* A PROVA SAI DO __cm.extrai, não do html2canvas: a tabela deixou de ser
     fotografada e virou dado, então o recorder antigo não via mais esses
     slides. Aqui o teste embrulha o extrai no momento em que o motor o
     instala no iframe — e anota se o slide saiu como TABELA ou imagem. */
  /* A PROVA NÃO PODE DEPENDER DO extrai: o slide da Árvore sai como FOTO e o
     1º do Painel de Metas pede hero+gráficos (semTab), e nenhum dos dois passa
     por ele — sem isto esses slides sumiriam do relatório do teste, que é
     justamente onde os defeitos moram. O `topo` roda em TODO cap. */
  await ctx.addInitScript(() => {
    if (window.top === window) return;
    let v;
    Object.defineProperty(window, '__cm', {
      configurable: true, get(){ return v; },
      set(nv){
        v = nv;
        const topo = nv.topo;
        nv.topo = function(el){
          try {
            const e = document.getElementById('estado');
            window.top.__provas.push({ pag: location.pathname,
              estado: e ? JSON.parse(e.textContent) : null,
              alvo: (el && (el.id || el.className)) || 'sem-alvo',
              tipo: 'imagem' });
          } catch (err) {}
          return topo.call(this, el);
        };
        const orig = nv.extrai;
        nv.extrai = function(el){
          const r = orig.call(this, el);
          try {
            const p = window.top.__provas;
            if (p.length && r) { const u = p[p.length - 1];
              u.tipo = 'tabela'; u.alvo = (el && (el.id || el.className)) || u.alvo; }
          } catch (err) {}
          return r;
        };
        const kc = nv.kcols, kp0 = nv.kpis;
        nv.kpis = function(el){ const r = kp0.call(this, el);
          try { const p = window.top.__provas; if (p.length) p[p.length-1].nKpi = (r||[]).length; } catch(e){}
          return r; };
        nv.kcols = function(el){ const r = kc.call(this, el);
          try { const p = window.top.__provas; if (p.length) p[p.length-1].kcols = r; } catch(e){}
          return r; };
        const gs = nv.grafs, hs = nv.heros;
        nv.grafs = function(el){ const r = gs.call(this, el);
          try { const p = window.top.__provas; if (p.length) p[p.length-1].nGraf = (r||[]).length; } catch(e){}
          return r; };
        nv.heros = function(el){ const r = hs.call(this, el);
          try { const p = window.top.__provas; if (p.length) p[p.length-1].nHero = (r||[]).length; } catch(e){}
          return r; };
      }
    });
  });
  await pg.addInitScript(() => { window.__provas = []; try{ localStorage.setItem('bi_theme','dark'); }catch(e){}
    window.CM_TEMPOS = { passo:60, quieto:1, min:120, teto:9000, pos:60, tema:30 }; });
  pg.on('pageerror', e => console.log('  [erro na página] ' + e.message));
  await pg.goto(BASE + '/check-metas/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.ROTEIRO === undefined || document.querySelectorAll('#body-rot tr').length > 0, { timeout: 15000 });
  return { ctx, pg };
}

// ── 1 · roteiro ──────────────────────────────────────────────
console.log('\n═══ 1 · o roteiro sai da tabela `fca`, não de uma lista fixa ═══');
{
  const { ctx, pg } = await abre();
  const r = await pg.evaluate(() => ROTEIRO.map(s => ({ t:s.t, tit:s.tit||s.txt, sub:s.sub, url:s.url,
    caps:(s.caps||[]).length, rots:(s.caps||[]).map(c=>c.rot||''),
    urls:(s.caps||[]).map(c=>c.url||s.url).join(' '),
    prep:(s.caps||[]).map(c=>c.prep).join(' ') })));
  af(r[0].t === 'capa', 'o 1º slide é a capa');
  af(r[1].t === 'p' && /scorecard\/$/.test(r[1].url || ''), 'o 2º é o Scorecard — sem a divisória FROTA (a "2ª capa" saiu, 20/09/2026)', r[1].tit);
  af(r.some(s => /scorecard\/$/.test(s.url || '')), 'tem o Scorecard');
  af(r.some(s => /resumo-executivo/.test(s.url || '')), 'tem o Resumo Executivo');
  const secs = r.filter(s => s.t === 'sec').map(s => s.tit);
  /* sem a divisória "Frota" depois da capa (Renan, 20/09/2026: "a segunda
     capa nem precisa") — a capa já diz FROTA */
  af(JSON.stringify(secs) === JSON.stringify(['Pneus','Manutenção','Combustíveis','Resultados']),
     'as divisórias são Pneus · Manutenção · Combustíveis · Resultados (sem a 2ª capa "Frota")', secs.join(' / '));
  const capa = r.find(s => s.t === 'capa');
  af(capa && /^FROTA$/.test(capa.sub || ''), 'a capa diz só FROTA', capa && capa.sub);
  /* ÁRVORE E FCA EM SLIDES SEPARADOS (Renan, 19/09/2026: "se precisar separar
     para caber, faça, mas quero as árvores"). Empilhados no mesmo slide, a
     árvore — que é um desenho com conectores — ficava com meia página e
     ilegível. Dois recortes de Combustíveis = 4 slides, aos pares. */
  const comb = r.filter(s => /Combustíveis – /.test(s.tit || ''));
  af(comb.length === 6, 'Combustíveis: a Árvore e o FCA em slides próprios (3 recortes)', comb.length);
  af(comb.filter(s => /arvore-combustivel/.test(s.url || '')).length === 2,
     'duas árvores Ambev, uma por unidade+projeto', JSON.stringify(comb.map(s => s.url)));
  /* A ANG É A SEARA (bug real, 20/09/2026: "Árvore Seara saiu tudo zerado"):
     a Árvore Ambev não tem a unidade, então a dela sai da Árvore da Seara. */
  const arvAng = comb.find(s => /ANG/.test(s.tit || '') && !/fca/.test(s.url || ''));
  af(arvAng && /combustivel\/seara\/arvore/.test(arvAng.url || ''),
     'a árvore da ANG sai da Árvore da SEARA, não da Ambev', arvAng && arvAng.url);
  af(arvAng && /Seara/.test(arvAng.sub || ''), 'e o subtítulo diz que é a Seara', arvAng && arvAng.sub);
  af(comb.filter(s => /fca-consolidado/.test(s.url || '')).length === 3,
     'e o FCA de cada uma logo depois');
  af(/arvore/.test(comb[0].url) && /fca/.test(comb[1].url),
     'nessa ordem: a árvore explica, o FCA responde', comb.map(s=>s.url).join(' '));

  /* UM SLIDE POR RECORTE, NÃO POR LINHA DO FCA (bug real, 20/09/2026): a
     tabela `fca` tem uma linha por causa, e PIR com três causas virava TRÊS
     slides idênticos — a causa de fundo do "esse FCA repetiu 3 vezes". */
  const fcaMan = r.filter(s => /fca-consolidado/.test(s.url || '')
    && (s.tit === 'Manutenções' || /^Manutenções – /.test(s.tit || '')));
  const capsPir = fcaMan.flatMap(s => s.rots || []).concat(fcaMan.map(s => s.tit));
  af(fcaMan.filter(s => /PIR/.test(s.tit + ' ' + (s.rots||[]).join(' '))).length === 1,
     'PIR com três causas dá UM slide, não três', JSON.stringify(fcaMan.map(s => s.tit)));

  /* FCA CURTO DIVIDE A PÁGINA (Renan, 20/09/2026: "se for apenas uma linha
     pode agrupar mais de uma unidade") */
  const agrup = fcaMan.filter(s => s.caps > 1);
  af(agrup.length >= 1, 'os FCAs curtos entram juntos num slide',
     JSON.stringify(fcaMan.map(s => s.tit + '=' + s.caps)));
  af(fcaMan.every(s => s.caps <= 4), 'no máximo quatro por página',
     JSON.stringify(fcaMan.map(s => s.caps)));
  af(agrup.every(s => (s.rots||[]).every(t => /desvio de R\$/.test(t))),
     'cada uma com o seu rótulo e o seu desvio', JSON.stringify(agrup[0] && agrup[0].rots));
  af(fcaMan.reduce((n,s)=>n+s.caps,0) === 4,
     'as quatro unidades preenchidas aparecem, nem a mais nem a menos',
     fcaMan.reduce((n,s)=>n+s.caps,0));

  /* NÃO PREENCHEU, NÃO ENTRA (Renan, 20/09/2026: "se não preencheu, mesmo
     desviando não traz") — o MCC desviou R$ 44 mil e ficou sem causa/ação. */
  af(!r.some(s => /MCC/.test(s.tit + ' ' + (s.rots||[]).join(' '))),
     'unidade que desviou mas não preencheu o FCA fica fora',
     JSON.stringify(r.filter(s => /MCC/.test(s.tit||'')).map(s=>s.tit)));

  af(!r.some(s => /Pneus – /.test(s.tit || '')), 'Pneus de MAI não entra no deck de JUN');
  af(r.filter(s => s.t === 'p').every(s => !/undefined/.test(s.prep)), 'nenhum prep com "undefined"');
  await ctx.close();
}

// ── 2 · o motor aplica visão e filtro ────────────────────────
console.log('\n═══ 2 · cada slide sai na visão e no filtro que o roteiro pediu ═══');
let provas1 = [];
{
  const { ctx, pg } = await abre();
  await pg.evaluate(() => gerar('pdf'));
  await pg.waitForFunction(() => !window.GERANDO && document.getElementById('ov-fim').style.display === 'flex', { timeout: 180000 });
  provas1 = await pg.evaluate(() => window.__provas);
  const pdf = await pg.evaluate(() => window.__pdf);
  const nSlides = await pg.evaluate(() => ROTEIRO.length);

  const sc = provas1.find(p => /\/scorecard\//.test(p.pag));
  af(sc && sc.estado.vw === 'resumo', 'Scorecard: visão "resumo"', sc && sc.estado.vw);
  af(sc && JSON.stringify(sc.estado.filtros['ms-vig']) === '["jun/26"]', 'Scorecard: ms-vig no dialeto dele (jun/26)', sc && JSON.stringify(sc.estado.filtros['ms-vig']));
  // cada painel escreve a vigência de um jeito: o mês tem de casar em TODOS
  const km = provas1.find(p => /painel-km/.test(p.pag));
  af(km && JSON.stringify(km.estado.filtros['ms-vig']) === '["06/2026"]',
     'Painel KM: casa pelo rótulo longo (jun/2026) e marca o valor 06/2026', km && JSON.stringify(km.estado.filtros['ms-vig']));
  const sk = provas1.find(p => /seara-km/.test(p.pag));
  af(sk && JSON.stringify(sk.estado.filtros['ms-vig']) === '["06/2026"]', 'Seara KM: idem', sk && JSON.stringify(sk.estado.filtros['ms-vig']));
  af(sc && sc.estado.tema === 'light', 'o painel foi para o tema claro (o deck é claro)', sc && sc.estado.tema);

  const vf = provas1.filter(p => /visao-financeira/.test(p.pag));
  af(vf.length >= 7, 'Visão Financeira aparece nos 7+ slides do roteiro', vf.length);
  af(vf[0].estado.filtros['ms-vig'].length === 6, 'Acum: os 6 meses de jan a jun ficam marcados', vf[0].estado.filtros['ms-vig'].length);
  af(JSON.stringify(vf[1].estado.filtros['ms-vig']) === '["2026-06"]', 'o slide do mês marca só junho');
  const pac = vf.filter(p => p.estado.dim === 'pacote');
  af(pac.length >= 2 && pac[0].estado.ref === 'REM' && pac[1].estado.ref === 'ORÇ',
     'Custo Pacotes sai duas vezes: vs REM e depois vs ORÇ', pac.map(p=>p.estado.ref).join(','));
  const abertura = vf.filter(p => p.estado.dim === 'uni');
  af(abertura.length === 3, 'as 3 aberturas (Pneus, Manutenção, Combustíveis) vão na aba UNIDADE', abertura.length);
  af(JSON.stringify(abertura.map(p => p.estado.filtros['ms-pac'][0])) === '["Pneus","Manutenções","Combustíveis"]',
     'cada abertura leva o seu pacote no filtro', JSON.stringify(abertura.map(p => p.estado.filtros['ms-pac'])));

  const fca = provas1.filter(p => /fca-consolidado/.test(p.pag));
  af(fca.length === 7, 'sete recortes de FCA (4 de Manutenções + 3 de Combustíveis)', fca.length);
  af(fca.every(p => p.estado.vw === 'tabela'), 'o FCA sai na visão Tabela');
  af(fca.every(p => p.estado.chamou.includes('run')), 'o FCA foi redesenhado (run)');
  const fc = fca.find(p => p.estado.filtros['ms-fato'][0] === 'Combustíveis');
  af(fc && fc.estado.filtros['ms-uni'][0] === 'CGR' && /CGR/.test(fc.estado.filtros['ms-proj'][0]),
     'o FCA de Combustíveis vem com unidade E o nível 3 INTEIRO (ao contrário da Árvore)',
     fc && JSON.stringify([fc.estado.filtros['ms-uni'], fc.estado.filtros['ms-proj']]));

  /* O REDESENHO NÃO PODE DEPENDER DO NOME (bug real na 1ª geração, 19/09):
     o roteiro chamava run() no fca-consolidado, que redesenha com render() —
     o prep morria com "run is not defined" e o slide saía com o recorte
     antigo, sem nada dizendo isso. O painel dublado não tem run NEM render,
     então este caso só passa se a rede funcionar. */
  af(fca.every(p => (p.estado.chamou || []).length > 0),
     'o FCA é redesenhado mesmo sem a função que o roteiro pediu',
     JSON.stringify(fca.map(p => p.estado.chamou)));
  af(!(provas1.some(p => (p.faltou || []).some(m => /não tem função de redesenho/.test(m)))),
     'e nenhum painel ficou sem redesenho');

  const arv = provas1.filter(p => /arvore-combustivel/.test(p.pag));
  af(arv.length === 2 && arv.every(p => p.estado.chamou.includes('onFilterChange')), 'as 2 árvores foram redesenhadas');
  af(arv[0].estado.filtros['ms-nv3'].length === 1, 'a árvore vem recortada no projeto', JSON.stringify(arv[0].estado.filtros['ms-nv3']));
  af(JSON.stringify(arv.map(p => p.estado.filtros['ms-nv3'][0]).sort()) === '["AS","ROTA"]',
     'a Árvore leva o PREFIXO do nível 3 (AS/ROTA), que é o que o filtro dela lista',
     JSON.stringify(arv.map(p => p.estado.filtros['ms-nv3'])));
  af(arv.every(p => p.estado.filtros['ms-vig'].length === 1),
     'e a vigência casa também no dialeto MM/AAAA da Árvore', JSON.stringify(arv.map(p => p.estado.filtros['ms-vig'])));
  const arvSea = provas1.filter(p => /seara\/arvore/.test(p.pag));
  af(arvSea.length === 1 && arvSea[0].estado.chamou.includes('onFilterChange'), 'a Árvore da Seara foi redesenhada', arvSea.length);
  af(arvSea[0] && arvSea[0].estado.filtros['ms-vig'].length === 1 && !(arvSea[0].estado.filtros['ms-nv3']||[]).length,
     'a Árvore da Seara leva só a vigência (é só ANG, não tem filtro de unidade/projeto)',
     arvSea[0] && JSON.stringify(arvSea[0].estado.filtros));

  const pr = provas1.filter(p => /programa-reconhecimento/.test(p.pag));
  af(pr.length === 4, 'Frota de Elite: ranking, dois pódios e a evolução', pr.length);
  af(pr[0].alvo === 'ranking-table', 'o ranking sai como TABELA, sem a moldura do card', pr[0].alvo);
  af(JSON.stringify(pr[0].estado.selVig) === '["jun/26"]',
     'o Frota de Elite casa a vigência pela lista dele, não por um formato chutado',
     JSON.stringify(pr[0].estado.selVig));
  af(pr[2] && pr[2].estado.selVig.length === 6, 'o pódio acumulado leva os 6 meses', pr[2] && pr[2].estado.selVig.length);
  /* O PÓDIO É MONTADO, NÃO FOTOGRAFADO (Renan, 19/09/2026): ele saía como
     tarja escura estreita boiando no slide branco, com os degraus cortados.
     Agora o slide lê o RANKING — o mesmo dado — e desenha os três degraus
     em página escura inteira. */
  af(pr[1].alvo === 'ranking-table', 'o pódio sai do ranking, que é o mesmo dado', pr[1].alvo);
  const pods = (await pg.evaluate(() => window.__slInsp || [])).filter(x => x.nPod);
  af(pods.length >= 1, 'o pódio é desenhado com os três degraus', pods.length);
  af(pods.every(x => /escuro/.test(x.cls)), 'em slide escuro inteiro, não uma tarja no branco',
     pods[0] && pods[0].cls);
  af(pods.every(x => x.nPod === 3), 'com os três lugares', pods[0] && pods[0].nPod);
  af(pr[3] && pr[3].estado.selVig.length === 0, 'a evolução usa o ano inteiro (sem filtro)',
     pr[3] && JSON.stringify(pr[3].estado.selVig));

  const ovlog = await pg.evaluate(() => (document.getElementById('ov-log')||{}).innerText || '');
  af(pdf && pdf.pgs.length === nSlides, 'o PDF tem uma página por slide',
     (pdf && pdf.pgs.length + ' de ' + nSlides) + (pdf && pdf.pgs.length !== nSlides ? ' · log=' + ovlog.slice(-300) : ''));
  /* AGORA TODA página é arte de página inteira — capa, divisória e slide de
     painel. Antes só a capa e as divisórias eram, e o resto era texto do
     jsPDF por cima de branco; foi dele que vieram os defeitos de 19/09. */
  af(pdf && pdf.cheias === pdf.pgs.length,
     'toda página é arte de página inteira, encostada na borda',
     pdf && pdf.cheias + ' de ' + pdf.pgs.length);
  af(pdf && pdf.txts.length === 0,
     'e nada é escrito por cima pelo gerador de PDF', pdf && JSON.stringify(pdf.txts));
  af(pdf && /^Check_de_Metas_2026_06\.pdf$/.test(pdf.arquivo), 'o arquivo sai com o mês no nome', pdf && pdf.arquivo);
  const rots = (await pg.evaluate(() => window.__slInsp || [])).flatMap(x => x.rot || []);
  af(rots.includes('Vs Remunerado') && rots.includes('Vs Orçado'),
     'os rótulos dos dois blocos vão DENTRO da arte do slide', JSON.stringify(rots.slice(0, 6)));

  // ── o coração da mudança: tabela é DADO, não print ──
  const tabs = provas1.filter(p => p.tipo === 'tabela');
  af(tabs.length >= 10, 'as tabelas saem como dados, não como print', tabs.length + ' de ' + provas1.length);
  af(provas1.filter(p => /rs-por-km/.test(p.pag)).every(p => p.tipo === 'tabela'),
     'o R$/Km vira tabela desenhada no slide');
  /* ══ O SLIDE É DESENHADO NO PADRÃO (Renan, 19/09/2026) ══
     Estas provas substituem as do desenho antigo (texto nativo no jsPDF).
     Foi ele que gerou o Δ virando aspas, o acento comido e a coluna
     truncada — agora o slide é uma página HTML com os tokens do portal. */
  const ins = (await pg.evaluate(() => window.__slInsp || [])).filter(x => !x.erro);
  const pain = ins.filter(x => x.nLin || x.nKpi || x.nCanvas || x.img);
  af(pain.length >= 10, 'todo slide de conteúdo passa pelo desenho do padrão', pain.length);
  af(pain.every(x => x.w === 1600 && x.h === 900), 'o slide é 1600×900 (16:9 exato)',
     JSON.stringify(pain.map(x => x.w + 'x' + x.h).filter((v,i,a) => a.indexOf(v) === i)));
  af(pain.every(x => /Montserrat/i.test(x.fonte)), 'Montserrat em tudo',
     (pain.find(x => !/Montserrat/i.test(x.fonte)) || {}).fonte);

  /* o fundo tem de ser o cinza do portal, nunca branco — era a emenda que
     aparecia como borda entre a imagem e o slide */
  const claros = pain.filter(x => !/escuro/.test(x.cls));
  af(claros.length && claros.every(x => x.fundo === 'rgb(225, 226, 229)'),
     'o fundo do slide é o cinza do portal, não branco',
     (claros.find(x => x.fundo !== 'rgb(225, 226, 229)') || {}).fundo);

  /* a listra laranja do PPT dele: topo, encostada à direita, metade da largura */
  const li = pain.map(x => x.listra).filter(Boolean);
  af(li.length === pain.length, 'todo slide leva a listra', li.length + ' de ' + pain.length);
  af(li.every(l => l.dir === 0 && l.topo === 0), 'encostada no canto superior direito',
     JSON.stringify(li[0]));
  af(li.every(l => l.larg >= .45 && l.larg <= .55), 'ocupando ~metade da largura', li[0] && li[0].larg);
  af(li.every(l => /249, 115, 22/.test(l.cor)), 'no laranja do portal', li[0] && li[0].cor);

  /* o que ele reprovou, célula a célula */
  const comTab = ins.filter(x => x.nLin > 0);
  af(comTab.length >= 8, 'as tabelas foram desenhadas no slide', comTab.length);
  const ofensoras = comTab.flatMap(x => x.cels).filter(t => /…|\.\.\.$/.test(t));
  af(!ofensoras.length, 'nenhum texto sai truncado com reticências',
     JSON.stringify(ofensoras.slice(0, 5)));
  af(comTab.every(x => !x.transborda), 'e nenhuma coluna vaza para fora da tabela');
  const todasCels = comTab.flatMap(x => x.cels);
  af(todasCels.some(t => /Δ/.test(t)), 'o Δ continua Δ — não virou aspas',
     todasCels.filter(t => /"/.test(t)).slice(0,3).join(' | '));
  af(todasCels.includes('Combustíveis'), 'e o acento não come letra ("Combu tívei")',
     todasCels.filter(t => /Combu/.test(t)).join(' | '));

  /* ══ O QUE ELE REPROVOU NA 1ª GERAÇÃO REAL (19/09/2026) ══ */

  /* 0 · UMA LINHA POR SLIDE (bug real achado em 19/09/2026 ao medir isto): o
     paginador comparava `wrap.scrollHeight` com uma altura estimada, e como o
     wrap é flex:1 o scrollHeight nunca fica abaixo do clientHeight — dava
     verdadeiro já na 1ª linha. O R$/Km de 4 linhas virava QUATRO slides de uma
     linha, e o deck inflava sem ninguém ver o motivo. */
  const cont = ins.filter(x => /continuação/.test(x.sub || ''));
  af(!cont.length, 'tabela de 4 linhas cabe num slide — nada de uma linha por página',
     JSON.stringify(cont.map(x => x.tit + ' | ' + x.nLin + ' linha(s)')));
  af(comTab.every(x => x.nLin >= 2), 'e todo slide de tabela traz mais de uma linha',
     JSON.stringify(comTab.map(x => x.tit + '=' + x.nLin)));

  /* 0b · O FCA NÃO REPETE O RECORTE EM TODA LINHA (Renan, 19/09/2026: "esse
     FCA repetiu 3 vezes, não entendi"). São três registros do MESMO pacote com
     causas diferentes — o que repetia de verdade eram Unidade, Projeto e
     Vigência, que já estão no título do slide, e o Fato. Tirando as três, o
     cabeçalho para de cortar em "PROJET"/"RESPONS" e a data para de quebrar. */
  const fcaCaps = provas1.filter(p => /fca-consolidado/.test(p.pag) && p.estado);
  const slFca = ins.filter(x => (x.cabs || []).includes('CAUSA'));
  af(slFca.length >= 1, 'o slide de FCA saiu com a tabela do painel', slFca.length);
  /* NADA SAI DA TABELA DO FCA (Renan, 20/09/2026: "coluna unidade, igual o
     FCA do painel. Não invente"). Eu tinha tirado Unidade/Projeto/Vigência
     achando que o título bastava; não era meu para decidir. */
  af(slFca.every(x => ['UNIDADE','PROJETO','VIGÊNCIA'].every(c => x.cabs.includes(c))),
     'a tabela do slide é a do painel, com Unidade, Projeto e Vigência',
     JSON.stringify(slFca[0] && slFca[0].cabs));
  af(slFca.every(x => ['FATO','CAUSA','AÇÃO','RESPONSÁVEL','PRAZO','STATUS'].every(c => x.cabs.includes(c))),
     'e com o que interessa inteiro, sem cortar o rótulo', JSON.stringify(slFca[0] && slFca[0].cabs));
  af(slFca.every(x => x.nLin >= 3), 'as três linhas do recorte continuam lá',
     JSON.stringify(slFca.map(x => x.nLin)));
  af(slFca.some(x => x.cels.some(t => /10\/11\/2026|30\/09\/2026/.test(t))),
     'a data inteira, sem quebrar no meio', JSON.stringify((slFca[0]||{cels:[]}).cels.filter(t=>/\//.test(t)).slice(0,3)));
  af(slFca.every(x => x.chips.some(c => /andamento/i.test(c.t))),
     'e o status continua sendo a pílula colorida do painel',
     JSON.stringify((slFca[0]||{chips:[]}).chips.map(c=>c.t)));
  /* O FATO APARECE UMA VEZ POR GRUPO (Renan, 19/09/2026, duas vezes: "FCA PIR
     repetindo 3 vezes de novo"). São três registros do mesmo pacote, então a
     coluna Fato trazia o mesmo bloco três vezes e a página parecia o mesmo FCA
     copiado. Nada é removido: o que muda (Causa, Ação, Prazo) é que aparece. */
  /* O FATO VAI EM TODA LINHA, como no painel (Renan, 20/09/2026: "uma delas
     veio sem o fato"). O agrupamento que apagava o repetido era invenção
     minha e saiu. */
  const fatos = (slFca[0] || {cels:[]}).cels.filter(t => /Manutenções/.test(t));
  af(fatos.length >= 3, 'o Fato aparece em cada linha, como no painel', fatos.length);
  /* AS SETAS PINTADAS (Renan: "os ▲ e ▼ podem vir pintados de vermelho e
     verde") — a cor de cada trecho, não uma cor por célula */
  const setas = slFca.flatMap(x => x.setas || []);
  af(setas.some(t => t === '▲=rgb(255, 0, 0)'), 'o ▲ do Fato sai vermelho', JSON.stringify(setas.slice(0,4)));
  af(setas.some(t => t === '▼=rgb(0, 179, 0)'), 'e o ▼ sai verde', JSON.stringify(setas.filter(t=>/▼/.test(t)).slice(0,2)));
  /* ORIGEM = CUSTOS (Renan: "Pneus GRL você trouxe da origem RPM") */
  af(fcaCaps.every(p => JSON.stringify(p.estado.filtros['ms-org']) === '["Custos"]'),
     'todo FCA do deck vem com Origem = Custos, nunca o indicador da RPM',
     JSON.stringify(fcaCaps.map(p => p.estado.filtros['ms-org'])));

  /* 1 · "tabela com cor sim cor não" — a tabela do portal não tem zebra */
  af(comTab.every(x => x.zebra === false || x.zebra === null),
     'nenhuma tabela sai com linha zebrada',
     JSON.stringify(comTab.filter(x => x.zebra).map(x => x.tit)));

  /* 2 · "auditorias sem as cores dos níveis" e "ranking do Frota de Elite
     totalmente sem cor" — a cor mora num <span> dentro do <td>, e ler o td
     devolvia a herdada. Estas duas provas falham no código antigo. */
  const aud = ins.filter(x => /Auditorias/.test(x.tit));
  af(aud.length === 2, 'as DUAS tabelas de auditoria viram slide (Demarco e DPO/VPO)', aud.length);
  const chAud = aud.flatMap(x => x.chips);
  af(chAud.length >= 4, 'a cor do nível chega ao slide como chip', chAud.length);
  af(chAud.some(c => c.bg === 'rgb(59, 179, 59)') && chAud.some(c => c.bg === 'rgb(234, 67, 53)'),
     'com o fundo que o painel escolheu para cada nível',
     JSON.stringify(chAud.map(c => c.t + '=' + c.bg)));
  af(chAud.every(c => c.bloco), 'preenchendo a célula, como o .niv do painel',
     JSON.stringify(chAud.map(c => c.bloco)));
  const rk = ins.filter(x => x.nLin && x.cels.includes('CDI MACACU'));
  af(rk.length >= 1, 'o ranking do Frota de Elite saiu como tabela', rk.length);
  const chRk = rk.flatMap(x => x.chips);
  af(chRk.some(c => /97,3/.test(c.t) && c.bg === 'rgb(59, 179, 59)'),
     'a pílula de pontuação mantém o verde do painel', JSON.stringify(chRk.map(c => c.t + '=' + c.bg)));
  const celsRk = rk.flatMap(x => x.chips.map(c => c.cor));
  af(rk.some(x => x.chips.some(c => c.bg === 'rgb(244, 161, 0)')),
     'e o âmbar e o vermelho vêm junto, não tudo cinza');

  /* 3 · "pódios sem os bonecos" — a prova do rótulo de dados vem mais abaixo,
     junto do resto do gráfico */
  af(pods.every(x => (x.avatares || []).length === 3),
     'o pódio leva o boneco de cada um dos três', JSON.stringify(pods.map(x => (x.avatares||[]).length)));
  af(pods.every(x => (x.avatares || []).every(s => /^data:image|avatares\//.test(s || ''))),
     'e a imagem é a do painel, não arte nova', JSON.stringify((pods[0]||{}).avatares || []));
  /* O BRASÃO do Frota de Elite atrás (Renan: "poderia usar toda a temática") */
  af(pods.every(x => x.brasao), 'e o brasão do Frota de Elite fica atrás', JSON.stringify(pods.map(x=>x.brasao)));

  /* 4 · "painel de metas não aparece" */
  /* DOIS slides: hero+gráficos e a tabela inteira (Renan: "se coubesse tudo
     até mais legal"). Numa página só a tabela era espremida pelo gráfico. */
  const pm = provas1.filter(p => /painel-metas/.test(p.pag));
  af(pm.length === 2, 'o Painel de Metas sai em dois slides', pm.length);
  af(pm[0] && pm[0].nHero >= 1 && pm[0].nGraf >= 1,
     'o 1º leva o hero e os gráficos', pm[0] && pm[0].nHero + '/' + pm[0].nGraf);
  af(pm[0] && pm[0].tipo === 'imagem', 'sem a tabela, que vai no seguinte', pm[0] && pm[0].tipo);
  af(pm[1] && pm[1].tipo === 'tabela', 'e o 2º é a tabela inteira', pm[1] && pm[1].tipo);
  const pmSl = ins.filter(x => x.cels.includes('Disponibilidade') && x.cels.includes('Conformidade'));
  af(pmSl.length >= 1, 'e o slide dele existe no deck, com os indicadores', pmSl.length);
  af(pmSl.every(x => !x.vazio), 'não como página de aviso');
  af(!ins.some(x => x.vazio), 'nenhum slide saiu como "o painel não entregou dado"',
     JSON.stringify(ins.filter(x => x.vazio).map(x => x.tit)));

  /* A FOTO SEM O CARD BRANCO (Renan: "por que essa porra branca no fundo?" ·
     "por que não distribui mais"). O painel já vem com o fundo dele; o card
     claro por baixo virava um slab e o padding ainda encolhia a imagem. */
  const comFoto2 = ins.filter(x => x.foto);
  af(comFoto2.length >= 1, 'o slide de foto existe (a Árvore)', comFoto2.length);
  af(comFoto2.every(x => /rgba\(0, 0, 0, 0\)|transparent/.test(x.foto.fundo)),
     'a foto vai direto sobre o slide, sem card branco atrás',
     JSON.stringify(comFoto2.map(x => x.foto.fundo)));
  af(comFoto2.every(x => x.foto.borda === '0px'), 'e sem moldura',
     JSON.stringify(comFoto2.map(x => x.foto.borda)));
  af(comFoto2.every(x => x.foto.larg >= 1100), 'usando a página (limitada pela altura, na proporção certa)',
     JSON.stringify(comFoto2.map(x => x.foto.larg)));

  /* TABELA SÓ DE COLUNAS CURTAS TEM DE DISTRIBUIR (Renan, 20/09/2026: "aqui
     dá para distribuir um pouco melhor"). Eu marcava toda coluna curta com
     width:1%; sem nenhuma coluna larga para absorver a sobra, ela foi inteira
     para a primeira e abriu um vão entre UNIDADE e REM. */
  const curtas = comTab.filter(x => x.larg && x.larg.encolhe === 0);
  af(curtas.length >= 1, 'existe tabela só de colunas curtas no deck', curtas.length);
  af(curtas.every(x => x.larg.pri <= 0.45),
     'e nela a 1ª coluna não fica com a sobra toda',
     JSON.stringify(curtas.map(x => x.tit + '=' + x.larg.pri)));
  const mistas = comTab.filter(x => x.larg && x.larg.encolhe > 0);
  af(mistas.length >= 1, 'e a tabela com DUAS colunas largas (o FCA) continua encolhendo as curtas',
     JSON.stringify(mistas.map(x => x.tit + '=' + x.larg.encolhe)));
  /* UMA coluna larga e várias curtas — a abertura por conta e por unidade — é
     o caso em que a sobra ia toda para o rótulo e abria um vão até o 1º
     número (Renan, 20/09/2026: "todas as tabelas assim, sem distribuir"). */
  const umaLarga = comTab.filter(x => (x.cabs||[]).includes('CONTA'));
  af(umaLarga.length >= 1, 'a abertura por conta está no deck', umaLarga.length);
  af(umaLarga.every(x => x.larg.encolhe === 0),
     'com UMA coluna larga, ninguém é encolhido — o browser reparte',
     JSON.stringify(umaLarga.map(x => x.larg.encolhe)));
  af(umaLarga.every(x => x.larg.pri <= 0.45),
     'e a coluna do rótulo não fica com a sobra toda',
     JSON.stringify(umaLarga.map(x => x.tit + '=' + x.larg.pri)));

  /* SOBRA DE ALTURA VIRA RESPIRO: a abertura de 12 unidades ocupava o terço
     de cima do slide e deixava dois terços em branco. */
  /* A SOBRA DE ALTURA NÃO VIRA PADDING (revertido em 20/09/2026: inflou o
     cabeçalho até virar uma placa, abriu vão, esticou tabela que já estava boa
     e fez caber MENOS linha — a RON das Auditorias e a 13ª do Ranking caíram
     fora). Tabela curta fica curta. */
  const soT = comTab.filter(x => x.soTab && x.larg);
  af(soT.length >= 3, 'há slides que são só a tabela', soT.length);
  af(soT.every(x => x.alturaTab <= 1.0),
     'e nenhuma estoura a caixa', JSON.stringify(soT.map(x => x.tit + '=' + x.alturaTab)));
  af(!ins.some(x => /não caiu inteira/.test((x.cels||[]).join(' '))),
     'nenhuma tabela ficou com o aviso de que não coube');

  /* O HERO É COMPACTO E SOLTO (Renan, 20/09/2026: "achatou, perdeu
     qualidade" — em coluna ele virou uma faixa alta e roubou a altura do
     gráfico). Deltas ao lado do valor e fundo nenhum. */
  const her = ins.filter(x => x.hero);
  af(her.length >= 1, 'o hero chega ao slide', her.length);
  af(her.every(x => /rgba\(0, 0, 0, 0\)|transparent/.test(x.hero.fundo)),
     'sem faixa clara atrás — o hero é solto sobre a página',
     JSON.stringify(her.map(x => x.hero.fundo)));
  /* A REFERÊNCIA É A IMAGEM 2 DELE (20/09/2026: "quero tudo EXATAMENTE igual"):
     os deltas na linha DE BAIXO do valor — eu tinha invertido e revertido a
     versão certa. É o CSS daquele build, copiado, não reescrito. */
  af(her.every(x => !x.hero.aoLado), 'com os deltas embaixo do valor, como na imagem 2',
     JSON.stringify(her.map(x => x.tit + '=' + x.hero.aoLado)));
  /* A LINHA "Km remunerado: 1.14 mi" EMBAIXO DO REALIZADO (Renan, 20/09/2026:
     "texto, dois pontos e do lado o valor") — entre o número e os deltas */
  const herL = her.filter(x => x.hero.linha);
  af(herL.length >= 1 && herL.every(x => x.hero.linha === 'Km remunerado: 1.14 mi'),
     'o km remunerado vai embaixo do realizado, "texto: valor"', JSON.stringify(her.map(x => x.hero.linha)));
  af(herL.every(x => x.hero.linhaEntre), 'entre o número e os deltas', JSON.stringify(herL.map(x => x.hero.linhaEntre)));
  af(her.every(x => x.hero.alt <= 120), 'e sem virar uma faixa alta',
     JSON.stringify(her.map(x => x.hero.alt)));

  /* FCAs AGRUPADOS = UMA TABELA, UM CABEÇALHO (Renan: "coluna unidade, igual
     o FCA do painel"). Antes era um bloco por unidade, com o cabeçalho
     repetido e fonte minúscula. */
  const junto = ins.filter(x => x.tit === 'Manutenções' && x.nLin > 0);
  af(junto.length >= 1, 'o slide de FCAs agrupados existe', junto.length);
  af(junto.every(x => x.nCab === 9), 'com UM cabeçalho só, o do painel',
     JSON.stringify(junto.map(x => x.nCab)));
  /* o dublê devolve a mesma tabela para toda unidade, então o que se mede é
     que as linhas dos DOIS recortes entraram na mesma tabela */
  af(junto.every(x => x.nLin >= 6), 'e as linhas dos recortes na mesma tabela',
     JSON.stringify(junto.map(x => x.nLin)));

  /* SELEÇÃO PRESA ENTRE UNIDADES (bug real, 20/09/2026: o FCA do PIR saiu
     vazio no slide agrupado). O iframe é reutilizado e a lista de projetos do
     fca-consolidado depende da unidade; para o PIR eu procurava EMPURRADA na
     lista do CGR, não achava, e a seleção ROTA do CGR ficava presa. */
  const pir = fcaCaps.find(p => (p.estado.filtros['ms-uni']||[])[0] === 'PIR');
  af(pir && JSON.stringify(pir.estado.filtros['ms-proj']) === '["EMPURRADA - PIR"]',
     'o PIR entra com o SEU projeto, não com o da unidade anterior',
     pir && JSON.stringify(pir.estado.filtros['ms-proj']));
  af(fcaCaps.every(p => { const u=(p.estado.filtros['ms-uni']||[])[0], pr=(p.estado.filtros['ms-proj']||[])[0];
       return u && pr && pr.endsWith(u.split(' ')[0]); }),
     'e toda unidade vem com o projeto dela',
     JSON.stringify(fcaCaps.map(p => (p.estado.filtros['ms-uni']||[])[0] + '→' + (p.estado.filtros['ms-proj']||[])[0])));
  af(!provas1.some(p => (p.faltou||[]).some(m => /ms-proj/.test(m))),
     'e nenhum filtro de projeto ficou sem casar');

  /* FOTO ALINHADA COM O TÍTULO (o "descentralizado" do Resumo Executivo) */
  const fotos = ins.filter(x => x.foto);
  af(fotos.length >= 1 && fotos.every(x => x.mioPad === '64px'),
     'o slide de foto usa o mesmo respiro dos outros — imagem alinhada com o título',
     JSON.stringify(fotos.map(x => x.tit + '=' + x.mioPad)));
  /* A FOTO NÃO ESTICA (Renan, 20/09/2026: "ainda estão esticando
     verticalmente os dados"): o html2canvas ignora object-fit, então a
     imagem tem de nascer em px na proporção da captura (o dublê devolve
     1200×700). */
  const razao = 1200 / 700;
  af(fotos.every(x => x.fotoEsc && Math.abs(x.fotoEsc.w / x.fotoEsc.h - razao) < 0.03),
     'a imagem da foto guarda a proporção da captura — nada esticado',
     JSON.stringify(fotos.map(x => x.tit + '=' + (x.fotoEsc && (x.fotoEsc.w / x.fotoEsc.h).toFixed(2)))));
  /* e a árvore "achatadinha de leve": 94% da caixa */
  const arvF = fotos.filter(x => /Combustíveis – /.test(x.tit));
  af(arvF.length >= 1 && arvF.every(x => x.fotoEsc.w <= x.fotoEsc.bw * 0.94 + 1
       && (x.fotoEsc.w >= x.fotoEsc.bw * 0.93 || x.fotoEsc.h >= x.fotoEsc.bh * 0.93)),
     'a árvore sai a 94% da caixa', JSON.stringify(arvF.map(x => x.fotoEsc)));
  af(fotos.filter(x => !/Combustíveis – /.test(x.tit)).every(x =>
       x.fotoEsc.w >= x.fotoEsc.bw * 0.99 || x.fotoEsc.h >= x.fotoEsc.bh * 0.99),
     'e só ela — o resto das fotos usa a caixa toda', JSON.stringify(fotos.map(x => x.tit + '=' + JSON.stringify(x.fotoEsc))));

  /* CLASSE "n" COLIDIA com o .n do check-metas (font-size:11px;color:--txt3):
     toda célula numérica saía em 11px cinza, fosse qual fosse a tabela. */
  const numT = comTab.filter(x => x.numFs);
  af(numT.length >= 3, 'há tabelas com célula numérica', numT.length);
  af(numT.every(x => parseFloat(x.numFs) === x.fsTab),
     'a célula numérica tem a fonte da tabela, não os 11px da lateral do check-metas',
     JSON.stringify(numT.map(x => x.tit + '=' + x.numFs + '/' + x.fsTab)));

  /* O QUADRADO BRANCO ATRÁS DA FOTO: o alvo (o .main do layout antigo, que no
     claro é #F0F0F0) pintava o próprio fundo. Agora a captura usa o cinza do
     slide e o alvo fica transparente no clone. */
  const fts = await pg.evaluate(() => window.__fotos || []);
  af(fts.length >= 1, 'houve captura de foto no painel', fts.length);
  af(fts.every(f => f.bg === '#E1E2E5'), 'o fundo da captura é o cinza do slide, não branco',
     JSON.stringify(fts.map(f => f.bg)));
  af(fts.every(f => f.alvoBg === 'transparent'), 'e o alvo não pinta o próprio fundo',
     JSON.stringify(fts.map(f => f.alvo + '=' + f.alvoBg)));

  /* A DENSIDADE DOS KPIs É A DO PAINEL: o Scorecard põe 20 em 10 colunas */
  const kdensa = ins.filter(x => x.cols >= 8);
  af(kdensa.length >= 1, 'a fileira de 20 indicadores sai na densidade do painel',
     JSON.stringify(ins.map(x => x.cols).filter(n => n)));
  af(kdensa.every(x => x.cols === 10), 'em 10 colunas, como o painel',
     JSON.stringify(kdensa.map(x => x.cols)));
  af(kdensa.every(x => x.densa), 'e com o card compacto, para o gráfico ficar com a altura dele');

  /* 5 · "pode diminuir as fontes, 1 a 2px" */
  af(comTab.every(x => x.fsTab <= 15), 'a tabela do slide não passa de 15px',
     JSON.stringify(comTab.map(x => x.fsTab).filter((v,i,a)=>a.indexOf(v)===i)));

  /* o gráfico: desenhado com os dados do painel e SEM animação — era a
     animação que deixava o canvas em branco na hora da foto */
  const chs = await pg.evaluate(() => (window.__charts || []).filter(c => c && c.options && c.options.animation === false));
  const diag = await pg.evaluate(() => ({ nCh:(window.__charts||[]).length,
    temChart: typeof window.Chart, canv: (window.__slInsp||[]).map(x=>x.nCanvas).join(',') }));
  af(chs.length >= 1, 'o gráfico do slide é desenhado com animação desligada',
     chs.length + ' · diag=' + JSON.stringify(diag));
  af(chs.some(c => (c.data.labels || []).join() === 'jan/26,fev/26,mar/26'),
     'com os rótulos que vieram do painel');
  af(chs.some(c => (c.data.datasets[0].data || []).join() === '12.5,8.3,30.7'),
     'e com os números do painel, não recalculados');

  /* RÓTULO DE DADOS NO TOPO DA BARRA (Renan, 19/09/2026: "rótulos de dados dos
     gráficos de barras") — é o padrão do portal e faltava no deck. */
  af(chs.every(c => c.options.plugins && c.options.plugins.datalabels),
     'todo gráfico do slide leva rótulo de dados');
  const fmt = await pg.evaluate(() => {
    const g = (window.__charts || []).find(c => c.options && c.options.plugins
      && c.options.plugins.datalabels && (c.data.labels || []).join() === 'A,B,C');
    const d = g && g.options.plugins.datalabels;
    const ctx = { dataset: {}, datasetIndex: 0, dataIndex: 0 };
    return d ? { rot: d.formatter(30.7, ctx), grande: d.formatter(3210987, { dataset:{}, datasetIndex:0, dataIndex:1 }),
                 mostra: d.display(ctx), clamp: d.clamp, ancora: d.anchor,
                 tam: d.font && d.font.size,
                 linha: d.display({ dataset: { type: 'line' }, datasetIndex: 1, dataIndex: 0 }) } : null;
  });
  af(fmt && fmt.mostra === true, 'o rótulo é mostrado nas barras', fmt && fmt.mostra);
  af(fmt && fmt.linha === false, 'e NÃO nos pontos da linha, que viraria sopa de números', fmt && fmt.linha);
  af(fmt && fmt.ancora === 'end' && fmt.clamp === true,
     'no topo da barra e preso dentro da área (barra no teto não perde o rótulo)', JSON.stringify(fmt));
  af(fmt && fmt.tam === 13, 'o rótulo está 2px maior, como ele pediu', fmt && fmt.tam);
  /* O RÓTULO É O QUE O PAINEL ESCREVE (Renan, 19/09/2026: "faltou... os ▲s").
     O painel formata "+12.5%"; eu reformatava para "12,5" e o sinal e o sufixo
     sumiam. O fallback em pt-BR só vale para gráfico SEM rótulo no painel. */
  const rotP = await pg.evaluate(() => {
    const g = (window.__charts || []).find(c => c.options && c.options.plugins
      && c.options.plugins.datalabels && (c.data.labels || []).join() === 'jan/26,fev/26,mar/26'
      && c.options.scales && c.options.scales.y && c.options.scales.y.min === 70);
    const d = g && g.options.plugins.datalabels;
    if (!d) return null;
    const f = (di, i, v) => d.formatter(v, { dataset:{}, datasetIndex:di, dataIndex:i });
    return { b0: f(0,0,12.5), b2: f(0,2,30.7), linha: d.display({ dataset:{}, datasetIndex:1, dataIndex:0 }),
             yMin: g.options.scales.y.min, yMax: g.options.scales.y.max,
             zero: g.options.scales.y.beginAtZero,
             yTick: g.options.scales.y.ticks.callback(70) };
  });
  af(rotP && rotP.b0 === '+12.5%' && rotP.b2 === '+30.7%',
     'o rótulo sai com o sinal e o % que o painel escreve', rotP && rotP.b0 + ' / ' + rotP.b2);
  af(rotP && rotP.linha === false, 'e a série que o painel não rotula continua sem rótulo', rotP && rotP.linha);
  /* O EIXO É O DO PAINEL (Renan: "ele começa no eixo Y do zero, diferente do
     painel"): a Evolução vai de 70 a 110 e virava 0 a 100, achatando tudo. */
  af(rotP && rotP.yMin === 70 && rotP.yMax === 110,
     'a janela do eixo Y é a do painel, não do zero', rotP && rotP.yMin + '–' + rotP.yMax);
  af(rotP && rotP.zero === false, 'e o beginAtZero fica desligado quando o painel define a janela', rotP && rotP.zero);
  af(rotP && rotP.yTick === '70%', 'o rótulo do eixo vem pronto do painel, com o %', rotP && rotP.yTick);
  af(fmt && fmt.rot === '30,7', 'gráfico sem rótulo no painel cai no pt-BR do portal', fmt && fmt.rot);
  af(fmt && fmt.grande === '3,2 mi', 'e o valor grande vem abreviado como no portal', fmt && fmt.grande);

  /* O CASO DA EVOLUÇÃO (Renan, 19/09/2026: "Evolução sem rótulos de dados").
     Lá o painel só LIGA o plugin (`datalabels:{}`) e o desliga nas linhas de
     meta, sem dizer o texto. Eu tratava "o painel não escreveu o texto" como
     "o painel não quer rótulo", e o gráfico saía limpo. Agora são duas coisas
     separadas: quem aparece é o painel que diz, o texto é do portal quando ele
     não escreve. */
  const evo = await pg.evaluate(() => {
    const g = (window.__charts || []).find(c => c.options && c.options.plugins
      && c.options.plugins.datalabels && (c.data.labels || []).join() === 'jan,fev,mar');
    const d = g && g.options.plugins.datalabels;
    if (!d) return null;
    return { barra: d.display({ dataset:{}, datasetIndex:0, dataIndex:0 }),
             txt: d.formatter(84.6, { dataset:{}, datasetIndex:0, dataIndex:0 }),
             meta: d.display({ dataset:{type:'line'}, datasetIndex:1, dataIndex:0 }) };
  });
  af(evo && evo.barra === true, 'a barra da Evolução volta a ter rótulo', evo && evo.barra);
  /* O FORMATTER MORA NO DATASET, não no gráfico — o Frota de Elite tem
     `datalabels:{}` vazio no gráfico e o formatter na BARRA. Lendo só o do
     gráfico eu nunca achava o texto, e a Evolução saiu sem rótulo três vezes
     seguidas. */
  af(evo && evo.txt === '84.6', 'com o texto que o DATASET do painel escreve', evo && evo.txt);
  af(evo && evo.meta === false, 'e a linha de meta segue sem rótulo, como o painel manda', evo && evo.meta);

  /* LEGENDA NO PADRÃO: a .gleg do painel, não as bolinhas do Chart.js */
  const legs = ins.flatMap(x => x.gleg || []);
  af(legs.some(t => /Rem %/.test(t)) && legs.some(t => /Meta/.test(t)),
     'a legenda do slide é a .gleg do painel', JSON.stringify(legs.slice(0, 4)));
  af(chs.every(c => c.options.plugins.legend && c.options.plugins.legend.display === false),
     'e a legenda nativa do Chart.js fica desligada');

  /* A APARÊNCIA DO DATASET É A DO PAINEL, INTEIRA (Renan: "não preciso nem
     falar"): borda, raio, largura da barra, pontos da linha. */
  const g1s = chs.find(c => (c.data.labels||[]).join() === 'jan/26,fev/26,mar/26' && c.data.datasets.length === 2);
  const d0 = g1s && g1s.data.datasets[0], d1 = g1s && g1s.data.datasets[1];
  af(d0 && d0.borderWidth === 1 && d0.borderRadius === 0 && d0.barPercentage === .97,
     'a barra leva borda, raio e largura do painel', JSON.stringify(d0 && [d0.borderWidth, d0.borderRadius, d0.barPercentage]));
  af(d0 && d0.backgroundColor === '#F9731633', 'com o alfa da cor preservado', d0 && d0.backgroundColor);
  af(d1 && JSON.stringify(d1.pointRadius) === '[0,0,6]' && d1.tension === 0,
     'e a linha leva os pontos e a tensão do painel — nada de default meu', JSON.stringify(d1 && [d1.pointRadius, d1.tension]));


  /* TODOS os gráficos, não só o primeiro */
  const disp = provas1.filter(p => /painel-km/.test(p.pag) && p.nGraf != null);
  af(disp.some(p => p.nGraf >= 2), 'o slide leva os DOIS gráficos da visão, não só o primeiro',
     JSON.stringify(disp.map(p => p.nGraf)));
  af(ins.some(x => x.nGraf >= 2), 'e os dois são desenhados lado a lado no slide',
     JSON.stringify(ins.map(x => x.nGraf).filter(n => n)));

  /* O HERO — "faltou realizado" */
  af(provas1.some(p => p.nHero >= 1), 'o hero do painel é lido',
     JSON.stringify(provas1.map(p => p.nHero).filter(n => n)));
  af(ins.some(x => x.nHero >= 1 && x.cels.length === 0 || x.nHero >= 1),
     'e vai para o slide', JSON.stringify(ins.map(x => x.nHero).filter(n => n)));
  const reg = await pg.evaluate(() => window.__registrados || []);
  af(reg.filter(r => r === 'datalabels').length === 1,
     'o plugin de rótulo é registrado UMA vez (registrar por gráfico desenhava duas)',
     JSON.stringify(reg));

  const pptT = await pg.evaluate(() => window.__ppt);

  const tema = await pg.evaluate(() => localStorage.getItem('bi_theme'));
  af(tema === 'dark' || tema === null, 'o tema do Renan é devolvido depois da geração', tema);
  af(provas1.filter(p => p.estado && p.estado.tema === 'light').length >= 8,
     'os painéis foram para o tema claro', provas1.filter(p => p.estado && p.estado.tema === 'light').length);

  const estados = await pg.evaluate(() => Object.values(ESTADO));
  af(estados.length === nSlides && estados.every(e => e.ok && !e.err), 'todos os slides fecharam sem falha',
     estados.filter(e => e.err).length + ' falharam');
  await ctx.close();
}

// ── 3 · filtro que não casa TEM de reclamar ──────────────────
console.log('\n═══ 3 · filtro que não existe vira alarme, não um slide errado ═══');
{
  const { ctx, pg } = await abre({ semJunEm: 'scorecard' });
  await pg.evaluate(() => { ROTEIRO = ROTEIRO.slice(0, 3); });   // capa, scorecard, resumo-exec
  await pg.evaluate(() => gerar('pdf'));
  await pg.waitForFunction(() => !window.GERANDO, { timeout: 60000 });
  const est = await pg.evaluate(() => ESTADO[1]);
  af(est && est.msgs && est.msgs.some(m => /ms-vig/.test(m) && /não achei/.test(m)),
     'o slide do Scorecard é marcado: o filtro não casou', JSON.stringify(est));
  const sel = await pg.evaluate(() => selo(1));
  af(/pill esp/.test(sel), 'e aparece como "atenção" no roteiro', sel);
  const p = (await pg.evaluate(() => window.__provas)).find(x => /scorecard/.test(x.pag));
  af(p && (!p.estado.filtros['ms-vig'] || p.estado.filtros['ms-vig'].length === 0),
     'o motor NÃO marcou um mês qualquer no lugar', p && JSON.stringify(p.estado.filtros['ms-vig']));
  await ctx.close();
}

// ── 4 · painel que recusa ────────────────────────────────────
console.log('\n═══ 4 · painel que recusa o acesso não vira slide em branco ═══');
{
  const { ctx, pg } = await abre({ gateEm: 'scorecard' });
  await pg.evaluate(() => { ROTEIRO = ROTEIRO.slice(0, 2); });   // capa, scorecard
  await pg.evaluate(() => gerar('pdf'));
  await pg.waitForFunction(() => !window.GERANDO, { timeout: 60000 });
  const est = await pg.evaluate(() => ESTADO[1]);
  af(est && est.err, 'o slide é marcado como falha', JSON.stringify(est));
  af(est && /recusou/.test(est.msgs[0]), 'e a mensagem diz que o painel recusou', est && est.msgs[0]);
  const pdf = await pg.evaluate(() => window.__pdf);
  af(pdf && pdf.pgs.length === 1, 'o PDF sai com o slide que deu certo (a capa), não com 2', pdf && pdf.pgs.length);
  await ctx.close();
}

// ── 5 · as capas ─────────────────────────────────────────────
console.log('\n═══ 5 · capa e divisórias no tema Conlog ═══');
{
  const { ctx, pg } = await abre();
  const c = await pg.evaluate(async () => {
    const foto = await carregaFoto();
    const url = desenhaCapa({ tit:'CHECK DE METAS', sub:'ATIVOS / FROTA / TI', rod:'Fechamento jun/2026' }, 1600, 900);
    const im = new Image(); im.src = url;
    await new Promise(r => { im.onload = r; });
    const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900;
    const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
    const px = (a, b) => { const d = x.getImageData(a, b, 1, 1).data; return [d[0], d[1], d[2]]; };
    // A foto TEM de aparecer: se ela não carregar, ou se o escurecedor
    // for opaco, a capa vira um retângulo chapado e ninguém repara até o
    // PDF chegar na diretoria. O desvio-padrão da luminância denuncia isso.
    let so = 0, so2 = 0, n = 0;
    for (let a = 0; a < 1600; a += 7) for (let b = 0; b < 880; b += 7) {
      const d = x.getImageData(a, b, 1, 1).data, l = (d[0] + d[1] + d[2]) / 3;
      so += l; so2 += l * l; n++;
    }
    const med = so / n, dp = Math.sqrt(so2 / n - med * med);
    return { url: url.slice(0, 22), foto: !!foto,
             rodape: px(800, 896), esq: px(40, 450),
             media: med, desvio: dp };
  });
  /* JPEG, não PNG: 46 slides em PNG estouravam o limite de string do
     navegador na hora de montar o arquivo ("Invalid string length"). */
  af(c.url === 'data:image/jpeg;base64', 'a capa sai como JPEG de qualidade alta', c.url);
  af(c.foto, 'a foto do caminhão CONLOG foi carregada');
  af(Math.abs(c.rodape[0] - 249) < 6 && Math.abs(c.rodape[1] - 115) < 6, 'a faixa do rodapé é o laranja do portal', c.rodape.join(','));
  af(c.esq[0] < 60 && c.esq[1] < 60, 'o lado do texto está escurecido para o título ler', c.esq.join(','));
  af(c.desvio > 22, 'a foto aparece na capa — não é um retângulo chapado',
     'média ' + c.media.toFixed(1) + ' · desvio ' + c.desvio.toFixed(1));

  const s = await pg.evaluate(async () => {
    const url = desenhaSecao({ txt:'Combustíveis' }, 1600, 900);
    const im = new Image(); im.src = url; await new Promise(r => { im.onload = r; });
    const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 900;
    const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
    let ambar = 0;
    const d = x.getImageData(110, 400, 700, 80).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 210 && d[i+1] > 150 && d[i+1] < 200 && d[i+2] < 140) ambar++;
    return { ambar };
  });
  af(s.ambar > 400, 'a divisória escreve a palavra no laranja do PPT dele (F6B26B)', s.ambar);
  await ctx.close();
}

// ── 6 · o PPT ────────────────────────────────────────────────
console.log('\n═══ 6 · o PPT sai com o mesmo desenho do PDF ═══');
{
  const { ctx, pg } = await abre();
  await pg.evaluate(() => { ROTEIRO = ROTEIRO.slice(0, 7); });
  await pg.evaluate(() => gerar('ppt'));
  await pg.waitForFunction(() => !window.GERANDO, { timeout: 90000 });
  const p = await pg.evaluate(() => window.__ppt);
  af(p && p.slides.length === 7, 'um slide por item do roteiro', p && p.slides.length);
  af(p && p.layout && Math.abs(p.layout.width - 13.3333) < 0.01 && p.layout.height === 7.5,
     'o slide é 16:9 de 13,333 × 7,5 pol — a mesma medida do PPT dele', p && JSON.stringify(p.layout));
  af(p && p.slides[0].imgs.length === 1 && p.slides[0].imgs[0].w === 13.3333,
     'a capa ocupa o slide inteiro', p && JSON.stringify(p.slides[0].imgs[0]));
  af(p && p.slides[0].txts.length === 0, 'e não leva caixa de texto por cima (o título está na arte)');
  const comTab = p.slides.filter(x => x.tabelas.length);
  af(comTab.length === 0, 'o PPT não monta mais tabela por fora — o slide já vem pronto', comTab.length);
  if (comTab.length) {
    const t = comTab[0].tabelas[0];
    af(t.rows[0][0].text === 'CONTA', 'o cabeçalho vai em caixa alta', t.rows[0][0].text);
    const cores = t.rows.flat().map(c => c.options && c.options.color).filter(Boolean);
    af(cores.includes('FF0000') && cores.includes('00B300'),
       'e a cor da célula é a do painel — vermelho estouro, verde saving', [...new Set(cores)].join(','));
    af(Math.abs(t.colW.reduce((a, b) => a + b, 0) - t.w) < 0.02,
       'as colunas somam a largura da caixa: a tabela preenche a página', t.colW.join(' '));
    af(t.colW[0] > t.colW[1] * 2, 'a coluna do nome é a larga', t.colW.slice(0, 2).join(' '));
  }
  const sl = p.slides[2];
  /* o título agora está DENTRO da arte do slide, como na capa — por isso o
     PPT não leva mais caixa de texto por cima da imagem */
  af(sl.txts.length === 0, 'o slide de painel não leva texto solto por cima', JSON.stringify(sl.txts));
  af(sl.imgs.length === 1 && sl.imgs[0].x === 0 && sl.imgs[0].y === 0,
     'o slide é a arte inteira, encostada no canto', JSON.stringify(sl.imgs[0]));
  af(sl.imgs[0].w === 13.3333 && sl.imgs[0].h === 7.5, 'ocupando a página toda',
     JSON.stringify(sl.imgs[0]));
  /* o slide de dois blocos continua existindo (rótulo laranja por bloco) para
     quando o roteiro pedir; a Árvore saiu dele por caber mal, não por o
     empilhamento ter morrido */
  const ins2 = (await pg.evaluate(() => window.__slInsp || [])).filter(x => !x.erro);
  af(ins2.some(x => (x.rot || []).includes('Vs Remunerado')),
     'o slide de dois blocos empilha com o rótulo de cada um',
     JSON.stringify(ins2.flatMap(x => x.rot || []).slice(0, 6)));
  af(p && /^Check_de_Metas_2026_06\.pptx$/.test(p.arquivo), 'o arquivo sai com o mês no nome', p && p.arquivo);
  await ctx.close();
}

await nav.close();
srv.close();
console.log(`\n${ok} ok · ${ruim} falha(s)`);
process.exit(ruim ? 1 : 0);
