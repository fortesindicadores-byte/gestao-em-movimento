// Migração de R$/L (combustivel/preco-litro) e CO² (combustivel/co2) para a
// casca padrão do portal — conferida no Chromium, nos DOIS lados.
//
// O gviz é dublado (JSONP, que é o que os dois painéis usam; o shim
// gviz-cache.js fica no caminho, com o Supabase respondendo vazio, e cai no
// Google dublado). As abas Km/L e R$/L do workbook Consumo saem de dados
// sintéticos no formato real (rótulos que o detectCols do próprio painel acha).
// O MESMO roteiro roda no HTML antigo (git show HEAD:…) e no novo, e os números
// (hero, total das tabelas, nº de linhas) têm de sair IGUAIS — antes e depois
// de aplicar um filtro.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   cp scripts/preco-litro-co2-casca-teste.mjs docs/driverpro-apresentacao/_rslco2-casca.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento \
//     ANTIGO_RSL=<html antigo> ANTIGO_CO2=<html antigo> CHART_JS=<chart.umd.js> SHOTS=<pasta> \
//     node _rslco2-casca.mjs ; rm _rslco2-casca.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const CHART_JS = process.env.CHART_JS || '';
const SHOTS = process.env.SHOTS || '';
const ORIG = 'http://gem.teste';

// ── dados sintéticos ─────────────────────────────────────────────────────────
// aba Km/L: 26 colunas, rótulos como os da aba real
const KML_COLS = ['Vigência','Operação','Empresa','c3','Km/L Rem Médio','Km/L Rem Modelo','Km/L Real','Δ Km/L',
  'R$/L Rem','R$/L Real','Δ R$/L','Ativo','c12','c13','Projeto','Placa','Modelo','Tipo Veículo','c18','c19',
  'Tipo Combustível','c21','Km Rodado','Qtd Total de Litros','c24','Total R$'];
const UNIS = ['PIR','CBA','GRL'];
const PROJS = ['ROTA','EMPURRADA','VAN'];
const TIPOS = ['CAMINHAO BAU ROLL UP 10 PALLETS','CAVALO MECANICO','CAMINHONETE FURGAO'];
const MODELOS = ['VW 24.280','VW 17.190','RENAULT MASTER'];
const KMLREM = { ROTA: 3.1, EMPURRADA: 2.05, VAN: 7.0 };
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const VIGS = [[2025,11]]; for (let m = 0; m <= 8; m++) VIGS.push([2026, m]);   // dez/25 + jan→set/26
const KML_ROWS = [];
VIGS.forEach(([y, m]) => UNIS.forEach((u, iu) => PROJS.forEach((p, ip) => {
  for (let k = 0; k < 3; k++) {
    const litros = Math.round(800 + rnd() * 2400);
    const preco = +(5.6 + rnd() * 0.9 + (p === 'VAN' ? 0.4 : 0)).toFixed(4);
    const kmlReal = KMLREM[p] * (0.85 + rnd() * 0.3);
    const km = Math.round(litros * kmlReal);
    const row = Array(26).fill(null);
    row[0] = `Date(${y},${m},1)`; row[1] = 'DISTRIBUIÇÃO'; row[2] = 'CONLOG';
    row[4] = KMLREM[p] * (0.97 + rnd() * 0.06); row[5] = KMLREM[p]; row[6] = kmlReal;
    row[8] = null; row[9] = preco; row[11] = k === 2 ? 'FALSO' : (k === 1 && iu === 2 ? 'Fora FT' : 'VERDADEIRO');
    row[14] = (p === 'VAN' && iu === 0 ? 'ROTA (VAN)' : p) + ' - ' + u;   // as duas grafias da VAN
    row[15] = `${'ABCDEFGHI'[ip*3+k]}${u}${1000 + iu*100 + ip*10 + k}`;
    row[16] = MODELOS[ip]; row[17] = TIPOS[ip]; row[20] = 'DIESEL S10';
    row[22] = km; row[23] = litros; row[25] = +(litros * preco).toFixed(2);
    KML_ROWS.push(row);
  }
})));
// aba R$/L (KML_ID): Unidade Benner · vigência texto · vigência data · … · precoOperadora (W) · tipoCombustivel (X)
const RSL_COLS = ['Unidade Benner','c1','Vigência Data','Vigência Data', ...Array(18).fill(0).map((_,i)=>'d'+i), 'precoOperadora','tipoCombustivel'];
const RSL_ROWS = [];
VIGS.forEach(([y, m]) => UNIS.forEach(u => ['ROTA','EMPURRADA'].forEach(p => {   // VAN sem preço: cai no ROTA
  for (let k = 0; k < 2; k++) {
    const r = Array(24).fill(null);
    r[0] = `${p} - ${u}`; r[2] = `${y}${String(m+1).padStart(2,'0')}`; r[3] = `Date(${y},${m},1)`;
    r[22] = +(5.8 + rnd() * 0.5).toFixed(4); r[23] = 'DIESEL S10';
    RSL_ROWS.push(r);
  }
})));
const pack = (cols, rows) => ({ status: 'ok', table: { cols: cols.map(c => ({ id: c, label: c })),
  rows: rows.map(r => ({ c: r.map(v => v == null ? null : { v }) })) } });
