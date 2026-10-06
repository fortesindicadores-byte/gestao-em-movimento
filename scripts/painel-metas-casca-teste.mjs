// Migração do Painel de Metas (painel-metas/) para a casca padrão do portal —
// conferida no Chromium, nos DOIS lados (HTML antigo × novo, mesmos dados).
//
// O painel lê:
//   · gviz JSONP: aba Painel de Metas (gid 199351909, a ESTRUTURA), Dispersão de km e DPO;
//   · gviz por fetch: DRE Frota e Receita Líquida (Custos = AV Real × AV Orçado);
//   · Supabase `fca` (vigencia, status) via supabase-js UMD (SBJS);
//   · GerotBase.load() (Ranking = pontuação do Frota de Elite) — DUBLADO: o arquivo
//     assets/gerot-base.js é servido como um stub que devolve registros prontos.
// O shim gviz-cache.js fica no caminho, com as tabelas sh_*/gviz_snapshot vazias,
// e cai no "Google" dublado.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show HEAD:painel-metas/index.html > <scratch>/antigo.html   (o último antes da casca)
//   cp scripts/painel-metas-casca-teste.mjs docs/driverpro-apresentacao/_pmetas-casca-x1.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento ANTIGO=<html antigo> \
//     SBJS=<supabase.js umd> CHART_JS=<chart.umd.js> FONT_DIR=<@fontsource/montserrat/files> \
//     SHOTS=<pasta> node _pmetas-casca-x1.mjs ; rm _pmetas-casca-x1.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGO = process.env.ANTIGO;
const SBJS = process.env.SBJS;
const CHART_JS = process.env.CHART_JS || '';
const FONT_DIR = process.env.FONT_DIR || '';
const SHOTS = process.env.SHOTS || '';
const BUILD = '202610070300';
const ORIG = 'http://gem.teste';
const PASTA = 'painel-metas';

let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const r1 = v => Math.round(v * 10) / 10;

// ── aba Painel de Metas: [vig, indicador, peso, descrição, regra, un, meta, real, atg, pontos] (jan→jul;
//    ago e set entram pela herança do último mês até o mês fechado) ──
const IND = [
  ['Ranking performance Frota - Unidades', 20, 'Média da pontuação do Programa de Reconhecimento (Frota de Elite) das unidades.', '≥ 100% da meta = 100%\n≥ 99% = 75%\n≥ 98% = 50%\nabaixo = 0', '%', 90],
  ['Dispersão de km', 15, 'Δ% acumulado no ano do km realizado contra o remunerado dos projetos ROTA e Auto Serviço.', '≤ 100% da meta = 100%\n≤ 101% = 75%\n≤ 102% = 50%\nacima = 0', '%', 10],
  ['DPO/VPO Pilar Sustentável', 20, 'Auditoria por semestre: unidades abaixo do Nível 3.', '0 unidades = 100%\n1 unidade = 50%\n2 ou mais = 0', '%', 100],
  ['Consolidação de FCAs', 15, 'Aderência dos FCAs (Concluída 100, Em andamento 50, Não iniciada 0), acumulado até M-2.', '≥ 100% da meta = 100%\n≥ 99% = 75%\n≥ 98% = 50%\nabaixo = 0', '%', 85],
  ['Custos de veículos e equipamentos', 25, 'AV Real (custo total ÷ Receita Líquida) contra o AV Orçado, como na Visão Financeira.', '≤ 100% do orçado = 100%\n≤ 101% = 75%\n≤ 102% = 50%\nacima = 0', '%', null],
  ['Treinamentos obrigatórios', 5, 'Percentual do quadro com os treinamentos obrigatórios em dia.', 'Valor lançado na aba.', '%', 100],
];
const METAS = [];
for (let m = 0; m < 7; m++) for (const [n, peso, d, rg, un, meta] of IND) {
  const outro = /Treinamentos/.test(n), real = outro ? r1(90 + rnd() * 10) : null;
  METAS.push([`Date(2026,${m},1)`, n, peso, d, rg, un, meta, real, outro ? real : null, outro ? (real >= 100 ? 5 : real >= 95 ? 2.5 : 0) : null]);
}
// ── Dispersão de km: 0 vig · 14 projeto · 31 rem · 32 real ──
const KM = [];
for (let m = 0; m < 9; m++) for (const p of ['ROTA - CGR', 'ROTA - GRL', 'AUTO SERVIÇO - FLP', 'EMPURRADA - PIR', 'ROTA - PLT']) for (let k = 0; k < 3; k++) {
  const row = Array(34).fill(null); row[0] = `Date(2026,${m},1)`; row[14] = p;
  const rem = 20000 + Math.round(rnd() * 30000); row[31] = rem; row[32] = Math.round(rem * (0.97 + rnd() * 0.18)); KM.push(row);
}
// ── DPO: a 1ª linha é o cabeçalho (headers=0) ──
const DPO = [['Unidade', '1H25', '2H25', '1H26', '2H26'],
  ...['CDD CUIABA', 'CDD PELOTAS', 'CDD GUARULHOS', 'CDD RIO DE JANEIRO', 'CDI MACACU', 'CDD FLORIANOPOLIS'].map((u, i) =>
    [u, 'Nível ' + (3 + (i % 2)), 'Nível ' + (i === 2 ? 2 : 3), 'Nível ' + (i === 4 ? 2 : 4), i < 2 ? 'Nível ' + (i === 0 ? 2 : 3) : null])];
