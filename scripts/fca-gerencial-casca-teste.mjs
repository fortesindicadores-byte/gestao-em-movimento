// Migração do FCA Gerencial (fca-gerencial/, card "Aderência ao FCA") para a
// casca padrão do portal — conferida no Chromium, nos DOIS lados.
//
// O painel lê UMA fonte: a tabela `fca` do Supabase (`sb.from('fca').select('*')`).
// O supabase-js do CDN vira um dublê que devolve as mesmas linhas sintéticas nos
// dois lados (formato real: origem RPM/Custos, vigencia "mmm/aa", unidade com e
// sem "(INATIVO)", projeto "NÍVEL 3 - COD", prazo AAAA-MM-DD, status, causa,
// ação e alguns fatos de Km/L e R$/L que o painel descarta). O MESMO roteiro roda
// no HTML antigo (git show 35353c4:…) e no novo, e os números (hero, os seis
// cards, os dois gráficos mensais, a tabela por Unidade e por Projeto e o
// Preenchimento) têm de sair IGUAIS — texto e cor de faixa, nos dois temas.
//
// Uso (Playwright só importa de dentro de docs/driverpro-apresentacao/):
//   git show 35353c4:fca-gerencial/index.html > <scratch>/fcag-antigo.html   (o último antes da casca)
//   cp scripts/fca-gerencial-casca-teste.mjs docs/driverpro-apresentacao/_fcag-casca-x1.mjs
//   cd docs/driverpro-apresentacao && RAIZ=/home/user/gestao-em-movimento \
//     ANTIGO=<html antigo> CHART_JS=<chart.umd.js> H2C=<html2canvas.min.js> \
//     FONT_DIR=<@fontsource/montserrat/files> SHOTS=<pasta> node _fcag-casca-x1.mjs ; rm _fcag-casca-x1.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = process.env.RAIZ || '/home/user/gestao-em-movimento';
const ANTIGO = process.env.ANTIGO;
const CHART_JS = process.env.CHART_JS || '';
const H2C = process.env.H2C || '';
const SHOTS = process.env.SHOTS || '';
const FONT_DIR = process.env.FONT_DIR || '';
const BUILD = '202610070300';
const ORIG = 'http://gem.teste';
const PASTA = 'fca-gerencial';

