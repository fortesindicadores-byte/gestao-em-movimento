// ============================================================
// Relatórios (/relatorios/) — teste no Chromium com o banco dublado
// (Renan, 11/10/2026: "exportar em excel relatórios detalhados de todos os
// painéis, com todas as infos, no detalhe máximo possível, do banco").
//
// Confere, baixando os .xlsx de verdade e lendo-os com o SheetJS:
//   · a aba do Sheets sai INTEIRA (2.500 linhas com teto de 1.000 por leitura),
//     com os RÓTULOS da aba no cabeçalho e a data como data;
//   · JSON por linha vira linhas: Ginfo (uma aba por exportação), Frota de
//     Elite (uma por indicador), Prolog (com a Unidade pelo branch_id) e a
//     Conferência de Locação (linhas + aba dos meses);
//   · CPF, e-mail e afins ficam fora; o e-mail do relatório de Acessos fica;
//   · fonte com erro não derruba o arquivo: vira linha na aba Sobre;
//   · quem não é admin não vê Administração nem os relatórios só de admin;
//   · sem sessão, gate; o card está no cluster Operacional do hub;
//   · a página não rola e a tabela não ganha barra horizontal (1366/1920, dois temas).
//
// Uso: SBJS=<supabase.js UMD> XLSXJS=<xlsx.full.min.js> node scripts/relatorios-teste.mjs
// ============================================================
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const RAIZ = process.cwd();
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SBJS = process.env.SBJS, XLSXJS = process.env.XLSXJS;
if (!SBJS || !XLSXJS) { console.error('Defina SBJS e XLSXJS'); process.exit(2); }
const XLSX = (() => { const c = { window: {}, self: {}, console }; c.global = c; vm.createContext(c); vm.runInContext(fs.readFileSync(XLSXJS, 'utf8'), c); return c.XLSX || c.window.XLSX || c.self.XLSX; })();
let ok = 0, falhas = 0;
const ehData = v => Object.prototype.toString.call(v) === '[object Date]';
const t = (cond, msg, extra) => { if (cond) { ok++; console.log('  ok  ', msg); } else { falhas++; console.log('  ✗   ', msg, extra != null ? '→ ' + JSON.stringify(extra).slice(0, 400) : ''); } };

// ── servidor estático ──
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = path.join(RAIZ, decodeURIComponent(u.pathname));
  if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => srv.listen(0, r));
const ORIG = 'http://127.0.0.1:' + srv.address().port;

