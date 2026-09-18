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
const SHIM_H2C = `
window.html2canvas = function(el, o){
  // dentro do painel dublado: registra o que o motor MANDOU a tela mostrar
  try{
    if (window.top !== window) {
      var e = document.getElementById('estado');
      window.top.__provas.push({
        pag: location.pathname,
        estado: e ? JSON.parse(e.textContent) : null,
        alvo: (el && (el.id || el.className)) || 'sem-alvo'
      });
    }
  }catch(err){ try{ window.top.__provas.push({erro:String(err)}); }catch(e2){} }
  var c = document.createElement('canvas'); c.width = 1200; c.height = 700;
  var x = c.getContext('2d'); x.fillStyle = '#EAEAEA'; x.fillRect(0,0,1200,700);
  return Promise.resolve(c);
};`;

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
    var s = { txts: [], imgs: [], shapes: [] };
    o.slides.push(s);
    return {
      background: null,
      addText: function(t){ s.txts.push(t); },
      addImage: function(i){ s.imgs.push({ x:i.x, y:i.y, w:i.w, h:i.h }); },
      addShape: function(t,p){ s.shapes.push(t); }
    };
  };
  this.writeFile = function(op){ o.arquivo = op.fileName; return Promise.resolve(); };
};
Object.defineProperty(window.PptxGenJS.prototype, 'layout', { set:function(v){ if(window.__ppt) window.__ppt.usou = v; }, get:function(){ return null; } });`;

const FCAS = [
  { vigencia:'jun/26', unidade:'CGR', projeto:'AS - CGR',   fato:'Combustíveis', fato_desvio:'Desvio: ▲ R$ 120.000 · ▲ -9%' },
  { vigencia:'jun/26', unidade:'CGR', projeto:'ROTA - CGR', fato:'Combustíveis', fato_desvio:'Desvio: ▲ R$ 90.000 · ▲ -7%' },
  { vigencia:'jun/26', unidade:'CBA T1', projeto:'EMPURRADA - CBA', fato:'Manutenções', fato_desvio:'Desvio: ▲ R$ 55.000 · ▲ -12%' },
  { vigencia:'jun/26', unidade:'GRL', projeto:'ROTA - GRL', fato:'Manutenções', fato_desvio:'Desvio: ▲ R$ 33.000 · ▲ -4%' },
  { vigencia:'mai/26', unidade:'PIR', projeto:'ROTA - PIR', fato:'Pneus', fato_desvio:'Desvio: ▲ R$ 10.000 · ▲ -3%' },
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
  'painel-km':'longo', 'seara-km':'longo', 'combustivel/arvore-combustivel':'mm', 'auditorias':'curto',
  'programa-reconhecimento':'curto' };

/* painel dublado: a MESMA mecânica do padrão (setVw, ms-*, atualizar) */
function painelDuble(chaves, dialeto, comGate) {
  if (comGate) return `<!doctype html><html><body><div class="app"><div class="cols">
    <div class="gate"><h2>Apenas administradores</h2><p>restrito</p></div></div></div></body></html>`;
  const vigs = chaves.map(DIALETO[dialeto || 'chave']);
  const ops = id => vigs.map(v => `<label class="ms-opt"><input type="checkbox" data-v="${v.v}"> ${v.t}<span class="ms-only">only</span></label>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  .vw{display:none} .vw.on{display:block} .card,.tbl-section,.chart-card{min-height:220px;background:#eee}
  body{margin:0;min-height:700px}</style></head><body>
  <div class="app"><div class="side"></div><main class="board"><div class="top">
    <div class="tit-sub" id="titSub">pronto</div>
    <div class="ms-wrap" id="ms-vig"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">${ops('ms-vig')}</div></div></div>
    <div class="ms-wrap" id="ms-uni"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">
      ${['CGR','CBA T1','GRL','PIR'].map(u=>`<label class="ms-opt"><input type="checkbox" data-v="${u}"> ${u}</label>`).join('')}</div></div></div>
    <div class="ms-wrap" id="ms-proj"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">
      ${['AS - CGR','ROTA - CGR','EMPURRADA - CBA','ROTA - GRL'].map(u=>`<label class="ms-opt"><input type="checkbox" data-v="${u}"> ${u}</label>`).join('')}</div></div></div>
    <div class="ms-wrap" id="ms-nv3"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">
      ${['AS','ROTA','EMPURRADA'].map(u=>`<label class="ms-opt"><input type="checkbox" data-v="${u}"> ${u}</label>`).join('')}</div></div></div>
    <div class="ms-wrap" id="ms-fato"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">
      ${['Combustíveis','Manutenções','Pneus'].map(u=>`<label class="ms-opt"><input type="checkbox" data-v="${u}"> ${u}</label>`).join('')}</div></div></div>
    <div class="ms-wrap" id="ms-pac"><span class="ms-cnt"></span><div class="ms-panel"><div class="ms-list">
      ${['Combustíveis','Manutenções','Pneus','ICMS'].map(u=>`<label class="ms-opt"><input type="checkbox" data-v="${u}"> ${u}</label>`).join('')}</div></div></div>
  </div><div class="cols">
    <section class="vw on" id="vw-resumo"><div class="card">resumo — texto suficiente para o motor considerar a tela carregada e estável</div></section>
    <section class="vw" id="vw-nominal"><div class="card">nominal <span id="ref-pac-v">REM</span></div></section>
    <section class="vw" id="vw-dispersao"><div class="card">dispersao por unidade, com tabela e ranking</div></section>
    <section class="vw" id="vw-tabela"><div class="card">tabela de FCA da unidade escolhida</div></section>
    <div class="tbl-section">R$/KM Detalhado <span id="dim-atual">pacote</span></div>
    <div class="tbl-section"><table id="ranking-table"><tr><td class="ind-col">ranking</td></tr></table></div>
    <div id="podio-section" class="card">podio</div>
    <div class="chart-card"><canvas id="chartTemporal"></canvas></div>
    <pre id="estado"></pre>
  </div></main></div>
  <script>
  var EST = { vw:'resumo', filtros:{}, dim:null, ref:'REM', chamou:[], selVig:[] };
  function grava(){ document.getElementById('estado').textContent = JSON.stringify(EST); }
  function setVw(v){ EST.vw = v;
    document.querySelectorAll('.vw').forEach(function(s){ s.classList.toggle('on', s.id === 'vw-' + v); }); grava(); }
  function leFiltros(){
    ['ms-vig','ms-uni','ms-proj','ms-nv3','ms-fato','ms-pac'].forEach(function(id){
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
  function onlyOpt(k, v){ EST.selVig = [v]; EST.chamou.push('onlyOpt'); grava(); }
  function toggleAll(k){ EST.selVig = []; EST.chamou.push('toggleAll'); grava(); }
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
    const body = u.includes('html2canvas') ? SHIM_H2C
      : u.includes('jspdf') ? SHIM_JSPDF
      : u.includes('pptxgen') ? SHIM_PPTX
      : u.includes('supabase') ? SHIM_SB
      : '/* nada */';
    r.fulfill({ status: 200, contentType: 'text/javascript', body });
  });
  // todo painel do roteiro entra dublado
  for (const p of ['scorecard','resumo-executivo','visao-financeira','rs-por-km','painel-km',
                   'seara-km','fca-consolidado','combustivel/arvore-combustivel','auditorias',
                   'programa-reconhecimento','painel-metas']) {
    await ctx.route(BASE + '/' + p + '/', r => r.fulfill({ status: 200, contentType: 'text/html;charset=utf-8',
      body: painelDuble(p === semJunEm ? VIGS_SEM_JUN : VIGS_OK, DIAL_DE[p], p === gateEm) }));
  }
  const pg = await ctx.newPage();
  await pg.addInitScript(() => { window.__provas = []; window.CM_TEMPOS = { passo:60, quieto:1, min:120, teto:9000, pos:60, tema:30 }; });
  pg.on('pageerror', e => console.log('  [erro na página] ' + e.message));
  await pg.goto(BASE + '/check-metas/', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.ROTEIRO === undefined || document.querySelectorAll('#body-rot tr').length > 0, { timeout: 15000 });
  return { ctx, pg };
}

// ── 1 · roteiro ──────────────────────────────────────────────
console.log('\n═══ 1 · o roteiro sai da tabela `fca`, não de uma lista fixa ═══');
{
  const { ctx, pg } = await abre();
  const r = await pg.evaluate(() => ROTEIRO.map(s => ({ t:s.t, tit:s.tit||s.txt, url:s.url, prep:(s.caps||[]).map(c=>c.prep).join(' ') })));
  af(r[0].t === 'capa', 'o 1º slide é a capa');
  af(r[1].t === 'sec' && /Frota/i.test(r[1].tit), 'o 2º é a divisória FROTA');
  af(r.some(s => /scorecard\/$/.test(s.url || '')), 'tem o Scorecard');
  af(r.some(s => /resumo-executivo/.test(s.url || '')), 'tem o Resumo Executivo');
  const secs = r.filter(s => s.t === 'sec').map(s => s.tit);
  af(JSON.stringify(secs) === JSON.stringify(['Frota','Pneus','Manutenção','Combustíveis','Resultados']),
     'as divisórias são Frota · Pneus · Manutenção · Combustíveis · Resultados', secs.join(' / '));
  const comb = r.filter(s => /Combustíveis – /.test(s.tit || ''));
  af(comb.length === 4, 'Combustíveis: 2 unidades × (FCA + árvore) = 4 slides', comb.length);
  af(comb.filter(s => /arvore-combustivel/.test(s.url)).length === 2,
     '"se tiver mais de um projeto, mais de uma árvore" — 2 árvores', comb.filter(s => /arvore/.test(s.url)).length);
  const man = r.filter(s => /Manutenções – /.test(s.tit || ''));
  af(man.length === 2 && /CBA T1/.test(man[0].tit), 'Manutenções: 2 unidades, a de maior desvio primeiro', man.map(m=>m.tit).join(' / '));
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
  af(fca.length === 4, 'quatro FCAs (2 de Manutenções + 2 de Combustíveis)', fca.length);
  af(fca.every(p => p.estado.vw === 'tabela'), 'o FCA sai na visão Tabela');
  af(fca.every(p => p.estado.chamou.includes('run')), 'o FCA foi redesenhado (run)');
  const fc = fca.find(p => p.estado.filtros['ms-fato'][0] === 'Combustíveis');
  af(fc && fc.estado.filtros['ms-uni'][0] === 'CGR' && /CGR/.test(fc.estado.filtros['ms-proj'][0]),
     'o FCA de Combustíveis vem com unidade E o nível 3 INTEIRO (ao contrário da Árvore)',
     fc && JSON.stringify([fc.estado.filtros['ms-uni'], fc.estado.filtros['ms-proj']]));

  const arv = provas1.filter(p => /arvore-combustivel/.test(p.pag));
  af(arv.length === 2 && arv.every(p => p.estado.chamou.includes('onFilterChange')), 'as 2 árvores foram redesenhadas');
  af(arv[0].estado.filtros['ms-nv3'].length === 1, 'a árvore vem recortada no projeto', JSON.stringify(arv[0].estado.filtros['ms-nv3']));
  af(JSON.stringify(arv.map(p => p.estado.filtros['ms-nv3'][0]).sort()) === '["AS","ROTA"]',
     'a Árvore leva o PREFIXO do nível 3 (AS/ROTA), que é o que o filtro dela lista',
     JSON.stringify(arv.map(p => p.estado.filtros['ms-nv3'])));
  af(arv.every(p => p.estado.filtros['ms-vig'].length === 1),
     'e a vigência casa também no dialeto MM/AAAA da Árvore', JSON.stringify(arv.map(p => p.estado.filtros['ms-vig'])));

  const pr = provas1.filter(p => /programa-reconhecimento/.test(p.pag));
  af(pr.length === 4, 'Frota de Elite: ranking, dois pódios e a evolução', pr.length);
  af(pr[0].alvo && /tbl-section/.test(pr[0].alvo), 'o ranking é recortado na tabela', pr[0].alvo);
  af(pr[1].alvo === 'podio-section', 'o pódio é recortado no pódio', pr[1].alvo);
  af(pr[3].estado.chamou.includes('toggleAll'), 'a evolução usa o ano inteiro');

  af(pdf && pdf.pgs.length === nSlides, 'o PDF tem uma página por slide', pdf && pdf.pgs.length + ' de ' + nSlides);
  af(pdf && pdf.cheias === 6, 'capa e as 5 divisórias entram de página inteira', pdf && pdf.cheias);
  af(pdf && /^Check_de_Metas_2026_06\.pdf$/.test(pdf.arquivo), 'o arquivo sai com o mês no nome', pdf && pdf.arquivo);
  af(pdf && pdf.txts.includes('Vs Remunerado') && pdf.txts.includes('Vs Orçado'), 'os rótulos das duas imagens vão no slide');

  const estados = await pg.evaluate(() => Object.values(ESTADO));
  af(estados.length === nSlides && estados.every(e => e.ok && !e.err), 'todos os slides fecharam sem falha',
     estados.filter(e => e.err).length + ' falharam');
  await ctx.close();
}

// ── 3 · filtro que não casa TEM de reclamar ──────────────────
console.log('\n═══ 3 · filtro que não existe vira alarme, não um slide errado ═══');
{
  const { ctx, pg } = await abre({ semJunEm: 'scorecard' });
  await pg.evaluate(() => { ROTEIRO = ROTEIRO.slice(0, 4); });   // capa, divisória, scorecard, resumo-exec
  await pg.evaluate(() => gerar('pdf'));
  await pg.waitForFunction(() => !window.GERANDO, { timeout: 60000 });
  const est = await pg.evaluate(() => ESTADO[2]);
  af(est && est.msgs && est.msgs.some(m => /ms-vig/.test(m) && /não achei/.test(m)),
     'o slide do Scorecard é marcado: o filtro não casou', JSON.stringify(est));
  const sel = await pg.evaluate(() => selo(2));
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
  await pg.evaluate(() => { ROTEIRO = ROTEIRO.slice(0, 3); });
  await pg.evaluate(() => gerar('pdf'));
  await pg.waitForFunction(() => !window.GERANDO, { timeout: 60000 });
  const est = await pg.evaluate(() => ESTADO[2]);
  af(est && est.err, 'o slide é marcado como falha', JSON.stringify(est));
  af(est && /recusou/.test(est.msgs[0]), 'e a mensagem diz que o painel recusou', est && est.msgs[0]);
  const pdf = await pg.evaluate(() => window.__pdf);
  af(pdf && pdf.pgs.length === 2, 'o PDF sai com os 2 slides que deram certo, não com 3', pdf && pdf.pgs.length);
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
    return { url: url.slice(0, 21), foto: !!foto,
             rodape: px(800, 896), esq: px(40, 450),
             media: med, desvio: dp };
  });
  af(c.url === 'data:image/png;base64', 'a capa sai como PNG');
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
  const sl = p.slides[2];
  af(sl.txts.length >= 1 && sl.txts[0] === 'Scorecard da Frota', 'o slide de painel leva o título', sl.txts[0]);
  af(sl.imgs.length === 1 && sl.imgs[0].y > 0.9, 'a imagem entra abaixo do título', JSON.stringify(sl.imgs[0]));
  af(sl.imgs[0].x >= 0.3 && sl.imgs[0].x + sl.imgs[0].w <= 13.04, 'e cabe dentro da margem', JSON.stringify(sl.imgs[0]));
  const duplo = p.slides[6];
  af(duplo.imgs.length === 2 && duplo.imgs[1].y > duplo.imgs[0].y,
     'o slide de duas imagens empilha uma sobre a outra, como no dele', JSON.stringify(duplo.imgs));
  af(p && /^Check_de_Metas_2026_06\.pptx$/.test(p.arquivo), 'o arquivo sai com o mês no nome', p && p.arquivo);
  await ctx.close();
}

await nav.close();
srv.close();
console.log(`\n${ok} ok · ${ruim} falha(s)`);
process.exit(ruim ? 1 : 0);
