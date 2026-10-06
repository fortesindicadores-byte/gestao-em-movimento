// Migração do Gerot (gerot/) para a casca padrão do portal — conferida no
// Chromium, nos DOIS lados (HTML antigo × novo, mesmos dados).
//
// O painel lê tudo pelo assets/gerot-base.js (o REAL, não dublado):
//   · Supabase elite_snapshot (escopos 'mes' e 'ano') via supabase-js UMD
//     (SBJS = dist/umd/supabase.js baixado do npm — o sandbox não alcança o CDN);
//   · Supabase snapshot?endpoint=eq.tires (Prolog: Amplitude e % Calibragem OK);
//   · gviz JSONP: aba Km/L (Combustível), aba Pneus do Frota de Elite e as quatro
//     abas por tier do termômetro (OS Vencida e Blitz).
// O shim gviz-cache.js fica no caminho, com as tabelas sh_*/gviz_snapshot
// respondendo vazio, e cai no "Google" dublado.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show HEAD:gerot/index.html > <scratch>/gerot-antigo.html   (o último antes da casca)
//   cp scripts/gerot-casca-teste.mjs docs/driverpro-apresentacao/_gerot-casca-x1.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento \
//     ANTIGO=<html antigo> SBJS=<supabase.js umd> SHOTS=<pasta> node _gerot-casca-x1.mjs ; rm _gerot-casca-x1.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGO = process.env.ANTIGO;
const SBJS = process.env.SBJS;
const SHOTS = process.env.SHOTS || '';
const BUILD = '202610070100';
const ORIG = 'http://gem.teste';
const PASTA = 'gerot';

// ── dados sintéticos no formato dos exports do Ginfo (elite_snapshot) ──
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const r2 = v => Math.round(v * 1000) / 1000;
const CDDS = ['CDD CAMBORIU', 'CDD CUIABA', 'CDD RIO DE JANEIRO', 'CDD FLORIANOPOLIS', 'CDD GUARULHOS', 'CDI MACACU',
  'CDD NOVA FRIBURGO', 'CDD PELOTAS', 'CDD RONDONOPOLIS'];
