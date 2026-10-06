// Migração da Gestão de Pneus (pneus/painel.html) para a casca padrão do portal —
// conferida no Chromium, nos DOIS lados (HTML antigo × novo, mesmos dados).
//
// O painel lê o snapshot do Prolog no Supabase por fetch (tabela `snapshot`, uma
// linha por endpoint × branch_id: vehicles, tires, inspections), o histórico mensal
// (`historico_mensal`) e o km/dia da aba Km/L do combustível pelo gviz. Os três são
// dublados aqui com uma frota sintética (5 unidades, 3 tipos de veículo, aferições
// mensais de jan a out/2026, PIR com odômetro 9999999 para cair no km/dia do
// abastecimento). O IndexedDB nasce vazio em cada contexto, então os dois lados
// buscam na "rede".
//
// O que se prova:
//  1. Para cada ?page=<x> do hub de Pneus (saude, painel, milimetragem, pressao,
//     cpk, previsao, desgaste, orcamento, eixos): o painel novo abre na visão certa
//     (saude → Resumo Gerencial) e TODOS os números — hero, cards, tabelas, laudo,
//     orçamento e os dados dos gráficos — saem iguais aos do antigo. Depois de um
//     filtro (Unidade = PIR) e dos drills/métricas/buscas, de novo iguais.
//  2. Casca: zero erro de página, nenhuma rolagem da página nem da visão e nenhuma
//     barra horizontal nas tabelas em 1366×768 e 1600×900, lateral cabendo,
//     tema claro (body.claro + bi_theme) redesenhando os gráficos, contagem laranja
//     do filtro aparecendo, PDF na lateral, Excel carregado.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show 3daea6e:pneus/painel.html > <scratch>/antigo.html   (o último antes da casca)
//   cp scripts/pneus-painel-casca-teste.mjs docs/driverpro-apresentacao/_pneus-painel-casca.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento ANTIGO=<scratch>/antigo.html \
//     CDN_DIR=<pasta com chart.umd.js e chartjs-plugin-datalabels.js> H2C=<html2canvas.min.js> \
//     FONTE_DIR=<woff2 da Montserrat> SHOTS=<pasta> node _pneus-painel-casca.mjs ; rm _pneus-painel-casca.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGO = process.env.ANTIGO;
const CDN = process.env.CDN_DIR || '';
const H2C = process.env.H2C || '';
const FONTE = process.env.FONTE_DIR || '';
const SHOTS = process.env.SHOTS || '';
const ORIG = 'http://gem.teste';

