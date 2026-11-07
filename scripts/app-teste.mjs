// ============================================================
// O app do celular (/app/) — teste no Chromium
//
// Abre o app de verdade (index.html + app.js + catalogo.js) com o Supabase
// DUBLADO (login, aprovação, perfil) e um PAINEL DUBLÊ com a mecânica da casca
// (setVw, #ms-vig com _sel/_render, atualizar(), .fin-hero, .kpis, .gcard com
// Chart.js real, table.dre). Confere que o app:
//   · entra com e-mail e senha e mostra "Olá, <nome>";
//   · lista os painéis por grupo e esconde os de admin para quem não é;
//   · abre o painel por dentro e redesenha hero, cards, gráficos e tabela com
//     os MESMOS números do painel; troca de visão e de vigência (o painel
//     recebe a vigência e redesenha);
//   · guarda o resumo e reabre na hora, sem iframe;
//   · tema claro/escuro, favoritos, modo web, o gate sem sessão;
//   · com PAINEIS=a,b abre painéis REAIS com o banco sintético (só a mecânica:
//     sem erro de página e a tela nunca fica em branco).
//
// Uso: node scripts/app-teste.mjs            [SHOT_DIR=<pasta> salva prints]
//      PAINEIS=visao-financeira,painel-km node scripts/app-teste.mjs
// Libs locais (o sandbox não alcança os CDNs): SBJS=<supabase.js umd>
// CHART_JS=<chart.umd.js>; sem elas procura na pasta do scratchpad.
// ============================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BASES, chaveDe } from './sheets-bases.mjs';

const RAIZ = process.cwd();
const SHOT = process.env.SHOT_DIR || '';
const acha = (env, nome) => {
  if (process.env[env] && fs.existsSync(process.env[env])) return process.env[env];
  const base = '/tmp/claude-0';
  const pilha = [base];
  while (pilha.length) { const d = pilha.pop(); let ls = []; try { ls = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of ls) { const f = path.join(d, e.name); if (e.isDirectory() && !/node_modules|\.git$/.test(e.name)) pilha.push(f); else if (e.name === nome) return f; } }
  return '';
};
const SBJS = acha('SBJS', 'supabase.js'), CHART_JS = acha('CHART_JS', 'chart.umd.js');
if (!SBJS || !CHART_JS) { console.log('faltam as libs: SBJS=' + SBJS + ' CHART_JS=' + CHART_JS); process.exit(1); }

let ok = 0, falhas = 0;
const conf = (c, m) => { if (c) { ok++; console.log('  ok  ' + m); } else { falhas++; console.log('  ✗   ' + m); } };
const espera = ms => new Promise(r => setTimeout(r, ms));

