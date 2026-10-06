// Migração do Resumo Executivo (resumo-executivo/) para a casca padrão do portal —
// conferida no Chromium, nos DOIS lados (HTML antigo × novo, mesmos dados).
//
// O painel lê:
//   · os ICs pelo assets/gerot-base.js (o REAL, não dublado): Supabase elite_snapshot
//     (escopos 'mes' e 'ano') via supabase-js UMD (SBJS), Prolog (snapshot?endpoint=eq.tires)
//     e as abas gviz que o gerot-base pede (Km/L, Pneus e os quatro tiers do termômetro);
//   · a Base RPM em CSV (/export?format=csv&gid=0) — só como RESERVA, quando o
//     elite_snapshot falha (cenário 3);
//   · gviz JSONP: DRE Frota, Dispersão de km, R$/L, Km/L, DPO, Demarco e FCA (gid=216663799).
// O shim gviz-cache.js fica no caminho, com as tabelas sh_*/gviz_snapshot respondendo
// vazio, e cai no "Google" dublado.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show 179afa3:resumo-executivo/index.html > <scratch>/antigo.html   (o último antes da casca)
//   cp scripts/resumo-executivo-casca-teste.mjs docs/driverpro-apresentacao/_resexec-casca-x1.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento ANTIGO=<html antigo> \
//     SBJS=<supabase.js umd> FONT_DIR=<montserrat files> SHOTS=<pasta> node _resexec-casca-x1.mjs ; rm _resexec-casca-x1.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGO = process.env.ANTIGO;
const SBJS = process.env.SBJS;
const FONT_DIR = process.env.FONT_DIR || '';
const SHOTS = process.env.SHOTS || '';
const BUILD = '202610070300';
const ORIG = 'http://gem.teste';
const PASTA = 'resumo-executivo';

// ── dados sintéticos no formato dos exports do Ginfo (elite_snapshot) ──
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const r2 = v => Math.round(v * 1000) / 1000;
const CDDS = ['CDD CAMBORIU', 'CDD CUIABA', 'CDD RIO DE JANEIRO', 'CDD FLORIANOPOLIS', 'CDD GUARULHOS', 'CDI MACACU',
  'CDD NOVA FRIBURGO', 'CDD PELOTAS', 'CDD RONDONOPOLIS'];
