// Migração das Auditorias (Demarco & DPO/VPO) para a casca padrão do portal —
// conferida no Chromium, nos DOIS lados.
//
// O painel lê DUAS abas do Consolidado Geral por gviz/JSONP (<script src=…
// &tqx=out:json;responseHandler:fn>): `Demarco` e `DPO`. A 1ª linha da aba é o
// cabeçalho (UNIDADE | 1H25 | 2H25 | 1H26 | 2H26) e cada célula de período traz
// o texto do nível ("Nível 3"), pintado pelo mapa CORES de cada aba. Período sem
// nenhum dado some da tabela; valor fora do mapa vira chip cinza (empty-niv).
// O shim gviz-cache.js fica no caminho, com o Supabase respondendo vazio, e cai
// no Google — que aqui é dublado pela rota do Playwright.
// O MESMO roteiro roda no HTML antigo (git show HEAD:…) e no novo, e as duas
// tabelas têm de sair IGUAIS célula a célula: texto, classe e cor do chip.
// Também confere o contrato do /check-metas/: `#tbl-demarco table` e
// `#tbl-dpo table` existem (o prep do check-metas abre a visão de cada uma).
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show HEAD:auditorias/index.html > /tmp/aud-antigo.html
//   cp scripts/auditorias-casca-teste.mjs docs/driverpro-apresentacao/_aud-casca-x1.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento \
//     ANTIGO=/tmp/aud-antigo.html SHOTS=<pasta> node _aud-casca-x1.mjs ; rm _aud-casca-x1.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const SHOTS = process.env.SHOTS || '';
const ANTIGO = process.env.ANTIGO;
const ORIG = 'http://gem.teste';
const PASTA = 'auditorias';
const BUILD = '202610070100';

// ── dados sintéticos no formato das abas ─────────────────────────────────────
const UNIS = ['CDD CUIABA', 'CUIABA EMPURRADA', 'CDD RIO DE JANEIRO', 'CDI MACACU', 'MACACU EMPURRADA', 'PIRAI EMPURRADA',
  'CDD GOIANIA', 'CDD GRAVATAI', 'CDD FLORIANOPOLIS', 'CDD NOVA FRIBURGO', 'CDD PELOTAS', 'CDD BALNEARIO CAMBORIU', 'CDD RONDONOPOLIS'];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// a aba DPO real escreve a unidade pelo CÓDIGO (MCC T1, CBA T2, PIR…), medido em 19/10/2026 (Aba Inspect)
const UNIS_COD = ['CGR', 'MCC T2', 'MCC T1', 'NFR', 'GRL', 'BLC', 'FLP', 'PLT', 'CBA T2', 'CBA T1', 'PIR', 'RON', 'GNA'];
const aba = (niveis, unis = UNIS) => {
  const rows = [['UNIDADE', '1H25', '2H25', '1H26', '2H26']];          // 2H26 vazio em toda linha → some
  unis.forEach((u, i) => {
    const r = [u];
    for (let p = 0; p < 3; p++) {
      const x = rnd();
      r.push(x < .06 ? '' : x < .1 ? '—' : x < .13 ? 'N/A' : niveis[Math.floor(rnd() * niveis.length)]);
    }
    r.push('');
    rows.push(r);
  });
  rows.push(['', 'Nível 1', '', '', '']);                                // linha sem unidade → descartada
  return rows;
};
const DEM = aba(['Nível 1', 'Nível 2', 'Nível 3', 'Nível 4', 'Nível 5']);
// o Resultado casa as duas abas pelo NOME da tela: a ordem é a da DPO (códigos) e Gravataí, que só
// existe no Demarco do dublê, entra no fim; Guarulhos (GRL) só existe na DPO
const DEM_COD = { 'CDD CUIABA': 'CBA T2', 'CUIABA EMPURRADA': 'CBA T1', 'CDD RIO DE JANEIRO': 'CGR', 'CDI MACACU': 'MCC T2', 'MACACU EMPURRADA': 'MCC T1',
  'PIRAI EMPURRADA': 'PIR', 'CDD GOIANIA': 'GNA', 'CDD FLORIANOPOLIS': 'FLP', 'CDD NOVA FRIBURGO': 'NFR', 'CDD PELOTAS': 'PLT', 'CDD BALNEARIO CAMBORIU': 'BLC', 'CDD RONDONOPOLIS': 'RON' };