// ── dados do dublê ──
const N_FROTA = 2500, MAXROWS = 1000;
const SH_BASE = [
  { slug: 'dre_frota', nome: 'DRE · Frota', aba: 'Frota', linhas: N_FROTA, erro: null, carregado_em: '2026-10-11T10:00:00Z',
    colunas: [{ i: 0, label: 'VIGÊNCIA', col: 'vigencia_orig', tipo: 'date' }, { i: 1, label: 'CONTA GERENCIAL', col: 'conta_gerencial', tipo: 'string' },
              { i: 2, label: 'REALIZADO', col: 'realizado', tipo: 'number' }, { i: 3, label: 'REALIZADO', col: 'realizado_3', tipo: 'number' }] },
  { slug: 'dre_ebitda', nome: 'DRE · EBITDA', linhas: 3, erro: null, carregado_em: '2026-10-11T10:00:00Z', colunas: [{ i: 0, label: 'Unidade', col: 'unidade', tipo: 'string' }] },
  { slug: 'dre_receita', nome: 'DRE · Receita Líquida', linhas: 2, erro: null, carregado_em: '2026-10-11T10:00:00Z', colunas: [{ i: 0, label: 'Unidade', col: 'unidade', tipo: 'string' }] },
];
const linhasSh = slug => {
  const b = SH_BASE.find(x => x.slug === slug); if (!b) return null;
  return Array.from({ length: b.linhas }, (_, i) => ({ linha: i + 1, vigencia: '08/2026', vigencia_orig: '2026-08-01', conta_gerencial: 'Conta ' + (i + 1), realizado: i + 1, realizado_3: -(i + 1), unidade: 'PIR' }));
};
const TABS = {
  forecast_scenarios: [{ id: 'a', nome: 'Cenário 1', autor_email: 'x@y.com', ano: 2026, overrides: { a: 1 }, atualizado_em: '2026-10-01T12:30:00Z' }],
  ginfo_snapshot: [
    { chave: 'ativos', updated_at: '2026-10-11T07:20:00Z', data: [{ Placa: 'AAA1A11', Filial: 'PIRAI' }, { Placa: 'BBB2B22', Filial: 'CUIABA' }] },
    { chave: 'civf', updated_at: '2026-10-11T07:21:00Z', data: [{ Veículo: 'CCC3C33', Status: 'OK', Telefone: '999' }] },
  ],
  elite_snapshot: [
    { indicador: 'conformidade-detalhe', vigencia: '09/2026', escopo: 'mes', updated_at: '2026-10-05T10:00:00Z', data: [{ Placa: 'AAA1A11', Status: 'No Prazo' }, { Placa: 'BBB2B22', Status: 'Não Realizado' }] },
    { indicador: 'disponibilidade', vigencia: '09/2026', escopo: 'mes', updated_at: '2026-10-05T10:00:00Z', data: [{ Filial: 'PIRAI', 'Disponibilidade Veículos': 0.97 }] },
  ],
  snapshot: [
    { branch_id: 38, endpoint: 'tires', updated_at: '2026-10-11T03:00:00Z', data: [{ id: 1, serial: 'S1', medida: '295/80 R22.5' }, { id: 2, serial: 'S2', medida: '275/80 R22.5' }] },
    { branch_id: 1676, endpoint: 'tires', updated_at: '2026-10-11T03:00:00Z', data: [{ id: 3, serial: 'S3', medida: '295/80 R22.5' }] },
    { branch_id: 38, endpoint: 'vehicles', updated_at: '2026-10-11T03:00:00Z', data: [{ id: 9, placa: 'AAA1A11' }] },
    { branch_id: 38, endpoint: 'inspections', updated_at: '2026-10-11T03:00:00Z', data: [{ placa: 'AAA1A11', menorMM: 5 }] },
  ],
  indisponibilidade: [{ id: 'e1', placa: 'AAA1A11', unidade: 'PIR', data_parada: '2026-10-01', data_retorno: null }],
  disp_snapshot: [{ id: 1, data: '2026-10-10', unidade: 'PIR', ativos: 50 }],
  fca: [{ id: 'f1', unidade: 'PIR', fato: 'Pacote Combustíveis', fato_desvio: 'Desvio: ▲ R$ 10\nContas:', created_at: '2026-09-01T10:00:00Z' }],
  ce_motoristas: [{ id: 1, chave: 'gt:b1', nome: 'Fulano', cpf: '12345678909', unidade: 'EMP PIRAI' }],
  ce_scores_mensais: [{ id: 1, chave: 'gt:b1', score: 80 }], ce_diario: [{ id: 1, chave: 'gt:b1', km: 300 }], ce_app_log: [{ id: 1, chave: 'gt:b1', evento: 'login' }],
  access_log: [{ id: 1, user_id: 'u1', email: 'a@b.com', painel: 'hub', created_at: '2026-10-10T09:00:00Z' }],
  locacao_conferencia: [
    { vigencia: '2026-08', linhas: [{ ativo: 'AAA1A11', ft: 100, prev: 90 }, { ativo: 'BBB2B22', ft: 50, prev: 50 }], resumo: { n: 2 }, arquivos: ['a.xlsx'], updated_at: '2026-09-01T10:00:00Z', updated_by: 'adm@x.com' },
    { vigencia: '2026-09', linhas: [{ ativo: 'AAA1A11', ft: 110, prev: 95 }], resumo: { n: 1 }, arquivos: [], updated_at: '2026-10-01T10:00:00Z', updated_by: 'adm@x.com' },
  ],
  locacao_obs: [{ ativo: 'AAA1A11', obs: 'ok' }], locacao_benner: [{ id: 1, dados: [] }], locacao_modelos: [{ id: 1, dados: [] }],
};