/* ── frota sintética no formato do pneus-loader.mjs ── */
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = a => a[Math.floor(rnd() * a.length)];
const BRANCHES = { 38: 'PIR', 37: 'CGR', 30: 'GRL', 1677: 'MCC T2', 26: 'PLT' };
const TIPOS = {
  'CAMINHÃO TOCO': [[111, '1E', 1], [121, '1D', 1], [211, '2EE'], [212, '2EI'], [221, '2DI'], [222, '2DE']],
  'CAMINHÃO TRUCK': [[111, '1E', 1], [121, '1D', 1], [211, '2EE'], [212, '2EI'], [221, '2DI'], [222, '2DE'], [311, '3EE'], [312, '3EI'], [321, '3DI'], [322, '3DE']],
  'SEMI REBOQUE 3 EIXOS': [[111, '1EE'], [112, '1EI'], [121, '1DI'], [122, '1DE'], [211, '2EE'], [212, '2EI'], [221, '2DI'], [222, '2DE'], [311, '3EE'], [312, '3EI'], [321, '3DI'], [322, '3DE']],
};
const MARCAS = ['Goodyear', 'Bridgestone', 'Pirelli', 'Firestone'];
const MODELOS = { Goodyear: 'KMAX S', Bridgestone: 'M729', Pirelli: 'FR85', Firestone: 'T831' };
const BANDAS = [['Vipal', 'VZY'], ['Bandag', 'BDR-HG'], ['Recamax', 'RX300']];
const SNAP = {}; const KML = [];
let vid = 100, tid = 5000;
const AGORA = new Date();
for (const [bid, uni] of Object.entries(BRANCHES)) {
  const vehicles = [], tires = [], inspections = [];
  for (let k = 0; k < 14; k++) {
    const tipo = Object.keys(TIPOS)[k % 3];
    const marcaV = pick(['VW', 'MERCEDES-BENZ', 'VOLVO']);
    const v = { id: ++vid, placa: `${uni.replace(/\W/g, '').slice(0, 3)}${k}A${10 + k}`, frota: String(9000 + vid), tipo, marca: marcaV,
      modelo: marcaV + ' ' + pick(['24.280', '17.230', 'FH 460']), odometro: 0, pneusInstalados: TIPOS[tipo].length, pneusEsperados: TIPOS[tipo].length };
    vehicles.push(v);
    if (uni === 'PIR') KML.push({ cidade: 'PIRAI', placa: v.placa, modelo: v.modelo, km: 4000 + Math.round(rnd() * 6000) });
    // última aferição: em dia, em atenção, vencida ou nunca (k % 7 === 6)
    const semAfericao = k % 7 === 6;
    const ultimoMes = k % 4 === 0 ? 7 : k % 4 === 1 ? 8 : 9;            // ago, set, out
    const vehTires = TIPOS[tipo].map(([posicao, nomePosicao, dir]) => {
      const marca = pick(MARCAS); const ciclo = 1 + Math.floor(rnd() * 4); const banda = ciclo > 1 ? pick(BANDAS) : ['', ''];
      const custo = ciclo > 1 ? 700 + Math.round(rnd() * 600) : 1500 + Math.round(rnd() * 900);
      const km = 15000 + Math.round(rnd() * 90000);
      return { id: ++tid, serial: String(900000 + tid), status: 'INSTALLED', marca, modelo: MODELOS[marca], sulcos: 4,
        medida: pick(['295/80 R22.5', '275/80 R22.5']), cicloVida: ciclo, maxCiclos: 5, banda: banda[1], bandaMarca: banda[0],
        dot: String(10 + Math.floor(rnd() * 40)).padStart(2, '0') + String(19 + Math.floor(rnd() * 7)),
        mm0: 9 + rnd() * 7, pressaoIdeal: 110, custo, kmRodados: km, cpk: +(custo / km).toFixed(4),
        veiculoId: v.id, placa: v.placa, frota: v.frota, posicao, nomePosicao, direcional: !!dir, criadoEm: '2025-01-01' };
    });
    let odo = 100000 + Math.round(rnd() * 200000);
    const ultimas = {};
    if (!semAfericao) for (let m = 0; m <= ultimoMes; m++) {
      const dia = m === 9 ? 1 + (k % 4) : 3 + Math.floor(rnd() * 22);
      const quando = new Date(2026, m, dia, 10, 0, 0);
      if (quando > AGORA) continue;
      odo += 6000 + Math.round(rnd() * 5000);
      const odoGravado = uni === 'PIR' ? 9999999 : odo;
      vehTires.forEach((t, j) => {
        const desg = (0.35 + (j % 3) * 0.12) * (1 + rnd() * 0.2);
        const base = Math.max(0.8, t.mm0 - desg * (m + 1));
        const mm = [0, 1, 2, 3].map(q => +(base + rnd() * (q === 1 && j % 5 === 0 ? 6 : 1.2)).toFixed(2));
        const menor = +Math.min(...mm).toFixed(2), amplitude = +(Math.max(...mm) - menor).toFixed(2);
        const pMed = Math.round(110 * (0.78 + rnd() * 0.42));
        const desvio = +(((pMed - 110) / 110) * 100).toFixed(2);
        const insp = { inspecaoId: vid * 100 + m, veiculoId: v.id, placa: v.placa, frota: v.frota, dataInspecao: quando.toISOString(),
          dias: Math.floor((AGORA - quando) / 864e5), aderencia: 'No Prazo', odometro: odoGravado, inspetor: 'Teste',
          tireId: t.id, serial: t.serial, posicao: t.posicao, mm1: mm[0], mm2: mm[1], mm3: mm[2], mm4: mm[3], menorMM: menor, amplitude,
          pressaoIdeal: 110, pressaoMedida: pMed, desvioPressao: desvio, pressaoNOK: Math.abs(desvio) > 15 };
        inspections.push(insp); ultimas[t.id] = insp;
      });
    }
    v.odometro = odo;
    vehTires.forEach(t => {
      const u = ultimas[t.id]; delete t.mm0;
      const mm = u ? [u.mm1, u.mm2, u.mm3, u.mm4] : [12, 12.4, 12.2, 12.1];
      const menor = Math.min(...mm), amplitude = +(Math.max(...mm) - menor).toFixed(2);
      const pAtual = u ? u.pressaoMedida : 108, desvio = +(((pAtual - 110) / 110) * 100).toFixed(2);
      Object.assign(t, { mm1: mm[0], mm2: mm[1], mm3: mm[2], mm4: mm[3], menorMM: menor, amplitude,
        statusMM: menor < 2 ? 'Bloquear' : menor <= 3 ? 'Recapar' : menor <= 6 ? 'Regular' : 'Bom Estado',
        pressaoAtual: pAtual, desvioPressao: desvio, pressaoNOK: Math.abs(desvio) > 10 });
      tires.push(t);
    });
  }
  for (let s = 0; s < 4; s++) tires.push({ id: ++tid, serial: String(900000 + tid), status: 'INVENTORY', marca: pick(MARCAS), modelo: 'X', cicloVida: 1, maxCiclos: 5,
    banda: '', bandaMarca: '', dot: '1225', mm1: 15, mm2: 15, mm3: 15, mm4: 15, menorMM: 15, amplitude: 0, statusMM: 'Bom Estado', pressaoIdeal: 0, pressaoAtual: 0,
    desvioPressao: 0, pressaoNOK: false, cpk: 0, kmRodados: 0, custo: 1900, veiculoId: null, placa: '', frota: '', posicao: null, nomePosicao: '', direcional: false, medida: '295/80 R22.5' });
  // uma paleteira (o painel tira do ar veículo, pneus e aferições dela)
  vehicles.push({ id: ++vid, placa: 'PAL' + bid, frota: '1', tipo: 'PALETEIRA ELETRICA', marca: 'X', modelo: 'Y', odometro: 0 });
  SNAP[bid] = [
    { endpoint: 'vehicles', branch_id: +bid, data: vehicles, updated_at: '2026-10-06T09:00:00Z' },
    { endpoint: 'tires', branch_id: +bid, data: tires, updated_at: '2026-10-06T09:00:00Z' },
    { endpoint: 'inspections', branch_id: +bid, data: inspections, updated_at: '2026-10-06T09:00:00Z' },
  ];
}
const cell = v => v == null ? null : { v };
const GVIZ_KML = 'google.visualization.Query.setResponse(' + JSON.stringify({ status: 'ok', table: { cols: [], rows: KML.map(r => {
  const c = Array(26).fill(null); c[15] = cell(r.cidade); c[16] = cell(r.placa); c[19] = cell(r.modelo); c[22] = cell(r.km); return { c };
}) } }) + ');';

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra !== '' ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
const htmlAntigo = ANTIGO ? fs.readFileSync(ANTIGO, 'utf8') : null;

