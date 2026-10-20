/* Condução Econômica · FORA DO PROGRAMA (Renan, 20/10/2026, lista do Jean
   Carlo: "Esses colaboradores precisam ficar fora do programa. São do time de
   frota, instrutores"). Abre o painel /combustivel/conducao-economica/ no
   Chromium com o banco dublado: três motoristas da Empurrada de Piraí, o
   instrutor com a MELHOR nota marcado em ce_motoristas.fora_programa. Confere
   que ele some do ranking (o 1º lugar passa a ser o motorista) e que, se a
   coluna ainda não existe no banco (400 no select), o painel abre igual, com
   todo mundo. Também roda o filtro do robô (foraPrograma/naoConta) em node:vm.

   Uso: SBJS=<umd do supabase-js> CHART_JS=<chart.umd.js> DATALABELS=<plugin>
        node scripts/conducao-fora-programa-teste.mjs */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SBJS = process.env.SBJS, CHART = process.env.CHART_JS, DL = process.env.DATALABELS;
for (const [k, v] of Object.entries({ SBJS, CHART_JS: CHART, DATALABELS: DL })) {
  if (!v || !fs.existsSync(v)) { console.error(`${k} precisa apontar para o arquivo local`); process.exit(1); }
}
let ok = 0, falhas = 0;
const t = (c, m, extra) => { console.log((c ? '  ✔ ' : '  ✘ ') + m + (c || extra === undefined ? '' : '  → ' + JSON.stringify(extra))); c ? ok++ : falhas++; };

// ── 1 · o filtro do robô, em vm, com o código do próprio arquivo ─────────────
console.log('═══ 1 · robô: foraPrograma()/naoConta() do conducao-robot.mjs ═══');
{
  const src = fs.readFileSync(path.join(ROOT, 'scripts/conducao-robot.mjs'), 'utf8');
  const ini = src.indexOf('let _FORA = null;'), fim = src.indexOf('// dias JÁ gravados no intervalo');
  const trecho = src.slice(ini, fim);
  const roda = async (resposta) => {
    const ctx = { console: { log() {} }, sbTodos: async () => { if (resposta instanceof Error) throw resposta; return resposta; } };
    vm.createContext(ctx);
    vm.runInContext(trecho + '\nglobalThis.__f = foraPrograma; globalThis.__n = naoConta;', ctx);
    const fora = await ctx.__f();
    return { fora, n: ctx.__n };
  };
  const a = await roda([{ id: 1, chave: 'gt:instrutor' }]);
  t(a.fora.has('gt:instrutor') && a.n('gt:instrutor', a.fora) && !a.n('gt:motorista', a.fora), 'marcado como fora não conta; o resto conta');
  t(a.n('semlogin:EMP PIRAI', a.fora) && a.n('teste:driverpro', a.fora), 'Sem Login e teste continuam fora');
  const b = await roda(new Error('ce_motoristas: 400 column fora_programa does not exist'));
  t(b.fora.size === 0 && !b.n('gt:instrutor', b.fora), 'sem a coluna no banco, ninguém está fora');
}