/* ── o painel dublê: a mecânica da casca num arquivo só ── */
const DUB = fs.mkdtempSync(path.join(os.tmpdir(), 'gem-app-dub-'));
fs.writeFileSync(path.join(DUB, 'index.html'), `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Painel Dublê</title>
<script>try{if(!sessionStorage.getItem("gem_hub"))document.addEventListener('DOMContentLoaded',function(){document.body.innerHTML='<div class="gate"><h2>Acesso restrito</h2><p>entre pelo hub</p></div>';});}catch(e){}</script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>body{font-family:sans-serif;background:#202022;color:#EEF2FA}body.claro{background:#E1E2E5;color:#161D2B}
.vw{display:none}.vw.on{display:block}.fin-hero{display:flex;gap:40px}.hlbl{font-size:10px;color:#A9B1C0}.hval{font-size:36px;font-weight:800}
.hdel{display:flex;gap:12px}.hdel div{font-size:10px;color:#A9B1C0}.hdel b{display:block;font-size:14px;color:#EEF2FA}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi{padding:10px;background:#2c2c2e}.kl{font-size:9px;color:#A9B1C0}.kv{font-size:25px;font-weight:800}.km{font-size:10px;color:#A9B1C0}
.cg{color:#3BB33B!important}.cr{color:#FF5252!important}
.gr2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.gcard{background:#2c2c2e;padding:10px}.gcv{height:220px;position:relative}
table{border-collapse:collapse}td,th{padding:4px 8px}.s-item{display:block}.ms-panel{display:none}.ms-panel.open{display:block}
</style></head><body>
<aside class="side"><button class="s-item on" data-vw="resumo"><svg></svg>Resumo Gerencial</button><button class="s-item" data-vw="detalhe"><svg></svg>Detalhe</button></aside>
<header class="top"><div class="tit-wrap"><h1 id="tit">Resumo Gerencial</h1><div class="tit-sub" id="titSub">Carregando…</div></div>
<div class="ms-wrap" id="ms-vig"><button class="ms-btn">Vigência<span class="ms-cnt"></span></button><div class="ms-panel"><div class="ms-list"></div></div></div></header>
<div class="cols">
<section class="vw on" id="vw-resumo">
  <div class="fin-hero"><div><div class="hlbl">Custo realizado</div><div class="hval" id="h-val">—</div>
    <div class="hdel"><div>Δ Rem %<b id="h-drem" class="cr">—</b></div><div>YoY %<b id="h-yoy" class="cg">—</b></div></div></div>
    <div><div class="hlbl">EBITDA</div><div class="hval" id="h-eb">—</div></div></div>
  <div class="kpis"><div class="kpi"><div class="kl">Orçado</div><div class="kv" id="c1">—</div><div class="km">YoY: <b class="cg">+3%</b></div></div>
    <div class="kpi"><div class="kl">Remunerado</div><div class="kv" id="c2">—</div><div class="km">—</div></div>
    <div class="kpi"><div class="kl">Δ Remunerado</div><div class="kv cg" id="c3">—</div><div class="km"><b id="c3p">—</b></div></div>
    <div class="kpi"><div class="klbl">Pontos</div><div class="kval">18,5<small>de 25,0</small></div><div class="kmeta">meta 80%</div></div></div>
  <div class="gr2"><div class="card gcard"><div class="gtit">Custo mensal</div><div class="gsub">Real × Rem</div><div class="gcv"><canvas id="g1"></canvas></div></div>
    <div class="card gcard"><div class="gtit">AV %</div><div class="gcv"><canvas id="g2"></canvas></div></div></div>
  <!-- o desenho da Árvore de Combustível: card com uma mini-tabela de uma linha -->
  <div class="tree"><div id="pos-custo"><div class="kpi-card"><div class="card-label">Custo Combustível</div><table class="kpi-table"><thead><tr><th>Rem</th><th>Real</th><th>Δ</th><th>Δ%</th></tr></thead><tbody><tr><td>1,0 mi</td><td>1,1 mi</td><td class="cr">+0,1 mi</td><td class="cr">+10%</td></tr></tbody></table></div></div></div>
  <!-- o desenho do painel de Pneus: adh-hero + saude-cards -->
  <div class="adh-hero"><div class="adh-hero-left"><div class="adh-label">Saúde dos Pneus</div><div class="adh-value" style="font-size:40px">82</div><div class="adh-deltas"><div class="adh-delta">Pneus Avaliados<b>6.500</b></div></div></div></div>
  <div class="saude-cards"><div class="saude-card"><div class="sc-label">MM Média</div><div class="sc-value" style="font-size:22px">7,1 mm</div><div class="sc-sub">menor sulco médio</div></div><div class="saude-card"><div class="sc-label">Vida Média</div><div class="sc-value" style="font-size:22px">1,8</div><div class="sc-sub">idade pelo DOT</div></div></div>
  <div class="card gate" style="display:none"><h2>Erro ao carregar</h2></div>
</section>
<section class="vw" id="vw-detalhe"><div class="card tsec"><div class="ttit">Por conta</div><div class="twrap"><table class="dre"><thead><tr><th>Conta</th><th>Orçado</th><th>Remunerado</th><th>Realizado</th><th>Δ %</th></tr></thead><tbody id="tb"></tbody></table></div></div></section>
</div>
<script>
var VW='resumo', VIGS=['10/2026','09/2026','08/2026','07/2026'], CH1=null, CH2=null, CHAM=[];
var TIT={resumo:'Resumo Gerencial',detalhe:'Detalhe'};
function setVw(v){VW=v;document.querySelectorAll('.s-item[data-vw]').forEach(b=>b.classList.toggle('on',b.dataset.vw===v));document.querySelectorAll('.vw').forEach(s=>s.classList.toggle('on',s.id==='vw-'+v));document.getElementById('tit').textContent=TIT[v];}
document.querySelectorAll('.s-item[data-vw]').forEach(b=>b.addEventListener('click',()=>setVw(b.dataset.vw)));
function aplicaTema(t){document.body.classList.toggle('claro',t==='light');}
// o filtro no desenho dos painéis: wrap._sel (Set) + _render(q)
(function(){var w=document.getElementById('ms-vig');w._sel=new Set([VIGS[0]]);w._render=function(q){w.querySelector('.ms-list').innerHTML='<label class="ms-opt all-opt"><input type="checkbox" class="ms-all"> Todos</label>'+VIGS.map(v=>'<label class="ms-opt"><input type="checkbox" data-v="'+v+'"'+(w._sel.has(v)?' checked':'')+'> '+v.replace('/','/').replace(/^(\\d\\d)\\/(\\d{4})$/,(m,a,b)=>['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][+a-1]+'/'+b.slice(2))+'<span class="ms-only">só</span></label>').join('');};w._render('');})();
function getVig(){var w=document.getElementById('ms-vig');return w._sel.size?[...w._sel][0]:VIGS[0];}
function atualizar(){
  var vig=getVig(); CHAM.push('atualizar:'+vig); var m=+vig.slice(0,2);
  document.getElementById('h-val').textContent='R$ '+(10+m/10).toFixed(1).replace('.',',')+' mi';
  document.getElementById('h-eb').textContent='R$ '+(2+m/10).toFixed(1).replace('.',',')+' mi';
  document.getElementById('h-drem').textContent='+'+m+'%'; document.getElementById('h-yoy').textContent='-'+(m/2)+'%';
  document.getElementById('c1').textContent='R$ 9,0 mi'; document.getElementById('c2').textContent='R$ 9,5 mi'; document.getElementById('c3').textContent='-R$ 0,5 mi'; document.getElementById('c3p').textContent='-5%';
  document.getElementById('titSub').textContent=vig+' · atualizado agora · banco';
  var L=['jan','fev','mar','abr','mai','jun','jul','ago','set','out'].slice(0,m);
  if(CH1) CH1.destroy(); CH1=new Chart(document.getElementById('g1'),{type:'bar',data:{labels:L,datasets:[{label:'Realizado',data:L.map((_,i)=>10+i),backgroundColor:'rgba(249,115,22,.65)',borderColor:'#F97316'},{label:'Remunerado',type:'line',data:L.map((_,i)=>9.5+i),borderColor:'#F1F5F9',borderDash:[5,3]}]},options:{animation:false,responsive:true,maintainAspectRatio:false}});
  if(CH2) CH2.destroy(); CH2=new Chart(document.getElementById('g2'),{type:'line',data:{labels:L,datasets:[{label:'AV Real',data:L.map((_,i)=>80+i),borderColor:'#F97316'}]},options:{animation:false,responsive:true,maintainAspectRatio:false}});
  var tb=document.getElementById('tb'),h='';for(var i=1;i<=20;i++)h+='<tr><td>Conta '+i+'</td><td class="num">'+(100*i)+'</td><td class="num">'+(110*i)+'</td><td class="num"><span style="background:'+(i%2?'#3BB33B':'#FF5252')+';color:#fff;border-radius:9px;padding:1px 6px">'+(105*i)+'</span></td><td class="num '+(i%2?'cg':'cr')+'">'+(i%2?'-':'+')+i+'%</td></tr>';
  h+='<tr class="total"><td>Total</td><td>21.000</td><td>23.100</td><td>22.050</td><td class="cr">+4%</td></tr>'; tb.innerHTML=h;
}
setTimeout(atualizar, 300);
</script></body></html>`);

