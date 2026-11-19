// ============================================================
// Gerenciar acessos no celular — teste no Chromium (390×844)
//
// 1) O app (/app/): Perfil → Gerenciar acessos, só para admin; lista com
//    filtros e busca; a pessoa abre com situação, senha provisória (Master),
//    liberar, encerrar sessões e unidades; cada botão chama a função certa do
//    banco (master_* / user_approvals / fca_profiles).
// 2) O hub (index.html): a caixa do usuário no celular mostra todos os campos
//    e o rodapé (antes Situação, Perfil, Senha e as unidades ficavam cortados).
//
// Uso: SBJS=<supabase.js umd> node scripts/app-acessos-teste.mjs
// ============================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.cwd();
const SBJS = process.env.SBJS;
if (!SBJS || !fs.existsSync(SBJS)) { console.log('falta SBJS'); process.exit(1); }
let ok = 0, falhas = 0;
const conf = (c, m) => { if (c) { ok++; console.log('  ok  ' + m); } else { falhas++; console.log('  ✗   ' + m); } };
const espera = ms => new Promise(r => setTimeout(r, ms));

const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  let f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(8773, r));
const BASE = 'http://localhost:8773';

const EU = { id: 'u-renan', aud: 'authenticated', role: 'authenticated', email: 'fortesindicadores@gmail.com', user_metadata: { name: 'Renan Fortes' }, app_metadata: { provider: 'email' }, created_at: '2026-01-01T00:00:00Z' };
const sessao = () => ({ access_token: 'tok.' + Date.now(), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'ref', user: EU });
const AP = [
  { user_id: 'u-renan', name: 'RENAN FORTES', email: 'fortesindicadores@gmail.com', status: 'approved', created_at: '2026-01-02T10:00:00Z', phone: '' },
  { user_id: 'u-silas', name: 'SILAS COSTA', email: 'silas.costa@conlogsa.com.br', status: 'pending', created_at: '2026-11-18T10:00:00Z', phone: '(21) 99999-1234' },
  { user_id: 'u-ana', name: 'ANA ROCHA', email: 'ana.rocha@conlogsa.com.br', status: 'approved', created_at: '2026-03-02T10:00:00Z', phone: '' },
  { user_id: 'u-chefe', name: 'PEDRO ALVES', email: 'pedro.alves@conlogsa.com.br', status: 'approved', created_at: '2026-02-02T10:00:00Z', phone: '' },
  { user_id: 'u-bloq', name: 'JOAO SILVA', email: 'joao.silva@conlogsa.com.br', status: 'blocked', created_at: '2026-02-02T10:00:00Z', phone: '' },
];
const PROF = [
  { user_id: 'u-renan', unidade: '', is_admin: true },
  { user_id: 'u-silas', unidade: 'PIR', is_admin: false },
  { user_id: 'u-ana', unidade: 'FLP', is_admin: false, cargo: 'Gestor de Unidade' },
  { user_id: 'u-chefe', unidade: '', is_admin: true },
];
const MU = [
  { id: 'u-silas', email: 'silas.costa@conlogsa.com.br', nome: 'SILAS COSTA', status: 'pending', confirmado: null, ultimo: null, sessoes: 0, troca_senha: false, master: false, criado: '2026-11-18T10:00:00Z' },
  { id: 'u-trav', email: 'travou@conlogsa.com.br', nome: 'CADASTRO TRAVADO', status: null, confirmado: null, ultimo: null, sessoes: 0, master: false, criado: '2026-11-17T10:00:00Z' },
  { id: 'u-ana', email: 'ana.rocha@conlogsa.com.br', nome: 'ANA ROCHA', status: 'approved', confirmado: '2026-03-02', ultimo: '2026-11-19T08:00:00Z', sessoes: 2, master: false },
  { id: 'u-renan', email: 'fortesindicadores@gmail.com', nome: 'RENAN FORTES', status: 'approved', confirmado: '2026-01-02', master: true },
];
let rpcs = [], escritas = [];
async function rotas(ctx, master) {
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => /supabase-js/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(SBJS) }) : r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Chart=window.Chart||function(){};' }));
  await ctx.route(/\/(sw\.js)$/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await ctx.route('**/docs.google.com/**', r => r.abort());
  await ctx.route('**/lozwipoeacpvplgkrxkq.supabase.co/**', r => {
    const req = r.request(), u = new URL(req.url()), p = u.pathname, m = req.method(), h = req.headers();
    const json = (b, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-expose-headers': 'content-range', 'content-range': '0-0/1' }, body: JSON.stringify(b) });
    const um = /vnd\.pgrst\.object/.test(h.accept || '');
    const uid = (u.searchParams.get('user_id') || '').replace('eq.', '');
    if (p === '/auth/v1/token') return json(sessao());
    if (p === '/auth/v1/user') return json(EU);
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice(13), b = req.postDataJSON() || {}; rpcs.push(fn + ' ' + JSON.stringify(b));
      if (fn === 'master_eu') return json(master);
      if (fn === 'master_usuarios') return json(master ? MU : null);
      if (fn === 'master_senha') return json(b.p_senha || 'Gem-7Kx2-9Pq');
      if (fn === 'master_encerrar') return json(2);
      if (fn === 'master_altera') { const a = AP.find(x => x.user_id === b.p_user); if (a && b.p_dados.status) a.status = b.p_dados.status; return json(null); }
      return json(null);
    }
    if (p === '/rest/v1/user_approvals') {
      if (m === 'PATCH') { const b = req.postDataJSON(); escritas.push('user_approvals ' + uid + ' ' + JSON.stringify(b)); const a = AP.find(x => x.user_id === uid); if (a) Object.assign(a, b); return json([]); }
      const l = uid ? AP.filter(x => x.user_id === uid) : AP; return json(um ? (l[0] || null) : l);
    }
    if (p === '/rest/v1/fca_profiles') {
      if (m === 'POST') { escritas.push('fca_profiles ' + req.postData()); return json([]); }
      const l = uid ? PROF.filter(x => x.user_id === uid) : PROF; return json(um ? (l[0] || null) : l);
    }
    if (p.startsWith('/rest/v1/')) return json([]);
    return json({});
  });
}