function dubleBanco(page, cfg) {
  const st = { pedidos: [], ranges: {} };
  const json = (o, extra) => ({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range', ...(extra || {}) }, body: JSON.stringify(o) });
  page.route(u => String(u).startsWith(SUPA), async route => {
    const req = route.request(); const u = new URL(req.url()); const tab = u.pathname.replace('/rest/v1/', '');
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Content-Range' } });
    st.pedidos.push(tab);
    if (tab === 'fca_profiles') {
      const rows = cfg.admin ? [{ is_admin: true }] : [{ is_admin: false }];
      return route.fulfill(/pgrst\.object/.test(req.headers()['accept'] || '') ? json(rows[0]) : json(rows));
    }
    if (tab === 'sh_base') return route.fulfill(json(SH_BASE));
    if (cfg.erro && cfg.erro.includes(tab)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ message: 'relation "' + tab + '" does not exist', code: '42P01' }) });
    let rows = tab.startsWith('sh_') ? linhasSh(tab.slice(3)) : (TABS[tab] || []);
    if (!rows) rows = [];
    // filtros eq./in. que os relatórios usam
    for (const [k, v] of u.searchParams) {
      if (['select', 'order', 'offset', 'limit'].includes(k)) continue;
      if (v.startsWith('eq.')) rows = rows.filter(r => String(r[k]) === v.slice(3));
      if (v.startsWith('in.(')) { const l = v.slice(4, -1).split(',').map(s => s.replace(/^"|"$/g, '')); rows = rows.filter(r => l.includes(String(r[k]))); }
    }
    // o supabase-js manda .range() como offset/limit na URL (ou Range, conforme a versão)
    let de, ate;
    if (u.searchParams.has('offset') || u.searchParams.has('limit')) { de = +(u.searchParams.get('offset') || 0); ate = de + +(u.searchParams.get('limit') || 1000) - 1; }
    else { [de, ate] = (req.headers()['range'] || '0-999').split('-').map(Number); }
    (st.ranges[tab] = st.ranges[tab] || []).push(de + '-' + ate);
    const fim = Math.min(ate, de + MAXROWS - 1, rows.length - 1);
    const fatia = rows.slice(de, fim + 1);
    const conta = /count=exact/.test(req.headers()['prefer'] || '');
    return route.fulfill(json(fatia, { 'Content-Range': (fatia.length ? `${de}-${fim}` : '*') + '/' + (conta ? rows.length : '*') }));
  });
  return st;
}

const sessao = (id, email) => JSON.stringify({ access_token: 'tok', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
  user: { id, email, aud: 'authenticated', role: 'authenticated', user_metadata: { name: 'Renan Teste' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' } });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
async function abre(cfg) {
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: cfg.vp || { width: 1600, height: 900 }, timezoneId: 'America/Sao_Paulo' });
  const page = await ctx.newPage();
  const erros = []; page.on('pageerror', e => erros.push(e.message));
  // abortar tudo de fora PRIMEIRO (o último handler registrado roda antes)
  await page.route(u => !String(u).startsWith(ORIG) && !String(u).startsWith(SUPA), r => r.abort());
  await page.route(u => String(u).includes('@supabase/supabase-js'), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(SBJS, 'utf8') }));
  await page.route(u => String(u).includes('/xlsx@0.18.5/'), r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(XLSXJS, 'utf8') }));
  const st = dubleBanco(page, cfg);
  if (cfg.sessao !== false) await page.addInitScript(({ s, tema }) => { localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', s); if (tema) localStorage.setItem('bi_theme', tema); }, { s: sessao('u1', 'renan@x.com'), tema: cfg.tema || null });
  await page.goto(ORIG + '/relatorios/');
  return { ctx, page, st, erros };
}
async function baixa(page, nomeRel, vw) {
  if (vw) await page.click(`.s-item[data-vw="${vw}"]`);
  const sel = vw ? `#vw-${vw}` : '#vw-resumo';
  const bt = page.locator(`${sel} tr:has(td.nome:text-is("${nomeRel}")) .bx, ${sel} tr:has-text("${nomeRel}") .bx`).first();
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), bt.click()]);
  const p = await dl.path();
  const wb = XLSX.read(fs.readFileSync(p), { type: 'buffer', cellDates: true });
  const st = await bt.locator('xpath=..').locator('.st').textContent();
  return { wb, nome: dl.suggestedFilename(), st };
}
const linhas = (wb, aba) => wb.Sheets[aba] ? XLSX.utils.sheet_to_json(wb.Sheets[aba], { defval: null }) : null;