// ── 2 · o painel no Chromium ─────────────────────────────────────────────────
console.log('═══ 2 · painel /combustivel/conducao-economica/ ═══');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
}).listen(0);
const ORIG = `http://127.0.0.1:${srv.address().port}`;
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const COMP = '2026-10-01';
const SCORES = [
  { id: 1, competencia: COMP, chave: 'gt:instrutor', motorista: 'SILAS INSTRUTOR', unidade: 'EMP PIRAI', fonte: 'Geotab', km: 2100, dias: 16, viagens: 30, rpm_pontos: 95, idle_pontos: 95, acel_pontos: 95, vel_pontos: 100, pontuacao: 95, atualizado_em: '2026-10-20T06:00:00Z' },
  { id: 2, competencia: COMP, chave: 'gt:b', motorista: 'MOTORISTA B', unidade: 'EMP PIRAI', fonte: 'Geotab', km: 1800, dias: 16, viagens: 28, rpm_pontos: 80, idle_pontos: 80, acel_pontos: 80, vel_pontos: 100, pontuacao: 80, atualizado_em: '2026-10-20T06:00:00Z' },
  { id: 3, competencia: COMP, chave: 'gt:c', motorista: 'MOTORISTA C', unidade: 'EMP PIRAI', fonte: 'Geotab', km: 1500, dias: 16, viagens: 25, rpm_pontos: 70, idle_pontos: 70, acel_pontos: 70, vel_pontos: 100, pontuacao: 70, atualizado_em: '2026-10-20T06:00:00Z' },
  { id: 4, competencia: COMP, chave: 'semlogin:EMP PIRAI', motorista: 'Sem Login · EMP PIRAI', unidade: 'EMP PIRAI', fonte: 'Geotab', km: 900, dias: 16, viagens: 10, rpm_pontos: 50, idle_pontos: 50, acel_pontos: 50, vel_pontos: 100, pontuacao: 50, atualizado_em: '2026-10-20T06:00:00Z' },
];
const MOTS = [
  { chave: 'gt:instrutor', nome: 'SILAS INSTRUTOR', unidade: 'EMP PIRAI', fora_programa: true },
  { chave: 'gt:b', nome: 'MOTORISTA B', unidade: 'EMP PIRAI', fora_programa: false },
  { chave: 'gt:c', nome: 'MOTORISTA C', unidade: 'EMP PIRAI', fora_programa: false },
];
const LOGS = [
  { chave: 'gt:instrutor', evento: 'login', quando: '2026-10-19T10:00:00Z' },
  { chave: 'gt:b', evento: 'login', quando: '2026-10-19T11:00:00Z' },
];
const json = (b, h = {}) => ({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range', 'Content-Type': 'application/json', ...h }, body: JSON.stringify(b) });
const cors = { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } };

function duble(page, { semColuna }) {
  const st = { pedidos: [] };
  page.route(u => String(u).startsWith(SUPA), async route => {
    const req = route.request(); const u = new URL(req.url()); const tab = u.pathname.replace('/rest/v1/', '');
    if (req.method() === 'OPTIONS') return route.fulfill(cors);
    st.pedidos.push(tab + '?' + u.searchParams.get('select'));
    if (tab === 'rpc/ce_app_criterios') return route.fulfill(json({ regras: { saldo_inicial: 200, km_min: 1000, top_n: 0, podio: [300, 150, 100], unidades: ['EMP PIRAI'], piso_nota: 60 }, unidades: [{ unidade: 'EMP PIRAI', grupo: 'PIRAI', top_n: 0, km_min: 1000 }] }));
    if (tab === 'ce_scores_mensais') return route.fulfill(json(SCORES, { 'Content-Range': '0-3/*' }));
    if (tab === 'ce_motoristas') {
      const sel = u.searchParams.get('select') || '';
      if (semColuna && sel.includes('fora_programa'))
        return route.fulfill({ status: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify({ code: '42703', message: 'column ce_motoristas.fora_programa does not exist' }) });
      return route.fulfill(json(MOTS.map(m => sel.includes('fora_programa') ? m : { chave: m.chave, nome: m.nome, unidade: m.unidade })));
    }
    if (tab === 'ce_app_log') return route.fulfill(json(LOGS, { 'Content-Range': '0-1/*' }));
    if (tab === 'ginfo_snapshot') return route.fulfill(json({ data: [] }));
    return route.fulfill(json([]));
  });
  return st;
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
await ctx.route(u => String(u).includes('cdn.jsdelivr.net/npm/@supabase/supabase-js'), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(SBJS, 'utf8') }));
await ctx.route(u => String(u).includes('chart.js@4.4.0'), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHART, 'utf8') }));
await ctx.route(u => String(u).includes('chartjs-plugin-datalabels'), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(DL, 'utf8') }));
await ctx.route(u => /cdn\.jsdelivr|cdnjs|fonts\.g|unpkg/.test(String(u)) && !/@supabase|chart\.js@4\.4\.0|datalabels/.test(String(u)), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
await ctx.addInitScript(() => {
  sessionStorage.setItem('gem_hub', '1');
  localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: 'u1', email: 'fortesindicadores@gmail.com', aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }));
});

async function abre(cfg) {
  const page = await ctx.newPage(); const st = duble(page, cfg);
  const erros = []; page.on('pageerror', e => erros.push(String(e.message).slice(0, 120)));
  await page.goto(ORIG + '/combustivel/conducao-economica/');
  await page.waitForFunction(() => window.ORIGEM === 'banco' || /banco|exemplo/.test(document.getElementById('titSub')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const nomes = [...document.querySelectorAll('#ranking-tbody tr')].map(tr => tr.textContent.replace(/\s+/g, ' ').trim());
    return { origem: typeof ORIGEM !== 'undefined' ? ORIGEM : null, raw: typeof RAW !== 'undefined' ? RAW.map(r => r.unit) : [], fora: typeof FORA !== 'undefined' ? [...FORA] : null, log: typeof LOG !== 'undefined' ? LOG.map(l => l.chave) : null, nomes, sub: document.getElementById('titSub')?.textContent || '' };
  });
  await page.close();
  return { ...r, erros, st };
}

{
  const r = await abre({ semColuna: false });
  t(r.erros.length === 0, 'sem erro de página', r.erros);
  t(r.origem === 'banco', 'dados do banco (não é a maquete)', r.origem);
  t(r.fora && r.fora.length === 1 && r.fora[0] === 'gt:instrutor', 'FORA lida do ce_motoristas: só o instrutor', r.fora);
  t(!r.raw.includes('SILAS INSTRUTOR') && r.raw.includes('MOTORISTA B') && r.raw.includes('MOTORISTA C'), 'o instrutor sai das linhas; B e C ficam', r.raw);
  t(r.nomes.length && !r.nomes.some(n => /INSTRUTOR/.test(n)) && /MOTORISTA B/.test(r.nomes[0] || ''), 'ranking sem o instrutor, com o motorista B em 1º', r.nomes);
  t(r.log && !r.log.includes('gt:instrutor') && r.log.includes('gt:b'), 'acessos do DriverPro sem o instrutor', r.log);
}
{
  const r = await abre({ semColuna: true });
  t(r.erros.length === 0, 'coluna inexistente (400): sem erro de página', r.erros);
  t(r.origem === 'banco' && r.fora && r.fora.length === 0, 'cai no select antigo e ninguém fica fora', { origem: r.origem, fora: r.fora });
  t(r.raw.includes('SILAS INSTRUTOR') && /INSTRUTOR/.test(r.nomes[0] || ''), 'o instrutor segue no ranking (como era antes do SQL rodar)', r.nomes);
  t(r.st.pedidos.some(p => p.startsWith('ce_motoristas?') && !p.includes('fora_programa')), 'o painel refez a leitura do ce_motoristas sem a coluna', r.st.pedidos.filter(p => p.startsWith('ce_motoristas')));
}

await browser.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