/* ── servidor: o repositório + o dublê em /_dub/ ── */
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = u.startsWith('/_dub/') ? path.join(DUB, u.slice(6) || 'index.html') : path.join(RAIZ, u);
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(8771, r));
const BASE = 'http://localhost:8771';

/* ── o banco dublado ── */
const USER = { id: 'u-renan', aud: 'authenticated', role: 'authenticated', email: 'renan@conlogsa.com.br', user_metadata: { name: 'Renan Fortes' }, app_metadata: { provider: 'email' }, created_at: '2026-01-01T00:00:00Z' };
const sessao = () => ({ access_token: 'tok.' + Date.now(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'ref', user: USER });
const shBase = BASES.map(b => ({ slug: b.slug, gviz_chave: chaveDe(b), colunas: [{ i: 0, label: 'VIGÊNCIA', col: 'vigencia_orig', tipo: 'date' }, { i: 1, label: 'Unidade', col: 'unidade', tipo: 'string' }, { i: 2, label: 'Valor', col: 'valor', tipo: 'number' }], linhas: 3, erro: null, carregado_em: new Date().toISOString() }));
const linhasDe = () => [1, 2, 3].map(i => ({ linha: i, vigencia: '09/2026', vigencia_orig: '2026-09-01', unidade: 'PIRAÍ', valor: i * 10 }));
const pedidos = [];
async function rotas(ctx, opt = {}) {
  const adm = opt.admin !== false;
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => {
    const u = r.request().url();
    if (/supabase-js/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(SBJS) });
    if (/chart\.js@/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHART_JS) });
    if (/datalabels/.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.ChartDataLabels={id:"datalabels"};' });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await ctx.route(/\/(sw\.js)$/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await ctx.route('**/lozwipoeacpvplgkrxkq.supabase.co/**', r => {
    const req = r.request(), u = new URL(req.url()), p = u.pathname, h = req.headers();
    pedidos.push(req.method() + ' ' + p);
    const json = (b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-expose-headers': 'content-range', 'content-range': '0-0/1' }, body: JSON.stringify(b) });
    const um = /vnd\.pgrst\.object/.test(h.accept || '');
    if (p === '/auth/v1/token') { const b = req.postDataJSON ? (req.postDataJSON() || {}) : {}; if (u.searchParams.get('grant_type') === 'password' && b.password !== 'certa') return json({ error: 'invalid_grant', error_description: 'Invalid login credentials', message: 'Invalid login credentials' }, 400); return json(sessao()); }
    if (p === '/auth/v1/user') return json(USER);
    if (p === '/auth/v1/logout') return json({}, 204);
    if (p === '/rest/v1/fca_profiles') { const d = { user_id: USER.id, unidade: adm ? '' : 'PIR', is_admin: adm }; return json(um ? d : [d]); }
    if (p === '/rest/v1/user_approvals') { const d = { status: opt.status || 'approved' }; return json(um ? d : [d]); }
    if (p === '/rest/v1/access_log') return json({}, 201);
    if (p === '/rest/v1/app_resumo') return json(opt.resumo || []);
    if (p === '/rest/v1/sh_base') return json(shBase);
    if (p.startsWith('/rest/v1/sh_') || p.startsWith('/rest/v1/ca_')) return json(linhasDe());
    if (p.startsWith('/rest/v1/rpc/')) return json(null);
    return json(um ? null : []);
  });
  await ctx.route('**/docs.google.com/**', r => r.abort());
  // o catálogo do teste: o dublê + alguns reais
  await ctx.route('**/app/catalogo.js*', r => {
    const real = JSON.parse(fs.readFileSync(path.join(RAIZ, 'app/catalogo.js'), 'utf8').replace(/^[\s\S]*?window\.GEM_CATALOGO = /, '').replace(/;\s*$/, ''));
    const cat = { ordem: real.ordem, paineis: [
      { id: 'dub', nome: 'Painel Dublê', desc: 'o dublê da casca', href: '_dub/', cluster: 'Financeiro', adm: false, dono: false, modo: 'resumo', rdz: 'atualizar', vig: 'ms-vig', gav: false, ico: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>' },
      { id: 'dub-web', nome: 'Dublê Web', desc: 'abre inteiro', href: '_dub/', cluster: 'Processos', adm: false, dono: false, modo: 'web', rdz: '', vig: '', gav: false, ico: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>' },
      { id: 'dub-adm', nome: 'Dublê Admin', desc: 'só admin', href: '_dub/', cluster: 'Administração', adm: true, dono: false, modo: 'resumo', rdz: 'atualizar', vig: 'ms-vig', gav: false, ico: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>' },
    ].concat(real.paineis) };
    r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.GEM_CATALOGO=' + JSON.stringify(cat) + ';' });
  });
}
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
const novoCtx = async (opt = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await rotas(ctx, opt);
  await ctx.addInitScript(({ fav }) => { if (location.pathname.indexOf('/app/') >= 0 && !localStorage.getItem('gem_app_fav')) localStorage.setItem('gem_app_fav', JSON.stringify(fav)); window.APP_TEMPOS = { passo: 150, quieto: 2, min: 400, pos: 300 }; window.APP_EXEC = []; }, { fav: ['dub'] });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.errs = errs;
  return { ctx, page };
};
const shot = async (page, n) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, n + '.png') }); } };