// ═══ 1 · admin ═══
console.log('\n═══ 1 · admin: lista e exportação ═══');
{
  const { ctx, page, st, erros } = await abre({ admin: true, erro: ['carta_custos'] });
  await page.waitForFunction(() => document.querySelectorAll('#t-resumo .bx').length > 0, null, { timeout: 15000 });
  const info = await page.evaluate(() => ({
    n: document.querySelectorAll('#t-resumo .bx').length, grupos: [...document.querySelectorAll('#t-resumo tr.grp td')].map(td => td.textContent),
    adm: getComputedStyle(document.getElementById('it-adm')).display, total: REL.length, sub: document.getElementById('titSub').textContent,
    sheets: document.querySelectorAll('#t-sheets .bx').length, hrel: document.getElementById('h-rel').textContent, hlin: document.getElementById('h-lin').textContent
  }));
  t(info.n === info.total, 'admin vê todos os relatórios no Resumo', info);
  t(info.grupos.length === 6 && info.grupos[0].startsWith('Visão Geral') && info.grupos.at(-1).startsWith('Administração'), 'agrupados pelas seis áreas do hub', info.grupos);
  t(info.adm !== 'none', 'visão Administração aparece para admin');
  t(info.sheets === 3, 'Bases do Sheets lista as bases do sh_base', info.sheets);
  t(info.hlin === (2505).toLocaleString('pt-BR'), 'hero soma as linhas das bases', info.hlin);

  // Visão Financeira: aba do Sheets inteira, com rótulos e datas
  const vf = await baixa(page, 'Visão Financeira', 'fin');
  t(/^Relatorio_visao_financeira_\d{4}-\d{2}-\d{2}\.xlsx$/.test(vf.nome), 'nome do arquivo', vf.nome);
  t(vf.wb.SheetNames[0] === 'Sobre', '1ª aba é "Sobre"', vf.wb.SheetNames);
  const fr = linhas(vf.wb, 'DRE · Frota');
  t(fr && fr.length === N_FROTA, 'DRE · Frota sai inteira (2.500 linhas, teto de 1.000 por leitura)', fr && fr.length);
  t(st.ranges['sh_dre_frota'] && st.ranges['sh_dre_frota'].length === 3, 'em 3 leituras', st.ranges['sh_dre_frota']);
  const cab = fr ? Object.keys(fr[0]) : [];
  t(cab.includes('VIGÊNCIA') && cab.includes('CONTA GERENCIAL') && cab.includes('REALIZADO') && cab.includes('REALIZADO (2)'), 'cabeçalho com os rótulos da aba (repetido ganha sufixo)', cab);
  const v0 = fr && fr[0]['VIGÊNCIA'];
  t(ehData(v0) && v0.getUTCFullYear() === 2026 && v0.getUTCMonth() === 7 && v0.getUTCDate() === 1, 'vigência sai como data (01/08/2026, sem cair para julho)', String(v0));
  t(fr && fr[N_FROTA - 1]['CONTA GERENCIAL'] === 'Conta 2500' && fr[N_FROTA - 1]['REALIZADO (2)'] === -2500, 'última linha certa', fr && fr[N_FROTA - 1]);
  const fc = linhas(vf.wb, 'Cenários de forecast');
  t(fc && fc.length === 1 && !('autor_email' in fc[0]) && fc[0].nome === 'Cenário 1', 'forecast sem a coluna de e-mail', fc && fc[0]);
  t(fc && typeof fc[0].overrides === 'string' && fc[0].overrides.includes('"a":1'), 'JSON vira texto na célula', fc && fc[0].overrides);

  // Gestão à Vista: Ginfo e Elite expandidos
  const gv = await baixa(page, 'Gestão à Vista', 'ger');
  t(gv.wb.SheetNames.includes('Ginfo · ativos') && gv.wb.SheetNames.includes('Ginfo · civf'), 'Ginfo: uma aba por exportação', gv.wb.SheetNames);
  const at = linhas(gv.wb, 'Ginfo · ativos');
  t(at && at.length === 2 && at[0].Placa === 'AAA1A11' && ehData(at[0]['Exportado do Ginfo em']) && Math.abs(at[0]['Exportado do Ginfo em'] - Date.parse('2026-10-11T04:20:00Z')) < 2000, 'linhas do JSON com a data da exportação na frente', at && at[0]);
  const cv = linhas(gv.wb, 'Ginfo · civf');
  t(cv && !('Telefone' in cv[0]), 'telefone fica fora do JSON também', cv && cv[0]);
  const cd = linhas(gv.wb, 'Elite · conformidade-detalhe');
  t(cd && cd.length === 2 && cd[0]['Vigência'] === '09/2026' && cd[0].Escopo === 'mes', 'Frota de Elite: só o indicador pedido, com vigência e escopo', cd && cd[0]);
  t(!gv.wb.SheetNames.includes('Elite · disponibilidade'), 'indicador fora do filtro não entra', gv.wb.SheetNames);
  const sb = linhas(gv.wb, 'Sobre');
  t(sb && sb.some(r => Object.values(r).includes('Ginfo · ativos')), 'Sobre lista cada aba', null);

  // Pneus: Prolog com Unidade
  const pn = await baixa(page, 'Pneus', 'op');
  const pt = linhas(pn.wb, 'Prolog · Pneus');
  t(pt && pt.length === 3 && pt.map(r => r.Unidade).sort().join() === 'MCC T1,PIR,PIR', 'Prolog: as duas unidades numa aba, com a Unidade pelo branch_id', pt && pt.map(r => r.Unidade));
  t(pn.wb.SheetNames.includes('Prolog · Veículos') && pn.wb.SheetNames.includes('Prolog · Aferições'), 'veículos e aferições em abas próprias', pn.wb.SheetNames);

  // Condução: sem CPF
  const ce = await baixa(page, 'Combustível · Condução Econômica', 'op');
  const mo = linhas(ce.wb, 'Motoristas');
  t(mo && mo.length === 1 && !('cpf' in mo[0]) && mo[0].nome === 'Fulano', 'motoristas sem CPF', mo && mo[0]);

  // Carta com uma fonte quebrada: o resto sai e o Sobre avisa
  const ca = await baixa(page, 'Carta de Custos', 'fin');
  const sc = linhas(ca.wb, 'Sobre');
  const lin = sc ? sc.map(r => Object.values(r).join(' | ')) : [];
  t(lin.some(l => l.includes('(não exportada)') && l.includes('Lançamentos') && l.includes('ERRO')), 'fonte com erro vira linha na aba Sobre', lin.slice(-6));
  t(!ca.wb.SheetNames.includes('Lançamentos') && ca.wb.SheetNames.length >= 2, 'as outras abas saem', ca.wb.SheetNames);
  t(/fonte\(s\) com erro/.test(ca.st), 'o status do botão avisa', ca.st);

  // Acessos mantém o e-mail; Conferência expande as linhas
  const ac = await baixa(page, 'Acessos', 'adm');
  const al = linhas(ac.wb, 'Acessos');
  t(al && al[0].email === 'a@b.com', 'Acessos mantém o e-mail (é a identidade do acesso)', al && al[0]);
  const cl = await baixa(page, 'Conferência de Locação', 'adm');
  const cf = linhas(cl.wb, 'Conferência');
  t(cf && cf.length === 3 && cf[0]['Vigência'] === '2026-08' && cf[2].ft === 110, 'Conferência: linhas de todos os meses, com a vigência', cf);
  const cm = linhas(cl.wb, 'Conferência · meses');
  t(cm && cm.length === 2 && !('linhas' in cm[0]) && typeof cm[0].resumo === 'string', 'aba dos meses sem a coluna das linhas', cm && cm[0]);

  // base avulsa do Sheets
  const sh = await baixa(page, 'DRE · EBITDA', 'sheets');
  t(linhas(sh.wb, 'DRE · EBITDA') && linhas(sh.wb, 'DRE · EBITDA').length === 3, 'Bases do Sheets: exporta a base sozinha', sh.wb.SheetNames);

  t(!erros.length, 'sem erro de JavaScript', erros);
  await ctx.close();
}

