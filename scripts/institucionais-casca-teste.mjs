// ============================================================================
// Teste da casca nova das duas páginas institucionais (governanca/ e
// papeis-responsabilidades/) — moldura de vidro, SEM menu lateral (Renan,
// 06/10/2026). Roda os DOIS lados (HTML do HEAD em OLD_GOV/OLD_PAP e o atual)
// no Chromium e confere:
//  - o MESMO texto no conteúdo (antigo .main × novo .hmio) e na marca do topo;
//  - em Papéis, as mesmas 19 linhas (bloco, descrição, dono e cor do chip) e a
//    mesma legenda de donos; ordenação por cabeçalho e menu do Excel vivos;
//  - zero erro de página nos dois lados;
//  - scripts do antigo todos presentes no novo, build 202610070700;
//  - tema (abre escuro, botão vira body.claro + bi_theme, bi_theme=light abre claro);
//  - "Hub Principal" volta para a raiz; sem gem_hub vai para o hub;
//  - sem rolagem da página e sem barra horizontal em 1366x768 e 1600x900,
//    nos dois temas; o conteúdo cabe dentro da moldura;
//  - celular 390px: documento rola, sem rolagem lateral da página.
// Uso (de uma pasta onde o playwright resolve):
//   RAIZ=<repo> OLD_GOV=<html> OLD_PAP=<html> FONTE=<pasta woff2> SHOT_DIR=<pasta> node <este>.mjs
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RAIZ = process.env.RAIZ;
const SHOT = process.env.SHOT_DIR || '';
const FONTE = process.env.FONTE || '';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inst-'));
function velho(pasta, env) {
  if (process.env[env]) return process.env[env];
  // o "antigo" é a última versão do histórico ainda SEM a moldura (.app) —
  // o HEAD pode já conter a casca nova se alguém commitou no meio do caminho
  const f = path.join(tmp, pasta + '.html');
  const revs = execSync(`git -C "${RAIZ}" log --format=%h -- ${pasta}/index.html`).toString().trim().split('\n');
  for (const rev of revs) {
    const html = execSync(`git -C "${RAIZ}" show ${rev}:${pasta}/index.html`);
    if (!html.includes('class="app"')) { fs.writeFileSync(f, html); console.log(`antigo de ${pasta}: ${rev}`); return f; }
  }
  throw new Error('sem versão antiga de ' + pasta);
}
const OLD = {
  '/governanca/index.html': velho('governanca', 'OLD_GOV'),
  '/papeis-responsabilidades/index.html': velho('papeis-responsabilidades', 'OLD_PAP'),
};
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const srv = createServer((req, res) => {
  let [p, q] = req.url.split('?');
  p = decodeURIComponent(p); if (p.endsWith('/')) p += 'index.html';
  let f;
  if (p.startsWith('/__fonte/') && FONTE) f = path.join(FONTE, path.basename(p));
  else f = (q === 'old' && OLD[p]) ? OLD[p] : path.join(RAIZ, p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
const FONT_CSS = FONTE ? [400, 500, 600, 700, 800].map(w => `@font-face{font-family:'Montserrat';font-weight:${w};src:url(${BASE}/__fonte/montserrat-latin-${w}-normal.woff2) format('woff2');}`).join('\n') : '';

let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e !== '' ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium' });
async function abre({ url, gem = true, theme = null, w = 1600, h = 900 }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  // sandbox sem Google/Supabase/CDN: fonte real servida localmente, o resto dublado
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS }));
  await ctx.route('**/fonts.gstatic.com/**', r => r.fulfill({ status: 404, body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/*supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', e => erros.push(e.message));
  await pg.addInitScript(([gem, theme]) => {
    try { if (gem) sessionStorage.setItem('gem_hub', '1'); if (theme) localStorage.setItem('bi_theme', theme); } catch (e) {}
  }, [gem, theme]);
  await pg.goto(BASE + url, { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts && document.fonts.ready);
  await pg.waitForTimeout(300);
  return { ctx, pg, erros };
}
const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
const texto = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); return e ? e.textContent : null; }, sel).then(norm);
const marca = (pg, old) => pg.evaluate(old => {
  const h = document.querySelector(old ? '.brand h1' : '.marca h1'), p = document.querySelector(old ? '.brand p' : '.marca p');
  return (h ? h.textContent : '') + ' | ' + (p ? p.textContent : '');
}, old);
const scripts = pg => pg.evaluate(() => [...document.scripts].map(s => (s.getAttribute('src') || '').split('?')[0]).filter(Boolean).map(s => s.split('/').pop()));

const PAGS = [
  { nome: 'governanca', url: '/governanca/' },
  { nome: 'papeis-responsabilidades', url: '/papeis-responsabilidades/', tabela: true },
];

for (const P of PAGS) {
  console.log(`\n══ ${P.nome} ══`);
  const o = await abre({ url: P.url + '?old' });
  const n = await abre({ url: P.url });
  const to = await texto(o.pg, '.main'), tn = await texto(n.pg, '.hmio');
  af('mesmo texto no conteúdo (antigo .main × novo .hmio)', to && to === tn, `${tn.length} caracteres`);
  if (to !== tn) { console.log('      antigo:', to.slice(0, 400)); console.log('      novo  :', tn.slice(0, 400)); }
  const mo = await marca(o.pg, true), mn = await marca(n.pg, false);
  af('mesma marca no topo (título · subtítulo)', mo === mn, mn);
  const htmlO = await o.pg.evaluate(() => document.querySelector('.main').innerHTML.match(/<(strong|em|br|li|b)\b/g)?.length || 0);
  const htmlN = await n.pg.evaluate(() => document.querySelector('.hmio').innerHTML.match(/<(strong|em|br|li|b)\b/g)?.length || 0);
  af('mesmos destaques de texto (strong/em/br/li)', htmlO === htmlN, `${htmlN}`);
  af('zero erro de página (antigo e novo)', o.erros.length === 0 && n.erros.length === 0, [...o.erros, ...n.erros].join('; '));
  const so = await scripts(o.pg), sn = await scripts(n.pg);
  const faltam = so.filter(s => !sn.includes(s));
  af('todos os scripts do antigo estão no novo', faltam.length === 0, faltam.length ? 'faltam ' + faltam.join(',') : sn.join(' '));
  const build = await n.pg.evaluate(() => document.querySelector('meta[name=build]').content + ' ' + [...document.scripts].map(s => s.getAttribute('src') || '').find(s => s.includes('build-check')));
  af('mesmo build no meta e no build-check', /^(\d{12}) \.\.\/assets\/build-check\.js\?v=\1$/.test(build), build);
  af('sem menu lateral (.side ausente)', await n.pg.evaluate(() => !document.querySelector('.side')));
  const casca = await n.pg.evaluate(() => {
    const app = getComputedStyle(document.querySelector('.app')), bf = getComputedStyle(document.querySelector('.app'), '::before'), gr = getComputedStyle(document.body, '::after');
    return { pos: app.position, raio: app.borderRadius, fundo: bf.backgroundColor, grao: gr.backgroundImage.startsWith('url('), font: getComputedStyle(document.body).fontFamily };
  });
  af('casca de vidro: .app absoluto, ::before com --app, grão no body::after, Montserrat', casca.pos === 'absolute' && casca.grao && /Montserrat/.test(casca.font) && casca.fundo !== 'rgba(0, 0, 0, 0)', JSON.stringify(casca));
  if (FONTE) af('Montserrat real carregada', await n.pg.evaluate(() => document.fonts.check('800 16px Montserrat')));

  if (P.tabela) {
    const linhas = pg => pg.evaluate(() => [...document.querySelectorAll('#tb tr')].map(tr => [...tr.cells].map(c => c.textContent.trim()).join(' | ') + ' | ' + tr.style.getPropertyValue('--oc')));
    const lo = await linhas(o.pg), ln = await linhas(n.pg);
    af('mesmas linhas da tabela (bloco · descrição · dono · cor)', lo.length === 19 && JSON.stringify(lo) === JSON.stringify(ln), `${ln.length} linhas`);
    const leg = pg => pg.evaluate(() => [...document.querySelectorAll('.owner-leg')].map(e => e.textContent.trim() + ':' + e.querySelector('i').style.background));
    af('mesma legenda de donos', JSON.stringify(await leg(o.pg)) === JSON.stringify(await leg(n.pg)));
    // ordenação (sortable-table) viva
    const antes = await n.pg.evaluate(() => document.querySelector('#tb tr td').textContent);
    await n.pg.click('table thead th:first-child'); await n.pg.waitForTimeout(150);
    const pos = await n.pg.evaluate(() => [...document.querySelectorAll('#tb tr td.bloco')].map(td => td.textContent));
    const ordenado = pos.every((v, i) => !i || pos[i - 1].localeCompare(v, 'pt-BR', { sensitivity: 'base' }) <= 0);
    af('clique no cabeçalho ordena a tabela', antes === 'Governança' && pos[0] !== 'Governança' && (ordenado || pos.every((v, i) => !i || pos[i - 1].localeCompare(v, 'pt-BR', { sensitivity: 'base' }) >= 0)), pos.slice(0, 3).join(', '));
    await n.pg.click('#tb tr:nth-child(3) td.desc', { button: 'right' }); await n.pg.waitForTimeout(150);
    const xl = await n.pg.evaluate(() => { const m = document.getElementById('xl-menu'); return m && getComputedStyle(m).display !== 'none' ? m.textContent.trim() : ''; });
    af('botão direito na tabela abre o menu do Excel', /Excel/i.test(xl), xl);
  }

  // tema
  const t0 = await n.pg.evaluate(() => document.body.classList.contains('claro'));
  await n.pg.click('#btTema');
  const t1 = await n.pg.evaluate(() => [document.body.classList.contains('claro'), localStorage.getItem('bi_theme')]);
  await n.pg.click('#btTema');
  const t2 = await n.pg.evaluate(() => [document.body.classList.contains('claro'), localStorage.getItem('bi_theme')]);
  af('tema: abre escuro, botão alterna body.claro e grava bi_theme', !t0 && t1[0] && t1[1] === 'light' && !t2[0] && t2[1] === 'dark', JSON.stringify([t1, t2]));
  // voltar ao hub
  const volta = await n.pg.evaluate(() => { const a = [...document.querySelectorAll('.top a')].find(a => a.textContent.trim() === 'Hub Principal'); return a && a.getAttribute('href'); });
  af('topo: "Hub Principal" → ../', volta === '../');
  await Promise.all([n.pg.waitForURL(u => new URL(u).pathname === '/' || new URL(u).pathname === '/index.html', { timeout: 8000 }).catch(() => {}), n.pg.click('.top a.rt')]);
  af('clicar em "Hub Principal" abre a raiz', ['/', '/index.html'].includes(new URL(n.pg.url()).pathname), new URL(n.pg.url()).pathname);
  await o.ctx.close(); await n.ctx.close();

  const c2 = await abre({ url: P.url, theme: 'light' });
  af('tema: bi_theme=light já abre claro', await c2.pg.evaluate(() => document.body.classList.contains('claro')));
  if (P.tabela) {
    const cor = await c2.pg.evaluate(() => [getComputedStyle(document.querySelector('.chip')).color, getComputedStyle(document.body).getPropertyValue('--txt').trim()]);
    af('tema claro: texto do chip escuro (legível)', cor[0] === 'rgb(22, 29, 43)', cor.join(' · '));
  }
  await c2.ctx.close();
  const r = await abre({ url: P.url, gem: false });
  const destino = new URL(r.pg.url()).pathname;
  af('sem gem_hub volta para o hub da raiz', destino === '/' || destino === '/index.html', destino);
  await r.ctx.close();

  for (const [w, h] of [[1600, 900], [1366, 768]]) {
    for (const theme of ['dark', 'light']) {
      const s = await abre({ url: P.url, theme, w, h });
      const m = await s.pg.evaluate(() => {
        const b = document.getElementById('board'), app = document.querySelector('.app').getBoundingClientRect();
        const tw = document.querySelector('.twrap');
        const filhos = [...b.querySelectorAll('.card, .tier, .twrap, .owners')].map(e => e.getBoundingClientRect());
        return { pag: document.documentElement.scrollHeight - innerHeight, pagX: document.documentElement.scrollWidth - innerWidth,
          board: b.scrollHeight - b.clientHeight, boardX: b.scrollWidth - b.clientWidth,
          tw: tw ? tw.scrollHeight - tw.clientHeight : 0, twX: tw ? tw.scrollWidth - tw.clientWidth : 0,
          dentro: filhos.every(x => x.bottom <= app.bottom + .5 && x.right <= app.right + .5) };
      });
      af(`${w}x${h} ${theme}: sem rolagem da página nem horizontal, conteúdo dentro da moldura`,
        m.pag <= 0 && m.pagX <= 0 && m.boardX <= 0 && m.twX <= 0 && m.dentro, JSON.stringify(m));
      af(`${w}x${h} ${theme}: tudo à vista, sem rolagem interna`, m.board <= 0 && m.tw <= 0, JSON.stringify({ board: m.board, tabela: m.tw }));
      af(`${w}x${h} ${theme}: zero erro de página`, s.erros.length === 0, s.erros.join('; '));
      if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await s.pg.screenshot({ path: path.join(SHOT, `${P.nome}-${w}x${h}-${theme}.png`) }); }
      await s.ctx.close();
    }
  }
  const cel = await abre({ url: P.url, w: 390, h: 844 });
  const mc = await cel.pg.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight, ov: getComputedStyle(document.body).overflow }));
  af('celular 390px: documento rola, sem rolagem lateral da página', mc.x <= 0 && mc.y > 0 && mc.ov !== 'hidden', JSON.stringify(mc));
  if (SHOT) await cel.pg.screenshot({ path: path.join(SHOT, `${P.nome}-390-celular.png`), fullPage: true });
  await cel.ctx.close();
}

await browser.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