// ── FCA Total (reserva quando o banco vem vazio): 1 vig · 8 status ──
const FCA_ABA = [];
for (let m = 0; m < 8; m++) for (let i = 0; i < 10; i++) { const r = Array(10).fill(null); r[1] = `Date(2026,${m},1)`; r[8] = ['Concluída', 'Em andamento', 'Não iniciada'][i % 3]; FCA_ABA.push(r); }
const ABAS = { 'gid=199351909': METAS, 'sheet=Dispers': KM, 'sheet=DPO': DPO, 'gid=216663799': FCA_ABA };
// ── DRE (fetch): Frota (custos negativos) e Receita Líquida ──
const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set'];
const DRE_CAB = ['Orçado', 'Remunerado', 'Realizado', 'Vigência', 'Conta Gerencial', 'Mês', 'Ano', 'Unidade'];
const FROTA = [], RECEITA = [];
for (let m = 0; m < 9; m++) for (const u of ['CGR', 'GRL', 'PIR', 'FLP']) {
  for (const c of ['Combustíveis Veículos e Equipamentos', 'Manutenção Preventiva', 'Pneus Novos']) {
    const orc = -(80000 + rnd() * 40000);
    FROTA.push([orc, orc * 1.01, orc * (0.95 + rnd() * 0.12), `Date(2026,${m},1)`, c, MES3[m], 2026, u]);
  }
  FROTA.push([500000, 500000, 510000, `Date(2026,${m},1)`, 'Receita Líquida', MES3[m], 2026, u]);   // ignorada no custo
  const rec = 1500000 + rnd() * 300000;
  RECEITA.push([rec, rec, rec * (0.96 + rnd() * 0.08), `Date(2026,${m},1)`, 'Receita Líquida', MES3[m], 2026, u]);
}
const DRE = { Frota: FROTA, 'Receita Líquida': RECEITA };
// ── FCA (Supabase) ──
const ST = ['Concluída', 'Em andamento', 'Não iniciada'];
const FCA = [];
for (let m = 0; m < 9; m++) for (let i = 0; i < 14; i++) FCA.push({ vigencia: `${MES3[m]}/26`, status: ST[rnd() < .6 ? 0 : rnd() < .6 ? 1 : 2] });
// ── GerotBase (Frota de Elite): registros {unit, vig, field, atg} ──
const NOMES = ['CDI MACACU', 'CDD PELOTAS', 'CDD RONDONOPOLIS', 'CDD NOVA FRIBURGO', 'CDD RIO DE JANEIRO', 'CDD FLORIANOPOLIS', 'CDD CUIABA', 'CDD GUARULHOS', 'CDD CAMBORIU', 'PIRAI EMPURRADA', 'MACACU EMPURRADA', 'CUIABA EMPURRADA', 'CUIABA'];
const CAMPOS = ['disp', 'prev', 'comb', 'pneus', 'checkT', 'checkWH', 'conf', 'stVeic', 'stEmp', 'sla', 'civf'];
const ELITE = [];
for (let m = 1; m <= 9; m++) for (const u of NOMES) for (const f of CAMPOS) {
  if (f === 'checkWH' && !/RIO|PELOTAS|^CUIABA$/.test(u)) continue;
  ELITE.push({ unit: u, vig: `2026-${String(m).padStart(2, '0')}`, field: f, atg: r1(80 + rnd() * 25) });
}
ELITE.push({ unit: 'UNIDADE FORA', vig: '2026-03', field: 'disp', atg: 10 });   // fora do ELITE_NOMES: não conta
const GEROT_STUB = `window.GerotBase={load:function(){return new Promise(function(ok){setTimeout(function(){ok(${JSON.stringify(ELITE)});},20);});}};`;

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const gvObj = (rows, cab) => ({ version: '0.6', status: 'ok', table: { cols: (cab || rows[0] || []).map((c, i) => ({ id: String.fromCharCode(65 + i), label: cab ? c : '', type: 'string' })),
  rows: rows.map(r => ({ c: r.map(v => v == null || v === '' ? null : { v }) })) } });