// ═══ 2 · usuário comum ═══
console.log('\n═══ 2 · usuário sem admin ═══');
{
  const { ctx, page } = await abre({ admin: false });
  await page.waitForFunction(() => document.querySelectorAll('#t-resumo .bx').length > 0, null, { timeout: 15000 });
  const i = await page.evaluate(() => ({ n: document.querySelectorAll('#t-resumo .bx').length, adm: REL.filter(r => r.adm).length, tot: REL.length,
    vis: getComputedStyle(document.getElementById('it-adm')).display,
    nomes: [...document.querySelectorAll('#t-resumo td.nome')].map(td => td.firstChild.textContent) }));
  t(i.n === i.tot - i.adm, 'vê só os relatórios abertos', i);
  t(i.vis === 'none', 'Administração escondida');
  t(!i.nomes.includes('Acessos') && !i.nomes.includes('Combustível · Condução Econômica') && i.nomes.includes('FCA'), 'sem Acessos nem Condução; com FCA', i.nomes);
  await page.evaluate(() => setVw('adm'));
  t(await page.evaluate(() => VW) === 'resumo', 'setVw("adm") devolve ao Resumo');
  await ctx.close();
}

// ═══ 3 · sem sessão ═══
console.log('\n═══ 3 · sem sessão ═══');
{
  const { ctx, page } = await abre({ sessao: false });
  await page.waitForSelector('.gate', { timeout: 15000 });
  t(/Login necessário/.test(await page.textContent('.gate')), 'gate de login');
  await ctx.close();
}