const browser = await chromium.launch();
async function novaPagina(master) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await ctx.addInitScript(() => { window.APP_EXEC = []; });
  await rotas(ctx, master);
  const page = await ctx.newPage(); const erros = [];
  page.on('pageerror', e => erros.push(String(e))); page.on('dialog', d => d.accept());
  return { ctx, page, erros };
}

/* ── 1. o app, como Master ── */
console.log('\n1 · app como Master');
{
  const { ctx, page, erros } = await novaPagina(true);
  await page.goto(BASE + '/app/');
  await page.fill('#lgEmail', EU.email); await page.fill('#lgSenha', 'certa'); await page.click('#btEntrar');
  await page.waitForSelector('#ola', { state: 'visible' }); await espera(400);
  await page.click('#nav button[data-v="perfil"]');
  conf(await page.isVisible('#pfAdm'), 'Perfil mostra Administração → Gerenciar acessos para admin');
  await page.click('#pfAdm .opt');
  await page.waitForSelector('#acLista .ac-li');
  conf(/^3 ativos · 2 aguardando · 1 bloqueado$/.test(await page.textContent('#acSub')), 'contagem: ' + await page.textContent('#acSub'));
  const nomes = await page.$$eval('#acLista .ac-li b', l => l.map(x => x.textContent));
  conf(nomes.join('|') === 'CADASTRO TRAVADO|SILAS COSTA', 'abre em Aguardando, com quem travou fora da aprovação: ' + nomes.join(', '));
  await page.click('#acChips .chip:nth-child(4)');
  await page.fill('#acBuscaIn', 'flp');
  conf((await page.$$eval('#acLista .ac-li b', l => l.map(x => x.textContent))).join() === 'ANA ROCHA', 'busca pela unidade acha a Ana (FLP)');
  await page.fill('#acBuscaIn', '');
  await page.click('#acChips .chip:nth-child(1)');
  await page.click('#acLista .ac-li:has-text("SILAS")');
  await page.waitForSelector('#tela-usuario.on');
  conf(await page.textContent('#acuTit') === 'SILAS COSTA', 'abre a pessoa');
  conf(await page.isVisible('#acuSenhaBt') && await page.isVisible('#acuLib') && await page.isVisible('#acuEnc'), 'Master vê senha, liberar e encerrar sessões');
  await page.click('#acuSenhaBt'); await page.waitForSelector('#acuSenhaV', { state: 'visible' });
  conf(await page.textContent('#acuSenhaCod') === 'Gem-7Kx2-9Pq', 'senha gerada aparece na tela');
  conf(rpcs.some(x => x.startsWith('master_senha') && /"p_senha":null/.test(x)), 'chamou master_senha sem senha (o banco gera)');
  conf(await page.isVisible('#acuWpp'), 'com telefone, mostra Mandar no WhatsApp');
  await page.click('#acuSt button:nth-child(1)'); await espera(500);
  conf(rpcs.some(x => x.startsWith('master_altera') && /"status":"approved"/.test(x)), 'Ativo chama master_altera com o status');
  conf(/on/.test(await page.getAttribute('#acuSt button:nth-child(1)', 'class')), 'situação fica em Ativo');
  await page.click('#acuUnis button:has-text("CGR")');
  conf(await page.isVisible('#acuUniSalvar'), 'marcar unidade mostra Salvar unidades');
  await page.click('#acuUniSalvar'); await espera(400);
  conf(rpcs.some(x => x.startsWith('master_altera') && /"unidade":"CGR,PIR"/.test(x)), 'grava as unidades pelo master_altera (CGR,PIR)');
  await page.click('#acuEnc'); await espera(400);
  conf(rpcs.some(x => x.startsWith('master_encerrar')), 'Encerrar sessões chama master_encerrar');
  // cabe sem barra lateral
  const larg = await page.evaluate(() => [document.querySelector('#tela-usuario .pcorpo').scrollWidth, document.querySelector('#tela-usuario .pcorpo').clientWidth]);
  conf(larg[0] <= larg[1], 'tela da pessoa sem rolagem lateral (' + larg.join(' ≤ ') + ')');
  if (process.env.SHOT_DIR) await page.screenshot({ path: path.join(process.env.SHOT_DIR, 'app-usuario.png'), fullPage: false });
  await page.goBack(); await espera(300);
  conf(!(await page.isVisible('#tela-usuario')) && await page.isVisible('#tela-acessos'), 'voltar do celular fecha a pessoa e fica na lista');
  if (process.env.SHOT_DIR) await page.screenshot({ path: path.join(process.env.SHOT_DIR, 'app-acessos.png') });
  conf(!erros.length, 'sem erro de página ' + erros.join(' | '));
  await ctx.close();
}