async function abre(browser, htmlAntigo, vp, tema, falhaFca = false) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(({ ABAS, tema }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_theme', tema);
    localStorage.removeItem('painel_metas_mini');
    const gv = rows => ({ status: 'ok', table: { cols: (rows[0] || []).map(() => ({ id: 'A', label: '' })),
      rows: rows.map(r => ({ c: r.map(v => v == null || v === '' ? null : { v }) })) } });
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        const src = decodeURIComponent(n.src);
        const k = Object.keys(ABAS).find(k => src.includes(k));
        setTimeout(() => { if (fn && window[fn]) window[fn](k ? gv(JSON.parse(JSON.stringify(ABAS[k]))) : { status: 'error' }); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
  }, { ABAS, tema });
  await page.route('**/*', async r => {
    const req = r.request(), u = new URL(req.url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      if (u.pathname.endsWith('/assets/gerot-base.js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: GEROT_STUB });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'docs.google.com') {   // o fetch do DRE (Frota / Receita Líquida)
      const aba = u.searchParams.get('sheet');
      const rows = DRE[aba];
      return r.fulfill({ status: 200, contentType: 'text/plain', body: '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify(rows ? gvObj(rows, DRE_CAB) : { status: 'error' }) + ');' });
    }
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('supabase-js'))
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(SBJS) });
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('chart.js') && CHART_JS)
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHART_JS) });
    if (u.hostname.endsWith('supabase.co')) {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors, body: '' });
      const json = b => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(b) });
      if (u.pathname.endsWith('/rest/v1/fca')) return falhaFca ? json([]) : json(FCA);
      return json([]);
    }
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
  await page.waitForFunction(() => document.querySelectorAll('#tbl table tbody tr').length >= 5, null, { timeout: 25000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(700);
  return { ctx, page, errs };
}

// hero, gráficos e tabela, lidos igual nos dois lados (cor da célula vira categoria)
const leNumeros = () => {
  const cat = s => { s = String(s || ''); return /green|verde/.test(s) ? 'G' : /amber|ambar/.test(s) ? 'A' : /red|vermelho/.test(s) ? 'R' : /text3|txt3/.test(s) ? '-' : s; };
  const out = {};
  const ht = document.getElementById('h-total');
  out.hero = ht.textContent + ' [' + cat(ht.style.color) + ']';
  out.heroSub = document.getElementById('h-sub').textContent;
  out.tblSub = (document.getElementById('tbl-sub') || {}).textContent;
  const tb = document.querySelector('#tbl table');
  out.cab = tb ? [...tb.querySelectorAll('thead th')].map(c => c.textContent.trim()).join(' | ') : null;
  out.linhas = tb ? [...tb.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim() + (c.getAttribute('style') ? '[' + cat(c.getAttribute('style')) + ']' : '')).join(' | ')) : [];
  const ch = c => c ? { labels: c.data.labels.map(l => String(l)), data: c.data.datasets.map(d => d.data), bg: c.data.datasets[0].backgroundColor } : null;
  out.chMensal = ch(chM); out.chInd = ch(chI);
  out.vigs = [...document.querySelectorAll('#ms-vig .ms-opt input[data-v]')].map(i => i.dataset.v + (i.checked ? '*' : '')).join(',');
  return out;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

console.log('\n══ números: antigo × novo ══');
const sel = (id, vals) => { const w = document.getElementById(id); w._sel.clear(); vals.forEach(v => w._sel.add(v)); if (w._render) w._render(''); atualizar(); };
const passos = {
  base: null,
  'Vigência mar/26': `(${sel})('ms-vig',['mar/26'])`,
  'Vigência jan→jun (média)': `(${sel})('ms-vig',['jan/26','fev/26','mar/26','abr/26','mai/26','jun/26'])`,
  'Vigência jul/26 + set/26 (herdada)': `(${sel})('ms-vig',['jul/26','set/26'])`,
  'Todas as vigências': `(${sel})('ms-vig',[])`,
};
const res = {};
for (const lado of ['antigo', 'novo']) {
  const { ctx, page, errs } = await abre(browser, lado === 'antigo' ? htmlAntigo : null, { width: 1600, height: 900 }, 'dark');
  res[lado] = { errs };
  for (const [nome, fn] of Object.entries(passos)) {
    if (fn) { await page.evaluate(fn); await page.waitForTimeout(250); }
    res[lado][nome] = await page.evaluate(leNumeros);
  }
  await ctx.close();
}
ok('antigo abre sem erro de página', res.antigo.errs.length === 0, res.antigo.errs.join(' / '));
ok('novo abre sem erro de página', res.novo.errs.length === 0, res.novo.errs.join(' / '));
const b = res.novo.base;
console.log(`  novo base: hero ${b.hero} · ${b.heroSub} · ${b.tblSub}\n    ` + b.linhas.join('\n    '));
ok('tabela com os 6 indicadores', b.linhas.length === 6, b.linhas.length + ' linhas');
ok('mês herdado (set/26) aparece no filtro, e o último vem marcado', /set\/26\*$/.test(b.vigs), b.vigs);
ok('gráfico mensal com a linha de meta 80', b.chMensal && b.chMensal.data[1].every(v => v === 80));
for (const nome of Object.keys(passos)) {
  const A = res.antigo[nome], N = res.novo[nome];
  for (const k of Object.keys(A)) {
    if (k === 'vigs' && nome !== 'base') continue;   // o antigo não redesenha a lista ao filtrar por script
    const igual = JSON.stringify(A[k]) === JSON.stringify(N[k]);
    ok(`igual antes × depois [${nome}]: ${k}`, igual, igual ? '' : `${JSON.stringify(A[k]).slice(0, 200)} × ${JSON.stringify(N[k]).slice(0, 200)}`);
  }
}
ok('filtro de vigência muda os números', JSON.stringify(res.novo['Vigência mar/26'].linhas) !== JSON.stringify(b.linhas) && res.novo['Vigência mar/26'].hero !== res.novo['Todas as vigências'].hero);

// casca: sem rolagem, visões, tema, exportação — 1366×768 e 1600×900
const mede = () => {
  const se = document.scrollingElement, vw = document.querySelector('.vw.on');
  const r = { id: vw.id, tit: document.getElementById('tit').textContent, sub: document.getElementById('titSub').textContent,
    pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
    vwRola: vw.scrollHeight > vw.clientHeight + 1 };
  const fora = [...vw.querySelectorAll('.card,.fin-hero,canvas')].filter(e => e.getBoundingClientRect().bottom > innerHeight - 15 || e.getBoundingClientRect().right > innerWidth - 15);
  r.foraTela = fora.length;
  if (vw.id === 'vw-resumo') {
    const cv = [...vw.querySelectorAll('canvas')].map(c => Math.round(c.getBoundingClientRect().height));
    r.canvas = cv;
    const gr = vw.querySelector('.gr2').getBoundingClientRect(), hv = vw.querySelector('.hval').getBoundingClientRect();
    r.sobra = Math.round(vw.getBoundingClientRect().bottom - gr.bottom);
    r.gr2 = Math.round(gr.height); r.hval = Math.round(hv.height);
    r.charts = [...vw.querySelectorAll('canvas')].every(c => window.Chart && Chart.getChart(c));
  } else {
    const tw = vw.querySelector('.twrap'), card = vw.querySelector('.card.tsec'), cs = getComputedStyle(card);
    const tb = tw.querySelector('table'), trs = [...tb.querySelectorAll('tbody tr')];
    r.horiz = tw.scrollWidth > tw.clientWidth + 1;
    r.twRolaV = tw.scrollHeight > tw.clientHeight + 1;
    r.sobraT = Math.round(tw.getBoundingClientRect().bottom - trs[trs.length - 1].getBoundingClientRect().bottom);
    r.sticky = getComputedStyle(tb.querySelector('thead th')).position;
    r.moldura = [cs.borderTopWidth, cs.backgroundColor, cs.boxShadow, cs.paddingTop].join(' ');
    r.cortes = [...tb.querySelectorAll('thead th')].filter(th => th.scrollWidth > th.clientWidth + 1).map(th => th.textContent.trim());
    r.al = [...tb.querySelectorAll('thead th')].map(th => getComputedStyle(th).textAlign).join(',');
    r.alTd = [...trs[0].cells].map(td => getComputedStyle(td).textAlign).join(',');
    r.tituloVisivel = !!(vw.querySelector('.ttit') && vw.querySelector('.ttit').offsetHeight);
  }
  return r;
};
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, null, vp, tema);
    const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    console.log(`\n══ ${tag} ══`);
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light') && !document.body.classList.contains('light-mode'), tema));
    for (const v of ['resumo', 'indicadores']) {
      await page.click(`.s-item[data-vw="${v}"]`); await page.waitForTimeout(400);
      const m = await page.evaluate(mede);
      const nome = v === 'resumo' ? 'Resumo Gerencial' : 'Indicadores';
      ok(`${tag} · ${nome}: visão abre com o título`, m.id === 'vw-' + v && m.tit === nome, m.id + ' / ' + m.tit);
      ok(`${tag} · ${nome}: página não rola`, !m.pagRola);
      ok(`${tag} · ${nome}: a visão não transborda`, !m.vwRola);
      ok(`${tag} · ${nome}: nada fora da tela`, !m.foraTela, m.foraTela);
      if (v === 'resumo') {
        ok(`${tag} · Resumo: os dois gráficos desenhados com altura`, m.charts && m.canvas.length === 2 && m.canvas.every(h => h > 150), m.canvas.join('/'));
        ok(`${tag} · Resumo: gráficos com teto (≤ 56vh)`, m.gr2 <= Math.ceil(vp.height * .56) + 1, m.gr2 + 'px');
        ok(`${tag} · Resumo: sem faixa vazia embaixo dos gráficos (≤ 4px)`, m.sobra <= 4, m.sobra + 'px');
        ok(`${tag} · Resumo: subtítulo do topo = recorte · carga`, /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(m.sub), m.sub);
      } else {
        ok(`${tag} · Indicadores: tabela sem barra horizontal`, !m.horiz);
        ok(`${tag} · Indicadores: tabela inteira à vista, sem barra vertical`, !m.twRolaV);
        ok(`${tag} · Indicadores: sem faixa vazia embaixo da tabela (≤ 4px)`, m.sobraT <= 4, m.sobraT + 'px');
        ok(`${tag} · Indicadores: cabeçalho sticky`, m.sticky === 'sticky');
        ok(`${tag} · Indicadores: cabeçalho sem texto cortado`, !m.cortes.length, m.cortes.join(' / '));
        ok(`${tag} · Indicadores: cabeçalho alinhado ao conteúdo`, m.al === m.alTd, m.al + ' × ' + m.alTd);
        ok(`${tag} · Indicadores: sem moldura dupla`, /^0px rgba\(0, 0, 0, 0\) none 0px$/.test(m.moldura), m.moldura);
        ok(`${tag} · Indicadores: título que repete a visão escondido`, !m.tituloVisivel);
      }
      if (SHOTS && vp.width === 1600) {
        const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${v}-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
      }
      if (SHOTS && vp.width === 1366 && tema === 'dark') await page.screenshot({ path: path.join(SHOTS, PASTA, `${v}-escuro-1366.png`) });
    }
    if (vp.width === 1600 && tema === 'dark') {
      await page.click('.s-item[data-vw="resumo"]'); await page.waitForTimeout(200);
      const cor0 = await page.evaluate(() => chM.data.datasets[1].borderColor);
      await page.click('#btTema'); await page.waitForTimeout(300);
      const cor1 = await page.evaluate(() => chM.data.datasets[1].borderColor);
      ok('troca de tema: body.claro + bi_theme', await page.evaluate(() => document.body.classList.contains('claro') && localStorage.getItem('bi_theme') === 'light'));
      ok('troca de tema: gráficos redesenham com a cor do tema', cor0 !== cor1, cor0 + ' → ' + cor1);
      await page.click('#btTema'); await page.waitForTimeout(200);
      const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
        xls: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
      ok('Gerar PDF na lateral (Atalhos)', exp.pdf);
      ok('excel-export carregado (menu Excel/PNG)', exp.xls);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('chart.js, supabase-js, gerot-base.js, gviz-cache.js e ctrlk.js continuam', ['chart.js', 'supabase-js', 'gerot-base.js', 'gviz-cache.js', 'ctrlk.js'].every(n => exp.srcs.some(s => s.includes(n))));
      ok('filters-toggle.js saiu', !exp.srcs.some(s => s.includes('filters-toggle')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(B => { const b = (document.querySelector('meta[name=build]') || {}).content; return b === B && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + b)); }, BUILD));
      await page.click('.s-item[data-vw="indicadores"]'); await page.waitForTimeout(200);
      await page.click('#tbl tbody td:nth-child(7)', { button: 'right' }); await page.waitForTimeout(150);
      ok('clique direito na tabela abre o menu Excel/PNG', await page.evaluate(() => { const m = document.getElementById('xl-menu'); return !!m && m.style.display !== 'none' && /Excel/.test(m.textContent); }));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      const antesOrd = await page.evaluate(() => document.querySelector('#tbl tbody tr td').textContent);
      await page.click('#tbl thead th:nth-child(1)'); await page.waitForTimeout(200);
      const depoisOrd = await page.evaluate(() => document.querySelector('#tbl tbody tr td').textContent);
      ok('ordenação pelo cabeçalho (Indicador)', antesOrd !== depoisOrd, `${antesOrd} → ${depoisOrd}`);
      await page.click('#ms-vig .ms-btn'); await page.waitForTimeout(100);
      await page.evaluate(() => document.querySelector('#ms-vig .ms-only[data-v="abr/26"]').click());
      await page.waitForTimeout(250);
      const cnt = await page.evaluate(() => { const c = document.querySelector('#ms-vig .ms-cnt'); return [getComputedStyle(c).display, c.textContent, document.getElementById('titSub').textContent]; });
      ok('contagem laranja do filtro aparece', cnt[0] !== 'none' && cnt[1] === '1', cnt.join(' · '));
      ok('o recorte da tabela vai para o subtítulo do topo', /^ABR\/26 · /.test(cnt[2]), cnt[2]);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'indicadores-filtro.png') });
      await page.mouse.click(5, 5);
      ok('contrato: ms-vig com wrap._sel (Set) + wrap._render, atualizar/carregar/setVw', await page.evaluate(() => { const w = document.getElementById('ms-vig'); return w._sel instanceof Set && typeof w._render === 'function' && typeof atualizar === 'function' && typeof carregar === 'function' && typeof setVw === 'function'; }));
      // o que o Check de Metas faz: prep (sel ms-vig + atualizar) e fotografa #vw-resumo e #tbl table
      const cm = await page.evaluate(() => {
        setVw('resumo'); const w = document.getElementById('ms-vig'); w._sel.clear(); w._sel.add('jul/26'); w._render(''); atualizar();
        const a = document.querySelector('#vw-resumo'), hv = a && a.querySelector('.fin-hero > div .hval');
        const graf = [...a.querySelectorAll('canvas')].filter(c => c.offsetHeight >= 40 && Chart.getChart(c)).length;
        const tit = [...a.querySelectorAll('.gcard')].map(c => (c.querySelector('.gtit') || {}).textContent);
        setVw('indicadores'); const t = document.querySelector('#tbl table');
        return { hero: hv && hv.textContent, sub: (a.querySelector('.hero-sub') || {}).textContent, graf, tit, tab: t ? t.offsetHeight : 0, linhas: t ? t.tBodies[0].rows.length : 0 };
      });
      ok('Check de Metas · slide 1: #vw-resumo com hero (.fin-hero > div .hval) e os gráficos com título', !!cm.hero && cm.hero !== '—' && cm.graf === 2 && cm.tit.join('|') === 'Pontuação · Mensal|Pontuação por Indicador', JSON.stringify(cm));
      ok('Check de Metas · slide 1: a vigência do prep chega ao hero', /jul\/26/.test(cm.sub), cm.sub);
      ok('Check de Metas · slide 2: #tbl table visível na visão Indicadores', cm.tab > 100 && cm.linhas === 6, cm.tab + 'px · ' + cm.linhas);
      await page.evaluate(() => setVw('resumo'));
      await page.click('#btMini'); await page.waitForTimeout(300);
      ok('lateral recolhe e guarda painel_metas_mini', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('painel_metas_mini') === '1'));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'resumo-mini.png') });
      await page.evaluate(() => { localStorage.setItem('painel_metas_mini', '0'); setCarga('x'); });
      await page.evaluate(() => carregar()); await page.waitForTimeout(900);
      ok('Atualizar dados: subtítulo com a hora da carga', await page.evaluate(() => / \d{2}:\d{2}/.test(document.getElementById('titSub').textContent)));
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}