const EMPS = ['MACACU EMPURRADA', 'CUIABA EMPURRADA', 'PIRAI EMPURRADA'];
const TODAS = [...CDDS, ...EMPS, 'CUIABA'];
const VIGS = []; for (let m = 1; m <= 8; m++) VIGS.push(`${String(m).padStart(2, '0')}/2026`);
const hms = s => { s = Math.round(s); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

function exportsDe(vig, esc) {
  const novaConf = vig >= '08/2026' && vig.endsWith('2026') && +vig.slice(0, 2) >= 8;
  const o = {};
  o.disponibilidade = TODAS.map(f => ({ Filial: f, 'Disponibilidade Veículos': r2(0.92 + rnd() * 0.08), 'Tempo Indisponível': hms(3600 * (5 + rnd() * 40)),
    'MTTR Veículos': hms(3600 * (2 + rnd() * 10)), 'MTBF Veículos': hms(3600 * (60 + rnd() * 200)) }));
  o.preventivas = TODAS.map(f => ({ Filial: f, 'Aderência': rnd() < .3 ? 1 : r2(0.85 + rnd() * 0.15), 'Preventivas Realizadas': 20 + Math.floor(rnd() * 40) }));
  o['sla-manutencao'] = TODAS.map(f => ({ Filial: f, 'SLA Atendimento': r2(0.6 + rnd() * 0.35), Executadas: 10 + Math.floor(rnd() * 30) }));
  o.conformidade = novaConf
    ? TODAS.map(f => ({ Filial: f, 'Nunca Realizado': Math.floor(rnd() * 3), 'Não Realizado': Math.floor(rnd() * 5), 'Realizado Fora Prazo': Math.floor(rnd() * 8),
      'Realizado Dentro Prazo': 20 + Math.floor(rnd() * 30), 'No Prazo': 10 + Math.floor(rnd() * 20) }))
    : TODAS.map(f => ({ Filial: f, 'Aderência Mensal': rnd() < .3 ? 1 : r2(0.6 + rnd() * 0.4), 'Aderência Bimestral': rnd() < .3 ? 1 : r2(0.7 + rnd() * 0.3) }));
  o['checklist-t2'] = CDDS.map(f => ({ Filial: f, 'Aderência': r2(0.88 + rnd() * 0.12), Viagens: 300 + Math.floor(rnd() * 400),
    'Saídas com OS Crítica': rnd() < .4 ? 0 : Math.floor(rnd() * 6) }));
  o['checklist-t1'] = ['MACACU', 'CUIABA', 'PIRAI'].map(f => ({ Filial: f, 'Aderência Saída': r2(0.9 + rnd() * 0.1), Viagens: 200 + Math.floor(rnd() * 200) }));
  o['checklist-wh'] = ['CUIABA', 'CDD RIO DE JANEIRO', 'CDD PELOTAS'].map(f => ({ Filial: f, 'Aderência': r2(0.85 + rnd() * 0.15), 'Aderência Ponto': 0.5, Realizados: 50 + Math.floor(rnd() * 50) }));
  if (esc === 'ano') return o;   // o escopo 'ano' só tem os % por filial
  const placa = i => 'ABC' + String(1000 + i);
  o['stress-test-frota'] = []; o.civf = [];
  CDDS.forEach((f, j) => { for (let i = 0; i < 8; i++) {
    o['stress-test-frota'].push({ 'Filial Freightech': f, 'Placa Freightech': placa(j * 10 + i), Projeto: 'ROTA', Desconto: rnd() < .12 ? 150 : 0 });
    o.civf.push({ 'Filial Freightech': f, 'Veículo': placa(j * 10 + i), Projeto: 'ROTA', 'Desconto Total': rnd() < .1 ? 80 : 0 });
  } });
  o['stress-test-empilhadeira'] = [];
  ['CDD FLORIANOPOLIS', 'CDD PELOTAS', 'CDD RIO DE JANEIRO', 'CUIABA'].forEach((f, j) => { for (let i = 0; i < 4; i++)
    o['stress-test-empilhadeira'].push({ 'Filial GINFO': f, 'Placa Ginfo': j === 0 && i === 0 ? 'EMP2024' : 'EMP' + (3000 + j * 10 + i), Chassis: 'CH' + j + i, 'Desc. Total': rnd() < .2 ? 300 : 0 }); });
  o.pneus = TODAS.map(f => ({ Filial: f, 'Aferidos em 30 dias': 30 + Math.floor(rnd() * 10), Frota: 40 }));
  return o;
}
const ELITE = [];
for (const vig of VIGS) for (const esc of ['mes', 'ano']) for (const [indicador, data] of Object.entries(exportsDe(vig, esc)))
  ELITE.push({ indicador, vigencia: vig, escopo: esc, data });

// ── gviz: Km/L (25 colunas: 0 vig · 4 rem · 14 projeto · 22 km · 23 litros) ──
const PROJS = ['ROTA - BLC', 'ROTA - CBA', 'EMPURRADA - CBA', 'ROTA - CGR', 'ROTA - FLP', 'ROTA - GRL', 'VAN - GRL', 'ROTA - MCC', 'EMPURRADA - MCC',
  'ROTA - NFR', 'EMPURRADA - PIR', 'ROTA - PLT', 'ROTA - RON'];
const KML = [['Vigência', ...Array(24).fill('x')]];
for (let m = 1; m <= 8; m++) for (const p of PROJS) for (let k = 0; k < 3; k++) {
  const emp = p.startsWith('EMP'), van = p.startsWith('VAN');
  const rem = emp ? 2.0 : van ? 7 : 3.2, km = 2000 + Math.floor(rnd() * 6000), real = rem * (0.9 + rnd() * 0.2);
  const row = Array(25).fill(null); row[0] = `Date(2026,${m - 1},1)`; row[4] = rem; row[14] = p; row[22] = km; row[23] = Math.round(km / real);
  KML.push(row);
}
// ── gviz: aba Pneus do Frota de Elite (0 Filial · 3 Projeto · 4 Período · 6 Status) ──
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto'];
const PNEUS = [['Filial', 'Evento', 'Placa', 'Projeto', 'Período', 'Última Leitura', 'Status']];
for (let m = 0; m < 8; m++) TODAS.forEach((f, j) => { for (let i = 0; i < 6; i++)
  PNEUS.push([f, i % 2 ? 'CALIBRAGEM' : 'MILIMETRAGEM', 'P' + j + i, EMPS.includes(f) ? 'EMPURRADA' : 'ROTA', `${MESES[m]} de 2026`, null, rnd() < .1 ? 'Não Realizado' : 'Realizado']); });
// ── gviz: termômetro, quatro tiers (0 'MM_Q' · 1 filial · 12 Blitz (T2) · 16 OS vencidas) ──
const TIER = { 'Transportes T1': ['MACACU', 'CUIABA', 'PIRAI'], 'Transportes T2': CDDS, 'WH T1': ['CUIABA'], 'WH T2': ['CDD RIO DE JANEIRO', 'CDD PELOTAS'] };
const TERMO = {};
for (const [t, us] of Object.entries(TIER)) {
  const rows = [['Vigência', 'CDD', ...Array(20).fill('x')]];
  for (let m = 1; m <= 8; m++) for (const q of [1, 2]) for (const u of us) {
    const r = Array(22).fill(null); r[0] = `${String(m).padStart(2, '0')}_0${q}`; r[1] = u;
    r[12] = rnd() < .5 ? 1 : r2(0.8 + rnd() * 0.2); r[16] = Math.floor(rnd() * 15); rows.push(r);
  }
  TERMO[t] = rows;
}
const ABAS = { 'Km/L': KML, Pneus: PNEUS, ...TERMO };
// ── Prolog (snapshot?endpoint=eq.tires) ──
const BR = { 'CDD CAMBORIU': 24, 'CDD CUIABA': 1878, 'CUIABA': 1906, 'CUIABA EMPURRADA': 1907, 'CDD FLORIANOPOLIS': 20, 'CDD GUARULHOS': 30, 'CDD NOVA FRIBURGO': 2517,
  'CDD PELOTAS': 26, 'CDD RIO DE JANEIRO': 37, 'CDD RONDONOPOLIS': 2277, 'CDI MACACU': 1677, 'MACACU EMPURRADA': 1676, 'PIRAI EMPURRADA': 38 };
const TIRES = Object.values(BR).map(b => ({ branch_id: b, data: Array.from({ length: 12 }, (_, i) => ({ placa: 'X' + b + i, menorMM: 6 + rnd() * 6,
  amplitude: rnd() * 8, pressaoIdeal: 110, desvioPressao: (rnd() - .5) * 26 })) }));

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function abre(browser, htmlAntigo, vp, tema, falhaBanco = false) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(({ ABAS, tema }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_theme', tema);
    const gv = rows => ({ status: 'ok', table: { cols: rows[0].map(() => ({ id: 'A', label: '' })),
      rows: rows.map(r => ({ c: r.map(v => v == null || v === '' ? null : { v }) })) } });
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        const aba = decodeURIComponent((n.src.match(/[?&]sheet=([^&]+)/) || [])[1] || '');
        const rows = ABAS[aba];
        setTimeout(() => { if (fn && window[fn]) window[fn](rows ? gv(JSON.parse(JSON.stringify(rows))) : { status: 'error' }); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
  }, { ABAS, tema });
  await page.route('**/*', async r => {
    const req = r.request(), u = new URL(req.url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('supabase-js'))
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(SBJS) });
    if (u.hostname.endsWith('supabase.co')) {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors, body: '' });
      const json = b => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(b) });
      if (u.pathname.endsWith('/elite_snapshot')) {
        if (falhaBanco) return r.fulfill({ status: 500, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'banco fora' }) });
        const esc = (u.searchParams.get('escopo') || '').replace('eq.', '');
        const inds = ((u.searchParams.get('indicador') || '').match(/^in\.\((.*)\)$/) || [, ''])[1].split(',').map(s => s.replace(/"/g, ''));
        return json(ELITE.filter(e => e.escopo === esc && inds.includes(e.indicador)).map(({ indicador, vigencia, data }) => ({ indicador, vigencia, data })));
      }
      if (u.pathname.endsWith('/snapshot') && (u.searchParams.get('endpoint') || '') === 'eq.tires') return json(TIRES);
      return json([]);
    }
    if (u.hostname.includes('fonts.')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.goto(`${ORIG}/${PASTA}/${htmlAntigo ? '__antigo.html' : ''}`, { waitUntil: 'domcontentloaded' });
  if (!falhaBanco) await page.waitForFunction(() => document.querySelectorAll('#tbl table tbody tr').length > 10, null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(500);
  return { ctx, page, errs };
}

// a tabela e os filtros, lidos igual nos dois lados
const leNumeros = () => {
  const out = {};
  const tb = document.querySelector('#tbl table');
  out.cab = tb ? [...tb.querySelectorAll('thead th')].map(c => c.textContent.trim()).join(' | ') : null;
  out.linhas = tb ? [...tb.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' | ')) : [];
  out.pilulas = [...document.querySelectorAll('#tbl .atg')].map(s => s.style.background + '/' + s.style.color).join(',');
  out.sub = (document.getElementById('tbl-sub') || {}).textContent;
  out.filtros = [...document.querySelectorAll('.ms-wrap')].map(w => w.id + ':' + w.querySelectorAll('.ms-opt input[data-v]').length + ':' + [...(w._sel || [])].join('/')).join(',');
  return out;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

// 1 · números: antigo × novo, base e depois de filtros
console.log('\n══ números: antigo × novo ══');
const sel = (id, vals) => { const w = document.getElementById(id); w._sel.clear(); vals.forEach(v => w._sel.add(v)); w._render(''); atualizar(); };
const passos = {
  base: null,
  'Vigência 03/2026': `(${sel})('ms-vig',['03/2026'])`,
  'Vigência jan→jun (acumulado do escopo ano)': `(${sel})('ms-vig',['01/2026','02/2026','03/2026','04/2026','05/2026','06/2026'])`,
  'Vigência abr→ago (cruza o corte da conformidade, média mensal)': `(${sel})('ms-vig',['04/2026','05/2026','06/2026','07/2026','08/2026'])`,
  'Unidade CDD PELOTAS': `(${sel})('ms-vig',[]);(${sel})('ms-unidade',['CDD PELOTAS'])`,
  'Unidade MACACU EMPURRADA + CDI MACACU · vig 07+08': `(${sel})('ms-unidade',['MACACU EMPURRADA','CDI MACACU']);(${sel})('ms-vig',['07/2026','08/2026'])`,
};
const res = {};
for (const lado of ['antigo', 'novo']) {
  const { ctx, page, errs } = await abre(browser, lado === 'antigo' ? htmlAntigo : null, { width: 1600, height: 900 }, 'dark');
  res[lado] = { errs };
  for (const [nome, fn] of Object.entries(passos)) {
    if (fn) { await page.evaluate(fn); await page.waitForTimeout(200); }
    res[lado][nome] = await page.evaluate(leNumeros);
  }
  await ctx.close();
}
ok('antigo abre sem erro de página', res.antigo.errs.length === 0, res.antigo.errs.join(' / '));
ok('novo abre sem erro de página', res.novo.errs.length === 0, res.novo.errs.join(' / '));
const b = res.novo.base;
console.log('  novo base (' + b.sub + '):\n    ' + b.linhas.join('\n    '));
ok('tabela com os 11 indicadores-chave + adicionais', b.linhas.length >= 17, b.linhas.length + ' linhas');
ok('pílulas verdes E vermelhas na tabela', /123, 196, 127/.test(b.pilulas) && /240, 145, 139/.test(b.pilulas));
for (const nome of Object.keys(passos)) {
  const A = res.antigo[nome], N = res.novo[nome];
  for (const k of Object.keys(A)) {
    const igual = JSON.stringify(A[k]) === JSON.stringify(N[k]);
    ok(`igual antes × depois [${nome}]: ${k}`, igual, igual ? '' : `${JSON.stringify(A[k]).slice(0, 160)} × ${JSON.stringify(N[k]).slice(0, 160)}`);
  }
}
ok('filtro de vigência muda os números', JSON.stringify(res.novo['Vigência 03/2026'].linhas) !== JSON.stringify(b.linhas));
ok('filtro de unidade muda os números', JSON.stringify(res.novo['Unidade CDD PELOTAS'].linhas) !== JSON.stringify(b.linhas));

// 2 · casca: sem rolagem, visão, tema, exportação — 1366×768 e 1600×900
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, null, vp, tema);
    const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    console.log(`\n══ ${tag} ══`);
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light') && !document.body.classList.contains('light-mode'), tema));
    await page.click('.s-item[data-vw="resumo"]'); await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const se = document.scrollingElement, vw = document.querySelector('.vw.on');
      const tw = vw.querySelector('.twrap'), card = vw.querySelector('.card.tsec'), cs = getComputedStyle(card);
      const tb = tw.querySelector('table'), trs = [...tb.querySelectorAll('tbody tr')];
      const cortes = [...vw.querySelectorAll('table thead th')].filter(th => th.scrollWidth > th.clientWidth + 1).map(th => th.textContent.trim());
      const al = [...tb.querySelectorAll('thead th')].map(th => getComputedStyle(th).textAlign).join(',');
      const alTd = [...trs[0].cells].map(td => getComputedStyle(td).textAlign).join(',');
      return { id: vw.id, tit: document.getElementById('tit').textContent, sub: document.getElementById('titSub').textContent,
        pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
        vwRola: vw.scrollHeight > vw.clientHeight + 1, horiz: tw.scrollWidth > tw.clientWidth + 1,
        twRolaV: tw.scrollHeight > tw.clientHeight + 1,
        sobra: Math.round(tw.getBoundingClientRect().bottom - trs[trs.length - 1].getBoundingClientRect().bottom),
        sticky: getComputedStyle(tb.querySelector('thead th')).position,
        moldura: [cs.borderTopWidth, cs.backgroundColor, cs.boxShadow, cs.paddingTop].join(' '),
        cortes, al, alTd, foraTela: tw.getBoundingClientRect().bottom > innerHeight + 1 };
    });
    ok(`${tag}: visão "Resumo Gerencial" abre`, m.id === 'vw-resumo' && m.tit === 'Resumo Gerencial');
    ok(`${tag}: subtítulo do topo = recorte · carga`, /\d{2}\/\d{4} · Atualizado /.test(m.sub), m.sub);
    ok(`${tag}: página não rola`, !m.pagRola);
    ok(`${tag}: a visão não transborda`, !m.vwRola);
    ok(`${tag}: tabela sem barra horizontal`, !m.horiz);
    ok(`${tag}: tabela inteira à vista, sem barra vertical`, !m.twRolaV);
    ok(`${tag}: sem faixa vazia embaixo da tabela (≤ 4px)`, m.sobra <= 4, m.sobra + 'px');
    ok(`${tag}: nada fora da tela`, !m.foraTela);
    ok(`${tag}: cabeçalho sticky`, m.sticky === 'sticky');
    ok(`${tag}: cabeçalho sem texto cortado`, !m.cortes.length, m.cortes.join(' / '));
    ok(`${tag}: cabeçalho alinhado ao conteúdo (texto à esq., número à dir.)`, m.al === m.alTd && m.al.startsWith('left,right'), m.al + ' × ' + m.alTd);
    ok(`${tag}: espelho atrás da tabela (card com borda e fundo — Renan, 06/10/2026)`, /^1px rgba?\(/.test(m.moldura) && !/^1px rgba\(0, 0, 0, 0\)/.test(m.moldura), m.moldura);
    if (SHOTS) {
      const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `resumo-${tema === 'light' ? 'claro' : 'escuro'}${vp.width === 1600 ? '' : '-' + vp.width}.png`) });
    }
    if (vp.width === 1600 && tema === 'dark') {
      await page.click('#btTema'); await page.waitForTimeout(200);
      ok('troca de tema: body.claro + bi_theme', await page.evaluate(() => document.body.classList.contains('claro') && localStorage.getItem('bi_theme') === 'light'));
      await page.click('#btTema'); await page.waitForTimeout(200);
      const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
        xls: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
      ok('Gerar PDF na lateral (Atalhos)', exp.pdf);
      ok('excel-export carregado (menu Excel/PNG)', exp.xls);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('ctrlk.js, gviz-cache.js, supabase-js e gerot-base.js continuam', ['ctrlk.js', 'gviz-cache.js', 'supabase-js', 'gerot-base.js'].every(n => exp.srcs.some(s => s.includes(n))));
      ok('filters-toggle.js saiu', !exp.srcs.some(s => s.includes('filters-toggle')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(B => { const b = (document.querySelector('meta[name=build]') || {}).content; return !!b && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + (document.querySelector('meta[name=build]') || {}).content)); }, BUILD));
      await page.click('#tbl tbody td:nth-child(3)', { button: 'right' }); await page.waitForTimeout(150);
      ok('clique direito na tabela abre o menu Excel/PNG', await page.evaluate(() => { const m = document.getElementById('xl-menu'); return !!m && m.style.display !== 'none' && /Excel/.test(m.textContent); }));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      const antesOrd = await page.evaluate(() => document.querySelector('#tbl tbody tr td').textContent);
      await page.click('#tbl thead th:nth-child(1)'); await page.waitForTimeout(200);
      const depoisOrd = await page.evaluate(() => document.querySelector('#tbl tbody tr td').textContent);
      ok('ordenação pelo cabeçalho (Indicador)', antesOrd !== depoisOrd, `${antesOrd} → ${depoisOrd}`);
      await page.click('#ms-unidade .ms-btn'); await page.waitForTimeout(100);
      await page.evaluate(() => document.querySelector('#ms-unidade .ms-only[data-v="CDD PELOTAS"]').click());
      await page.waitForTimeout(200);
      const cnt = await page.evaluate(() => { const c = document.querySelector('#ms-unidade .ms-cnt'); return [getComputedStyle(c).display, c.textContent]; });
      ok('contagem laranja do filtro aparece', cnt[0] !== 'none' && cnt[1] === '1', cnt.join(' · '));
      await page.mouse.click(5, 5);
      ok('contrato: wrap._sel (Set) + wrap._render, atualizar/carregar', await page.evaluate(() => ['ms-unidade', 'ms-vig'].every(id => { const w = document.getElementById(id); return w._sel instanceof Set && typeof w._render === 'function'; }) && typeof atualizar === 'function' && typeof carregar === 'function'));
      await page.click('#btMini'); await page.waitForTimeout(300);
      ok('lateral recolhe e guarda gerot_mini', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('gerot_mini') === '1'));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'resumo-mini-filtro.png') });
      await page.evaluate(() => { localStorage.setItem('gerot_mini', '0'); setCarga('x'); });
      await page.evaluate(() => carregar()); await page.waitForTimeout(800);
      ok('Atualizar dados: subtítulo "… · Atualizado …"', await page.evaluate(() => / · Atualizado /.test(document.getElementById('titSub').textContent)));
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}

// 3 · banco fora do ar: o aviso vai para o subtítulo (era o selo do header)
{
  const { ctx, page } = await abre(browser, null, { width: 1366, height: 768 }, 'dark', true);
  await page.waitForFunction(() => /Erro/.test(document.getElementById('titSub').textContent), null, { timeout: 20000 }).catch(() => {});
  const t = await page.evaluate(() => document.getElementById('titSub').textContent);
  ok('banco fora do ar: "Erro ao carregar" no subtítulo', /Erro ao carregar/.test(t), t);
  await ctx.close();
}

// 4 · celular: a página volta a rolar e a tabela tem altura
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  const m = await page.evaluate(() => ({ rola: /auto|scroll/.test(getComputedStyle(document.body).overflowY) && getComputedStyle(document.querySelector('.app')).position === 'static',
    h: Math.round(document.querySelector('#vw-resumo .twrap').getBoundingClientRect().height) }));
  ok('celular: página livre para rolar e tabela com altura', m.rola && m.h > 300, m.h + 'px');
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular.png'), fullPage: true });
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