// ── linhas sintéticas da tabela fca ──
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const UNIS = ['CBA T1', 'CBA T1 WH', 'CBA T2', 'MCC T1', 'MCC T2', 'PIR', 'GRL', 'CGR', 'BLC', 'FLP', 'PLT', 'NFR', 'RON', 'ANG (INATIVO)'];
const PROJ = ['ROTA', 'EMPURRADA', 'APOIO', 'ARMAZEM', 'ROTA (VAN)', 'INSUMOS'];
const STATUS = ['Concluída', 'Em andamento', 'Não iniciada', 'Concluida', 'Andamento', ''];
const FATOS = ['Pacote Manutenções', 'Pacote Pneus', 'Pacote Combustíveis', 'Disponibilidade', 'Preventivas', 'Checklist T2'];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ROWS = [];
for (let m = 0; m < 9; m++) for (const u of UNIS) {
  const n = 1 + Math.floor(rnd() * 5);
  for (let k = 0; k < n; k++) {
    const cod = u.split(' ')[0];
    const d = new Date(2026, m + 1, 1 + Math.floor(rnd() * 60));
    const prazo = rnd() < .08 ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`;
    const st = STATUS[Math.floor(rnd() * STATUS.length) % (m < 6 ? 2 : STATUS.length)];
    ROWS.push({ id: ROWS.length + 1, origem: rnd() < .5 ? 'RPM' : 'Custos ', vigencia: `${MES[m]}/26`, unidade: u,
      projeto: rnd() < .1 ? `${PROJ[Math.floor(rnd() * PROJ.length)]} (INATIVO) - ${cod}` : `${PROJ[Math.floor(rnd() * PROJ.length)]} - ${cod}`,
      prazo, status: st, fato: FATOS[Math.floor(rnd() * FATOS.length)],
      causa: rnd() < .7 ? 'Causa escrita' : (rnd() < .5 ? '' : null), acao: rnd() < .65 ? 'Ação escrita' : '   ' });
  }
}
// fatos que o painel DESCARTA (Km/L e R$/L são causa do Combustível)
ROWS.push({ id: 9001, origem: 'RPM', vigencia: 'set/26', unidade: 'PIR', projeto: 'ROTA - PIR', prazo: '2026-01-01', status: 'Não iniciada', fato: 'Km/L abaixo do remunerado', causa: '', acao: '' });
ROWS.push({ id: 9002, origem: 'Custos', vigencia: 'set/26', unidade: 'PIR', projeto: 'ROTA - PIR', prazo: '2026-01-01', status: 'Não iniciada', fato: 'Preço R$/L', causa: '', acao: '' });

let falhas = 0, oks = 0;
const ok = (t, v, extra = '') => { console.log(`  ${v ? '✓' : '✗'} ${t}${extra ? '  (' + extra + ')' : ''}`); v ? oks++ : falhas++; };
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const sbDuble = (rows, erro) => `window.supabase={createClient:()=>({from:t=>({select:async()=>{await new Promise(r=>setTimeout(r,20));
  ${erro ? "return {data:null,error:{message:'banco fora'}};" : "return t==='fca'?{data:JSON.parse(JSON.stringify(window.__FCA)),error:null}:{data:[],error:null};"}}})})};`;

async function abre(browser, htmlAntigo, vp, tema, { erro = false } = {}) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'pt-BR' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept('Teste'));
  await page.addInitScript(({ ROWS, tema }) => {
    sessionStorage.setItem('gem_hub', '1');
    localStorage.setItem('bi_theme', tema);
    window.__FCA = ROWS;
  }, { ROWS, tema });
  await page.route('**/*', async r => {
    const req = r.request(), u = new URL(req.url());
    if (u.origin === ORIG) {
      if (u.pathname.endsWith('/__antigo.html')) return r.fulfill({ status: 200, contentType: 'text/html', body: htmlAntigo });
      const f = path.join(RAIZ, decodeURIComponent(u.pathname).replace(/\/$/, '/index.html'));
      if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
      return r.fulfill({ status: 404, body: '' });
    }
    if (u.hostname.endsWith('supabase.co')) {   // o gviz-cache.js consulta o banco: nada aqui
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
      if (req.method() === 'OPTIONS') return r.fulfill({ status: 200, headers: cors, body: '' });
      return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: '[]' });
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
    const js = b => r.fulfill({ status: 200, contentType: 'application/javascript', body: b });
    if (u.pathname.includes('supabase-js')) return js(sbDuble(ROWS, erro));
    if (u.pathname.includes('chart.js') && CHART_JS) return js(fs.readFileSync(CHART_JS));
    if (u.pathname.includes('html2canvas') && H2C) return js(fs.readFileSync(H2C));
    // jsPDF dublado: aceita qualquer chamada, conta as páginas e guarda o nome do arquivo
    if (u.pathname.includes('jspdf')) return js(`window.__pdfPag=1;window.jspdf={jsPDF:function(){return new Proxy({},{get:(t,k)=>k==='internal'?{pageSize:{getWidth:()=>338.7,getHeight:()=>190.5,width:338.7,height:190.5}}:k==='save'?(n=>{window.__pdf=n;}):k==='addPage'?(()=>{window.__pdfPag++;return t;}):k==='getNumberOfPages'?(()=>window.__pdfPag):(()=>t)});}};`);
    return js('/*stub*/');
  });
  await page.goto(`${ORIG}/${PASTA}/${htmlAntigo ? '__antigo.html' : ''}`, { waitUntil: 'domcontentloaded' });
  if (!erro) await page.waitForFunction(() => document.querySelectorAll('#tbl table tr').length > 3 && document.querySelectorAll('#tbl-pre table tr').length > 3, null, { timeout: 25000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}

// tudo que é número na tela: hero, cards, gráficos, as duas tabelas (texto + cor)
const leTela = () => {
  const cor = e => e ? (e.style.color || '') : '';
  const tab = id => [...document.querySelectorAll(`#${id} table tr`)].map(tr => [...tr.cells].map(c => {
    const sp = c.querySelector('.pctcell');
    return c.textContent.trim() + (c.style.color ? '{' + c.style.color + '}' : '') + (sp ? '[' + sp.style.background + ']' : '') + (c.title ? '<' + c.title + '>' : '');
  }).join(' | '));
  const ch = c => c ? { labels: c.data.labels, data: c.data.datasets[0].data.map(v => v == null ? null : +v.toFixed(6)),
    bg: c.data.datasets[0].backgroundColor, bc: c.data.datasets[0].borderColor, min: c.options.scales.y.min, max: c.options.scales.y.max } : null;
  return {
    hero: ['h-total', 'h-prazo', 'h-concl'].map(id => { const e = document.getElementById(id); return e.textContent + '{' + cor(e) + '}'; }),
    kpis: ['k-tt', 'k-concl', 'k-andam', 'k-nini', 'k-nop', 'k-venc'].map(id => document.getElementById(id).textContent),
    prazo: ch(chPrazo), concl: ch(chConcl),
    tbl: tab('tbl'), pre: tab('tbl-pre'), preSub: document.getElementById('pre-sub').textContent.trim(),
    vazio: [document.querySelector('#tbl .loading'), document.querySelector('#tbl-pre .loading')].map(e => e ? e.textContent : '').join('/'),
    filtros: [...document.querySelectorAll('.ms-wrap')].map(w => w.id + ':' + w.querySelectorAll('.ms-opt input[data-v]').length + ':' + [...(w._sel || [])].join('/')).join(','),
  };
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--lang=pt-BR'] });
const htmlAntigo = fs.readFileSync(ANTIGO, 'utf8');