// FCA do banco vazio: cai na aba FCA Total e o subtítulo avisa (era o selo do header)
{
  const { ctx, page, errs } = await abre(browser, null, { width: 1366, height: 768 }, 'dark', true);
  const t = await page.evaluate(() => document.getElementById('titSub').textContent);
  ok('FCA do banco vazio: aviso "FCA da planilha" no subtítulo', /FCA da planilha/.test(t), t);
  ok('FCA do banco vazio: zero erro de página', errs.length === 0, errs.join(' / '));
  await ctx.close();
}

// celular: a página volta a rolar, gráficos e tabela com altura
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  const m = await page.evaluate(() => ({ rola: /auto|scroll/.test(getComputedStyle(document.body).overflowY) && getComputedStyle(document.querySelector('.app')).position === 'static',
    cv: [...document.querySelectorAll('#vw-resumo canvas')].map(c => Math.round(c.getBoundingClientRect().height)) }));
  ok('celular: página livre para rolar e gráficos com altura', m.rola && m.cv.every(h => h > 150), m.cv.join('/'));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-resumo.png'), fullPage: true });
  await page.evaluate(() => setVw('indicadores')); await page.waitForTimeout(700);
  // como no antigo: o mobile.js troca o "+ Ver detalhes" da página pelo "+ Detalhar" dele
  const t = await page.evaluate(() => ({ h: Math.round(document.querySelector('#vw-indicadores .twrap').getBoundingClientRect().height),
    mt: !!document.querySelector('#vw-indicadores .mt-detail-btn'), sec: [...document.querySelectorAll('#tbl .sec-col')].every(e => getComputedStyle(e).display === 'none') }));
  const vis = () => [...document.querySelectorAll('#tbl thead th')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.textContent.trim()).join(',');
  t.vis = await page.evaluate(vis);
  const { ctx: c0, page: p0 } = await abre(browser, htmlAntigo, { width: 390, height: 844 }, 'dark'); await p0.waitForTimeout(500);
  const visAnt = await p0.evaluate(vis), mtAnt = await p0.evaluate(() => !!document.querySelector('.mt-detail-btn')); await c0.close();
  ok('celular: tabela com altura e o "+ Detalhar" do mobile.js, com as MESMAS colunas visíveis do antigo', t.h > 200 && t.mt && mtAnt && t.vis === visAnt, JSON.stringify(t) + ' × antigo ' + visAnt);
  await page.click('#vw-indicadores .mt-detail-btn'); await page.waitForTimeout(200);
  ok('celular: "+ Detalhar" mostra as colunas', await page.evaluate(() => [...document.querySelectorAll('#tbl .sec-col')].every(e => getComputedStyle(e).display !== 'none')));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-indicadores.png'), fullPage: true });
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