async function abre(browser, { antigo = false, page: pg = null, vp = { width: 1600, height: 900 }, tema = 'dark' } = {}) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.dismiss());
  await page.addInitScript(({ tema }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_theme', tema);
    localStorage.setItem('pneus_theme', tema);
  }, { tema });
  await page.route('**/*', async r => {
    const req = r.request(), u = new URL(req.url());
    if (u.origin === ORIG) {
      if (u.pathname === '/pneus/__antigo.html') return r.fulfill({ status: 200, contentType: 'text/html;charset=utf-8', body: htmlAntigo });
      if (u.pathname.startsWith('/__fonte/')) return r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(FONTE, path.basename(u.pathname))) });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'cdn.jsdelivr.net') {
      if (u.pathname.includes('chart.js') && CDN) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(CDN, 'chart.umd.js')) });
      if (u.pathname.includes('datalabels') && CDN) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(CDN, 'chartjs-plugin-datalabels.js')) });
      if (u.pathname.includes('html2canvas') && H2C) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(H2C) });
    }
    if (u.hostname.endsWith('supabase.co')) {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors, body: '' });
      const json = b => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(b) });
      if (u.pathname.endsWith('/snapshot')) {
        const bid = (u.searchParams.get('branch_id') || '').replace('eq.', '');
        return json(SNAP[bid] || []);
      }
      return json([]);
    }
    if (u.hostname === 'docs.google.com') return r.fulfill({ status: 200, contentType: 'text/plain', body: GVIZ_KML });
    if (u.hostname === 'fonts.googleapis.com') return r.fulfill({ status: 200, contentType: 'text/css', body: !FONTE ? '' :
      [400, 500, 600, 700, 800].map(w => `@font-face{font-family:'Montserrat';font-style:normal;font-weight:${w};src:url(${ORIG}/__fonte/montserrat-latin-${w}-normal.woff2) format('woff2');}`).join('\n') });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  const q = pg ? '?page=' + pg : '';
  await page.goto(`${ORIG}/pneus/${antigo ? '__antigo.html' : 'painel.html'}${q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const e = document.getElementById('lastUpdate'); const o = document.getElementById('loadingOverlay');
    return e && /\d{2}\/\d{2}\/\d{4}/.test(e.textContent) && o && o.classList.contains('hidden'); }, null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(700);
  return { ctx, page, errs };
}

/* números da tela — os mesmos ids nos dois lados */
const IDS = ('saudeScore saudePneus saudeVeiculos scMM scMMSub scVida scVidaSub scRecapes scAmplitude scCalibragem saudeLegend thDrill ' +
  'adhValue adhTotalVeic adhDeltaPrazo adhDeltaAtencao adhDeltaVencida adhDeltaSemAfer ' +
  'mmHeroVal mmHeroCluster mmCardTotal mmCardBloquear mmCardRecapar mmCardRegular mmCardBom mmCardIrregular mmCardIrregularSub ' +
  'prHeroVal prCardTotal prCardTotalSub prCardOK prCardBaixa prCardAlta prCardDesvio ' +
  'cpkHeroVal cpkCardPneus cpkCardCusto cpkCardKm cpkCardMelhor cpkCardMelhorSub cpkCardPior cpkCardPiorSub thCpkDrill ' +
  'prevHeroVal prevDeltaJa prevDelta30 prevDelta60 prevDelta90 prevCardProj prevCardProjSub prevCardJa prevCard30 prevCard90 prevCardDesg ' +
  'dsgHeroVal dsgDeltaG dsgDeltaY dsgDeltaR dsgCardN dsgCardNSub dsgCardMed dsgCardMdn dsgCardMelhor dsgCardMelhorSub dsgCardPior dsgCardPiorSub thDsgDrill ' +
  'orcTotal orcNota').split(' ');
const TBODIES = 'tbodySaudeRanking tbodyAdhMM tbodyAdhCalib tbodyMM tbodyPressao tbodyCpk tbodyPrev tbodyDsg orcTable eixosPior eixosSugestao eixosTexto eixosCompat'.split(' ');
const CHARTS = 'chartSaudeMensal chartMensal chartUnidade chartMMMensal chartAmpMensal chartPressaoMensal chartDesvioMensal chartCalibUnidade chartPrevMensal chartDsgMensal chartOrcRecapes chartOrcNovos'.split(' ');
const leNumeros = ({ IDS, TBODIES, CHARTS }) => {
  const out = {};
  // texto + a cor que o JS pinta inline (orcNota: a cor vinha do style fixo do HTML antigo, só o texto conta)
  IDS.forEach(id => { const e = document.getElementById(id); out[id] = e ? e.textContent.replace(/\s+/g, ' ').trim() + (id === 'orcNota' ? '' : ' |' + (e.style.color || '')) : null; });
  TBODIES.forEach(id => { const e = document.getElementById(id); out[id] = e ? e.textContent.replace(/\s+/g, ' ').trim() : null; out[id + '#n'] = e ? e.querySelectorAll('tr').length : null; });
  CHARTS.forEach(id => {
    const c = document.getElementById(id); const k = c && window.Chart && Chart.getChart(c);
    // 4 casas: a idade pelo DOT conta a partir de "agora", então duas aberturas diferem no 8º dígito
    const r4 = v => typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v;
    out[id] = k ? JSON.stringify([k.data.labels, k.data.datasets.map(d => [d.label, (d.data || []).map(r4), d.backgroundColor])]) : null;
  });
  return out;
};
const comparaTudo = (titulo, a, b) => {
  const dif = Object.keys(a).filter(k => a[k] !== b[k]);
  const cheios = Object.keys(a).filter(k => a[k] && !/^—/.test(a[k]) && a[k] !== 'null').length;
  ok(`${titulo}: ${Object.keys(a).length} leituras iguais (${cheios} com valor)`, dif.length === 0,
    dif.length ? dif.map(k => `${k}: antigo=${String(a[k]).slice(0, 140)} · novo=${String(b[k]).slice(0, 140)}`).join(' ;; ') : '');
};
// mexe nos controles que existem nos dois lados (mesmas funções globais)
const mexe = async (page) => page.evaluate(() => {
  onlyFilter('branch', 'PIR');
  const q = s => document.querySelector(s);
  setSaudeDrill('placa', q('[data-drill=placa]'));
  setSaudeMetric('mm', q('[data-met=mm]'));
  setCpkDrill('marca', q('[data-cpkdrill=marca]'));
  setDsgDrill('marca', q('[data-dsgdrill=marca]'));
  const s = q('#searchMM'); if (s) { s.value = 'PIR'; filtrarMM(); }
  const p = q('#searchPrev'); if (p) { p.value = '9000'; filtrarPrev(); }
});

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const PAGINAS = { saude: 'resumo', painel: 'aderencia', milimetragem: 'milimetragem', pressao: 'pressao', cpk: 'cpk',
  previsao: 'previsao', desgaste: 'desgaste', orcamento: 'orcamento', eixos: 'eixos' };

console.log('\n══ ?page=<x>: abre a visão certa e os números batem com o antigo ══');
for (const [pg, vw] of Object.entries(PAGINAS)) {
  const A = await abre(browser, { antigo: true, page: pg });
  const N = await abre(browser, { page: pg });
  const vwOn = await N.page.evaluate(() => (document.querySelector('.vw.on') || {}).id);
  const itemOn = await N.page.evaluate(() => (document.querySelector('.s-item.on') || {}).dataset?.vw);
  ok(`?page=${pg} abre a visão ${vw}`, vwOn === 'vw-' + vw && itemOn === vw, `${vwOn} · item ${itemOn}`);
  const a = await A.page.evaluate(leNumeros, { IDS, TBODIES, CHARTS });
  const b = await N.page.evaluate(leNumeros, { IDS, TBODIES, CHARTS });
  comparaTudo(`?page=${pg} · base`, a, b);
  await mexe(A.page); await mexe(N.page);
  await A.page.waitForTimeout(300); await N.page.waitForTimeout(300);
  const a2 = await A.page.evaluate(leNumeros, { IDS, TBODIES, CHARTS });
  const b2 = await N.page.evaluate(leNumeros, { IDS, TBODIES, CHARTS });
  comparaTudo(`?page=${pg} · Unidade=PIR + drills + buscas`, a2, b2);
  if (pg === 'saude') {
    ok('o filtro muda o número (Saúde, PIR ≠ todas)', a.saudeScore !== a2.saudeScore || a.saudePneus !== a2.saudePneus, `${a.saudePneus} → ${a2.saudePneus}`);
    const cnt = await N.page.evaluate(() => { const c = document.getElementById('cnt-branch'); return [c.style.display, c.textContent, getComputedStyle(c).display]; });
    ok('contagem laranja do filtro aparece (inline-block)', cnt[0] === 'inline-block' && cnt[1] === '1' && cnt[2] !== 'none', cnt.join(' · '));
    ok('a tabela de Saúde tem linhas', b.tbodySaudeRanking && b['tbodySaudeRanking#n'] > 2, b['tbodySaudeRanking#n']);
  }
  ok(`?page=${pg}: zero erro de página no novo`, N.errs.length === 0, N.errs.slice(0, 2).join(' | '));
  if (A.errs.length) console.log('    (antigo teve erro: ' + A.errs.slice(0, 2).join(' | ') + ')');
  await A.ctx.close(); await N.ctx.close();
}
{
  const N = await abre(browser, { page: 'naoexiste' });
  ok('?page desconhecida cai no Resumo Gerencial', await N.page.evaluate(() => document.querySelector('.vw.on').id) === 'vw-resumo');
  await N.ctx.close();
}

console.log('\n══ casca: cada visão sem rolagem, tabelas sem barra lateral ══');
// cada card do hub é um painel: o menu lateral mostra SÓ as visões da página (Renan, 06/10/2026)
const VIEWS_PG = { saude: ['resumo', 'saude-bottom'], painel: ['aderencia', 'adh-tabelas'], milimetragem: ['milimetragem', 'mm-bottom'],
  pressao: ['pressao', 'pressao-bottom'], cpk: ['cpk'], previsao: ['previsao', 'prev-bottom'],
  desgaste: ['desgaste', 'dsg-ranking'], orcamento: ['orcamento'], eixos: ['eixos', 'laudo', 'compat'] };
const NOME_PG = { saude: 'Saúde dos Pneus', painel: 'Aderência às Aferições', milimetragem: 'Milimetragem', pressao: 'Pressão',
  cpk: 'CPK — Custo por Km', previsao: 'Previsão de Troca', desgaste: 'Desgaste — mm/1.000km', orcamento: 'Previsão Orçamentária', eixos: 'Visão de Eixos' };
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of (vp.width === 1600 ? ['dark', 'light'] : ['dark'])) {
   for (const [pg, VIEWS] of Object.entries(VIEWS_PG)) {
    const N = await abre(browser, { vp, tema, page: pg });
    const menu = await N.page.evaluate(() => [...document.querySelectorAll('.s-item[data-vw]')].map(b => b.dataset.vw));
    ok(`${vp.width} ${tema} · ?page=${pg}: o menu lateral só tem as visões do painel`, JSON.stringify(menu) === JSON.stringify(VIEWS), menu.join(','));
    const marca = await N.page.evaluate(() => [document.querySelector('.s-top b').textContent, document.title, document.querySelector('.s-item[data-vw]').textContent.trim()]);
    ok(`${vp.width} ${tema} · ?page=${pg}: nome do painel na lateral e 1º item "Resumo Gerencial"`, marca[0] === NOME_PG[pg] && marca[1].startsWith(NOME_PG[pg]) && marca[2] === 'Resumo Gerencial', marca.join(' · '));
    const lado = await N.page.evaluate(() => { const s = document.querySelector('.side'); return [s.scrollHeight, s.clientHeight]; });
    ok(`${vp.width}×${vp.height} ${tema}: a lateral cabe sem rolar`, lado[0] <= lado[1] + 1, lado.join(' / '));
    const tit = [];
    for (const v of VIEWS) {
      await N.page.evaluate(v => setVw(v), v);
      await N.page.waitForTimeout(v === VIEWS[0] ? 450 : 350);
      const m = await N.page.evaluate(() => {
        const vw = document.querySelector('.vw.on'); const se = document.scrollingElement;
        const tw = [...vw.querySelectorAll('.twrap')].map(w => [w.scrollWidth, w.clientWidth, w.clientHeight]);
        const cv = [...vw.querySelectorAll('canvas')].map(c => c.getBoundingClientRect().height);
        const cards = [...vw.querySelectorAll('.saude-card')].map(c => c.getBoundingClientRect().height);
        const fora = [...vw.querySelectorAll('.card,.saude-card,.adh-hero,.twrap')].filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.bottom > innerHeight - 10; }).length;
        return { pag: [se.scrollHeight, innerHeight], vw: [vw.scrollHeight, vw.clientHeight], tw, cv, cards, fora, tit: document.getElementById('tit').textContent };
      });
      tit.push(m.tit);
      const semRol = m.pag[0] <= m.pag[1] + 1 && m.vw[0] <= m.vw[1] + 1 && m.fora === 0;
      const semHoriz = m.tw.every(([sw, cw]) => sw <= cw + 1);
      const tabAlta = m.tw.every(([, , ch]) => ch >= 120);
      const cvOk = m.cv.every(h => h >= 110);
      ok(`${vp.width}×${vp.height} ${tema} · ${v}: sem rolagem${m.tw.length ? ', tabela sem barra lateral e com altura' : ''}${m.cv.length ? ', gráficos com altura' : ''}`,
        semRol && semHoriz && tabAlta && cvOk, `pág ${m.pag.join('/')} · visão ${m.vw.join('/')} · twrap ${JSON.stringify(m.tw)} · canvas ${m.cv.map(Math.round).join(',')} · cards ${m.cards.map(Math.round).join(',')}`);
      if (SHOTS && (vp.width === 1600 || tema === 'dark')) await N.page.screenshot({ path: path.join(SHOTS, `${vp.width}-${tema}-${pg}-${v}.png`) });
    }
    ok(`${vp.width} ${tema} · ?page=${pg}: primeira visão = "Resumo Gerencial"`, tit[0] === 'Resumo Gerencial', tit[0]);
    if (pg !== 'saude') { await N.ctx.close(); continue; }
    if (vp.width === 1600 && tema === 'dark') {
      // tema claro: classe, chave e gráficos redesenhados
      await N.page.evaluate(() => setVw('resumo')); await N.page.waitForTimeout(300);
      const antes = await N.page.evaluate(() => Chart.getChart(document.getElementById('chartSaudeMensal')).options.scales.x.ticks.color);
      await N.page.evaluate(() => trocaTema()); await N.page.waitForTimeout(400);
      const depois = await N.page.evaluate(() => [document.body.classList.contains('claro'), localStorage.getItem('bi_theme'),
        Chart.getChart(document.getElementById('chartSaudeMensal')).options.scales.x.ticks.color, document.body.classList.contains('light-mode')]);
      ok('trocaTema: body.claro + bi_theme=light e o gráfico redesenha com a cor do claro', depois[0] && depois[1] === 'light' && depois[2] !== antes && !depois[3], `${antes} → ${depois[2]}`);
      // lateral recolhida
      await N.page.evaluate(() => trocaMini()); await N.page.waitForTimeout(350);
      const mini = await N.page.evaluate(() => [document.querySelector('.side').classList.contains('mini'), localStorage.getItem('pneus_mini')]);
      ok('lateral recolhe (pneus_mini)', mini[0] && mini[1] === '1');
      await N.page.evaluate(() => trocaMini());
      const at = await N.page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'), h2c: !!window.H2CPrep,
        pdfFn: typeof initPdfExport, sort: !!document.querySelector('table.dre th'), refresh: !!document.querySelector('#btnRefresh.s-item'),
        build: document.querySelector('meta[name=build]').content, bc: [...document.scripts].some(s => /build-check\.js\?v=202610070700/.test(s.src)) }));
      ok('PDF na lateral (Atalhos), Excel/PNG carregado, Atualizar na lateral', at.pdf && at.h2c && at.pdfFn === 'function' && at.refresh, JSON.stringify(at));
      ok('build 202610070700 no <meta> e no build-check', at.build === '202610070700' && at.bc);
      ok(`${vp.width} ${tema}: zero erro de página`, N.errs.length === 0, N.errs.slice(0, 2).join(' | '));
    }
    await N.ctx.close();
   }
  }
}

console.log('\n══ celular (390×844) ══');
{
  const N = await abre(browser, { vp: { width: 390, height: 844 } });
  const m = await N.page.evaluate(() => ({ rola: Math.max(document.scrollingElement.scrollHeight, document.body.scrollHeight) > innerHeight && getComputedStyle(document.body).overflowY !== "hidden",
    cv: Chart.getChart(document.getElementById('chartSaudeMensal')).height, larg: document.scrollingElement.scrollWidth <= innerWidth + 1 }));
  ok('celular: a página rola, o gráfico tem altura e não há barra lateral na página', m.rola && m.cv > 150 && m.larg, JSON.stringify(m));
  const N2 = await abre(browser, { vp: { width: 390, height: 844 }, page: 'milimetragem' });
  await N2.page.evaluate(() => setVw('mm-bottom')); await N2.page.waitForTimeout(300);
  const t = await N2.page.evaluate(() => [document.querySelector('#vw-mm-bottom .twrap').getBoundingClientRect().height, getComputedStyle(document.querySelector('#vw-mm-bottom .row-toggle')).display]);
  ok('celular: a tabela do Menor Sulco aparece com o "+" de detalhar', t[0] > 200 && t[1] !== 'none', t.join(' · '));
  if (SHOTS) await N2.page.screenshot({ path: path.join(SHOTS, 'mobile-mm-bottom.png') });
  await N2.ctx.close();
  ok('celular: zero erro de página', N.errs.length === 0, N.errs.slice(0, 2).join(' | '));
  await N.ctx.close();
}

// scripts antigo × novo
const srcs = h => [...h.matchAll(/<script src="([^"]+)"/g)].map(m => m[1].replace(/\?.*$/, '').replace(/^.*\//, ''));
const sa = new Set(srcs(htmlAntigo)), sn = new Set(srcs(fs.readFileSync(path.join(RAIZ, 'pneus/painel.html'), 'utf8')));
const faltam = [...sa].filter(s => !sn.has(s));
ok('nenhum <script src> do antigo ficou de fora', faltam.length === 0, `antigo: ${[...sa].join(', ')} · novo: ${[...sn].join(', ')}`);

await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