// 1 · números: antigo × novo
console.log('\n══ números: antigo × novo ══');
const sel = (id, vals) => { const w = document.getElementById(id); w._sel.clear(); vals.forEach(v => w._sel.add(v)); w._render && w._render(''); atualizar(); };
const passos = {
  'base (último mês)': null,
  'Vigência = todas': `(${sel})('ms-vig',[])`,
  'Unidade = PIR + CBA T1': `(${sel})('ms-unidade',['PIR','CBA T1'])`,
  'Origem = RPM': `(${sel})('ms-unidade',[]);(${sel})('ms-origem',['RPM'])`,
  'Vigência jun+jul · tabela por Projeto': `(${sel})('ms-origem',[]);(${sel})('ms-vig',['jun/26','jul/26']);setDim('projeto')`,
  'ordena por Prazo · Preenchimento por RPM': `sortBy('pPrazo');sortPre('rpm')`,
  'Status Prazo = Vencida · Projeto = ROTA': `setDim('unidade');(${sel})('ms-vig',[]);(${sel})('ms-sprazo',['Vencida']);(${sel})('ms-projeto',['ROTA'])`,
  'Status = Concluída (sem Vencida)': `(${sel})('ms-projeto',[]);(${sel})('ms-sprazo',[]);(${sel})('ms-status',['Concluída'])`,
  'filtro que esvazia (Vencida + Concluída)': `(${sel})('ms-sprazo',['Vencida'])`,
};
const res = {};
for (const lado of ['antigo', 'novo']) {
  res[lado] = {};
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, lado === 'antigo' ? htmlAntigo : null, { width: 1600, height: 900 }, tema);
    res[lado][tema] = { errs };
    for (const [nome, fn] of Object.entries(passos)) {
      if (fn) { await page.evaluate(fn); await page.waitForTimeout(150); }
      res[lado][tema][nome] = await page.evaluate(leTela);
    }
    await ctx.close();
  }
}
for (const tema of ['dark', 'light']) {
  ok(`antigo abre sem erro de página (${tema})`, res.antigo[tema].errs.length === 0, res.antigo[tema].errs.join(' / '));
  ok(`novo abre sem erro de página (${tema})`, res.novo[tema].errs.length === 0, res.novo[tema].errs.join(' / '));
}
const b = res.novo.dark['base (último mês)'];
console.log('  novo base: hero', b.hero.join(' · '), '| cards', b.kpis.join(' · '));
console.log('  filtros:', b.filtros);
ok('carregou: tabela por unidade e preenchimento com linhas', b.tbl.length > 5 && b.pre.length > 5, `${b.tbl.length} · ${b.pre.length}`);
ok('Km/L e R$/L ficam fora (Total de Ações da base todas as vigências)', res.novo.dark['Vigência = todas'].kpis[0] === String(ROWS.length - 2).replace(/\B(?=(\d{3})+(?!\d))/g, '.'), res.novo.dark['Vigência = todas'].kpis[0]);
ok('"(INATIVO)" some da unidade (ANG) e do projeto', res.novo.dark['Vigência = todas'].tbl.some(l => l.startsWith('ANG |')) && !b.filtros.includes('INATIVO'));
for (const tema of ['dark', 'light']) for (const nome of Object.keys(passos)) {
  const A = res.antigo[tema][nome], N = res.novo[tema][nome];
  const t = `[${tema === 'light' ? 'claro' : 'escuro'} · ${nome}]`;
  ok(`igual ${t}: hero (valor e cor da faixa)`, JSON.stringify(A.hero) === JSON.stringify(N.hero), `${A.hero} × ${N.hero}`);
  ok(`igual ${t}: seis cards`, JSON.stringify(A.kpis) === JSON.stringify(N.kpis), `${A.kpis} × ${N.kpis}`);
  ok(`igual ${t}: gráficos (meses, valores, cores, eixo)`, JSON.stringify([A.prazo, A.concl]) === JSON.stringify([N.prazo, N.concl]));
  const d1 = A.tbl.findIndex((l, i) => l !== N.tbl[i]), d2 = A.pre.findIndex((l, i) => l !== N.pre[i]);
  ok(`igual ${t}: tabela Unidade/Projeto (${A.tbl.length} linhas)`, A.tbl.length === N.tbl.length && d1 < 0, d1 < 0 ? '' : `linha ${d1}: ${A.tbl[d1]} × ${N.tbl[d1]}`);
  ok(`igual ${t}: Preenchimento (${A.pre.length} linhas) e subtítulo`, A.pre.length === N.pre.length && d2 < 0 && A.preSub === N.preSub, d2 < 0 ? `${A.preSub} × ${N.preSub}` : `linha ${d2}: ${A.pre[d2]} × ${N.pre[d2]}`);
  ok(`igual ${t}: aviso de vazio e filtros`, A.vazio === N.vazio && A.filtros === N.filtros, `${A.vazio} × ${N.vazio}`);
}
ok('filtro muda os números', JSON.stringify(res.novo.dark['Unidade = PIR + CBA T1'].hero) !== JSON.stringify(res.novo.dark['Vigência = todas'].hero));
ok('tema muda a cor da faixa (claro ≠ escuro)', JSON.stringify(res.novo.dark['Vigência = todas'].hero) !== JSON.stringify(res.novo.light['Vigência = todas'].hero));
ok('filtro que esvazia: "Sem dados" nas duas tabelas', res.novo.dark['filtro que esvazia (Vencida + Concluída)'].vazio === 'Sem dados/Sem dados', res.novo.dark['filtro que esvazia (Vencida + Concluída)'].vazio);