let DADOS_DUB = null;   // o resumo do dublê lido no cenário 3, reaproveitado como "resumo do robô" no cenário 8b
/* ══════ 1 · login ══════ */
console.log('1 · login');
{
  const { ctx, page } = await novoCtx();
  await page.goto(BASE + '/app/');
  await page.waitForSelector('#tela-login.on', { timeout: 15000 });
  conf(await page.isVisible('#lgEmail'), 'abre na tela de login (sem sessão guardada)');
  await shot(page, '01-login');
  await page.fill('#lgEmail', 'renan@conlogsa.com.br'); await page.fill('#lgSenha', 'errada'); await page.click('#btEntrar');
  await page.waitForFunction(() => document.getElementById('lgErro').textContent.length > 0);
  conf(/incorretos/.test(await page.textContent('#lgErro')), 'senha errada → "E-mail ou senha incorretos."');
  await page.fill('#lgSenha', 'certa'); await page.click('#btEntrar');
  await page.waitForSelector('#app:not([style*="none"])', { timeout: 15000 });
  conf((await page.textContent('#ola')) === 'Olá, Renan!', 'entra e cumprimenta pelo primeiro nome: ' + await page.textContent('#ola'));
  conf(await page.evaluate(() => sessionStorage.getItem('gem_hub') === '1'), 'libera o gate dos painéis (sessionStorage.gem_hub)');
  conf(await page.evaluate(() => JSON.parse(localStorage.getItem('gem_perfil_u-renan') || '{}').is_admin === true), 'guarda o perfil (admin)');
  await shot(page, '02-inicio');

  /* ══════ 2 · painéis ══════ */
  console.log('2 · a lista de painéis');
  await page.click('#nav button[data-v="paineis"]');
  const grupos = await page.$$eval('#lista .sec', ls => ls.map(l => l.firstChild.textContent.trim()));
  conf(grupos[0] === 'Visão Geral' && grupos.includes('Financeiro') && grupos.includes('Administração'), 'grupos na ordem do hub: ' + grupos.join(' · '));
  conf(await page.$('#lista .li[data-id="dub-adm"]') !== null, 'admin vê o painel de admin');
  const nLi = await page.$$eval('#lista .li', l => l.length);
  conf(nLi >= 60, nLi + ' painéis listados');
  await page.fill('#busca', 'dublê');
  conf(await page.$$eval('#lista .li', l => l.length) === 3, 'a busca filtra (3 dublês)');
  await page.fill('#busca', '');
  await shot(page, '03-paineis');

  /* ══════ 3 · abre o painel por dentro ══════ */
  console.log('3 · o painel dublê, por dentro');
  await page.click('#lista .li[data-id="dub"]');
  await page.waitForSelector('#tela-painel.on');
  await page.waitForFunction(() => document.querySelector('#pnCorpo .hero .val'), null, { timeout: 30000 });
  await page.waitForFunction(() => document.getElementById('pnEstado').style.display === 'none', null, { timeout: 30000 });
  const hero = await page.$$eval('#pnCorpo .hero .hi', hs => hs.map(h => ({ l: h.querySelector('.rot').textContent, v: h.querySelector('.val').textContent, dels: [...h.querySelectorAll('.pills .pill')].map(d => d.textContent) })));
  conf(hero.length === 3 && hero[0].l === 'Custo realizado' && hero[0].v === 'R$ 11,0 mi' && hero[1].v === 'R$ 3,0 mi', 'hero: dois números com o rótulo e o valor do painel (' + JSON.stringify(hero.map(h => h.v)) + ')');
  conf(hero[0].dels.length === 2 && /Δ Rem %\+10%/.test(hero[0].dels[0]), 'deltas do hero viram pílulas: ' + hero[0].dels.join(' | '));
  const delCor = await page.$eval('#pnCorpo .hero .pills .pill', b => b.className);
  conf(/\bneg\b/.test(delCor), 'a cor do delta é a do painel (vermelho → pílula neg): ' + delCor);
  const kp = await page.$$eval('#pnCorpo .kg .k', ks => ks.map(k => ({ l: k.querySelector('.l').textContent, v: k.querySelector('.v').textContent, c: k.querySelector('.v').className, m: (k.querySelector('.m') || {}).textContent })));
  conf(kp.length === 6 && kp[0].l === 'Orçado' && kp[0].v === 'R$ 9,0 mi', '4 cards do 1º grupo com rótulo e valor: ' + kp.slice(0, 4).map(k => k.l + '=' + k.v).join(', '));
  const grp = await page.$eval('#pnCorpo .kgrp', g => ({ t: g.querySelector('.t').textContent, n: g.querySelectorAll('.row div').length, v: [...g.querySelectorAll('.row b')].map(b => b.textContent + (b.className ? '(' + b.className + ')' : '')) }));
  conf(grp.t === 'Custo Combustível' && grp.n === 4 && /1,0 mi/.test(grp.v[0]) && /\(neg\)/.test(grp.v[2]), 'o grupo de mini-tabela (Árvore) vira UM card de uma linha: ' + grp.t + ' · ' + grp.v.join(' '));
  conf(kp[3].v === '18,5' && /^de 25,0 · meta 80%/.test(kp[3].m), 'valor com <small> (Painel de Metas): o número é o valor e o "de 25,0" vai para a nota: ' + kp[3].v + ' / ' + kp[3].m);
  conf(/pos/.test(kp[2].c), 'o card verde do painel sai verde no app');
  conf(/YoY: \+3%/.test(kp[0].m), 'a nota do card (YoY) vem junto: ' + kp[0].m);
  const gr = await page.$$eval('#pnCorpo .gc', gs => gs.map(g => ({ t: g.querySelector('.t').textContent, leg: [...g.querySelectorAll('.leg span')].map(s => s.textContent) })));
  conf(gr.length === 2 && gr[0].t === 'Custo mensal' && gr[0].leg.join(',') === 'Realizado,Remunerado', '2 gráficos com título e legenda do painel: ' + JSON.stringify(gr));
  const dados = await page.evaluate(() => { const c = document.querySelector('#pnCorpo .gc canvas'); const ch = Chart.getChart(c); return { tipos: ch.data.datasets.map(d => d.type), n: ch.data.labels.length, d0: ch.data.datasets[0].data.slice(0, 3), d1: ch.data.datasets[1].data.slice(0, 3), dash: ch.data.datasets[1].borderDash }; });
  conf(dados.n === 10 && dados.d0.join() === '10,11,12' && dados.d1.join() === '9.5,10.5,11.5' && dados.tipos[1] === 'line', 'os dados do gráfico são os do painel (barra + linha, 10 meses): ' + JSON.stringify(dados));
  conf(dados.dash && dados.dash.length === 2, 'linha tracejada do painel continua tracejada');
  const bl = await page.evaluate(() => PN_DATA.blocos.map(b => b.t + (b.tit ? ':' + b.tit : '')));
  conf(bl.join(',') === 'hero,kpis,graf:Custo mensal,graf:AV %,kpis:Custo Combustível,hero,kpis', 'blocos na ordem do painel (o .gate escondido não conta): ' + bl.join(','));
  const arv = await page.evaluate(() => PN_DATA.blocos[4]);
  conf(arv.itens.length === 4 && arv.itens[0].l === 'Rem' && arv.itens[0].v === '1,0 mi' && arv.itens[2].cor === 'r', 'card com mini-tabela (Árvore) vira grupo de 4 cards com o rótulo do card: ' + arv.itens.map(i => i.l + '=' + i.v).join(' · '));
  const pn = await page.evaluate(() => ({ h: PN_DATA.blocos[5].itens[0], k: PN_DATA.blocos[6].itens }));
  conf(pn.h.l === 'Saúde dos Pneus' && pn.h.v === '82' && pn.h.dels.length === 1 && pn.h.dels[0].v === '6.500', 'hero com classes próprias (adh-hero): ' + JSON.stringify(pn.h));
  conf(pn.k.length === 2 && pn.k[0].l === 'MM Média' && pn.k[0].v === '7,1 mm' && pn.k[0].m === 'menor sulco médio', 'cards com classes próprias (saude-card): ' + pn.k.map(i => i.l + '=' + i.v).join(' · '));
  const vistas = await page.$$eval('#pnVistas .chip', cs => cs.map(c => c.textContent + (c.classList.contains('on') ? '*' : '')));
  conf(vistas.join('|') === 'Resumo Gerencial*|Detalhe', 'chips das visões, a 1ª marcada: ' + vistas.join(' | '));
  const vigs = await page.$$eval('#vigMes option', os => os.map(o => o.textContent + (o.selected ? '*' : '') + '=' + o.value));
  conf(vigs.join(' ') === 'Todos=* Jul=07/2026 Ago=08/2026 Set=09/2026 Out*=10/2026', 'lista suspensa de MÊS: "Todos" primeiro, só os meses com dado, na ordem do calendário, a padrão marcada: ' + vigs.join(' '));
  const anos = await page.$$eval('#vigAno option', os => os.map(o => o.textContent + (o.selected ? '*' : '')));
  conf(anos.join(' ') === '2026*', 'lista suspensa de ANO (mesmo um ano só): ' + anos.join(' '));
  conf(await page.$$eval('#pnVigs .chip', c => c.length) === 0, 'nenhum chip de vigência na tela (saiu a grade de 12 meses)');
  conf(/Painel Dublê/.test(await page.textContent('#pnTit')) && /10\/2026 · atualizado/.test(await page.textContent('#pnSub')), 'título e subtítulo do painel: ' + await page.textContent('#pnSub'));
  conf(await page.$$eval('#forno iframe', l => l.length) === 1 && await page.$eval('#forno iframe', f => f.getBoundingClientRect().width) === 1366, 'o painel carregou num iframe escondido de 1366 px');
  conf(pedidos.some(x => x === 'GET /rest/v1/app_resumo'), 'antes de abrir o iframe o app pediu os resumos do robô (app_resumo) ao banco');
  DADOS_DUB = await page.evaluate(() => JSON.parse(JSON.stringify(PN_DATA)));
  await shot(page, '04-painel-resumo');

  /* ══════ 4 · troca de visão: tabela ══════ */
  console.log('4 · visão Detalhe (tabela)');
  await page.click('#pnVistas .chip[data-v="detalhe"]');
  await page.waitForFunction(() => document.querySelector('#pnCorpo .tb .lista') && document.getElementById('pnEstado').style.display === 'none', null, { timeout: 30000 });
  const tb = await page.$eval('#pnCorpo .tb', t => ({ tit: t.querySelector('.t').textContent, n: t.querySelectorAll('.lr').length, head: [...t.querySelectorAll('.lh span')].map(s => s.textContent), l1: { nome: t.querySelector('.lr .ln b').textContent, vals: [...t.querySelectorAll('.lr .lv b')].slice(0, 3).map(b => b.textContent + '/' + b.className), mais: !!t.querySelector('.lr .mi'), extras: t.querySelectorAll('.lr .bar, .lr .rk, .lr small').length }, chips: t.querySelectorAll('.colsel, .chip').length, mais: (t.querySelector('.mais') || {}).textContent }));
  conf(tb.tit === 'Por conta' && tb.head.join('|') === 'Conta|Remunerado|Realizado|Δ %|' && tb.l1.nome === 'Conta 1' && tb.l1.vals.join(' ') === '110/ 105/pos -1%/pos' && tb.l1.mais && tb.l1.extras === 0 && tb.chips === 0, 'tabela compacta: Rem · Real · Δ % na linha, na cor do painel (fundo da pílula e cg → pos), com o "+" e sem chips de coluna: ' + JSON.stringify(tb));
  conf(tb.n === 12 && /ver todas as 21/.test(tb.mais), '12 linhas na tela e o "ver todas as 21 linhas"');
  await page.click('#pnCorpo .tb .lr');   // o "+": abre o resto das colunas embaixo da linha
  const ld = await page.$eval('#pnCorpo .tb', t => ({ ab: t.querySelector('.lr').classList.contains('ab'), det: [...t.querySelectorAll('.ld span')].map(x => x.querySelector('em').textContent + '=' + x.querySelector('b').textContent) }));
  conf(ld.ab && ld.det.join(' ') === 'Orçado=100', 'tocar na linha abre as colunas que não cabem (Orçado) embaixo dela: ' + JSON.stringify(ld));
  await page.click('#pnCorpo .tb .lr');
  conf(await page.$$eval('#pnCorpo .tb .ld', l => l.length) === 0, 'tocar de novo fecha');
  const v3 = await page.$$eval('#pnCorpo .tb .lr', rs => rs.slice(0, 2).map(r => r.querySelectorAll('.lv b')[1]).map(b => b.textContent + '/' + b.className).join(' '));
  conf(v3 === '105/pos 210/neg', 'a cor da condicional vem do FUNDO da pílula quando o texto é branco: ' + v3);
  const subPos = await page.$eval('#pnCorpo .tb', t => { const k = [...t.children].map(c => c.className); return k.indexOf('lista') < k.indexOf('s pe') || !t.querySelector('.s.pe') ? 'embaixo' : 'em cima'; });
  conf(subPos === 'embaixo', 'subtítulo/nota da tabela fica embaixo da lista, nunca em cima');
  await page.click('#pnCorpo .tb .mais');
  conf(await page.$$eval('#pnCorpo .tb .lr', l => l.length) === 21 && await page.$eval('#pnCorpo .tb .lr:last-child', tr => tr.classList.contains('tot')), 'ver todas → 21 linhas, a última é o Total');
  await shot(page, '05-painel-tabela');

  /* ══════ 5 · troca de vigência ══════ */
  console.log('5 · vigência');
  await page.click('#pnVistas .chip[data-v="resumo"]');
  await page.waitForFunction(() => document.querySelector('#pnCorpo .hero') && document.getElementById('pnEstado').style.display === 'none', null, { timeout: 30000 });
  await page.selectOption('#vigMes', '08/2026');
  await page.waitForFunction(() => (document.querySelector('#pnCorpo .hero .val') || {}).textContent === 'R$ 10,8 mi' && document.getElementById('pnEstado').style.display === 'none', null, { timeout: 30000 });
  const cham = await page.evaluate(() => document.querySelector('#forno iframe').contentWindow.CHAM);
  conf(cham.includes('atualizar:08/2026'), 'o painel recebeu a vigência e redesenhou (atualizar com 08/2026): ' + cham.join(', '));
  conf(await page.$eval('#vigMes', s => s.value) === '08/2026' && await page.$eval('#vigAno', s => s.value) === '2026', 'a lista de mês fica em Ago e a de ano em 2026');
  const n8 = await page.evaluate(() => Chart.getChart(document.querySelector('#pnCorpo .gc canvas')).data.labels.length);
  conf(n8 === 8, 'o gráfico acompanha a vigência (8 meses)');
  conf(/08\/2026 · atualizado/.test(await page.textContent('#pnSub')), 'subtítulo acompanha: ' + await page.textContent('#pnSub'));
  await page.selectOption('#vigMes', '*');   // Todos: nada marcado no filtro do painel
  await page.waitForFunction(() => (document.getElementById('vigMes') || {}).value === '*' && document.getElementById('pnEstado').style.display === 'none', null, { timeout: 30000 });
  const todos = await page.evaluate(() => { const w = document.querySelector('#forno iframe').contentWindow; return { sel: w.document.getElementById('ms-vig')._sel.size, cham: w.CHAM[w.CHAM.length - 1] }; });
  conf(todos.sel === 0 && /^atualizar:/.test(todos.cham), '"Todos" limpa o filtro do painel (nada marcado = todas) e redesenha: ' + JSON.stringify(todos));
  await page.selectOption('#vigMes', '10/2026');
  await page.waitForFunction(() => (document.querySelector('#pnCorpo .hero .val') || {}).textContent === 'R$ 11,0 mi' && document.getElementById('pnEstado').style.display === 'none', null, { timeout: 30000 });

  /* ══════ 6 · cache e início ══════ */
  console.log('6 · cache, favoritos e início');
  const chaves = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('gem_app_c2_dub|')));
  conf(chaves.length === 4, 'quatro resumos guardados (padrão, detalhe, 08/2026, Todos; 10/2026 é o padrão e reaproveita): ' + chaves.join(' '));
  conf(await page.$eval('#btFav', b => b.classList.contains('on')), 'o dublê é favorito (estrela acesa)');
  await page.click('button[onclick="fechaPainel()"]');
  await page.waitForFunction(() => !document.getElementById('tela-painel').classList.contains('on'));
  await page.click('#nav button[data-v="inicio"]');
  const dq = await page.$eval('#destaques .dq', d => ({ rot: d.querySelector('.rot').textContent, val: d.querySelector('.val').textContent, sub: (d.querySelector('.sub') || {}).textContent }));
  conf(/Painel Dublê/.test(dq.rot) && dq.val === 'R$ 11,0 mi', 'o início mostra o destaque com o número da vigência PADRÃO do painel: ' + dq.val + ' · ' + dq.sub);
  conf(await page.$$eval('#exec .ex', l => l.length) === 0 && await page.$$eval('#v-inicio .saldo, #iniVal', l => l.length) === 0, 'sem o hero do 1º favorito nem sparkline no início (o teste roda com o bloco executivo vazio)');
  conf(await page.$$eval('#recentes .li', l => l.length) === 1 && /lido/.test(await page.textContent('#recentes .li .tx span')), 'abertos por último: o dublê, com a hora da leitura');
  await shot(page, '06-inicio-com-dados');
  // reabrir: na hora, do cache, sem iframe novo
  await page.evaluate(() => mataForno());
  await page.click('#destaques .dq');
  await page.waitForSelector('#tela-painel.on');
  const antes = await page.evaluate(() => ({ val: (document.querySelector('#pnCorpo .hero .val') || {}).textContent, ifr: document.querySelectorAll('#forno iframe').length }));
  conf(antes.val === 'R$ 11,0 mi' && antes.ifr === 0, 'reabre na hora do cache, sem iframe: ' + JSON.stringify(antes));
  conf(/lido do painel em/.test(await page.textContent('#pnCorpo .pe-painel')), 'rodapé diz quando foi lido');
  await page.click('#btFav');
  conf(!(await page.$eval('#btFav', b => b.classList.contains('on'))) && await page.evaluate(() => JSON.parse(localStorage.getItem('gem_app_fav')).length === 0), 'a estrela tira dos favoritos');
  await page.click('#btFav');
  await page.click('button[onclick="fechaPainel()"]');

  /* ══════ 7 · tema, web e perfil ══════ */
  console.log('7 · tema, painel inteiro e perfil');
  await page.click('#btTema');
  conf(await page.evaluate(() => document.body.classList.contains('claro') && localStorage.getItem('bi_theme') === 'light'), 'tema claro, na chave do portal (bi_theme)');
  await shot(page, '07-claro');
  await page.click('#btTema');
  await page.click('#nav button[data-v="paineis"]');
  await page.click('#lista .li[data-id="dub-web"]');
  await page.waitForSelector('#tela-web.on');
  conf(/\/_dub\/$/.test(await page.$eval('#wbFrame', f => f.src)) && (await page.textContent('#wbTit')) === 'Dublê Web', 'painel "web" abre inteiro dentro do app');
  await page.click('button[onclick="fechaWeb()"]');
  await page.click('#nav button[data-v="perfil"]');
  conf(/Renan Fortes/.test(await page.textContent('#pfNome')) && /Administrador/.test(await page.textContent('#pfSub')), 'perfil: nome e papel');
  await shot(page, '08-perfil');
  conf(page.errs.length === 0, 'nenhum erro de página no app' + (page.errs.length ? ': ' + page.errs.join(' | ') : ''));
  await ctx.close();
}