/* ── 2. o app, admin sem Master ── */
console.log('\n2 · app como admin (sem Master)');
{
  rpcs = []; escritas = [];
  AP.find(x => x.user_id === 'u-silas').status = 'pending';
  const { ctx, page, erros } = await novaPagina(false);
  await page.goto(BASE + '/app/');
  await page.fill('#lgEmail', EU.email); await page.fill('#lgSenha', 'certa'); await page.click('#btEntrar');
  await page.waitForSelector('#ola', { state: 'visible' }); await espera(400);
  await page.click('#nav button[data-v="perfil"]'); await page.click('#pfAdm .opt');
  await page.waitForSelector('#acLista .ac-li');
  conf((await page.$$eval('#acLista .ac-li b', l => l.map(x => x.textContent))).join() === 'SILAS COSTA', 'sem Master, quem travou fora da aprovação não aparece');
  await page.click('#acLista .ac-li'); await page.waitForSelector('#tela-usuario.on');
  conf(!(await page.isVisible('#acuSenhaBt')) && !(await page.isVisible('#acuEnc')), 'sem Master não aparece senha nem encerrar sessões');
  conf(await page.isVisible('#acuMstNota'), 'avisa que isso é do Master');
  await page.click('#acuSt button:nth-child(1)'); await espera(500);
  conf(escritas.some(x => /user_approvals u-silas .*approved/.test(x)), 'admin aprova pelo user_approvals');
  await page.goBack(); await espera(200);
  await page.click('#acChips .chip:nth-child(4)');
  await page.click('#acLista .ac-li:has-text("PEDRO")'); await page.waitForSelector('#tela-usuario.on');
  conf(await page.$$eval('#acuSt button', l => l.every(b => b.disabled)), 'cadastro de outro Admin fica só leitura');
  conf(!erros.length, 'sem erro de página ' + erros.join(' | '));
  await ctx.close();
}