// 2 · casca: sem rolagem, visões, tema, exportação — 1366×768 e 1600×900
const VISOES = { resumo: 'Resumo Gerencial', aderencia: 'Aderência por Unidade', preenchimento: 'Preenchimento do FCA' };
for (const vp of [{ width: 1366, height: 768 }, { width: 1600, height: 900 }]) {
  for (const tema of ['dark', 'light']) {
    const { ctx, page, errs } = await abre(browser, null, vp, tema);
    const tag = `${vp.width}×${vp.height} ${tema === 'light' ? 'claro' : 'escuro'}`;
    console.log(`\n══ ${tag} ══`);
    ok(`${tag}: body.claro = tema (sem light-mode)`, await page.evaluate(t => document.body.classList.contains('claro') === (t === 'light') && !document.body.classList.contains('light-mode'), tema));
    const vigCnt = await page.evaluate(() => { const c = document.querySelector('#ms-vig .ms-cnt'); return getComputedStyle(c).display + ':' + c.textContent; });
    ok(`${tag}: vigência abre no último mês, com a contagem laranja visível`, !vigCnt.startsWith('none') && vigCnt.endsWith(':1'), vigCnt);
    // todas as vigências: a tabela mais longa (todas as unidades)
    await page.evaluate(`(${sel})('ms-vig',[])`); await page.waitForTimeout(150);
    for (const mini of [false, true]) {
      if (mini) { await page.evaluate(() => trocaMini()); await page.waitForTimeout(400); }
      for (const [v, titulo] of Object.entries(VISOES)) {
        await page.evaluate(v => setVw(v), v);
        await page.waitForTimeout(v === 'resumo' ? 1100 : 250);   // deixa a animação das barras terminar
        const m = await page.evaluate(() => {
          const se = document.scrollingElement, vw = document.querySelector('.vw.on');
          const tw = [...vw.querySelectorAll('.twrap')];
          const blocos = [...vw.querySelectorAll('.kpi,.gcard,.twrap,.fin-hero')].map(c => c.getBoundingClientRect());
          const cortes = [...vw.querySelectorAll('.kpi .kl,.kpi .kv,.hero-leg span,.gtit,th')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim());
          const cv = [...vw.querySelectorAll('canvas')].map(c => Math.round(c.getBoundingClientRect().height));
          const kp = [...vw.querySelectorAll('.kpi')].map(k => Math.round(k.getBoundingClientRect().height));
          const eixo = vw.id === 'vw-resumo' ? [chPrazo, chConcl].map(c => c.scales.x.labelRotation + ':' + c.scales.x.ticks.length) : [];
          return { eixo, id: vw.id, tit: document.getElementById('tit').textContent,
            pagRola: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
            vwRola: vw.scrollHeight > vw.clientHeight + 1, horiz: tw.some(t => t.scrollWidth > t.clientWidth + 1),
            foraTela: blocos.some(r => r.bottom > innerHeight + 1 || r.right > innerWidth + 1),
            cortes: [...new Set(cortes)], cv, kp,
            sticky: tw.length ? getComputedStyle(vw.querySelector('thead th')).position : '',
            alinh: tw.length ? [...vw.querySelectorAll('thead th')].map(th => getComputedStyle(th).textAlign[0]).join('') : '' };
        });
        const t2 = `${tag}${mini ? ' (lateral recolhida)' : ''} · ${v}`;
        ok(`${t2}: visão abre (${m.tit})`, m.id === 'vw-' + v && m.tit === titulo);
        ok(`${t2}: página não rola`, !m.pagRola);
        ok(`${t2}: a visão não transborda`, !m.vwRola);
        ok(`${t2}: nada fora da tela`, !m.foraTela);
        ok(`${t2}: nenhum texto cortado`, !m.cortes.length, m.cortes.join(' / '));
        if (v === 'resumo') {
          ok(`${t2}: eixo X com os 12 meses na horizontal`, m.eixo.every(e => e === '0:12'), m.eixo.join(' / '));
          ok(`${t2}: gráficos com altura (${m.cv.join('/')}px) e cards com altura (${m.kp[0]}px)`, m.cv.length === 2 && m.cv.every(h => h > 150) && m.kp.every(h => h >= 100));
        } else {
          ok(`${t2}: tabela sem barra horizontal`, !m.horiz);
          ok(`${t2}: cabeçalho sticky e alinhado (texto à esquerda, número à direita)`, m.sticky === 'sticky' && /^l(r|e)+$/.test(m.alinh), m.alinh);
        }
        if (SHOTS && !mini && vp.width === 1600) {
          const dir = path.join(SHOTS, PASTA); fs.mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: path.join(dir, `${v}-${tema === 'light' ? 'claro' : 'escuro'}.png`) });
        }
        if (SHOTS && !mini && vp.width === 1366 && v === 'resumo') await page.screenshot({ path: path.join(SHOTS, PASTA, `${v}-${tema === 'light' ? 'claro' : 'escuro'}-1366.png`) });
      }
    }
    await page.evaluate(() => { trocaMini(); setVw('resumo'); }); await page.waitForTimeout(300);
    if (vp.width === 1600 && tema === 'dark') {
      // Unidade ⇄ Projeto troca o título do topo (o da tabela fica escondido)
      await page.evaluate(() => setVw('aderencia'));
      await page.click('.dim-btn[data-dim="projeto"]'); await page.waitForTimeout(150);
      const tp = await page.evaluate(() => [document.getElementById('tit').textContent, document.querySelector('#tbl thead th').textContent]);
      ok('Projeto: topo diz "Aderência por Projeto" e a 1ª coluna é Projeto', tp[0] === 'Aderência por Projeto' && tp[1] === 'Projeto', tp.join(' · '));
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'aderencia-projeto-escuro.png') });
      await page.click('.dim-btn[data-dim="unidade"]'); await page.waitForTimeout(100);
      // ordenação do cabeçalho (onclick do painel) continua
      await page.click('#tbl thead th:nth-child(2)'); await page.waitForTimeout(150);
      const ord = await page.evaluate(() => [...document.querySelectorAll('#tbl tbody tr')].map(tr => +tr.cells[1].textContent));
      ok('clique no cabeçalho ordena (TT Ações)', ord.length > 3 && ord.every((v, i) => !i || ord[i - 1] >= v || ord[i - 1] <= v) && (ord.every((v, i) => !i || ord[i - 1] >= v) || ord.every((v, i) => !i || ord[i - 1] <= v)), ord.slice(0, 5).join(','));
      // troca de tema pelo botão: classe, chave e gráficos redesenhados
      await page.evaluate(() => setVw('resumo'));
      const c0 = await page.evaluate(() => JSON.stringify(chPrazo.data.datasets[0].borderColor));
      await page.click('#btTema'); await page.waitForTimeout(250);
      const dep = await page.evaluate(() => [document.body.classList.contains('claro'), localStorage.getItem('bi_theme'), JSON.stringify(chPrazo.data.datasets[0].borderColor)]);
      ok('botão de tema: body.claro + bi_theme=light + gráfico redesenhado com as faixas do claro', dep[0] && dep[1] === 'light' && dep[2] !== c0);
      await page.click('#btTema'); await page.waitForTimeout(250);
      const exp = await page.evaluate(() => ({ pdf: !!document.querySelector('.side #pdf-slot button.s-item'),
        atalhosAntesDoUser: !!document.querySelector('.side #pdf-slot'),
        h2c: typeof window.H2CPrep !== 'undefined', srcs: [...document.scripts].map(s => s.getAttribute('src')).filter(Boolean) }));
      ok('Gerar PDF em Atalhos, na lateral', exp.pdf);
      ok('excel-export carregado (menu Excel/PNG no clique direito)', exp.h2c);
      const ordem = ['mobile.js', 'sortable-table.js', 'excel-export.js', 'pdf-export.js', 'build-check.js'].map(n => exp.srcs.findIndex(s => s.includes(n)));
      ok('scripts no fim, na ordem do padrão', ordem.every((x, i) => x >= 0 && (i === 0 || x > ordem[i - 1])), ordem.join(','));
      ok('chart.js, supabase-js, gviz-cache.js e ctrlk.js continuam', ['chart.js', 'supabase-js', 'gviz-cache.js', 'ctrlk.js'].every(n => exp.srcs.some(s => s.includes(n))));
      ok('filters-toggle.js saiu', !exp.srcs.some(s => s.includes('filters-toggle')));
      ok('build-check com o mesmo build do <meta>', await page.evaluate(B => { const b = (document.querySelector('meta[name=build]') || {}).content; return !!b && [...document.scripts].some(s => (s.getAttribute('src') || '').includes('build-check.js?v=' + (document.querySelector('meta[name=build]') || {}).content)); }, BUILD));
      // clique direito numa tabela abre o menu Excel/PNG
      await page.evaluate(() => setVw('preenchimento'));
      await page.click('#tbl-pre tbody tr:nth-child(2) td:nth-child(2)', { button: 'right' }); await page.waitForTimeout(150);
      ok('clique direito na tabela abre o menu Excel/PNG', await page.evaluate(() => { const m = document.getElementById('xl-menu'); return !!m && m.style.display !== 'none' && /Excel|imagem/i.test(m.textContent); }));
      await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
      await page.evaluate(() => setVw('resumo'));
      // contagem laranja do filtro aparece e o "only" funciona
      await page.click('#ms-unidade .ms-btn'); await page.waitForTimeout(100);
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'filtro-aberto-escuro.png') });
      await page.evaluate(() => document.querySelector('#ms-unidade .ms-only[data-v="PIR"]').click()); await page.waitForTimeout(200);
      const cnt = await page.evaluate(() => { const c = document.querySelector('#ms-unidade .ms-cnt'); return [getComputedStyle(c).display, c.textContent, document.getElementById('k-tt').textContent]; });
      ok('contagem laranja do filtro aparece (só PIR)', cnt[0] !== 'none' && cnt[1] === '1', cnt.join(' · '));
      await page.mouse.click(5, 5);
      ok('contrato dos filtros: wrap._sel (Set) + wrap._render + atualizar/setDim/sortBy/sortPre', await page.evaluate(() => ['ms-unidade', 'ms-origem', 'ms-vig', 'ms-projeto', 'ms-sprazo', 'ms-status'].every(id => { const w = document.getElementById(id); return w._sel instanceof Set && typeof w._render === 'function'; }) && ['atualizar', 'setDim', 'sortBy', 'sortPre', 'renderTable', 'renderPreench', 'carregar'].every(f => typeof window[f] === 'function')));
      // PDF: um slide por visão (jsPDF dublado), sem erro
      await page.click('#pdfBtn'); await page.waitForTimeout(150);
      ok('Gerar PDF abre o menu Claro/Escuro', await page.evaluate(() => { const m = document.getElementById('pdfMenu'); return m.classList.contains('open') && m.querySelectorAll('button').length === 2; }));
      await page.click('#pdfMenu button[data-mode="dark"]');
      const pdf = await page.waitForFunction(() => window.__pdf, null, { timeout: 90000 }).then(h => h.jsonValue()).catch(() => '');
      const pags = await page.evaluate(() => window.__pdfPag);
      ok('PDF gerado (capa + um slide por visão)', /fca-gerencial/.test(pdf) && pags >= 4, `${pdf} · ${pags} página(s)`);
      await page.waitForTimeout(300); await page.evaluate(() => setVw('resumo'));
      // Atualizar (mesma função do botão antigo) redesenha sem erro
      await page.evaluate(() => atualizar()); await page.waitForTimeout(200);
      ok('subtítulo com a contagem de ações e a hora', await page.evaluate(() => /^\d[\d.]* ações · \d\d\/\d\d\/\d{4} \d\d:\d\d$/.test(document.getElementById('titSub').textContent)), await page.evaluate(() => document.getElementById('titSub').textContent));
    }
    ok(`${tag}: zero erro de página`, errs.length === 0, errs.join(' / '));
    await ctx.close();
  }
}