const demEsp = col => { const porCod = {}; DEM.slice(1).filter(x => x[0]).forEach(x => { if (DEM_COD[x[0]]) porCod[DEM_COD[x[0]]] = x[col] || '—'; });
  const extra = DEM.slice(1).filter(x => x[0] && !DEM_COD[x[0]]).map(x => x[col] || '—');
  return UNIS_COD.map(c => porCod[c] || '—').concat(extra); };
const DPO = aba(['Nível 0', 'Nível 1', 'Nível 2', 'Nível 3', 'Nível 4'], UNIS_COD);
const pack = rows => ({ version: '0.6', status: 'ok', table: { cols: rows[0].map((_, i) => ({ id: String.fromCharCode(65 + i), label: '', type: 'string' })),
  rows: rows.map(r => ({ c: r.map(v => v === '' ? null : { v }) })) } });
const GVIZ = { Demarco: pack(DEM), DPO: pack(DPO) };

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function abre(browser, htmlAntigo, vp, tema) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.dismiss());
  const gviz = [];
  await page.addInitScript(({ tema }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_user_name', 'Teste');
    localStorage.setItem('bi_theme', tema);
  }, { tema });
  await page.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname === 'docs.google.com') {
      const sheet = u.searchParams.get('sheet') || '';
      const fn = ((u.searchParams.get('tqx') || '').match(/responseHandler:([A-Za-z0-9_$]+)/) || [])[1] || 'google.visualization.Query.setResponse';
      gviz.push(sheet);
      const body = GVIZ[sheet] || { status: 'error', errors: [{ message: 'aba inexistente' }] };
      return r.fulfill({ status: 200, contentType: 'application/javascript', body: `/*O_o*/\n${fn}(${JSON.stringify(body)});` });
    }
    if (u.hostname.endsWith('supabase.co')) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (u.hostname.includes('fonts.')) return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' });
  });
  await page.goto(`${ORIG}/${PASTA}/${htmlAntigo ? '__antigo.html' : ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#tbl-demarco table') && document.querySelector('#tbl-dpo table'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  return { ctx, page, errs, gviz };
}

// cada tabela: cabeçalho + célula a célula (texto, classe, cor do chip inline e computada)
const leTabelas = () => {
  const t = id => {
    const tb = document.querySelector(`#${id} table`); if (!tb) return null;
    return {
      head: [...tb.querySelectorAll('thead th')].map(th => th.textContent.trim()),
      cels: [...tb.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(td => {
        const s = td.querySelector('span');
        const cs = s ? getComputedStyle(s) : null;
        return [td.dataset.u || td.textContent.trim(), s ? s.className : '', s ? s.getAttribute('style') || '' : '',
          s && /niv/.test(s.className) && !/empty/.test(s.className) ? cs.backgroundColor + '/' + cs.color : ''].join(' ¦ ');
      })),
    };
  };
  return { demarco: t('tbl-demarco'), dpo: t('tbl-dpo') };
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

