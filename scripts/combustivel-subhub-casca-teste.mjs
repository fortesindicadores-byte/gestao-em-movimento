// ============================================================================
// Teste da casca nova dos dois sub-hubs de Combustível (combustivel/ e
// combustivel/seara/) no Chromium, com o supabase-js dublado. Roda os DOIS
// lados (HTML do HEAD salvo em OLD_COMB/OLD_SEARA, e o atual) e confere:
//  - os mesmos cards, na mesma ordem, com o mesmo título, texto, destino e selo;
//  - a mesma regra de visibilidade dos cards de admin, em 4 papéis
//    (admin pelo e-mail fixo, admin pelo fca_profiles, usuário comum, sem sessão);
//  - o redirect para o hub sem sessionStorage.gem_hub;
//  - (só no novo) página sem rolagem em 1366x768 e 1600x900, tema claro/escuro
//    com a chave bi_theme, zero erro de página; prints nos dois temas.
// Uso (de uma pasta onde o playwright resolve):
//   RAIZ=<repo> OLD_COMB=<html> OLD_SEARA=<html> SHOT_DIR=<pasta> node combustivel-subhub-casca-teste.mjs
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.env.RAIZ;
const SHOT = process.env.SHOT_DIR || '';
const OLD = { '/combustivel/index.html': process.env.OLD_COMB, '/combustivel/seara/index.html': process.env.OLD_SEARA };
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' };
const srv = createServer((req, res) => {
  let [p, q] = req.url.split('?');
  p = decodeURIComponent(p); if (p.endsWith('/')) p += 'index.html';
  const f = (q === 'old' && OLD[p]) ? OLD[p] : path.join(RAIZ, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e !== '' ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

const SBDUB = `window.supabase={createClient:()=>({
  auth:{getSession:async()=>{const r=window.__ROLE;
    if(r==='anon')return{data:{session:null}};
    const email=r==='admin-email'?'fortesindicadores@gmail.com':'x@conlog.com.br';
    return{data:{session:{user:{id:'u-'+r,email}}}};}},
  from:(t)=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:t==='fca_profiles'?{is_admin:window.__ROLE==='admin-prof'}:null,error:null})};return q;}
})};`;

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
async function abre({ url, role = 'user', gem = true, theme = null, w = 1600, h = 900 }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: r.request().url().includes('supabase') ? SBDUB : '' }));
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', e => erros.push(e.message));
  await pg.addInitScript(([role, gem, theme]) => {
    window.__ROLE = role;
    try { if (gem) sessionStorage.setItem('gem_hub', '1'); if (theme) localStorage.setItem('bi_theme', theme); } catch (e) {}
  }, [role, gem, theme]);
  await pg.goto(BASE + url, { waitUntil: 'load' });
  await pg.waitForTimeout(400);
  return { ctx, pg, erros };
}
const cards = pg => pg.evaluate(() => {
  const els = [...document.querySelectorAll('.dash-card, .hcard')];
  return els.map(c => {
    const a = c.tagName === 'A' ? c : c.querySelector('a');
    const tit = c.querySelector('.card-title, .tit');
    const dsc = c.querySelector('.card-desc, .dsc');
    const bdg = c.querySelector('.badge, .bdg');
    return { t: tit && tit.textContent.trim(), d: dsc && dsc.textContent.trim(), h: a && a.getAttribute('href'),
      b: bdg ? bdg.textContent.trim() : '', vis: getComputedStyle(c).display !== 'none' };
  });
});

const PAGS = [
  { nome: 'combustivel', url: '/combustivel/', hub: '/', esperaAdm: { 'admin-email': true, 'admin-prof': true, user: false, anon: false }, cardAdm: 'Condução Econômica',
    voltar: [['Hub Principal', '../'], ['Seara', 'seara/']] },
  { nome: 'seara', url: '/combustivel/seara/', hub: '/', esperaAdm: { 'admin-email': false, 'admin-prof': true, user: false, anon: false }, cardAdm: 'Remuneração por placa',
    voltar: [['Combustível', '../']] },
];

