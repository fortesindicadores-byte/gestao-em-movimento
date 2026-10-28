// Pesquisa por palavra-chave no Planner Corporativo (Renan, 28/10/2026: "Coloque pesquisa no planner também").
// O Planner usa o mesmo assets/fca-busca.js dos FCAs: campo na lateral acima do Voltar ao Hub,
// todas as palavras, sem acento, Esc limpa, Ctrl+K foca, preenchimento do navegador apagado.
// Banco dublado (supabase-js trocado por um shim). Uso: node scripts/planner-busca-teste.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

const PLANNER = [
  { id: 'p1', assunto: 'Pneus', acao: 'Revisar a política de recapagem', responsavel: 'Renan Fortes', prazo: '2026-11-10', status: 'Em execução', acompanhamento: 'Cotação com três fornecedores', created_at: '2026-10-01' },
  { id: 'p2', assunto: 'Manutenção', acao: 'Auditar o contrato de manutenção', responsavel: 'Pedro Alves', prazo: '2026-11-20', status: 'Não iniciada', acompanhamento: '', created_at: '2026-10-02' },
  { id: 'p3', assunto: 'Combustível', acao: 'Negociar preço do diesel', responsavel: 'Renan Fortes', prazo: '2026-12-01', status: 'Não iniciada', acompanhamento: 'Reunião marcada com o posto', created_at: '2026-10-03' },
  { id: 'p4', assunto: 'Pneus', acao: 'Calibração semanal nas unidades', responsavel: 'Ana Rocha', prazo: '2026-11-05', status: 'Concluída', acompanhamento: '', created_at: '2026-10-04' },
];
const SHIM = `window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'fortesindicadores@gmail.com',user_metadata:{name:'Renan Fortes'}}}}})},
  from:(t)=>{let rows=t==='planner'?${JSON.stringify(PLANNER)}:t==='fca_profiles'?[{user_id:'u1',nome:'Renan Fortes',is_admin:true}]:[];
    const q={select(){return q;},order(){return q;},eq(){return q;},in(){return q;},
      maybeSingle:async()=>({data:rows[0]||null,error:null}),
      then(res,rej){return Promise.resolve({data:rows,error:null}).then(res,rej);}};return q;}})};`;

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
for (const [w, h, tema] of [[1366, 768, 'dark'], [1920, 1000, 'light']]) {
  console.log(`\n══ ${w}×${h} ${tema}`);
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => { const u = r.request().url();
    const chart = process.env.CHART_JS && u.includes('chart.js') ? fs.readFileSync(process.env.CHART_JS, 'utf8') : '';
    r.fulfill({ status: 200, contentType: 'application/javascript', body: u.includes('supabase') ? SHIM : chart }); });
  await ctx.route('**/lozwipoeacpvplgkrxkq.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(t => { try { localStorage.setItem('bi_theme', t); localStorage.removeItem('planner_mini'); } catch (e) {} }, tema);
  await pg.goto(BASE + '/planner-corporativo/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof LINHAS !== 'undefined' && LINHAS.length > 0, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(600);
  await pg.evaluate(() => { const b = document.querySelector('.s-item[data-ver="tabela"]'); if (b) b.click(); });
  await pg.waitForTimeout(400);
  const vis = () => pg.evaluate(() => LINHAS.filter(passa).map(r => r.id).sort().join(','));
  const P = await pg.evaluate(() => { const i = document.getElementById('fcaBusca'), wr = i && i.closest('.s-busca'), v = document.querySelector('.side .s-volta');
    return { tem: !!i, antesVolta: !!(wr && v && wr.nextElementSibling === v), velho: !!document.getElementById('busca'), vis: !!(i && i.getBoundingClientRect().width > 60) }; });
  af('campo Pesquisar na lateral, logo acima do Voltar ao Hub (o do topo saiu)', P.tem && P.antesVolta && !P.velho && P.vis, JSON.stringify(P));
  const A = await vis();
  af('sem busca: as 4 ações', A === 'p1,p2,p3,p4', A);
  await pg.evaluate(() => { const i = document.getElementById('fcaBusca'); i.value = 'renan@empresa.com.br'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await pg.waitForTimeout(400);
  af('valor posto pelo navegador (sem digitar) é apagado e não filtra', (await pg.$eval('#fcaBusca', i => i.value)) === '' && (await vis()) === A);
  await pg.click('#fcaBusca'); await pg.keyboard.type('PNEUS'); await pg.waitForTimeout(400);
  af('"PNEUS" acha as duas ações do assunto Pneus', (await vis()) === 'p1,p4', await vis());
  await pg.keyboard.type(' cotacao'); await pg.waitForTimeout(400);
  af('"pneus cotacao" (sem acento) casa assunto + acompanhamento: só p1', (await vis()) === 'p1', await vis());
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
  af('Esc limpa e volta tudo', (await vis()) === A, await vis());
  await pg.click('#fcaBusca'); await pg.keyboard.type('pedro'); await pg.waitForTimeout(400);
  const linhasTab = await pg.evaluate(() => [...document.querySelectorAll('#cols table tbody tr')].filter(tr => tr.offsetParent).length);
  af('"pedro" (responsável) filtra a Tabela na tela', (await vis()) === 'p2' && linhasTab >= 1, JSON.stringify({ v: await vis(), linhasTab }));
  await pg.keyboard.press('Escape'); await pg.click('body'); await pg.waitForTimeout(200);
  await pg.keyboard.press('Control+k'); await pg.waitForTimeout(300);
  af('Ctrl+K põe o cursor no campo', (await pg.evaluate(() => document.activeElement && document.activeElement.id)) === 'fcaBusca');
  await pg.evaluate(() => document.getElementById('btMini').click()); await pg.waitForTimeout(300);
  const M = await pg.evaluate(() => ({ lupa: getComputedStyle(document.querySelector('.s-busca .sb-lupa')).display !== 'none', box: getComputedStyle(document.querySelector('.s-busca .sb-box')).display === 'none' }));
  af('lateral recolhida: só a lupa', M.lupa && M.box, JSON.stringify(M));
  af('página sem rolagem', await pg.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1));
  af('sem erro de página', !errs.length, errs.join(' | ').slice(0, 300));
  await ctx.close();
}
await nav.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