// 1 · números (níveis e cores): antigo × novo, nos dois temas
console.log(`\n══ ${PASTA} · tabelas ══`);
const res = {};
for (const lado of ['antigo', 'novo']) {
  res[lado] = {};
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs, gviz } = await abre(browser, lado === 'antigo' ? htmlAntigo : null, { width: 1600, height: 900 }, tema);
    res[lado][tema] = { errs, gviz: [...gviz], t: await page.evaluate(leTabelas) };
    await ctx.close();
  }
}
const A = res.antigo.dark.t, N = res.novo.dark.t;
console.log('  antigo demarco:', JSON.stringify(A.demarco && A.demarco.head), (A.demarco && A.demarco.cels.length) + ' linhas');
console.log('  novo   demarco:', JSON.stringify(N.demarco && N.demarco.head), (N.demarco && N.demarco.cels.length) + ' linhas');
console.log('  ex. linha:', N.demarco && N.demarco.cels[0].join(' ║ ').slice(0, 260));
ok('antigo abre sem erro de página', !res.antigo.dark.errs.length && !res.antigo.light.errs.length, [...res.antigo.dark.errs, ...res.antigo.light.errs].join(' / '));
ok('novo abre sem erro de página', !res.novo.dark.errs.length && !res.novo.light.errs.length, [...res.novo.dark.errs, ...res.novo.light.errs].join(' / '));
ok('novo leu as duas abas (Demarco e DPO)', ['Demarco', 'DPO'].every(a => res.novo.dark.gviz.includes(a)), res.novo.dark.gviz.join(','));
ok('Demarco com as 13 unidades', N.demarco && N.demarco.cels.length === 13, String(N.demarco && N.demarco.cels.length));
{
  // NOMES (Renan, 19/10/2026: "CGR: CD Rio de Janeiro. Restante você já sabe")
  const nomes = await (async () => { const { ctx, page } = await abre(browser, null, { width: 1600, height: 900 }, 'dark');
    const r = await page.evaluate(() => [...document.querySelectorAll('#tbl-dpo tbody td.uni')].map(td => td.dataset.u + '=' + td.textContent.trim())); await ctx.close(); return r; })();
  const esp = { 'CGR': 'CD Rio de Janeiro', 'MCC T2': 'CDI Macacu', 'MCC T1': 'Macacu Empurrada', 'CBA T2': 'CD Cuiabá', 'CBA T1': 'Cuiabá Empurrada', 'PIR': 'Piraí Empurrada', 'GNA': 'CD Goiânia' };
  ok('unidade aparece pelo nome (CGR = CD Rio de Janeiro…), código guardado em data-u', nomes.length === 13 && Object.entries(esp).every(([k, v]) => nomes.includes(k + '=' + v)) && nomes.every(x => !/^(.+)=\1$/.test(x)), nomes.join(' · '));
}
ok('DPO/VPO com as 13 unidades', N.dpo && N.dpo.cels.length === 13, String(N.dpo && N.dpo.cels.length));
ok('período sem dado (2H26) some do cabeçalho', N.demarco && JSON.stringify(N.demarco.head) === '["UNIDADE","1H25","2H25","1H26"]', JSON.stringify(N.demarco && N.demarco.head));
{
  const todas = [...N.demarco.cels, ...N.dpo.cels].flat();
  ok('células de nível pintadas pelo mapa (chip com fundo inline)', todas.filter(c => /background:/.test(c)).length > 40, String(todas.filter(c => /background:/.test(c)).length));
  ok('valor fora do mapa / vazio vira texto apagado (.vazio)', todas.some(c => /^N\/A ¦ vazio/.test(c)) && todas.some(c => /^— ¦ vazio/.test(c)));
  ok('Demarco Nível 1 = azul #1565C0 e DPO Nível 0 = #404040', todas.some(c => /^Nível 1 ¦ niv ¦ background:#1565C0/.test(c)) && N.dpo.cels.flat().some(c => /^Nível 0 ¦ niv ¦ background:#404040/.test(c)));
}
for (const tema of ['dark', 'light']) for (const tb of ['demarco', 'dpo']) {
  const a = res.antigo[tema].t[tb], b = res.novo[tema].t[tb];
  ok(`igual antes × depois (${tema === 'light' ? 'claro' : 'escuro'}) · ${tb}: cabeçalho`, JSON.stringify(a.head) === JSON.stringify(b.head));
  const dif = [];
  // SELOS DO DPO (Renan, 19/10/2026): Nível 1 a 4 do DPO viram o selo (texto "Nível N" escondido na célula)
  // PADRÃO DE TABELA (19/10/2026): unidade em texto simples e vazio/N/A em texto apagado (span .vazio)
  const esperado = c => tb === 'dpo' && /^Nível [1-4] ¦ niv ¦/.test(c) ? c.split(' ¦ ')[0] + ' ¦ selo ¦  ¦ '
    : / ¦ uni-card ¦ /.test(c) ? c.split(' ¦ ')[0] + ' ¦  ¦  ¦ '
    : / ¦ niv empty-niv ¦ /.test(c) ? c.split(' ¦ ')[0] + ' ¦ vazio ¦  ¦ ' : c;
  a.cels.forEach((r, i) => r.forEach((c, j) => { if (esperado(c) !== (b.cels[i] || [])[j]) dif.push(`${i},${j}: ${esperado(c)} × ${(b.cels[i] || [])[j]}`); }));
  ok(`igual antes × depois (${tema === 'light' ? 'claro' : 'escuro'}) · ${tb}: ${a.cels.length}×${a.cels[0].length} células (texto, classe e cor do chip)`,
    a.cels.length === b.cels.length && !dif.length, dif.slice(0, 2).join(' / '));
}

// 2 · casca: sem rolagem, visão, tema, exportação — 1366×768 e 1600×900
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, null, vp, tema);
    const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    ok(`${tag}: body.claro = tema`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light'), tema));
    // DPO/VPO e Demarco em visões próprias, tabela na tela toda (Renan, 19/10/2026)
    for (const [v, idT, nome] of [['dpo', 'tbl-dpo', 'DPO/VPO'], ['demarco', 'tbl-demarco', 'Demarco']]) {
    await page.click(`.s-item[data-vw="${v}"]`); await page.waitForTimeout(250);
    const m = await page.evaluate(idT => {
      const se = document.scrollingElement, vw = document.querySelector('.vw.on');
      const tw = [...vw.querySelectorAll('.twrap')];
      const blocos = [...vw.querySelectorAll('.tsec,.twrap')].map(c => c.getBoundingClientRect());
      const card = document.querySelector('#' + idT).closest('.card');
      const cs = getComputedStyle(card), co = document.getElementById('cols'), cc = getComputedStyle(co), cb = co.getBoundingClientRect(), cr = card.getBoundingClientRect();
      const cols = { width: cb.width - parseFloat(cc.paddingLeft) - parseFloat(cc.paddingRight), height: cb.height - parseFloat(cc.paddingTop) - parseFloat(cc.paddingBottom) };
      const tb = document.querySelector('#' + idT + ' table'), twr = document.querySelector('#' + idT).getBoundingClientRect();
      const img = vw.querySelector('.selo img'), niv = vw.querySelector('.niv:not(.empty-niv)');
      return { id: vw.id, tit: document.getElementById('tit').textContent,
        pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
        vwRola: vw.scrollHeight > vw.clientHeight + 1,
        horiz: tw.some(t => t.scrollWidth > t.clientWidth + 1),
        vert: tw.some(t => t.scrollHeight > t.clientHeight + 1),
        foraTela: blocos.some(r => r.bottom > innerHeight + 1 || r.right > innerWidth + 1),
        cheia: [Math.round(cr.width / cols.width * 100), Math.round(cr.height / cols.height * 100), Math.round(tb.getBoundingClientRect().height / twr.height * 100)],
        grande: img ? Math.round(img.getBoundingClientRect().height) : niv ? parseFloat(getComputedStyle(niv).fontSize) : 0,
        thAlto: [...vw.querySelectorAll('thead tr')].map(tr => Math.round(tr.getBoundingClientRect().height)).filter(h => h > 60),
        thAlin: [...document.querySelectorAll('#' + idT + ' thead th')].map(th => getComputedStyle(th).textAlign).join(','),
        cabBg: getComputedStyle(document.querySelector('#' + idT + ' thead th')).backgroundColor,
        cabSticky: getComputedStyle(document.querySelector('#' + idT + ' thead th')).position,
        moldura: [cs.borderTopWidth, cs.backgroundColor, cs.boxShadow].join(' | '),
        twBorda: getComputedStyle(document.querySelector('#' + idT)).borderTopWidth,
        ttits: [...vw.querySelectorAll('.ttit')].map(e => e.offsetParent ? e.textContent : '(oculto)'),
        sub: document.getElementById('titSub').textContent };
    }, idT);
    ok(`${tag} · ${nome}: visão abre (${m.tit})`, m.id === 'vw-' + v && m.tit === nome);
    ok(`${tag} · ${nome}: página não rola`, !m.pagRola);
    ok(`${tag} · ${nome}: a visão não transborda`, !m.vwRola);
    ok(`${tag} · ${nome}: tabela sem barra horizontal`, !m.horiz);
    ok(`${tag} · ${nome}: todas as unidades à vista, sem barra vertical`, !m.vert);
    ok(`${tag} · ${nome}: nada fora da tela`, !m.foraTela);
    ok(`${tag} · ${nome}: tabela na tela toda (largura · altura do card · tabela no card, %)`, m.cheia[0] >= 99 && m.cheia[1] >= 99 && m.cheia[2] >= 97, m.cheia.join(' · '));
    ok(`${tag} · ${nome}: grande (selo ≥ 34 px ou letra do chip ≥ 12 px)`, v === 'dpo' ? m.grande >= 34 : m.grande >= 12, String(m.grande));
    ok(`${tag} · ${nome}: cabeçalho numa linha só`, !m.thAlto.length, m.thAlto.join(','));
    ok(`${tag} · ${nome}: cabeçalho alinhado ao conteúdo`, /^left(,center)+$/.test(m.thAlin), m.thAlin);
    ok(`${tag} · ${nome}: cabeçalho sticky no tom --cabec`, m.cabSticky === 'sticky' && m.cabBg !== 'rgba(0, 0, 0, 0)', `${m.cabSticky} ${m.cabBg}`);
    ok(`${tag} · ${nome}: espelho atrás da tabela`, /^1px \| rgba?\(/.test(m.moldura) && !/rgba\(0, 0, 0, 0\)/.test(m.moldura), `${m.moldura} · twrap ${m.twBorda}`);
    ok(`${tag} · ${nome}: título que repete a visão escondido`, m.ttits.every(t => t === '(oculto)'), JSON.stringify(m.ttits));
    ok(`${tag} · ${nome}: subtítulo com a fonte e a hora da carga`, /^Consolidado Geral — Demarco & DPO\/VPO · Atualizado \d\d\/\d\d\/\d{4} \d\d:\d\d$/.test(m.sub), m.sub);
    if (SHOTS) { const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `${v}-${vp.width}-${tema === 'light' ? 'claro' : 'escuro'}.png`) }); }
    }
    // VISÃO RESULTADO (Renan, 19/10/2026): só unidade e resultado, com Ano e Semestre
    const filtrosResumo = await page.evaluate(() => ['ms-ano', 'ms-h'].map(i => getComputedStyle(document.getElementById(i)).display));
    ok(`${tag}: Ano e Semestre do Resultado (escolha única) escondidos nas visões DPO/VPO e Demarco`, filtrosResumo.every(d => d === 'none'), filtrosResumo.join(','));
    await page.click('.s-item[data-vw="resultado"]'); await page.waitForTimeout(250);
    const lr = () => page.evaluate(() => {
      const t = id => { const tb = document.querySelector(`#${id} table`); if (!tb) return document.querySelector('#' + id).textContent.trim();
        return { head: [...tb.querySelectorAll('thead th')].map(th => th.textContent.trim()),
          rows: [...tb.querySelectorAll('tbody tr')].map(tr => [...tr.cells].map(td => td.textContent.trim().replace(/\s+/g, ' '))),
          selos: tb.querySelectorAll('.selo img').length }; };
      const vw = document.querySelector('.vw.on'), tw = [...vw.querySelectorAll('.twrap')];
      return { tit: document.getElementById('tit').textContent, ano: document.getElementById('ms-ano')._val, h: document.getElementById('ms-h')._val,
        lbl: [...document.querySelectorAll('#ms-ano .ms-lbl, #ms-h .ms-lbl')].map(e => e.textContent).join(' | '),
        vis: ['ms-ano', 'ms-h'].map(i => getComputedStyle(document.getElementById(i)).display),
        tab: t('res-tab'), nTab: document.querySelectorAll('#vw-resultado table').length,
        topo: Math.round(document.querySelector('.top').getBoundingClientRect().height),
        alturas: [...new Set([...document.querySelectorAll('#res-tab tbody tr')].map(tr => Math.round(tr.getBoundingClientRect().height)))],
        centro: [...document.querySelectorAll('#res-tab td .selo')].map(sl => { const a = sl.getBoundingClientRect(), c = sl.closest('td').getBoundingClientRect(); return Math.round(Math.abs((a.left + a.right) / 2 - (c.left + c.right) / 2)); }),
        esq: [...new Set([...document.querySelectorAll('#res-tab td .selo img')].map(i => Math.round(i.getBoundingClientRect().left)))],
        vert: tw.some(x => x.scrollHeight > x.clientHeight + 1), horiz: tw.some(x => x.scrollWidth > x.clientWidth + 1),
        pagRola: document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight + 1 };
    });
    let r = await lr();
    ok(`${tag}: Resultado abre no último semestre com dado (1H26) e mostra os dois filtros`, r.tit === 'Resultado' && r.ano === '2026' && r.h === '1H' && r.vis.every(d => d !== 'none'), `${r.tit} ${r.ano} ${r.h} ${r.vis}`);
    /* UMA TABELA SÓ (Renan, 20/10/2026: "pode ser uma planilha só… uma coluna escrito Demarco e
       outra escrito DPO/VPO"): Unidade · Demarco · DPO/VPO, 13 unidades casadas pelo nome */
    ok(`${tag}: Resultado = UMA tabela, Unidade · Demarco · DPO/VPO, 13 unidades`, r.nTab === 1 && r.tab.head && r.tab.head.length === 3 && r.tab.head[1] === 'Demarco' && r.tab.head[2] === 'DPO/VPO' && r.tab.rows.length === 14, JSON.stringify(r.tab.head) + ' · ' + (r.tab.rows || []).length);
    const espDpo = DPO.slice(1).filter(x => x[0]).map(x => x[3] || '—').concat(['—']);   // Gravataí só no Demarco
    const espDem1 = demEsp(3);
    ok(`${tag}: coluna DPO/VPO = a coluna 1H26 da aba, com selo e nome do nível`, r.tab.rows.every((c, i) => c[2].includes(espDpo[i])) && r.tab.selos === espDpo.filter(v => /^Nível [1-4]$/.test(v)).length && r.tab.rows.some(c => /Sustentável|Básico|Intermediário|Top Performance/.test(c[2])), JSON.stringify(r.tab.rows.slice(0, 3)));
    ok(`${tag}: coluna Demarco = a coluna 1H26 da aba Demarco, na linha da MESMA unidade (Guarulhos "—", Gravataí no fim)`, r.tab.rows.every((c, i) => c[1].replace(/Demarco$/, '') === espDem1[i]) && r.tab.rows[4][1] === '—' && /GRAVATAI/i.test(r.tab.rows[13][0]), JSON.stringify(r.tab.rows.slice(0, 3).map(c => c[1])) + ' × ' + JSON.stringify(espDem1.slice(0, 3)));
    ok(`${tag}: Resultado: filtros numa linha só no topo`, r.topo <= 70, `${r.topo} px`);
    ok(`${tag}: Resultado: linhas da mesma altura`, Math.max(...r.alturas) - Math.min(...r.alturas) <= 2, r.alturas.join(','));
    ok(`${tag}: Resultado do DPO centrado na coluna, selos alinhados entre si`, r.centro.length && Math.max(...r.centro) <= 3 && r.esq.length === 1, `${Math.max(...r.centro)} px · ${r.esq.length} alinhamento(s)`);
    ok(`${tag}: Resultado cabe sem rolagem`, !r.vert && !r.horiz && !r.pagRola, `${r.vert} ${r.horiz} ${r.pagRola}`);
    if (SHOTS) { const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `resultado-${vp.width}-${tema === 'light' ? 'claro' : 'escuro'}.png`) }); }
    await page.click('#ms-ano .ms-btn'); await page.click('#ms-ano input[data-v="2025"]'); await page.waitForTimeout(100);
    await page.click('#ms-h .ms-btn'); await page.click('#ms-h input[data-v="2H"]'); await page.waitForTimeout(150);
    r = await lr();
    const esp2 = demEsp(2);
    ok(`${tag}: Ano 2025 + 2H troca o semestre nas duas colunas`, r.tab.rows.every((c, i) => c[1].replace(/Demarco$/, '') === esp2[i]) && r.lbl === 'Ano 2025 | Semestre 2H', `${r.tab.head} · ${r.lbl}`);
    await page.click('#ms-h .ms-btn'); await page.click('#ms-h input[data-v="2H"]'); await page.waitForTimeout(80);
    await page.click('#ms-ano .ms-btn'); await page.click('#ms-ano input[data-v="2026"]'); await page.waitForTimeout(150);
    r = await lr();
    ok(`${tag}: semestre sem coluna na aba (2H26 vazio) avisa em vez de tabela vazia`, typeof r.tab === 'string' && /Sem 2H 2026|Nenhuma/.test(r.tab) || (r.tab.rows && r.tab.rows.every(c => c[1] === '—' && c[2] === '—')), JSON.stringify(r.tab).slice(0, 80));
    await page.click('.s-item[data-vw="demarco"]'); await page.waitForTimeout(150);
    if (SHOTS && vp.width === 1600) {
      const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `resumo-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
    }
    if (SHOTS && vp.width === 1366) {
      const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, `resumo-1366-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
    }
    if (vp.width === 1600 && tema === 'dark') {
      // contrato do /check-metas/: prep vazio, alvo = a tabela de cada aba, chips com cor
      const cm = await page.evaluate(() => ['#tbl-demarco table', '#tbl-dpo table'].map(s => { const t = document.querySelector(s);
        return t ? t.querySelectorAll('tbody tr').length + ':' + t.querySelectorAll('.niv[style*="background"], .selo[data-bg] img').length : null; }));
      ok('check-metas: #tbl-demarco table e #tbl-dpo table existem, com chips pintados', cm.every(x => x && +x.split(':')[0] === 13 && +x.split(':')[1] > 20), cm.join(' / '));
      await page.click('#btTema'); await page.waitForTimeout(200);
      const depois = await page.evaluate(() => [document.body.classList.contains('claro'), localStorage.getItem('bi_theme'), document.getElementById('btTema').innerHTML.includes('M21 12.79')]);
      ok('troca de tema: body.claro + bi_theme + ícone', depois[0] && depois[1] === 'light' && depois[2], JSON.stringify(depois));
      await page.click('#btTema'); await page.waitForTimeout(150);
      const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('#pdf-slot .s-item, #pdf-slot button'),
        pdfAtalho: (() => { const s = document.getElementById('pdf-slot'); let p = s.previousElementSibling; while (p && !p.classList.contains('s-sec')) p = p.previousElementSibling; return p && p.textContent.trim(); })(),
        xls: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
      ok('Gerar PDF na lateral (Atalhos)', exp.pdf && exp.pdfAtalho === 'Atalhos', exp.pdfAtalho);
      ok('excel-export carregado (menu Excel/PNG no botão direito)', exp.xls);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('ctrlk.js e gviz-cache.js ficaram', exp.srcs.some(s => s.includes('ctrlk.js')) && exp.srcs.some(s => s.includes('gviz-cache.js')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(b => { const m = (document.querySelector('meta[name=build]') || {}).content; return !!m && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + (document.querySelector('meta[name=build]') || {}).content)); }, BUILD));
      await page.click('#tbl-demarco tbody tr td', { button: 'right' }); await page.waitForTimeout(200);
      const menu = await page.evaluate(() => { const m = document.getElementById('xl-menu'); return m && getComputedStyle(m).display !== 'none' ? m.textContent : ''; });
      ok('botão direito na tabela: menu "Exportar Excel"', /Exportar Excel/.test(menu), menu.trim().slice(0, 80));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      const s1 = await page.evaluate(() => [...document.querySelectorAll('#tbl-demarco tbody tr')].map(tr => tr.cells[0].textContent).join(','));
      await page.click('#tbl-demarco thead th:nth-child(1)'); await page.waitForTimeout(150);
      const s2 = await page.evaluate(() => [...document.querySelectorAll('#tbl-demarco tbody tr')].map(tr => tr.cells[0].textContent).join(','));
      ok('ordenação pelo cabeçalho continua', s1 !== s2, `${s1.slice(0, 60)} → ${s2.slice(0, 60)}`);
      const n0 = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('docs.google.com')).length);
      await page.click('.side .s-item[onclick="carregar()"]'); await page.waitForTimeout(700);
      const n1 = await page.evaluate(() => [performance.getEntriesByType('resource').filter(e => e.name.includes('docs.google.com')).length, document.getElementById('titSub').textContent]);
      ok('"Atualizar dados" relê as abas e escreve no subtítulo', n1[0] >= n0 + 2 && /Atualizado/.test(n1[1]), `${n0} → ${n1[0]} · ${n1[1]}`);
      // ANO E SEMESTRE NAS VISÕES DPO/VPO E DEMARCO (Renan, 19/10/2026: "Aqui também filtro de ano e semestre")
      await page.click('.s-item[data-vw="dpo"]'); await page.waitForTimeout(150);
      const vis = id => page.evaluate(i => getComputedStyle(document.getElementById(i)).display, id);
      ok('Ano e Semestre (múltiplos) aparecem no DPO/VPO', (await vis('ms-anos')) !== 'none' && (await vis('ms-sems')) !== 'none');
      const cabs = () => page.evaluate(() => ['#tbl-demarco', '#tbl-dpo'].map(s => { const t = document.querySelector(s + ' table');
        return t ? [...t.querySelectorAll('thead th')].map(th => th.textContent.trim()).slice(1).join(',') : document.querySelector(s).textContent.trim(); }));
      const so = async (id, v) => { await page.click(`#${id} .ms-btn`); await page.waitForTimeout(100);
        await page.evaluate(([i, x]) => [...document.querySelectorAll(`#${i} .ms-only`)].find(o => o.dataset.v === x).click(), [id, v]);
        await page.waitForTimeout(150); await page.mouse.click(5, 5); };
      await so('ms-anos', '2025');
      const c25 = await cabs();
      ok('Ano = 2025: só 1H25 e 2H25 nas duas tabelas', c25.every(c => c === '1H25,2H25'), JSON.stringify(c25));
      await so('ms-sems', '2H');
      const c2h = await cabs();
      ok('Ano 2025 + Semestre 2H: só 2H25', c2h.every(c => c === '2H25'), JSON.stringify(c2h));
      await so('ms-anos', '2026');
      const c26 = await cabs();
      ok('2H de 2026 sem resultado: aviso em vez de tabela vazia', c26.every(c => /Nenhum semestre/.test(c)), JSON.stringify(c26));
      await page.evaluate(() => ['ms-anos', 'ms-sems'].forEach(i => document.querySelector(`#${i} .ms-all`).click())); await page.waitForTimeout(150);
      const call = await cabs();
      ok('Todos volta às colunas de sempre', call.every(c => c === '1H25,2H25,1H26'), JSON.stringify(call));
      await page.click('.s-item[data-vw="resultado"]'); await page.waitForTimeout(150);
      ok('no Resultado ficam só os filtros de escolha única', (await vis('ms-anos')) === 'none' && (await vis('ms-ano')) !== 'none');
      await page.click('.s-item[data-vw="dpo"]'); await page.waitForTimeout(150);
      // FILTRO TIER (Renan, 17/10/2026): T1 = Empurradas + armazém de Cuiabá; T2 = CDDs e CDI
      const tierDe = () => ['#tbl-demarco', '#tbl-dpo'].map(s => [...document.querySelectorAll(s + ' tbody tr')].map(tr => tr.cells[0].dataset.u || tr.cells[0].textContent.trim()));
      await page.click('#ms-tier .ms-btn'); await page.waitForTimeout(150);
      await page.evaluate(() => { const o = [...document.querySelectorAll('#ms-tier .ms-only')].find(x => x.dataset.v === 'T1'); o.click(); });
      await page.waitForTimeout(200);
      const t1 = await page.evaluate(tierDe);
      await page.evaluate(() => { const o = [...document.querySelectorAll('#ms-tier .ms-only')].find(x => x.dataset.v === 'T2'); o.click(); });
      await page.waitForTimeout(200);
      const t2 = await page.evaluate(tierDe);
      const cnt = await page.evaluate(() => document.querySelector('#ms-tier .ms-cnt').textContent);
      await page.evaluate(() => document.querySelector('#ms-tier .ms-all').click()); await page.waitForTimeout(200);
      const todos = await page.evaluate(tierDe);
      await page.mouse.click(5, 5);
      const T1 = ['CUIABA EMPURRADA', 'MACACU EMPURRADA', 'PIRAI EMPURRADA', 'MCC T1', 'CBA T1', 'PIR'];
      ok('filtro Tier = T1: só as Empurradas nas duas tabelas', t1.every(l => l.length === 3 && l.every(u => T1.includes(u))), JSON.stringify(t1));
      ok('filtro Tier = T2: CDDs e CDI, sem Empurrada', t2.every(l => l.length === 10 && l.every(u => !/EMPURRADA| T1$|^PIR$/.test(u))) && cnt === '1', JSON.stringify(t2[0]));
      ok('filtro Tier "Todos" volta às 13 unidades', todos.every(l => l.length === 13), todos.map(l => l.length).join('/'));
      await page.click('#btMini'); await page.waitForTimeout(300);
      ok('lateral recolhe (chave auditorias_mini)', await page.evaluate(() => document.querySelector('.side').classList.contains('mini') && localStorage.getItem('auditorias_mini') === '1'));
      await page.hover('.s-item[data-vw="demarco"]'); await page.waitForTimeout(200);
      ok('dica na lateral recolhida', await page.evaluate(() => { const d = document.querySelector('.dica.on'); return d && d.textContent === 'Demarco'; }));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'resumo-mini-escuro.png') });
      const mini = await page.evaluate(() => { const tw = [...document.querySelectorAll('.twrap')]; return tw.some(t => t.scrollWidth > t.clientWidth + 1); });
      ok('lateral recolhida: tabela sem barra horizontal', !mini);
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}
// 3 · celular: a tabela da visão aberta aparece inteira
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  const m = await page.evaluate(() => {
    const b = document.querySelector('#tbl-dpo').getBoundingClientRect();
    return { vis: document.querySelector('.vw.on').id, alt: Math.round(b.height),
      larg: document.scrollingElement.scrollWidth <= innerWidth + 1 };
  });
  ok('celular: abre no DPO/VPO com a tabela inteira (altura)', m.vis === 'vw-dpo' && m.alt > 200, JSON.stringify(m));
  ok('celular: página sem rolagem lateral', m.larg);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-resumo.png'), fullPage: true });
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