const EMPS = ['MACACU EMPURRADA', 'CUIABA EMPURRADA', 'PIRAI EMPURRADA'];
const TODAS = [...CDDS, ...EMPS, 'CUIABA'];
const VIGS = []; for (let m = 1; m <= 8; m++) VIGS.push(`${String(m).padStart(2, '0')}/2026`);
const hms = s => { s = Math.round(s); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
// unidades "fracas" para os quadrantes terem críticas, regulares e saudáveis
const FRACA = { 'CDD GUARULHOS': .62, 'CDD RONDONOPOLIS': .78, 'PIRAI EMPURRADA': .84 };
const fx = f => FRACA[f] || 1;

function exportsDe(vig, esc) {
  const mes = +vig.slice(0, 2);
  const queda = mes >= 6 ? 1 - (mes - 5) * .03 : 1;   // a frota cai de jun em diante (tendência)
  const novaConf = mes >= 8;
  const o = {};
  o.disponibilidade = TODAS.map(f => ({ Filial: f, 'Disponibilidade Veículos': r2(Math.min(1, (0.92 + rnd() * 0.08) * fx(f))), 'Tempo Indisponível': hms(3600 * (5 + rnd() * 40)),
    'MTTR Veículos': hms(3600 * (2 + rnd() * 10)), 'MTBF Veículos': hms(3600 * (60 + rnd() * 200)) }));
  o.preventivas = TODAS.map(f => ({ Filial: f, 'Aderência': r2(Math.min(1, (0.78 + rnd() * 0.2) * fx(f) * queda)), 'Preventivas Realizadas': 20 + Math.floor(rnd() * 40) }));
  o['sla-manutencao'] = TODAS.map(f => ({ Filial: f, 'SLA Atendimento': r2((0.6 + rnd() * 0.35) * fx(f)), Executadas: 10 + Math.floor(rnd() * 30) }));
  o.conformidade = novaConf
    ? TODAS.map(f => ({ Filial: f, 'Nunca Realizado': Math.floor(rnd() * 3), 'Não Realizado': Math.floor(rnd() * 5 / fx(f)), 'Realizado Fora Prazo': Math.floor(rnd() * 8),
      'Realizado Dentro Prazo': 20 + Math.floor(rnd() * 30), 'No Prazo': 10 + Math.floor(rnd() * 20) }))
    : TODAS.map(f => ({ Filial: f, 'Aderência Mensal': r2(Math.min(1, (0.75 + rnd() * 0.3) * fx(f))), 'Aderência Bimestral': r2(Math.min(1, (0.8 + rnd() * 0.25) * fx(f))) }));
  o['checklist-t2'] = CDDS.map(f => ({ Filial: f, 'Aderência': r2(Math.min(1, (0.88 + rnd() * 0.12) * fx(f))), Viagens: 300 + Math.floor(rnd() * 400),
    'Saídas com OS Crítica': rnd() < .4 ? 0 : Math.floor(rnd() * 6) }));
  o['checklist-t1'] = ['MACACU', 'CUIABA', 'PIRAI'].map(f => ({ Filial: f, 'Aderência Saída': r2(0.9 + rnd() * 0.1), Viagens: 200 + Math.floor(rnd() * 200) }));
  o['checklist-wh'] = ['CUIABA', 'CDD RIO DE JANEIRO', 'CDD PELOTAS'].map(f => ({ Filial: f, 'Aderência': r2(0.85 + rnd() * 0.15), 'Aderência Ponto': 0.5, Realizados: 50 + Math.floor(rnd() * 50) }));
  if (esc === 'ano') return o;   // o escopo 'ano' só tem os % por filial
  const placa = i => 'ABC' + String(1000 + i);
  o['stress-test-frota'] = []; o.civf = [];
  CDDS.forEach((f, j) => { for (let i = 0; i < 8; i++) {
    o['stress-test-frota'].push({ 'Filial Freightech': f, 'Placa Freightech': placa(j * 10 + i), Projeto: 'ROTA', Desconto: rnd() < .12 / fx(f) ? 150 : 0 });
    o.civf.push({ 'Filial Freightech': f, 'Veículo': placa(j * 10 + i), Projeto: 'ROTA', 'Desconto Total': rnd() < .1 ? 80 : 0 });
  } });
  o['stress-test-empilhadeira'] = [];
  ['CDD FLORIANOPOLIS', 'CDD PELOTAS', 'CDD RIO DE JANEIRO', 'CUIABA'].forEach((f, j) => { for (let i = 0; i < 4; i++)
    o['stress-test-empilhadeira'].push({ 'Filial GINFO': f, 'Placa Ginfo': 'EMP' + (3000 + j * 10 + i), Chassis: 'CH' + j + i, 'Desc. Total': rnd() < .2 ? 300 : 0 }); });
  o.pneus = TODAS.map(f => ({ Filial: f, 'Aferidos em 30 dias': 30 + Math.floor(rnd() * 10), Frota: 40 }));
  return o;
}
const ELITE = [];
for (const vig of VIGS) for (const esc of ['mes', 'ano']) for (const [indicador, data] of Object.entries(exportsDe(vig, esc)))
  ELITE.push({ indicador, vigencia: vig, escopo: esc, data });

const D = (m, d = 1) => `Date(2026,${m - 1},${d})`;
// ── gviz: Km/L (0 vig · 4 rem · 14 projeto · 20 combustível · 22 km · 23 litros · 25 total R$) ──
const PROJS = ['ROTA - BLC', 'ROTA - CBA', 'EMPURRADA - CBA', 'ROTA - CGR', 'ROTA - FLP', 'ROTA - GRL', 'VAN - GRL', 'ROTA - MCC', 'EMPURRADA - MCC',
  'ROTA - NFR', 'EMPURRADA - PIR', 'ROTA - PLT', 'ROTA - RON'];
const KML = [['Vigência', ...Array(25).fill('x')]];
for (let m = 1; m <= 8; m++) for (const p of PROJS) for (let k = 0; k < 3; k++) {
  const emp = p.startsWith('EMP'), van = p.startsWith('VAN');
  const rem = emp ? 2.0 : van ? 7 : 3.2, km = 2000 + Math.floor(rnd() * 6000), real = rem * (0.88 + rnd() * 0.2);
  const lit = Math.round(km / real);
  const row = Array(26).fill(null); row[0] = D(m); row[4] = rem; row[14] = p; row[20] = 'Diesel S10'; row[22] = km; row[23] = lit;
  row[25] = Math.round(lit * 6.1 * (0.97 + rnd() * 0.08) * 100) / 100;
  KML.push(row);
}
// ── gviz: R$/L (0 projeto · 3 data · 22 preço remunerado · 23 combustível) ──
const RSL = [];
for (let m = 1; m <= 8; m++) for (const p of PROJS) { const r = Array(24).fill(null); r[0] = p; r[3] = D(m); r[22] = 6.0 + rnd() * .3; r[23] = 'Diesel S10'; RSL.push(r); }
// ── gviz: DRE Frota (0 vig · 5 conta · 9 rem · 10 real), despesa NEGATIVA como na aba ──
const CONTAS = ['Combustíveis Veiculos e Equipamentos', 'Arla', 'Manutenção de Veículos e Equipamentos', 'Lavação de Veículos',
  'Pneus Novos', 'Consertos e Recapagens de Pneus', 'IPVA e Licenciamento de Veículos', 'Receita Líquida'];
const FROTA = [];
for (let m = 1; m <= 8; m++) for (const c of CONTAS) for (let u = 0; u < 4; u++) {
  const rem = -(20000 + rnd() * 80000), fat = c.startsWith('Manut') ? 1.09 : c.startsWith('Pneus') ? .9 : 1 + (rnd() - .5) * .04;
  const r = Array(11).fill(null); r[0] = D(m); r[5] = c; r[9] = Math.round(rem); r[10] = Math.round(rem * fat); FROTA.push(r);
}
// ── gviz: Dispersão de km (0 vig · 31 rem · 32 real) ──
const DISP = [];
for (let m = 1; m <= 8; m++) for (let k = 0; k < 13; k++) { const r = Array(33).fill(null); const rem = 40000 + rnd() * 50000; r[0] = D(m); r[31] = Math.round(rem); r[32] = Math.round(rem * (1.03 + rnd() * .07)); DISP.push(r); }
// ── gviz: DPO e Demarco (1ª linha = cabeçalho do semestre; código na col 0) ──
const DPO = [['Unidade', '1º Sem/2026', '2º Sem/2026'], ['BLC', 'Nível 3', 'Nível 3'], ['CBA', 'Nível 2', 'Nível 4'], ['GRL', 'Nível 3', 'Nível 2'],
  ['PEL', 'Nível 2', 'Nível 3'], ['RON', 'Nível 3', 'Nível 1'], ['NFR', 'Nível 4', 'Nível 4']];
const DEMARCO = [['Unidade', '1º Sem/2026', '2º Sem/2026'], ['BLC', 'Nível 2', 'Nível 1'], ['CBA', 'Nível 3', 'Nível 4'], ['GRL', 'Nível 2', 'Nível 2'],
  ['PEL', 'Nível 4', 'Nível 3'], ['RON', 'Nível 1', 'Nível 1'], ['MCC', 'Nível 2', 'Nível 3']];
// ── gviz: FCA Total (1 data · 7 prazo · 8 status) ──
const FCA = [];
for (let m = 1; m <= 8; m++) for (let k = 0; k < 9; k++) {
  const st = rnd() < .45 ? 'Concluído' : rnd() < .6 ? 'Em andamento' : 'Não iniciado';
  const r = Array(9).fill(null); r[1] = D(m, 3 + k); r[7] = D(Math.min(12, m + (rnd() < .5 ? 1 : 0)), 20); r[8] = st; FCA.push(r);
}
// ── gviz do gerot-base: aba Pneus do Frota de Elite e termômetro (mesmo formato do gerot-casca-teste) ──
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto'];
const PNEUS = [['Filial', 'Evento', 'Placa', 'Projeto', 'Período', 'Última Leitura', 'Status']];
for (let m = 0; m < 8; m++) TODAS.forEach((f, j) => { for (let i = 0; i < 6; i++)
  PNEUS.push([f, i % 2 ? 'CALIBRAGEM' : 'MILIMETRAGEM', 'P' + j + i, EMPS.includes(f) ? 'EMPURRADA' : 'ROTA', `${MESES[m]} de 2026`, null, rnd() < .1 / fx(f) ? 'Não Realizado' : 'Realizado']); });
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
const ABAS = { 'Km/L': KML, 'R$/L': RSL, Frota: FROTA, 'Dispersão de km': DISP, DPO, Demarco: DEMARCO, 'gid:216663799': FCA, Pneus: PNEUS, ...TERMO };
const BR = { 'CDD CAMBORIU': 24, 'CDD CUIABA': 1878, 'CUIABA': 1906, 'CUIABA EMPURRADA': 1907, 'CDD FLORIANOPOLIS': 20, 'CDD GUARULHOS': 30, 'CDD NOVA FRIBURGO': 2517,
  'CDD PELOTAS': 26, 'CDD RIO DE JANEIRO': 37, 'CDD RONDONOPOLIS': 2277, 'CDI MACACU': 1677, 'MACACU EMPURRADA': 1676, 'PIRAI EMPURRADA': 38 };
const TIRES = Object.values(BR).map(b => ({ branch_id: b, data: Array.from({ length: 12 }, (_, i) => ({ placa: 'X' + b + i, menorMM: 6 + rnd() * 6,
  amplitude: rnd() * 8, pressaoIdeal: 110, desvioPressao: (rnd() - .5) * 26 })) }));
// ── Base RPM em CSV (a reserva do painel quando o elite_snapshot falha) ──
const KPIS = ['IC: % de Disponibilidade Equipamentos', 'IC: % de Aderência às Preventivas', 'IC: Consumo Km/l', 'IC: % de Aderência às Aferições',
  'IC: Aderência ao Checklist - T1 e T2', 'IC: Aderência ao Checklist - Apoio', 'IC: % de conformidade da Frota', 'IC: Aderência ao Stress Test - Caminhões',
  'IC: Aderência ao Stress Test - Empilhadeiras', 'IC: SLA de atendimento', 'IC: Aderência à Conformidade'];
let CSV = 'Unidade,Vigência,KPI,% de Ating.\n';
for (let m = 1; m <= 6; m++) for (const u of TODAS) for (const k of KPIS)
  CSV += `${u},01/0${m}/2026,${k},"${(Math.min(100, (80 + rnd() * 25) * fx(u))).toFixed(1).replace('.', ',')}%"\n`;

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
        const gid = (n.src.match(/[?&]gid=(\d+)/) || [])[1];
        const rows = ABAS[aba] || (gid ? ABAS['gid:' + gid] : null);
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
    if (u.hostname === 'docs.google.com' && /\/export/.test(u.pathname) && u.searchParams.get('format') === 'csv')
      return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/csv' }, body: CSV });
    if (u.hostname === 'fonts.googleapis.com') {
      const css = FONT_DIR ? [400, 500, 600, 700, 800].flatMap(w => ['latin', 'latin-ext'].map(sub =>
        `@font-face{font-family:'Montserrat';font-style:normal;font-weight:${w};font-display:block;src:url(https://fonts.gstatic.com/m/montserrat-${sub}-${w}-normal.woff2) format('woff2');}`)).join('\n') : '';
      return r.fulfill({ status: 200, contentType: 'text/css', body: css });
    }
    if (u.hostname === 'fonts.gstatic.com') {
      const f = FONT_DIR && path.join(FONT_DIR, path.basename(u.pathname));
      if (f && fs.existsSync(f)) return r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.goto(`${ORIG}/${PASTA}/${htmlAntigo ? '__antigo.html' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelectorAll('#quad .box').length === 4 && /\d/.test(document.getElementById('hero').textContent), null, { timeout: 25000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(700);
  return { ctx, page, errs };
}

// o hero, os quatro quadrantes, o rodapé e o filtro — lidos igual nos dois lados
const leNumeros = () => {
  const h = document.getElementById('hero');
  const q = s => h.querySelector(s);
  const val = q('.hval') || q('.val');
  const out = {
    heroLbl: (q('.hlbl') || q('.lbl') || {}).textContent,
    hero: val && val.textContent, heroCor: val && val.style.color,
    heroSub: (q('.hero-sub') || q('.sub') || {}).textContent,
  };
  for (const c of ['pos', 'neg', 'at', 'next']) {
    const b = document.querySelector('#quad .box.' + c);
    out[c] = b ? [b.querySelector('h2').textContent, ...[...b.querySelectorAll('li, .empty')].map(li => (li.classList.contains('hl') ? '★ ' : '') + li.textContent.replace(/\s+/g, ' ').trim())] : null;
  }
  out.foot = document.getElementById('foot').textContent;
  const w = document.getElementById('ms-vig');
  out.filtro = w.querySelectorAll('.ms-opt input[data-v]').length + ':' + [...(w._sel || [])].join('/');
  return out;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

// 1 · números: antigo × novo, base e depois de filtros
console.log('\n══ números: antigo × novo ══');
const sel = (id, vals) => { const w = document.getElementById(id); w._sel.clear(); vals.forEach(v => w._sel.add(v)); if (w._render) w._render(''); atualizar(); };
const passos = {
  base: null,
  'Vigência mar/26': `(${sel})('ms-vig',['mar/26'])`,
  'Vigência jun/26': `(${sel})('ms-vig',['jun/26'])`,
  'Vigência jan→jun (média)': `(${sel})('ms-vig',['jan/26','fev/26','mar/26','abr/26','mai/26','jun/26'])`,
  'Vigência abr→ago (média)': `(${sel})('ms-vig',['abr/26','mai/26','jun/26','jul/26','ago/26'])`,
  'Todas as vigências': `(${sel})('ms-vig',[])`,
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
console.log(`  novo base: ${b.heroLbl} ${b.hero} (${b.heroCor}) · ${b.heroSub}`);
for (const c of ['pos', 'neg', 'at', 'next']) console.log('    ' + (b[c] || []).join('\n      '));
ok('hero com a Pontuação Geral da Frota', /^\d+,\d$/.test(b.hero || ''), b.hero);
ok('os quatro quadrantes têm frase (nenhum vazio na base)', ['pos', 'neg', 'at', 'next'].every(c => b[c] && b[c].length > 1 && !/Nada relevante/.test(b[c][1])));
ok('dados de todas as fontes chegaram (DPO, Demarco, FCA, custos, dispersão, R$/L)',
  [/DPO/, /Demarco/, /FCA/, /Custo/, /Dispersão de km/, /R\$\/L/].every(re => ['pos', 'neg', 'at', 'next'].some(c => b[c].some(t => re.test(t)))));
for (const nome of Object.keys(passos)) {
  const A = res.antigo[nome], N = res.novo[nome];
  for (const k of Object.keys(A)) {
    const igual = JSON.stringify(A[k]) === JSON.stringify(N[k]);
    ok(`igual antes × depois [${nome}]: ${k}`, igual, igual ? '' : `${JSON.stringify(A[k]).slice(0, 160)} × ${JSON.stringify(N[k]).slice(0, 160)}`);
  }
}
ok('filtro de vigência muda os números', res.novo['Vigência mar/26'].hero !== b.hero || JSON.stringify(res.novo['Vigência mar/26'].neg) !== JSON.stringify(b.neg));

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
      const quad = document.getElementById('quad'), boxes = [...quad.querySelectorAll('.box')];
      const r = quad.getBoundingClientRect(), vr = vw.getBoundingClientRect(), foot = document.getElementById('foot').getBoundingClientRect();
      const uls = boxes.map(bx => { const ul = bx.querySelector('ul'); return ul.scrollHeight > ul.clientHeight + 1; });
      const bg = getComputedStyle(boxes[0]).backgroundColor;
      return { id: vw.id, tit: document.getElementById('tit').textContent, sub: document.getElementById('titSub').textContent,
        pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
        vwRola: vw.scrollHeight > vw.clientHeight + 1, ulRola: uls, horiz: boxes.some(bx => bx.scrollWidth > bx.clientWidth + 1),
        grade: boxes.map(bx => { const b = bx.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }),
        k: (getComputedStyle(quad).getPropertyValue('--k') || '1').trim(), g: (getComputedStyle(quad).getPropertyValue('--g') || '1').trim(), quadH: Math.round(r.height), vwH: Math.round(vr.height), sobra: Math.round(vr.bottom - foot.bottom), bg,
        foraTela: foot.bottom > innerHeight + 1 };
    });
    ok(`${tag}: visão "Resumo Gerencial" abre`, m.id === 'vw-resumo' && m.tit === 'Resumo Gerencial');
    ok(`${tag}: subtítulo do topo = vigência · carga`, /^[A-Z]{3}\/\d{2} · Atualizado /.test(m.sub), m.sub);
    ok(`${tag}: página não rola`, !m.pagRola);
    ok(`${tag}: a visão não transborda`, !m.vwRola);
    // com o texto pesado destes dados: em 1600×900 tudo cabe; em 1366×768 a letra desce até o piso (80%)
    // e o que ainda sobrar rola DENTRO do quadrante (nunca a página)
    if (vp.width === 1600) ok(`${tag}: nenhum quadrante com barra (o texto cabe)`, !m.ulRola.some(Boolean), m.ulRola.join(',') + ' · g=' + m.g + ' k=' + m.k);
    else ok(`${tag}: só rola dentro do quadrante, e só depois de a letra chegar ao piso`, !m.ulRola.some(Boolean) || +m.k <= .8 + 1e-9, m.ulRola.join(',') + ' · g=' + m.g + ' k=' + m.k);
    ok(`${tag}: sem barra horizontal`, !m.horiz);
    // 2 × 2 alinhado: mesma largura nos quatro, mesma altura dentro de cada linha (a linha mais cheia pode ser mais alta)
    const p1 = (x, y) => Math.abs(x - y) <= 1;
    ok(`${tag}: quadrantes em 2×2 alinhados`, p1(m.grade[0][1], m.grade[1][1]) && p1(m.grade[2][1], m.grade[3][1]) && p1(m.grade[0][0], m.grade[2][0])
      && m.grade.every(g => p1(g[2], m.grade[0][2])) && p1(m.grade[0][3], m.grade[1][3]) && p1(m.grade[2][3], m.grade[3][3]), JSON.stringify(m.grade) + ' · k=' + m.k);
    ok(`${tag}: os quadrantes ficam com a maior parte da altura (≥ 70% da visão)`, m.quadH / m.vwH >= .7, `${m.quadH}/${m.vwH}`);
    ok(`${tag}: sem faixa vazia embaixo (≤ 4px)`, m.sobra <= 4, m.sobra + 'px');
    ok(`${tag}: nada fora da tela`, !m.foraTela);
    ok(`${tag}: quadrante é card da casca (fundo translúcido --side)`, /rgba\(/.test(m.bg), m.bg);
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
      ok('excel-export carregado (menu PNG)', exp.xls);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('ctrlk.js, gviz-cache.js, supabase-js e gerot-base.js continuam', ['ctrlk.js', 'gviz-cache.js', 'supabase-js', 'gerot-base.js'].every(n => exp.srcs.some(s => s.includes(n))));
      ok('filters-toggle.js saiu', !exp.srcs.some(s => s.includes('filters-toggle')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(B => { const b = (document.querySelector('meta[name=build]') || {}).content; return !!b && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + (document.querySelector('meta[name=build]') || {}).content)); }, BUILD));
      await page.click('#quad .box.neg h2', { button: 'right' }); await page.waitForTimeout(150);
      ok('clique direito no quadrante abre o menu PNG', await page.evaluate(() => { const m = document.getElementById('xl-menu'); return !!m && m.style.display !== 'none' && /PNG/.test(m.textContent); }));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      await page.click('#ms-vig .ms-btn'); await page.waitForTimeout(100);
      await page.evaluate(() => document.querySelector('#ms-vig .ms-only[data-v="mar/26"]').click());
      await page.waitForTimeout(200);
      const cnt = await page.evaluate(() => { const c = document.querySelector('#ms-vig .ms-cnt'); return [getComputedStyle(c).display, c.textContent, document.getElementById('titSub').textContent]; });
      ok('contagem laranja do filtro aparece', cnt[0] !== 'none' && cnt[1] === '1', cnt.join(' · '));
      ok('o filtro pelo clique muda o recorte do subtítulo', /^MAR\/26 · /.test(cnt[2]), cnt[2]);
      await page.mouse.click(5, 5);
      ok('contrato do Check de Metas: ms-vig com _sel (Set) + _render, atualizar/carregar', await page.evaluate(() => { const w = document.getElementById('ms-vig'); return w._sel instanceof Set && typeof w._render === 'function' && typeof atualizar === 'function' && typeof carregar === 'function'; }));
      await page.click('#btMini'); await page.waitForTimeout(300);
      ok('lateral recolhe e guarda resumo_executivo_mini', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('resumo_executivo_mini') === '1'));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'resumo-mini-filtro.png') });
      await page.evaluate(() => { localStorage.setItem('resumo_executivo_mini', '0'); setCarga('x'); });
      await page.evaluate(() => carregar()); await page.waitForTimeout(1200);
      ok('Atualizar dados: subtítulo "… · Atualizado …"', await page.evaluate(() => / · Atualizado /.test(document.getElementById('titSub').textContent)));
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}

// 3 · elite_snapshot fora do ar: os ICs caem para a Base RPM (CSV) — igual nos dois lados
{
  const lados = {};
  for (const lado of ['antigo', 'novo']) {
    const { ctx, page, errs } = await abre(browser, lado === 'antigo' ? htmlAntigo : null, { width: 1366, height: 768 }, 'dark', true);
    lados[lado] = { ...(await page.evaluate(leNumeros)), errs };
    await ctx.close();
  }
  ok('banco fora: a reserva Base RPM (CSV) traz a pontuação', /^\d+,\d$/.test(lados.novo.hero || ''), lados.novo.hero + ' · ' + lados.novo.heroSub);
  ok('banco fora: antigo × novo iguais (hero, quadrantes, filtro)', JSON.stringify({ ...lados.antigo, errs: 0 }) === JSON.stringify({ ...lados.novo, errs: 0 }));
  ok('banco fora: zero erro de página no novo', lados.novo.errs.length === 0, lados.novo.errs.join(' / '));
}

// 3b · Check de Metas: o slide é FOTO do painel (P(...,{foto:true})). Roda o MESMO helper __cm do
//      check-metas/index.html no iframe do tamanho do palco (1760×866), tema claro: filtro pelo contrato
//      (__cm.sel + atualizar), alvo padrão (.vw.on), __cm.abre — e nada pode ficar cortado.
{
  const cm = fs.readFileSync(path.join(RAIZ, 'check-metas/index.html'), 'utf8');
  const i = cm.indexOf('const CM_HELPER=`') + 17, j = cm.indexOf('`;\n', i);
  const HELPER = new Function('return `' + cm.slice(i, j) + '`')();
  ok('check-metas: o roteiro fotografa o Resumo Executivo (foto:true)', /P\('Resumo Executivo'[\s\S]{0,200}\{foto:true\}\)\)/.test(cm));
  const { ctx, page, errs } = await abre(browser, null, { width: 1760, height: 866 }, 'dark');
  const r = await page.evaluate(H => {
    (0, eval)(H);
    aplicaTema('light');
    __cm.faltou = []; __cm.sel('ms-vig', ['jul/26|2026-07|JUL/26|jul/2026|07/2026']); atualizar();
    const alvo = document.querySelector('.vw.on');
    __cm.topo(alvo); const h = __cm.abre(alvo);
    const cortado = [...alvo.querySelectorAll('*')].filter(n => n.scrollHeight > n.clientHeight + 2 && getComputedStyle(n).overflowY !== 'visible').length;
    const boxes = [...alvo.querySelectorAll('#quad .box')].map(b => Math.round(b.getBoundingClientRect().height));
    const ultimo = [...alvo.querySelectorAll('#quad li')].pop().getBoundingClientRect().bottom <= alvo.getBoundingClientRect().bottom + 1;
    return { faltou: __cm.faltou, h, cortado, boxes, ultimo, sub: document.getElementById('titSub').textContent, hero: document.querySelector('#hero .hval').textContent };
  }, HELPER);
  ok('check-metas: filtro da vigência casou (sem aviso)', r.faltou.length === 0 && /^JUL\/26 · /.test(r.sub), r.faltou.join(' / ') + ' · ' + r.sub);
  ok('check-metas: depois do __cm.abre nada fica cortado no alvo', r.cortado === 0 && r.ultimo && r.boxes.every(x => x > 80), `cortados ${r.cortado} · caixas ${r.boxes.join(',')} · alvo ${r.h}px`);
  if (SHOTS) await (await page.$('.vw.on')).screenshot({ path: path.join(SHOTS, PASTA, 'check-metas-foto.png') });
  await page.evaluate(() => __cm.fecha());
  ok('check-metas: zero erro de página', errs.length === 0, errs.join(' / '));
  await ctx.close();
}

// 4 · celular: a página volta a rolar e os quadrantes empilham com altura
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  const m = await page.evaluate(() => ({ rola: /auto|scroll/.test(getComputedStyle(document.body).overflowY) && getComputedStyle(document.querySelector('.app')).position === 'static',
    hs: [...document.querySelectorAll('#quad .box')].map(b => Math.round(b.getBoundingClientRect().height)),
    col: new Set([...document.querySelectorAll('#quad .box')].map(b => Math.round(b.getBoundingClientRect().left))).size,
    corta: [...document.querySelectorAll('#quad .box ul')].some(u => u.scrollHeight > u.clientHeight + 1) }));
  ok('celular: página livre para rolar, quadrantes empilhados com altura', m.rola && m.col === 1 && m.hs.every(h => h > 80) && !m.corta, m.hs.join(','));
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular.png'), fullPage: true });
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