const GVIZ = { 'Km/L': pack(KML_COLS, KML_ROWS), 'R$/L': pack(RSL_COLS, RSL_ROWS) };

// ── painéis ──────────────────────────────────────────────────────────────────
const PAINEIS = {
  rsl: { pasta: 'combustivel/preco-litro', antigo: process.env.ANTIGO_RSL, shots: 'combustivel-preco-litro',
         hero: ['h-real','h-rem','h-drem-v','h-drem-p','h-imp','h-ytd-v','h-ytd-p','h-ytd-imp'],
         visoes: ['resumo','detalhado','veiculo'] },
  co2: { pasta: 'combustivel/co2', antigo: process.env.ANTIGO_CO2, shots: 'combustivel-co2',
         hero: ['h-real','h-rem','h-drem-v','h-drem-p','h-ytd-v','h-ytd-p'],
         visoes: ['resumo','detalhado','veiculo'] },
};

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };

const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json' };

async function abre(browser, pastaRel, htmlAntigo, vp, tema) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.dismiss());
  await page.addInitScript(({ GVIZ, tema }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_user_name', 'Teste');
    localStorage.setItem('bi_theme', tema);
    const ap = Element.prototype.appendChild;
    Element.prototype.appendChild = function (n) {
      if (n && n.tagName === 'SCRIPT' && n.src && n.src.includes('docs.google.com')) {
        const fn = (n.src.match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1];
        const aba = decodeURIComponent((n.src.match(/sheet=([^&]+)/) || [])[1] || '');
        const body = JSON.parse(JSON.stringify(GVIZ[aba] || { status: 'ok', table: { cols: [], rows: [] } }));
        setTimeout(() => { if (fn && window[fn]) window[fn](body); }, 5);
        return n;
      }
      return ap.call(this, n);
    };
  }, { GVIZ, tema });
  await page.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('chart.js') && CHART_JS)
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(CHART_JS) });
    if (u.hostname.endsWith('supabase.co')) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (u.hostname.includes('fonts.')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  const url = `${ORIG}/${pastaRel}/${htmlAntigo ? '__antigo.html' : ''}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const e = document.getElementById('h-real'); return e && e.textContent.trim() !== '—'; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  return { ctx, page, errs };
}

// números da tela: hero + total da tabela resumo + linhas das duas tabelas
const leNumeros = (hero) => {
  const t = id => (document.getElementById(id) || {}).textContent?.trim();
  const out = {}; hero.forEach(id => out[id] = t(id));
  const tot = document.querySelector('#body-kml tr.total');
  out.total = tot ? [...tot.cells].map(c => c.textContent.trim()).join(' | ') : null;
  out.linhasKml = document.querySelectorAll('#body-kml tr:not(.total)').length;
  out.linhasVei = document.querySelectorAll('#body-vei tr').length;
  const v1 = document.querySelector('#body-vei tr'); out.vei1 = v1 ? [...v1.cells].map(c => c.textContent.trim()).join(' | ') : null;
  const esg = document.getElementById('esg-block'); if (esg) out.esg = esg.textContent.replace(/\s+/g, ' ').trim();
  return out;
};
// filtro pelo contrato do check-metas: wrap._sel + _render + atualizar()
const filtra = () => { const w = document.getElementById('ms-uni'); w._sel.clear(); w._sel.add('PIR'); w._render(''); atualizar(); };
const filtraProj = () => { setDim('proj'); };

async function rodaPainel(chave) {
  const P = PAINEIS[chave];
  console.log(`\n══ ${P.pasta} ══`);
  const htmlAntigo = fs.readFileSync(P.antigo, 'utf8');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  // 1 · números: antigo × novo, com e sem filtro, e com a dimensão Projeto
  const res = {};
  for (const lado of ['antigo', 'novo']) {
    const { ctx, page, errs } = await abre(browser, P.pasta, lado === 'antigo' ? htmlAntigo : null, { width: 1600, height: 900 }, 'dark');
    const base = await page.evaluate(leNumeros, P.hero);
    await page.evaluate(filtraProj);
    const proj = await page.evaluate(() => { const tot = document.querySelector('#body-kml tr.total');
      return [...document.querySelectorAll('#body-kml tr')].map(tr => tr.cells[0].textContent.trim() + '=' + (tr.cells[3] || {}).textContent).join(' ; ') + ' :: ' + (tot ? tot.textContent : ''); });
    await page.evaluate(filtra);
    await page.waitForTimeout(200);
    const filt = await page.evaluate(leNumeros, P.hero);
    res[lado] = { base, proj, filt, errs };
    await ctx.close();
  }
  console.log('  antigo:', JSON.stringify(res.antigo.base));
  console.log('  novo  :', JSON.stringify(res.novo.base));
  console.log('  filtrado (PIR) novo:', JSON.stringify(res.novo.filt));
  ok('antigo abre sem erro de página', res.antigo.errs.length === 0, res.antigo.errs.join(' / '));
  ok('novo abre sem erro de página', res.novo.errs.length === 0, res.novo.errs.join(' / '));
  ok('hero carregou com número', res.novo.base['h-real'] && res.novo.base['h-real'] !== '—', res.novo.base['h-real']);
  for (const k of Object.keys(res.antigo.base))
    ok(`igual antes × depois: ${k}`, JSON.stringify(res.antigo.base[k]) === JSON.stringify(res.novo.base[k]),
       `${res.antigo.base[k]} × ${res.novo.base[k]}`.slice(0, 160));
  ok('igual antes × depois: tabela por Projeto', res.antigo.proj === res.novo.proj);
  for (const k of Object.keys(res.antigo.filt))
    ok(`igual com filtro PIR: ${k}`, JSON.stringify(res.antigo.filt[k]) === JSON.stringify(res.novo.filt[k]),
       `${res.antigo.filt[k]} × ${res.novo.filt[k]}`.slice(0, 160));
  ok('filtro muda os números', res.novo.filt['h-real'] !== res.novo.base['h-real'] || res.novo.filt.total !== res.novo.base.total);

  // 2 · casca: sem rolagem, visões, tema, exportação — 1366×768 e 1600×900
  for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
    for (const tema of ['dark', 'light']) {
      const { ctx, page, errs } = await abre(browser, P.pasta, null, vp, tema);
      const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
      ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light'), tema));
      for (const v of P.visoes) {
        await page.click(`.s-item[data-vw="${v}"]`);
        await page.waitForTimeout(350);
        const m = await page.evaluate(v => {
          const se = document.scrollingElement, vw = document.querySelector('.vw.on');
          const tw = [...vw.querySelectorAll('.twrap')];
          const canv = [...vw.querySelectorAll('canvas')].map(c => c.getBoundingClientRect().height);
          const cards = [...vw.querySelectorAll('.gcard,.tsec')].map(c => c.getBoundingClientRect());
          return { id: vw.id, pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
                   vwRola: vw.scrollHeight > vw.clientHeight + 1,
                   horiz: tw.some(t => t.scrollWidth > t.clientWidth + 1),
                   canv, foraTela: cards.some(r => r.bottom > innerHeight + 1 || r.right > innerWidth + 1),
                   thAlto: [...vw.querySelectorAll('thead tr')].map(tr => Math.round(tr.getBoundingClientRect().height)).filter(h => h > 70),
                   tit: document.getElementById('tit').textContent };
        }, v);
        ok(`${tag} · ${v}: visão abre (${m.tit})`, m.id === 'vw-' + v);
        ok(`${tag} · ${v}: página não rola`, !m.pagRola);
        ok(`${tag} · ${v}: a visão não transborda`, !m.vwRola);
        ok(`${tag} · ${v}: tabela sem barra horizontal`, !m.horiz);
        ok(`${tag} · ${v}: nada fora da tela`, !m.foraTela);
        ok(`${tag} · ${v}: cabeçalho de tabela numa linha só (sem desmontar)`, !m.thAlto.length, m.thAlto.join(','));
        if (m.canv.length) ok(`${tag} · ${v}: gráficos com altura`, m.canv.every(h => h > 120), m.canv.map(Math.round).join(','));
        if (SHOTS && vp.width === 1600) {
          const dir = path.join(SHOTS, P.shots); fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: path.join(dir, `${v}-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
        }
      }
      if (vp.width === 1600 && tema === 'dark') {
        await page.click('.s-item[data-vw="resumo"]');
        const antes = await page.evaluate(() => [document.body.classList.contains('claro'), chKml && chKml.options.scales.x.ticks.color]);
        await page.click('#btTema'); await page.waitForTimeout(250);
        const depois = await page.evaluate(() => [document.body.classList.contains('claro'), chKml && chKml.options.scales.x.ticks.color, localStorage.getItem('bi_theme')]);
        ok('troca de tema: body.claro + bi_theme + gráfico redesenhado', !antes[0] && depois[0] && depois[2] === 'light' && antes[1] !== depois[1], JSON.stringify([antes, depois]));
        const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
          xls: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
        ok('Gerar PDF na lateral (Atalhos)', exp.pdf);
        ok('excel-export carregado (menu Excel/PNG)', exp.xls);
        const ordem = ['mobile.js','sortable-table.js','excel-export.js','pdf-export.js','build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
        ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
        ok('build-check com o build novo', exp.srcs.some(s => s.includes('build-check.js?v=202610052300')));
        // ordenação da tabela de veículos continua
        await page.click('.s-item[data-vw="veiculo"]');
        const s1 = await page.evaluate(() => document.querySelector('#body-vei tr')?.cells[0].textContent);
        await page.evaluate(() => sortVei('uni'));
        const s2 = await page.evaluate(() => [document.querySelector('#body-vei tr')?.cells[0].textContent, document.getElementById('sort-uni').textContent]);
        ok('ordenação da tabela de veículos', s2[1].includes('▼') || s2[1].includes('▲'), `${s1} → ${s2[0]} ${s2[1]}`);
        // lateral recolhida
        await page.click('#btMini'); await page.waitForTimeout(300);
        ok('lateral recolhe', await page.evaluate(k => document.querySelector('.side').classList.contains('mini') && localStorage.getItem(k) === '1', chave + '_mini'));
      }
      ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
      await ctx.close();
    }
  }
  // 3 · celular: a página volta a rolar e o gráfico tem altura
  {
    const { ctx, page, errs } = await abre(browser, P.pasta, null, { width: 390, height: 844 }, 'dark');
    const m = await page.evaluate(() => ({ rola: document.scrollingElement.scrollHeight > innerHeight || document.body.scrollHeight > document.body.clientHeight + 1,
      canv: [...document.querySelectorAll('#vw-resumo canvas')].map(c => c.getBoundingClientRect().height) }));
    ok('celular: página rola e gráficos com altura', m.rola && m.canv.every(h => h > 120), m.canv.map(Math.round).join(','));
    ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, P.shots, 'celular.png'), fullPage: true });
    await ctx.close();
  }
  await browser.close();
}

const quais = (process.env.PAINEL || 'rsl,co2').split(',');
for (const q of quais) await rodaPainel(q);
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