// 3 · banco fora: aviso no subtítulo, sem erro de página
{
  const { ctx, page, errs } = await abre(browser, null, { width: 1366, height: 768 }, 'dark', { erro: true });
  await page.waitForTimeout(600);
  ok('banco fora: "Erro ao carregar" no subtítulo', await page.evaluate(() => document.getElementById('titSub').textContent === 'Erro ao carregar'));
  ok('banco fora: zero erro de página', errs.length === 0, errs.join(' / '));
  await ctx.close();
}

// 4 · celular: a página volta a rolar, gráfico com altura, "+ Ver detalhes" da tabela
{
  const { ctx, page, errs } = await abre(browser, null, { width: 390, height: 844 }, 'dark');
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => ({ rola: /auto|scroll/.test(getComputedStyle(document.body).overflowY) && getComputedStyle(document.querySelector('.app')).position === 'static',
    cv: [...document.querySelectorAll('#vw-resumo canvas')].map(c => Math.round(c.getBoundingClientRect().height)) }));
  ok('celular: página livre para rolar', m.rola);
  ok('celular: gráficos com altura', m.cv.every(h => h > 150), m.cv.join('/'));
  if (SHOTS) {
    await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular.png') });
    await page.evaluate(() => document.querySelector('#vw-resumo .gr2').scrollIntoView()); await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-graficos.png') });
  }
  ok('celular: gráfico desenhado (barras com cor no canvas)', await page.evaluate(() => { const c = document.getElementById('ch-prazo'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 0; i < x.length; i += 16) if (x[i + 3] > 0 && x[i] > 150 && x[i + 1] < 120) n++; return n > 50; }));
  await page.evaluate(() => setVw('aderencia')); await page.waitForTimeout(600);
  // o mobile.js troca o "+ Ver detalhes" do painel pelo "+ Detalhar" dele (tabela compacta) — como no antigo
  const leMob = () => ({ box: !!document.querySelector('[data-mt-box] #tbl, #tbl [data-mt-box], [data-mt-box] table') && !!document.querySelector('.mt-detail-btn'),
    proprio: getComputedStyle(document.getElementById('tbl-mob-toggle')).display });
  const mNovo = await page.evaluate(leMob);
  const ant = await abre(browser, htmlAntigo, { width: 390, height: 844 }, 'dark'); await ant.page.waitForTimeout(600);
  const mAnt = await ant.page.evaluate(leMob); await ant.ctx.close();
  ok('celular: tabela compacta com o "+ Detalhar" do mobile.js, igual ao antigo', mNovo.box && mAnt.box && mNovo.proprio === mAnt.proprio, JSON.stringify([mAnt, mNovo]));
  await page.click('#vw-aderencia .mt-detail-btn'); await page.waitForTimeout(200);
  const t1 = await page.evaluate(() => getComputedStyle(document.querySelector('#tbl tbody td:nth-child(2)')).display);
  ok('celular: "+ Detalhar" mostra TT Ações', t1 === 'table-cell', t1);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, PASTA, 'celular-aderencia.png') });
  ok('celular: zero erro de página', errs.length === 0, errs.join(' / '));
  await ctx.close();
}
await browser.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