/* ── 3. o hub: a caixa do usuário no celular ── */
console.log('\n3 · hub · caixa do usuário no celular');
{
  const { ctx, page, erros } = await novaPagina(true);
  await page.goto(BASE + '/index.html');
  await page.evaluate(() => {
    document.getElementById('mdl-usr').style.display = 'flex';
    ['uc-st-fld', 'uc-pf-fld', 'uc-pass-fld', 'uc-ops'].forEach(i => document.getElementById(i).style.display = '');
    document.getElementById('uc-pf').innerHTML = '<button>Gestor de Frota</button><button>Gestor de Unidade</button><button>Gestor de Área</button><button>Gestor Regional</button><button>Gestor</button><button>Time Frota</button><button>Admin</button><button>Master</button>';
    document.getElementById('uc-st').innerHTML = '<button class="on">Ativo</button><button>Pendente</button><button>Bloqueado</button>';
    const un = ['CGR', 'BLC', 'CBA T1', 'CBA T1 WH', 'CBA T2', 'FLP', 'GRL', 'NFR', 'PLT', 'RON', 'MCC T1', 'MCC T2', 'PIR', 'GNA'];
    ['uc-fca', 'uc-far'].forEach(i => document.getElementById(i).innerHTML = un.map(u => '<button class="uc-it"><span class="uc-ck"></span>' + u + '</button>').join(''));
  });
  await espera(200);
  const r = await page.evaluate(() => {
    const body = document.querySelector('.uc-body'), cols = [...document.querySelectorAll('.uc-col')];
    return { rola: body.scrollHeight > body.clientHeight, cortada: cols.some(c => c.scrollHeight > c.clientHeight + 1),
      foot: document.querySelector('.uc-foot').getBoundingClientRect().bottom <= innerHeight + 1,
      caixa: document.querySelector('.uc-cx').getBoundingClientRect().height };
  });
  conf(!r.cortada, 'nenhuma coluna corta o que tem dentro');
  conf(r.rola, 'o miolo rola por inteiro');
  conf(r.foot, 'Salvar e Fechar ficam à vista, no rodapé');
  // rola até o fim e confere a última unidade do Farol
  await page.evaluate(() => { const b = document.querySelector('.uc-body'); b.scrollTop = b.scrollHeight; });
  const ult = await page.evaluate(() => { const l = [...document.querySelectorAll('#uc-far .uc-it')].pop().getBoundingClientRect(), b = document.querySelector('.uc-body').getBoundingClientRect(); return l.bottom <= b.bottom + 1 && l.top >= b.top; });
  conf(ult, 'rolando até o fim aparece a última unidade do Farol');
  if (process.env.SHOT_DIR) await page.screenshot({ path: path.join(process.env.SHOT_DIR, 'hub-usuario.png') });
  await ctx.close();
}

await browser.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