for (const P of PAGS) {
  console.log(`\n══ ${P.nome} ══`);
  for (const role of ['admin-email', 'admin-prof', 'user', 'anon']) {
    const o = await abre({ url: P.url + '?old', role });
    const n = await abre({ url: P.url, role });
    const co = await cards(o.pg), cn = await cards(n.pg);
    af(`${role}: mesmos cards (título, texto, destino, selo, visível) antigo × novo`, JSON.stringify(co) === JSON.stringify(cn),
      cn.filter(c => c.vis).map(c => c.t).join(' | '));
    const adm = cn.find(c => c.t === P.cardAdm);
    af(`${role}: card "${P.cardAdm}" ${P.esperaAdm[role] ? 'visível' : 'escondido'}`, adm && adm.vis === P.esperaAdm[role]);
    af(`${role}: zero erro de página (novo)`, n.erros.length === 0, n.erros.join('; '));
    await o.ctx.close(); await n.ctx.close();
  }
  // botões do topo
  const n = await abre({ url: P.url, role: 'user' });
  for (const [txt, href] of P.voltar) {
    const achou = await n.pg.evaluate(([txt, href]) => [...document.querySelectorAll('.top a')].some(a => a.textContent.trim() === txt && a.getAttribute('href') === href), [txt, href]);
    af(`topo: "${txt}" → ${href}`, achou);
  }
  const meta = await n.pg.evaluate(() => document.querySelector('meta[name=build]').content + ' · ' + [...document.scripts].map(s => s.getAttribute('src') || '').filter(Boolean).join(' '));
  af('build 202610052300 no meta e no build-check', meta.startsWith('202610052300') && meta.includes('build-check.js?v=202610052300'), meta);
  af('scripts: mobile.js, ctrlk.js, gviz-cache.js, supabase', ['mobile.js', 'ctrlk.js', 'gviz-cache.js', 'supabase-js'].every(s => meta.includes(s)));
  // tema
  const t0 = await n.pg.evaluate(() => document.body.classList.contains('claro'));
  await n.pg.click('#btTema');
  const t1 = await n.pg.evaluate(() => [document.body.classList.contains('claro'), localStorage.getItem('bi_theme')]);
  af('tema: abre escuro, botão troca para body.claro e grava bi_theme=light', !t0 && t1[0] && t1[1] === 'light', JSON.stringify(t1));
  await n.ctx.close();
  const c2 = await abre({ url: P.url, theme: 'light' });
  af('tema: bi_theme=light já abre claro', await c2.pg.evaluate(() => document.body.classList.contains('claro')));
  await c2.ctx.close();
  // redirect sem gem_hub
  const r = await abre({ url: P.url, gem: false });
  const destino = new URL(r.pg.url()).pathname;
  af('sem gem_hub volta para o hub da raiz', destino === '/' || destino === '/index.html', destino);
  await r.ctx.close();
  // sem rolagem + prints
  for (const [w, h] of [[1600, 900], [1366, 768]]) {
    for (const role of ['admin-prof', 'user']) {
      for (const theme of ['dark', 'light']) {
        const s = await abre({ url: P.url, role, theme, w, h });
        const m = await s.pg.evaluate(() => {
          const b = document.getElementById('board');
          const r = [...document.querySelectorAll('.hcard')].filter(c => getComputedStyle(c).display !== 'none').map(c => c.getBoundingClientRect());
          const app = document.querySelector('.app').getBoundingClientRect();
          return { pag: document.documentElement.scrollHeight - innerHeight, pagX: document.documentElement.scrollWidth - innerWidth,
            board: b.scrollHeight - b.clientHeight, boardX: b.scrollWidth - b.clientWidth,
            dentro: r.every(x => x.bottom <= app.bottom && x.right <= app.right) };
        });
        af(`${w}x${h} ${role} ${theme}: sem rolagem (página e grade) e cards dentro da moldura`,
          m.pag <= 0 && m.pagX <= 0 && m.board <= 0 && m.boardX <= 0 && m.dentro, JSON.stringify(m));
        if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await s.pg.screenshot({ path: path.join(SHOT, `${P.nome}-${w}x${h}-${role}-${theme}.png`) }); }
        await s.ctx.close();
      }
    }
  }
  // celular
  const cel = await abre({ url: P.url, role: 'admin-prof', w: 390, h: 844 });
  const mc = await cel.pg.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, cols: getComputedStyle(document.getElementById('board')).gridTemplateColumns.split(' ').length }));
  af('celular 390px: uma coluna e sem rolagem lateral', mc.x <= 0 && mc.cols === 1, JSON.stringify(mc));
  if (SHOT) await cel.pg.screenshot({ path: path.join(SHOT, `${P.nome}-390-celular.png`), fullPage: true });
  await cel.ctx.close();
}

await browser.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