/* ══════ 8 · quem não é admin e quem não tem sessão ══════ */
console.log('8 · gestor (não admin) e sem sessão');
{
  const { ctx, page } = await novoCtx({ admin: false });
  await page.goto(BASE + '/app/');
  await page.waitForSelector('#tela-login.on');
  await page.fill('#lgEmail', 'gestor@conlogsa.com.br'); await page.fill('#lgSenha', 'certa'); await page.click('#btEntrar');
  await page.waitForSelector('#app:not([style*="none"])', { timeout: 15000 });
  await page.click('#nav button[data-v="paineis"]');
  conf(await page.$('#lista .li[data-id="dub-adm"]') === null && await page.$('#lista .li[data-id="dub"]') !== null, 'gestor não vê os painéis de admin');
  conf(/Gestor · PIR/.test(await page.evaluate(() => document.getElementById('pfSub').textContent)), 'papel: Gestor · PIR');
  conf((await page.evaluate(() => urlDe(painelPorId('gestao-a-vista')))).endsWith('?u=PIR'), 'Gestão à Vista abre na unidade do gestor (?u=PIR)');
  await ctx.close();
}
{
  const { ctx, page } = await novoCtx({ status: 'pending' });
  await page.goto(BASE + '/app/');
  await page.waitForSelector('#tela-login.on');
  await page.fill('#lgEmail', 'novo@conlogsa.com.br'); await page.fill('#lgSenha', 'certa'); await page.click('#btEntrar');
  await page.waitForFunction(() => /aprovado/.test(document.getElementById('lgErro').textContent), null, { timeout: 15000 });
  conf(true, 'cadastro pendente fica no login com o aviso');
  await ctx.close();
}
{
  /* ══════ 8b · o resumo PRÉ-LIDO pelo robô (app_resumo): nada de iframe ══════ */
  console.log('8b · resumos do robô (app_resumo)');
  const robo = JSON.parse(JSON.stringify(DADOS_DUB)); robo.blocos[0].itens[0].v = 'R$ 77,7 mi';   // número que só o robô tem
  const { ctx, page } = await novoCtx({ resumo: [{ id: 'dub', vw: robo.vw || 'resumo', vig: '', unidade: '', dados: robo, lido_em: new Date(Date.now() - 10 * 60e3).toISOString() }] });
  await page.goto(BASE + '/app/');
  await page.waitForSelector('#tela-login.on');
  await page.fill('#lgEmail', 'renan@conlogsa.com.br'); await page.fill('#lgSenha', 'certa'); await page.click('#btEntrar');
  await page.waitForSelector('#app:not([style*="none"])', { timeout: 15000 });
  // o bloco EXECUTIVO do início (Renan, 07/11/2026): números fixos lidos do resumo do robô; aqui apontado para o dublê
  await page.evaluate(() => { EXEC = [{ id: 'dub', bloco: 'hero', l: 'custo', rot: 'Custo (dublê)', dels: [{ p: 'rem.*%', l: 'vs remunerado' }, { p: 'yoy', l: 'YoY' }] }]; renderInicio(); });
  const ex = await page.$eval('#exec', e => ({ sec: e.querySelector('.sec').textContent, rot: e.querySelector('.ex .rot').textContent, val: e.querySelector('.ex .val').textContent, dls: [...e.querySelectorAll('.ex .dl')].map(d => d.querySelector('span').textContent + '=' + d.querySelector('b').textContent + '/' + d.querySelector('b').className), dq: document.querySelectorAll('#destaques .dq').length }));
  conf(/Resultado/.test(ex.sec) && /Out\/26/.test(ex.sec) && ex.rot === 'Custo (dublê)' && ex.val === 'R$ 77,7 mi', 'o início executivo mostra o número do robô, lido do banco, com a vigência: ' + JSON.stringify(ex));
  conf(ex.dls.join(' ') === 'vs remunerado=+10%/neg YoY=-5%/pos' && ex.dq === 0, 'com o delta em % na cor do painel, e o painel do bloco executivo não repete nos destaques: ' + JSON.stringify(ex.dls));
  await page.waitForTimeout(1500);
  conf(await page.$$eval('#forno iframe', l => l.length) === 0, 'e NENHUM iframe foi aberto (a fila de destaques não roda quando o robô já leu)');
  await page.evaluate(() => abrePainel('dub'));
  await page.waitForFunction(() => document.querySelector('#pnCorpo .pe-painel'), null, { timeout: 10000 });
  await page.waitForTimeout(800);
  conf(/77,7/.test(await page.textContent('#pnCorpo .hero .val')) && /lido pelo robô/.test(await page.textContent('#pnCorpo .pe-painel')) && await page.$$eval('#forno iframe', l => l.length) === 0, 'abrir o painel desenha o resumo do robô na hora, sem iframe, e o rodapé diz "lido pelo robô"');
  await page.evaluate(() => recarregaPainel());
  await page.waitForFunction(() => document.querySelector('#forno iframe'), null, { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => /11,0/.test((document.querySelector('#pnCorpo .hero .val') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
  conf(/11,0/.test(await page.textContent('#pnCorpo .hero .val')) && /lido do painel/.test(await page.textContent('#pnCorpo .pe-painel')), '"Atualizar" relê do painel de verdade (iframe) e passa a dizer "lido do painel": ' + await page.textContent('#pnCorpo .hero .val'));
  conf(page.errs.length === 0, 'nenhum erro de página' + (page.errs.length ? ': ' + page.errs.join(' | ') : ''));
  await ctx.close();
}
{
  // sem gem_hub o painel manda para o hub → o app diz que o painel recusou
  const { ctx, page } = await novoCtx();
  await page.goto(BASE + '/app/');
  await page.waitForSelector('#tela-login.on');
  await page.fill('#lgEmail', 'renan@conlogsa.com.br'); await page.fill('#lgSenha', 'certa'); await page.click('#btEntrar');
  await page.waitForSelector('#app:not([style*="none"])', { timeout: 15000 });
  await page.evaluate(() => { sessionStorage.removeItem('gem_hub'); localStorage.removeItem('gem_app_fav'); });
  await page.evaluate(() => abrePainel('dub'));
  await page.waitForFunction(() => document.querySelector('#pnEstado.erro') || document.querySelector('#pnCorpo .vazio'), null, { timeout: 40000 });
  conf(/recusou|Não deu/.test(await page.textContent('#pnCorpo')), 'painel que recusa (gate) vira aviso com "abrir o painel completo", não tela em branco');
  await ctx.close();
}
{
  /* ══════ 8c · o início NÃO fica em "carregando…" para sempre (Renan, 06/11/2026: "2h carregando essa pora?") ══════ */
  console.log('8c · destaque que falha na leitura em segundo plano');
  const { ctx, page } = await novoCtx();
  await page.goto(BASE + '/app/');
  await page.waitForSelector('#tela-login.on');
  await page.fill('#lgEmail', 'renan@conlogsa.com.br'); await page.fill('#lgSenha', 'certa'); await page.click('#btEntrar');
  await page.waitForSelector('#app:not([style*="none"])', { timeout: 15000 });
  await page.evaluate(() => { sessionStorage.removeItem('gem_hub'); localStorage.setItem('gem_app_fav', '["dub"]'); limpaCache(); renderInicio(); filaDestaques(); });
  conf(/carregando/.test(await page.textContent('#destaques .dq .sub')), 'enquanto a fila lê, o destaque diz "carregando…"');
  await page.waitForFunction(() => /não deu para ler/.test((document.querySelector('#destaques .dq .sub') || {}).textContent || ''), null, { timeout: 60000 }).catch(() => {});
  conf(/não deu para ler agora/.test(await page.textContent('#destaques .dq .sub')), 'a leitura falhou (gate): o destaque diz "não deu para ler agora · toque para abrir", não "carregando…" para sempre');
  const falha = await page.evaluate(() => FALHA.dub && FALHA.dub.msg);
  conf(/recusou/.test(falha || ''), 'o motivo fica guardado para a nova tentativa em 10 min: ' + falha);
  const t1 = await page.evaluate(() => FORNO.t);
  await page.evaluate(() => filaDestaques());
  await page.waitForTimeout(800);
  conf(await page.evaluate(() => FORNO.t) === t1 && await page.$$eval('#forno iframe', l => l.length) <= 1, 'chamar a fila de novo antes dos 10 min NÃO reabre o iframe do que acabou de falhar');
  await ctx.close();
}

/* ══════ 9 · painéis reais (mecânica) ══════ */
const PAINEIS = (process.env.PAINEIS || 'visao-financeira,painel-km,scorecard,fca-gerencial').split(',').filter(Boolean);
if (PAINEIS.length) {
  console.log('9 · painéis reais com o banco sintético: ' + PAINEIS.join(', '));
  const { ctx, page } = await novoCtx();
  await page.goto(BASE + '/app/');
  await page.waitForSelector('#tela-login.on');
  await page.fill('#lgEmail', 'renan@conlogsa.com.br'); await page.fill('#lgSenha', 'certa'); await page.click('#btEntrar');
  await page.waitForSelector('#app:not([style*="none"])', { timeout: 15000 });
  await page.evaluate(() => { localStorage.setItem('gem_app_fav', '[]'); });
  for (const id of PAINEIS) {
    const t0 = Date.now();
    await page.evaluate(id => abrePainel(id), id);
    await page.waitForFunction(() => { const e = document.getElementById('pnEstado'); const c = document.getElementById('pnCorpo'); return (e && e.style.display === 'none' && c.textContent.trim().length > 0) || document.querySelector('#pnEstado.erro') || c.querySelector('.vazio'); }, null, { timeout: 120000 }).catch(() => {});
    const r = await page.evaluate(() => ({ blocos: window.PN_DATA ? PN_DATA.blocos.map(b => b.t).join(',') : '', estado: (document.getElementById('pnEstado') || {}).textContent || '', vazio: !!document.querySelector('#pnCorpo .vazio'), txt: document.getElementById('pnCorpo').textContent.trim().length }));
    conf(r.txt > 0 && (r.blocos || r.vazio || r.estado), id + ' (' + Math.round((Date.now() - t0) / 1000) + ' s): ' + (r.blocos ? 'blocos ' + r.blocos : r.vazio ? 'sem resumo (aviso)' : r.estado));
    await shot(page, '09-' + id);
    await page.evaluate(() => fechaPainel());
  }
  conf(page.errs.filter(e => /app\.js|catalogo\.js/.test(e)).length === 0, 'nenhum erro do app.js com os painéis reais' + (page.errs.length ? ' (erros dos painéis: ' + page.errs.length + ')' : ''));
  await ctx.close();
}

await browser.close(); srv.close();
console.log('\n' + ok + ' ok · ' + falhas + ' falha(s)');
process.exit(falhas ? 1 : 0);