// ═══ 4 · busca e layout ═══
console.log('\n═══ 4 · busca e layout ═══');
for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) for (const tema of ['dark', 'light']) {
  const { ctx, page } = await abre({ admin: true, vp, tema });
  await page.waitForFunction(() => document.querySelectorAll('#t-resumo .bx').length > 0, null, { timeout: 15000 });
  const m = await page.evaluate(() => { const tw = document.getElementById('t-resumo');
    return { pagRola: document.scrollingElement.scrollHeight > innerHeight + 1, hor: tw.scrollWidth > tw.clientWidth + 1, claro: document.body.classList.contains('claro') }; });
  t(!m.pagRola && !m.hor && m.claro === (tema === 'light'), `${vp.width}×${vp.height} ${tema}: página não rola, tabela sem barra horizontal`, m);
  if (vp.width === 1366 && tema === 'dark') {
    await page.fill('[data-busca="resumo"]', 'pneu');
    const v = await page.evaluate(() => [...document.querySelectorAll('#t-resumo tbody tr')].filter(tr => tr.style.display !== 'none').map(tr => tr.textContent.trim().slice(0, 30)));
    t(v.some(s => s.startsWith('Pneus')) && v.some(s => s.startsWith('Compra de Pneus')) && !v.some(s => s.startsWith('Visão Financeira')), 'busca "pneu" filtra (e mostra o grupo de quem sobra)', v);
    if (process.env.SHOT_DIR) await page.screenshot({ path: path.join(process.env.SHOT_DIR, 'relatorios-busca.png') });
  }
  if (process.env.SHOT_DIR && vp.width === 1920) await page.screenshot({ path: path.join(process.env.SHOT_DIR, `relatorios-${tema}.png`) });
  await ctx.close();
}

// ═══ 5 · hub ═══
console.log('\n═══ 5 · card no hub ═══');
{
  const h = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const m = h.match(/const CLUSTERS = (\[.*?\]);\n/s);
  const cl = JSON.parse(m[1]);
  const op = cl.find(c => c.nome === 'Operacional');
  const card = op && op.cards.find(c => c.t === 'Relatórios');
  t(card && card.h === 'relatorios/' && !card.adm, 'card "Relatórios" no Operacional, aberto a todos', card && card.h);
  t(op && op.cards.at(-1).t === 'Relatórios', 'depois do Catálogo de Peças', op && op.cards.map(c => c.t));
}

await browser.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
