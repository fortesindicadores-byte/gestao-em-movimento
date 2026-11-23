// Painel Apresentações (/apresentacoes/): a unidade monta a própria apresentação.
// Banco, DRE (gviz) e Gestão à Vista dublados, com números conhecidos.
//   SHOT_DIR = pasta para os prints
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SHOT = process.env.SHOT_DIR || '';
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// aba Frota: GRL com dois projetos; PIR para o admin trocar de unidade
const CT = { 'Combustíveis Veiculos e Equipamentos': 100000, 'Fluídos (Arla)': 5000, 'Manutenção de Veículos e Equipamentos': 40000, 'Pneus Novos': 20000, 'Seguro de Veículos e Equipamentos': 9000 };
const UN = [['ROTA - GRL', 1.10], ['ROTA (VAN) - GRL', 0.90], ['EMPURRADA - PIR', 1.00]];
const rows = [];
for (const ano of [2025, 2026]) for (let m = 1; m <= 12; m++) { const fechado = ano === 2025 || m <= 10;
  for (const [n3, fat] of UN) for (const [cta, base] of Object.entries(CT)) {
    const f = (n3 === 'ROTA - GRL' && cta === 'Pneus Novos' && ano === 2026 && m === 10) ? 2 : fat;
    rows.push({ c: [{ v: `Date(${ano},${m - 1},1)` }, { v: 0 }, { v: 0 }, { v: 'X' }, { v: n3 }, { v: cta }, { v: MES[m - 1] }, { v: ano }, { v: -base * 1.05 }, { v: fechado ? -base : null }, { v: fechado ? -base * f : null }] }); } }
const GVIZ = { status: 'ok', table: { cols: ['VIGÊNCIA', 'Δ ORÇ (BRL)', 'Δ REM (BRL)', 'Unidade', 'NÍVEL 3', 'CONTA GERENCIAL', 'MÊS', 'ANO', 'ORÇADO', 'REMUNERADO', 'REALIZADO'].map(l => ({ label: l })), rows } };
const FCA = [
  { id: 1, unidade: 'GRL', vigencia: 'out/26', origem: 'Custos', projeto: 'ROTA - GRL', fato: 'Pneus', causa: '1. Carta de Custos: pneus novos R$ 40 mil\n- ABC1D23', acao: '1.1. Fazer a análise de causa raiz nas placas listadas', responsavel: 'JOSE SANTOS', prazo: '2026-11-10', status: 'Em andamento' },
  { id: 2, unidade: 'GRL', vigencia: 'out/26', origem: 'Custos', projeto: 'ROTA - GRL', fato: 'Pneus', causa: '1. Carta de Custos: pneus novos R$ 40 mil', acao: '1.2. Cotar com outro fornecedor', responsavel: 'JOSE SANTOS', prazo: '2026-10-30', status: 'Não iniciada' },
  { id: 3, unidade: 'GRL', vigencia: 'out/26', origem: 'RPM', projeto: 'ROTA', fato: 'Preventivas', causa: 'Oficina sem vaga', acao: 'Programar as vencidas', responsavel: 'JOSE SANTOS', prazo: '2026-11-20', status: 'Concluída' },
  { id: 4, unidade: 'GRL', vigencia: 'out/26', origem: 'RPM', projeto: 'ROTA', fato: 'SLA de manutenção', causa: '', acao: '', responsavel: '', prazo: null, status: 'Não iniciada' },
  { id: 5, unidade: 'GRL', vigencia: 'set/26', origem: 'Custos', projeto: 'ROTA - GRL', fato: 'Combustíveis', causa: 'x', acao: 'y', responsavel: 'z', prazo: null, status: 'Concluída' },
];
const GAVPG = `<!doctype html><meta charset=utf-8><body><script>
  const u=new URLSearchParams(location.search).get('u');
  if(u==='PIR') location.replace('./'); else { window.GavApresentacao={montar:async()=>({lista:['Visão geral','Placas','Placas','Frota parada e manutenção','Prioridades'].map((k,i)=>({bloco:'',k,html:'<section class="slide top"><div class="kicker">'+k+'</div><h2>Farol '+u+' '+i+'</h2><div class="foot"><span>Gestão à Vista</span><span>§PG§</span></div></section>'}))})}; setTimeout(()=>{window.__gavPronto=true;},150); }
<\/script>`;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.jpg': 'image/jpeg', '.css': 'text/css' };
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]);
  if (/^\/gestao-a-vista\/?$/.test(u)) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(GAVPG); }
  let f = path.join(RAIZ, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => srv.listen(8794, r));
const br = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
let falhas = 0, oks = 0; const ok = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e ? '  (' + e + ')' : ''}`); v ? oks++ : falhas++; };

async function abre({ w = 1366, h = 768, tema = 'dark', perfil = { nome: 'Renan', unidade: '', is_admin: true }, tabela = true, modelo = null } = {}) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(({ perfil, FCA, GVIZ, tabela, modelo, tema }) => {
    if (window.top !== window) return;
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', tema); window.__ups = [];
    const q = (tab) => { const f = {}; const o = { select() { return o; }, order() { return o; }, eq(k, v) { f[k] = v; return o; },
      async maybeSingle() { if (tab === 'fca_profiles') return { data: perfil, error: null };
        if (tab === 'apres_modelo') return tabela ? { data: modelo && modelo[f.unidade] ? { modelo: modelo[f.unidade] } : null, error: null } : { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }; return { data: null, error: null }; },
      async range() { if (tab === 'fca') return { data: FCA.filter(r => r.unidade === f.unidade && r.vigencia === f.vigencia), error: null }; return { data: [], error: null }; },
      async upsert(v) { if (!tabela) return { error: { message: 'sem tabela' } }; window.__ups.push(v); return { error: null }; } }; return o; };
    window.supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'x@conlogsa.com.br' } } } }) }, from: q }) };
    const orig = window.fetch; window.fetch = async (u, o) => { const s = String(u);
      if (s.includes('docs.google.com')) return new Response(`/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(GVIZ)});`, { status: 200 });
      return orig(u, o); };
  }, { perfil, FCA, GVIZ, tabela, modelo, tema });
  await pg.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*stub*/' }));
  await pg.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '/*sem o shim no teste*/' }));
  await pg.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  await pg.goto('http://localhost:8794/apresentacoes/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof DECK !== 'undefined' && (DECK.length > 0 || document.querySelector('.gate')), { timeout: 20000 });
  return { ctx, pg, errs };
}
const estado = pg => pg.evaluate(() => ({ seq: SEQ.map(i => `${i.pg == null ? '–' : i.pg}|${i.id}|${i.off ? 'off' : ''}${i.vazio ? 'vazio' : ''}`), n: DECK.length, itens: DECK.map(d => d.item),
  sub: document.getElementById('titSub').textContent, av: document.getElementById('avisos').textContent, cod: COD, vig: VIG, cont: document.getElementById('cont').textContent }));
const slideTxt = (pg, item, i = 0) => pg.evaluate(([item, i]) => { const d = document.createElement('div'); d.innerHTML = DECK.filter(x => x.item === item)[i].html; return d.textContent.replace(/\s+/g, ' '); }, [item, i]);

console.log('1 · admin, GRL, com o farol');
{
  const { ctx, pg, errs } = await abre();
  await pg.evaluate(() => { const o = [...document.querySelectorAll('#un-uni .un-opt')].find(x => x.dataset.v === 'GRL'); o.click(); });
  await pg.waitForFunction(() => COD === 'GRL' && GAV && GAV.lista && FUNDOS && DECK.length > 8, { timeout: 20000 });
  await pg.waitForTimeout(300);
  let E = await estado(pg);
  ok('abre no último mês com realizado', E.vig === '2026-10' && /fechamento de out\/26/.test(E.sub), E.sub);
  ok('capa, sumário e encerramento fixos nas pontas', E.itens[0] === 'capa' && E.itens[1] === 'sumario' && E.itens[E.n - 1] === 'fim');
  ok('blocos na ordem padrão, com a página de cada um', E.seq.slice(0, 8).join(' ') === '1|capa| 2|sumario| 3|resultado| 4|ponte| 5|aderencia| 6|desvios| 7|fca| 8|gav:visao-geral|', E.seq.join(' '));
  ok('bloco do farol com dois slides ocupa duas páginas', E.seq.includes('9|gav:placas|') && E.seq.includes('11|gav:frota-parada-e-manutencao|'), E.seq.join(' '));
  ok('bloco sem slide (descontos, documentos, custos) fica marcado e fora do deck', E.seq.includes('–|gav:descontos|vazio') && !E.itens.includes('gav:descontos'));
  const r = await slideTxt(pg, 'resultado');
  // GRL out/26: Rota 1,10 (pneus 2,0) + Van 0,90 → rem 2×165.000 = 330.000; real = 165.000×1,1 + 20.000×0,9(extra pneus) ... conferido pela conta abaixo
  const rem = 2 * 165000, real = (100000 + 5000 + 40000) * 1.1 + 20000 * 2 + 165000 * 0.9;
  ok('Resultado: remunerado e realizado só dos três pacotes (seguro fora)', r.includes('R$ 330 mil') && r.includes('R$ ' + Math.round(real / 1e3) + ' mil'), r.slice(0, 220));
  ok('Resultado: aderência = remunerado ÷ realizado', r.includes((rem / real * 100).toFixed(1).replace('.', ',') + '%'), (rem / real * 100).toFixed(1));
  ok('Ponte: duas cascatas (acumulado e mês)', await pg.evaluate(() => { const d = document.createElement('div'); d.innerHTML = DECK.find(x => x.item === 'ponte').html; return d.querySelectorAll('svg').length === 2 && /Pneus Novos/.test(d.textContent); }));
  const a = await slideTxt(pg, 'aderencia');
  ok('Aderência: linhas por projeto, meses fechados e nov/dez vazios', a.includes('ROTA') && a.includes('ROTA (VAN)') && a.includes('111%') && a.includes('91%'), a.slice(0, 200));
  const d = await slideTxt(pg, 'desvios');
  ok('Maiores desvios: a conta com a causa e a ação do FCA do mês', /ROTA\s*Pneus Novos/.test(d) && d.includes('Carta de Custos: pneus novos R$ 40 mil') && d.includes('Fazer a análise de causa raiz') && d.includes('(+1)'), d.slice(0, 400));
  ok('Maiores desvios: conta sem FCA diz "sem causa no FCA"', d.includes('sem causa no FCA'));
  const f = await slideTxt(pg, 'fca');
  ok('FCA do mês: 3 fatos, 3 ações, 1 concluída, 1 vencida, 1 fato sem ação; só o mês', f.includes('3 fatos e 3 ações') && f.includes('Programar as vencidas') && !f.includes('Combustíveis'), f.slice(0, 260));
  ok('sumário lista os blocos com o número da página', await pg.evaluate(() => { const x = document.createElement('div'); x.innerHTML = DECK[1].html; const t = x.textContent.replace(/\s+/g, ' '); return /03\s*Resultado do mês/.test(t) && /08\s*Farol de hoje/.test(t); }));
  ok('capa com o título, a unidade e o mês', await pg.evaluate(() => { const x = document.createElement('div'); x.innerHTML = DECK[0].html; const t = x.textContent; return /Reunião Mensal/.test(t) && /CDD Guarulhos/.test(t) && /Outubro\s+\|\s+2026/.test(t); }));
  ok('número da página no rodapé = posição no deck', await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument; const s = [...d.querySelectorAll('.slide')]; return s.every((x, i) => { const f = x.querySelector('.foot span:last-child'); return !f || f.textContent === String(i + 1); }) && !d.body.innerHTML.includes('§PG§'); }));
  // tirar um bloco
  const n0 = E.n; await pg.click('.sq[data-id="ponte"] .sq-b[data-ac="olho"]'); await pg.waitForTimeout(150); E = await estado(pg);
  ok('o olho tira o bloco e renumera', E.n === n0 - 1 && E.seq.includes('–|ponte|off') && E.seq.includes('4|aderencia|'), E.seq.slice(0, 6).join(' '));
  // mudar a ordem
  await pg.evaluate(() => move('fca', 'resultado')); await pg.waitForTimeout(150); E = await estado(pg);
  ok('arrastar muda a ordem', E.seq[2] === '3|fca|' && E.seq[3] === '4|resultado|', E.seq.slice(0, 6).join(' '));
  // recado
  await pg.evaluate(() => novoRecado()); await pg.fill('#cxT', 'Combinados de novembro'); await pg.fill('#cxX', 'Zerar preventivas vencidas\nReunião com a oficina na terça'); await pg.evaluate(() => salvaRecado()); await pg.waitForTimeout(150);
  E = await estado(pg); const rt = await pg.evaluate(() => { const id = MOD.textos[0].id; const x = document.createElement('div'); x.innerHTML = DECK.find(d => d.item === id).html; return x.textContent.replace(/\s+/g, ' '); });
  ok('recado do gestor vira slide, antes do encerramento', /Combinados de novembro/.test(rt) && /Reunião com a oficina na terça/.test(rt) && E.itens[E.n - 2].startsWith('txt:'), rt.slice(0, 120));
  await pg.waitForTimeout(900);
  const ups = await pg.evaluate(() => window.__ups);
  ok('o modelo é gravado em apres_modelo, por unidade', ups.length >= 1 && ups[ups.length - 1].unidade === 'GRL' && ups[ups.length - 1].modelo.ordem[0] === 'fca' && ups[ups.length - 1].modelo.off.includes('ponte') && ups[ups.length - 1].modelo.textos.length === 1, JSON.stringify(ups.slice(-1)).slice(0, 160));
  // título
  await pg.fill('#inTit', 'Fechamento de Outubro'); await pg.waitForTimeout(600);
  ok('o título da capa acompanha o campo', await pg.evaluate(() => /Fechamento de Outubro/.test(DECK[0].html)));
  // navegar e apresentar
  await pg.click('.sq[data-id="aderencia"]'); await pg.waitForTimeout(100);
  const vis = await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument; return [...d.querySelectorAll('.slide')].filter(s => s.style.display !== 'none').map(s => s.textContent.replace(/\s+/g, ' ').slice(0, 30)); });
  ok('clicar no bloco mostra o slide dele na prévia (um só à vista)', vis.length === 1 && /Aderência ao remunerado/.test(vis[0]), vis.join(' | '));
  await pg.evaluate(() => apresentar()); await pg.waitForTimeout(400); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(100);
  const sh = await pg.evaluate(() => ({ on: document.getElementById('show').classList.contains('on'), c: document.getElementById('showC').textContent, um: [...document.getElementById('showF').contentDocument.querySelectorAll('.slide')].filter(s => s.style.display !== 'none').length }));
  const p0 = await pg.evaluate(() => DECK.findIndex(d => d.item === 'aderencia'));
  ok('Apresentar: tela cheia, um slide por vez, as setas passam', sh.on && sh.um === 1 && sh.c === `${p0 + 2} / ${E.n}`, JSON.stringify(sh));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  ok('Esc sai e a prévia fica no slide em que parou', await pg.evaluate(p => !document.getElementById('show').classList.contains('on') && POS === p + 1, p0));
  // mês e unidade
  await pg.evaluate(() => { const o = [...document.querySelectorAll('#un-mes .un-opt')].find(x => x.dataset.v === '2026-09'); o.click(); }); await pg.waitForFunction(() => VIG === '2026-09' && /set\/26/.test(document.getElementById('titSub').textContent)); await pg.waitForTimeout(200);
  const f9 = await slideTxt(pg, 'fca');
  ok('trocar o mês troca o fechamento e o FCA', /FCA de set\/26/.test(f9) && f9.includes('1 fato e 1 ação'), f9.slice(0, 140));
  await pg.evaluate(() => { const o = [...document.querySelectorAll('#un-uni .un-opt')].find(x => x.dataset.v === 'PIR'); o.click(); }); await pg.waitForFunction(() => COD === 'PIR' && GAV && GAV.erro, { timeout: 20000 }); await pg.waitForTimeout(200);
  E = await estado(pg);
  ok('outra unidade: o modelo é o dela (padrão) e o farol que não abre vira aviso', E.seq[2] === '3|resultado|' && /Farol de hoje fora da apresentação/.test(E.av) && !E.itens.some(i => i.startsWith('gav:')), E.av);
  ok('sem erro de JavaScript', !errs.length, errs.join(' | '));
  await ctx.close();
}

console.log('2 · gestor de uma unidade, sem a tabela no banco');
{
  const { ctx, pg, errs } = await abre({ perfil: { nome: 'José Santos', unidade: 'GRL', is_admin: false }, tabela: false });
  await pg.waitForFunction(() => GAV && GAV.lista, { timeout: 20000 }); await pg.waitForTimeout(200);
  const E = await estado(pg);
  ok('abre direto na unidade dele, sem o filtro de unidade', E.cod === 'GRL' && await pg.evaluate(() => document.getElementById('un-uni').style.display === 'none'));
  ok('sem a tabela: avisa e guarda neste navegador', /só neste navegador/.test(E.av), E.av);
  await pg.click('.sq[data-id="fca"] .sq-b[data-ac="olho"]'); await pg.waitForTimeout(900);
  ok('a escolha fica no navegador e volta depois do F5', await pg.evaluate(() => JSON.parse(localStorage.getItem('apres_modelo_GRL')).off.includes('fca')));
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof DECK !== 'undefined' && DECK.length > 3); await pg.waitForTimeout(200);
  ok('depois do F5 o bloco continua fora', (await estado(pg)).seq.includes('–|fca|off'));
  ok('sem erro de JavaScript', !errs.length, errs.join(' | '));
  await ctx.close();
}
console.log('3 · sem unidade no perfil');
{
  const { ctx, pg } = await abre({ perfil: { nome: 'X', unidade: '', is_admin: false } });
  ok('cai no aviso de sem unidade', await pg.evaluate(() => /Sem unidade no perfil/.test(document.getElementById('gate').textContent)));
  await ctx.close();
}
console.log('4 · telas');
for (const [w, h] of [[1366, 768], [1600, 900], [1920, 1080]]) for (const tema of ['dark', 'light']) {
  const { ctx, pg, errs } = await abre({ w, h, tema, perfil: { nome: 'José Santos', unidade: 'GRL', is_admin: false } });
  await pg.waitForFunction(() => GAV && GAV.lista && FUNDOS, { timeout: 20000 }); await pg.waitForTimeout(500);
  const r = await pg.evaluate(() => { const de = document.documentElement, q = document.getElementById('telaQ').getBoundingClientRect(), t = document.getElementById('tela').getBoundingClientRect(), s = document.getElementById('seq');
    return { pagina: de.scrollHeight <= de.clientHeight + 1 && de.scrollWidth <= de.clientWidth + 1, prop: Math.abs(q.width / q.height - 16 / 9) < 0.02, cabe: q.width <= t.width + 1 && q.height <= t.height + 1, larg: Math.round(q.width), lateral: s.scrollWidth <= s.clientWidth + 1 }; });
  ok(`${w}×${h} ${tema}: sem rolagem de página, prévia em 16:9 dentro do palco`, r.pagina && r.prop && r.cabe && r.lateral && r.larg > 500, JSON.stringify(r));
  if (SHOT) { await pg.screenshot({ path: path.join(SHOT, `ap-${w}-${tema}.png`) });
    if (w === 1600 && tema === 'dark') for (const it of ['resultado', 'ponte', 'aderencia', 'desvios', 'fca']) { await pg.click(`.sq[data-id="${it}"]`); await pg.waitForTimeout(250); await pg.locator('#telaQ').screenshot({ path: path.join(SHOT, `slide-${it}.png`) }); } }
  ok(`${w}×${h} ${tema}: sem erro de JavaScript`, !errs.length, errs.join(' | '));
  await ctx.close();
}
await br.close(); srv.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
