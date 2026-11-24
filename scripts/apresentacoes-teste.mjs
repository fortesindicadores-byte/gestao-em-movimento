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
const UN = [['ROTA - GRL', 1.10], ['ROTA (VAN) - GRL', 0.90], ['EMPURRADA - PIR', 1.00], ['EMPURRADA - CBA', 1.00], ['ROTA - CBA', 1.05]];
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
const SL1 = (k, t) => `'<section class="slide top"><div class="kicker">${k}</div><h2>'+${t}+'</h2><div class="foot"><span>painel</span><span>§PG§</span></div></section>'`;
const GAVPG = `<!doctype html><meta charset=utf-8><body><script>
  const u=new URLSearchParams(location.search).get('u');
  if(u==='PIR') location.replace('./'); else { window.GavApresentacao={montar:async()=>({lista:['Visão geral','Placas','Placas','Frota parada e manutenção','Prioridades'].map((k,i)=>({bloco:'',k,html:'<section class="slide top"><div class="kicker">'+k+'</div><h2>Farol '+u+' '+i+'</h2><div class="foot"><span>Gestão à Vista</span><span>§PG§</span></div></section>'}))})}; setTimeout(()=>{window.__gavPronto=true;},150); }
<\/script>`;
// dublês dos painéis que a página abre por dentro: guardam o filtro que receberam no título do slide
const KMPG = `<!doctype html><meta charset=utf-8><body><div id="titSub">ok</div><div id="ms-ano"></div><div id="ms-und"></div><div id="ms-proj"></div><div id="ms-vig"></div><script>
  let ALL=[{und:'GRL',proj:'ROTA',vig:'10/2026',real:100,rem:90},{und:'GRL',proj:'ROTA (VAN)',vig:'10/2026',real:50,rem:50},{und:'CBA',proj:'EMPURRADA',vig:'10/2026',real:9,rem:9},{und:'CBA',proj:'ROTA',vig:'10/2026',real:9,rem:9}];
  const sel=id=>[...(document.getElementById(id)._sel||[])].join(',');
  window.KmApresentacao={montar:async()=>({lista:['Resumo','Unidades e projetos'].map(k=>({k,html:${SL1("'+k+'", "'KM und='+sel('ms-und')+' proj='+sel('ms-proj')+' vig='+sel('ms-vig')")}}))})};
<\/script>`;
const SCPG = `<!doctype html><meta charset=utf-8><body><div id="titSub">ok</div><div id="ms-uni"></div><div id="ms-vig"></div><script>
  const UNI_LIST=['CDD GUARULHOS','CDD CUIABA','CUIABA','CUIABA EMPURRADA'], UNI2CONLOG={'CDD GUARULHOS':'GRL','CDD CUIABA':'CBA T2','CUIABA':'CBA T1 WH','CUIABA EMPURRADA':'CBA T1'};
  let ICS=[1]; const VIGS=[new Date(2026,8,1),new Date(2026,9,1)], vigLbl=d=>['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][d.getMonth()]+'/'+String(d.getFullYear()).slice(2);
  const sel=id=>[...(document.getElementById(id)._sel||[])].join(',');
  window.ScApresentacao={montar:async()=>({lista:['Resumo','Ranking','Indicadores da rede'].map(k=>({k,html:${SL1("'+k+'", "'SC uni='+sel('ms-uni')+' vig='+sel('ms-vig')")}}))})};
<\/script>`;
const ARVPG = `<!doctype html><meta charset=utf-8><body><div id="titSub">ok</div><div id="ms-ano"></div><div id="ms-vig"></div><div id="ms-uni"></div><div id="ms-nv3"></div><div id="treeWrap"></div><script>
  document.getElementById('ms-uni')._items=['CBA','GRL','PIR']; document.getElementById('ms-vig')._items=['10/2026','09/2026']; document.getElementById('ms-nv3')._items=['EMPURRADA','ROTA','VAN'];
  const sel=id=>[...(document.getElementById(id)._sel||[])].join(',');
  window.__fotos=[]; function onFilterChange(){ document.getElementById('ms-nv3')._items=sel('ms-uni')==='PIR'?['EMPURRADA']:sel('ms-uni')==='CBA'?['EMPURRADA','ROTA']:['ROTA','VAN']; document.getElementById('treeWrap').textContent='Árvore de combustível '+sel('ms-uni')+' | '+sel('ms-nv3')+' | '+sel('ms-vig')+' ........................................'; }
  document.getElementById('treeWrap').textContent='Árvore de combustível ........................................................';
  window.html2canvas=async el=>{ window.parent.__arvFotos=(window.parent.__arvFotos||[]).concat(el.textContent.replace(/\\.+/,'').trim()); const c=document.createElement('canvas'); c.width=2000; c.height=900; return c; };
<\/script>`;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.jpg': 'image/jpeg', '.css': 'text/css' };
const DUB = [[/^\/gestao-a-vista\/(index\.html)?$/, GAVPG], [/^\/painel-km\/(index\.html)?$/, KMPG], [/^\/scorecard\/(index\.html)?$/, SCPG], [/^\/combustivel\/arvore-combustivel\/(index\.html)?$/, ARVPG]];
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]);
  const d = DUB.find(x => x[0].test(u)); if (d) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(d[1]); }
  let f = path.join(RAIZ, u); if (u.endsWith('/')) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => srv.listen(8794, r));
const br = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
let falhas = 0, oks = 0; const ok = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e ? '  (' + e + ')' : ''}`); v ? oks++ : falhas++; };

async function abre({ w = 1366, h = 768, tema = 'dark', perfil = { nome: 'Renan', unidade: '', is_admin: true }, tabela = true, modelo = null } = {}) {
  const ctx = await br.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', acceptDownloads: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(({ perfil, FCA, GVIZ, tabela, modelo, tema }) => {
    if (window.top !== window) return;
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', tema); window.__ups = [];
    const q = (tab) => { const f = {}; const o = { select() { return o; }, order() { return o; }, eq(k, v) { f[k] = v; return o; }, in(k, v) { f[k] = v; return o; },
      async maybeSingle() { if (tab === 'fca_profiles') return { data: perfil, error: null };
        if (tab === 'apres_modelo') return tabela ? { data: modelo && modelo[f.unidade] ? { modelo: modelo[f.unidade] } : null, error: null } : { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }; return { data: null, error: null }; },
      async range() { if (tab === 'fca') return { data: FCA.filter(r => [].concat(f.unidade).includes(r.unidade) && r.vigencia === f.vigencia), error: null }; return { data: [], error: null }; },
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
  sub: document.getElementById('titSub').textContent, av: document.getElementById('avisos').textContent, cod: COD, cods: CODS.join(','), vig: VIG, cont: document.getElementById('cont').textContent }));
const slideTxt = (pg, item, i = 0) => pg.evaluate(([item, i]) => { const d = document.createElement('div'); d.innerHTML = DECK.filter(x => x.item === item)[i].html; return d.textContent.replace(/\s+/g, ' '); }, [item, i]);
const escolhe = (pg, id, v) => pg.evaluate(([id, v]) => { abreUn2(id); const o = [...document.querySelectorAll('#' + id + ' .ms-opt input')].find(x => x.dataset.v === v); o.click(); }, [id, v]);
const pronto = pg => pg.waitForFunction(() => window.__apresPronto === true && FUNDOS, { timeout: 40000 });

console.log('1 · admin, GRL, com os painéis');
{
  const { ctx, pg, errs } = await abre();
  const F0 = await pg.evaluate(() => { abreUn2('un-uni'); const w = document.getElementById('un-uni'); return { ops: [...w.querySelectorAll('.ms-opt input')].map(i => i.dataset.v), txt: [...w.querySelectorAll('.ms-opt')].map(l => l.textContent.trim()), busca: !!w.querySelector('.ms-search input'), caixa: w.querySelectorAll('.ms-opt input[type=checkbox]:checked').length }; });
  ok('filtro Unidade no padrão: busca + lista com caixa, uma marcada', F0.busca && F0.caixa === 1, JSON.stringify(F0.txt.slice(0, 4)));
  ok('filtro Unidade só com a sigla, sem tier', F0.ops.join() === 'ANG,BLC,CBA,CGR,FLP,GNA,GRL,MCC,NFR,PIR,PLT,RON' && F0.txt.every(t => /^[A-Z]{3}$/.test(t)), F0.ops.join());
  await pg.evaluate(() => { const i = document.querySelector('#un-uni .ms-search input'); i.value = 'gr'; i.oninput(); });
  ok('a busca do filtro filtra a lista', await pg.evaluate(() => [...document.querySelectorAll('#un-uni .ms-opt input')].map(i => i.dataset.v).join()) === 'CGR,GRL');
  await escolhe(pg, 'un-uni', 'GRL');
  await pg.waitForFunction(() => COD === 'GRL', { timeout: 20000 }); await pronto(pg); await pg.waitForTimeout(300);
  let E = await estado(pg);
  ok('abre no último mês com realizado', E.vig === '2026-10' && /fechamento de out\/26/.test(E.sub), E.sub);
  ok('capa, sumário e encerramento fixos nas pontas', E.itens[0] === 'capa' && E.itens[1] === 'sumario' && E.itens[E.n - 1] === 'fim');
  const ids = E.seq.map(x => x.split('|')[1]);
  ok('blocos na ordem padrão: custos, combustível, árvore, km, manutenção, pneus, FCA, scorecard, farol', ids.slice(2, 13).join() === 'resultado,ponte,pac:combustiveis,arv,km,pac:manutencao,pac:pneus,desvios,fca,sc,gav:visao-geral', ids.join());
  ok('não existe mais o bloco de aderência', !ids.includes('aderencia'));
  ok('bloco do farol com dois slides ocupa duas páginas', await pg.evaluate(() => DECK.filter(d => d.item === 'gav:placas').length) === 2);
  ok('bloco sem slide (descontos) fica marcado e fora do deck', E.seq.some(x => /^–\|gav:descontos\|vazio/.test(x)) && !E.itens.includes('gav:descontos'));
  const r = await slideTxt(pg, 'resultado');
  const rem = 2 * 165000, real = (100000 + 5000 + 40000) * 1.1 + 20000 * 2 + 165000 * 0.9;
  ok('Resultado: remunerado e realizado só dos três pacotes (seguro fora)', r.includes('R$ 330 mil') && r.includes('R$ ' + Math.round(real / 1e3) + ' mil'), r.slice(0, 160));
  ok('Resultado: sem o card de aderência, com o "No ano"', !/Aderência/.test(r) && /No ano · jan a out/.test(r));
  const rp = await slideTxt(pg, 'resultado', 1);
  ok('Resultado por projeto: uma linha por projeto com o Δ de cada pacote', /Resultado por projeto/i.test(rp) && /ROTA /.test(rp) && /ROTA \(VAN\)/.test(rp) && /Δ Combustíveis/.test(rp) && /Total/.test(rp), rp.slice(0, 200));
  const P1 = await pg.evaluate(() => { const d = document.createElement('div'); d.innerHTML = DECK.filter(x => x.item === 'ponte').map(x => x.html).join(''); const tx = [...d.querySelectorAll('svg')].map(sv => [...sv.querySelectorAll('text')].map(t => ({ x: +t.getAttribute('x'), y: +t.getAttribute('y'), n: t.textContent.length, fs: +(t.getAttribute('font-size') || sv.getAttribute('font-size')) })));
    const rot = (tx[0] || []).filter(t => t.y > 340).sort((a, b) => a.x - b.x || a.y - b.y); let bate = 0; for (let i = 1; i < rot.length; i++) { const a = rot[i - 1], b = rot[i]; if (a.y === b.y && Math.abs(b.x - a.x) > 1 && (a.n * a.fs * .6 + b.n * b.fs * .6) / 2 > Math.abs(b.x - a.x)) bate++; }
    return { svgs: d.querySelectorAll('svg').length, slides: DECK.filter(x => x.item === 'ponte').length, bate, w: +d.querySelector('svg').getAttribute('width') }; });
  ok('Ponte: UMA cascata, na largura do slide', P1.svgs === 1 && P1.slides === 1 && P1.w > 1000, JSON.stringify(P1));
  ok('Ponte: os rótulos das barras não se encavalam', P1.bate === 0, String(P1.bate));
  const pc = await slideTxt(pg, 'pac:combustiveis'), pn = await slideTxt(pg, 'pac:pneus');
  ok('Combustíveis por projeto: projetos + contas que mais desviaram', /ROTA/.test(pc) && /ROTA \(VAN\)/.test(pc) && /Contas que mais desviaram/.test(pc) && /Arla/.test(pc), pc.slice(0, 160));
  ok('Pneus por projeto: o estouro da ROTA aparece', /Pneus Novos/.test(pn) && /R\$ 20 mil acima|20 mil/.test(pn), pn.slice(0, 160));
  const km = await slideTxt(pg, 'km'), sc = await pg.evaluate(() => DECK.filter(x => x.item === 'sc').map(x => { const d = document.createElement('div'); d.innerHTML = x.html; return d.textContent.replace(/\s+/g, ' '); }));
  ok('Dispersão de km: slides do Painel KM, filtrado na unidade e no mês', /Dispersão de km · Resumo/.test(km) && /und=GRL proj= vig=10\/2026/.test(km), km.slice(0, 120));
  ok('Scorecard: slides do Scorecard, filtrado na unidade e no mês, sem o ranking de uma unidade só', sc.length === 2 && /Scorecard · Resumo/.test(sc[0]) && /uni=CDD GUARULHOS vig=out\/26/.test(sc[0]), sc.join(' | ').slice(0, 160));
  const av = await pg.evaluate(() => ({ n: DECK.filter(x => x.item === 'arv').length, fotos: window.__arvFotos, img: /<img src="data:image/.test(DECK.find(x => x.item === 'arv').html), t: DECK.filter(x => x.item === 'arv').map(x => { const d = document.createElement('div'); d.innerHTML = x.html; return d.querySelector('h2').textContent; }) }));
  ok('Árvore de Combustível: a unidade inteira e uma foto por projeto', av.n === 3 && av.img && /todos os projetos/.test(av.t[0]) && /ROTA$/.test(av.t[1]) && /VAN$/.test(av.t[2]), av.t.join(' | '));
  ok('Árvore: fotografada com o filtro da unidade, do mês e do projeto', av.fotos.length === 3 && /GRL \|\s*\| 10\/2026/.test(av.fotos[0]) && /GRL \| ROTA \| 10\/2026/.test(av.fotos[1]), av.fotos.join(' ; '));
  const d = await slideTxt(pg, 'desvios');
  ok('Maiores desvios: a conta com a causa e a ação do FCA do mês', /ROTA\s*Pneus Novos/.test(d) && d.includes('Carta de Custos: pneus novos R$ 40 mil') && d.includes('Fazer a análise de causa raiz'), d.slice(0, 200));
  ok('Maiores desvios: conta sem FCA diz "sem causa no FCA"', d.includes('sem causa no FCA'));
  const f = await slideTxt(pg, 'fca');
  ok('FCA do mês: 3 fatos, 3 ações; só o mês', f.includes('3 fatos e 3 ações') && f.includes('Programar as vencidas') && !f.includes('Combustíveis'), f.slice(0, 160));
  const C0 = await pg.evaluate(() => { const x = document.createElement('div'); x.innerHTML = DECK[0].html + DECK[1].html + DECK[DECK.length - 1].html; return { t: x.textContent.replace(/\s+/g, ' '), serifa: /class="ser"/.test(x.innerHTML), ak: x.querySelectorAll('.ak').length }; });
  ok('capa: título, unidade e mês; sumário com os blocos; encerramento', /Reunião Mensal/.test(C0.t) && /CDD Guarulhos/.test(C0.t) && /Outubro/.test(C0.t) && /Sumário/.test(C0.t) && /01\s*Resultado do mês\s*pág\. 3/.test(C0.t) && /Dispersão de km/.test(C0.t) && /Obrigado!/.test(C0.t), C0.t.slice(0, 200));
  ok('arte própria: Montserrat, sem serifa', !C0.serifa && C0.ak >= 1);
  ok('número da página no rodapé = posição no deck', await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument; const s = [...d.querySelectorAll('.slide')]; return s.every((x, i) => { const f = x.querySelector('.foot span:last-child'); return !f || f.textContent.trim() === String(i + 1); }); }));
  ok('botões Gerar PDF e Gerar PPT no topo e nos atalhos', await pg.evaluate(() => !!document.getElementById('btPdf') && !!document.getElementById('btPpt') && !!document.getElementById('btPdf2') && document.getElementById('btPpt2').textContent.trim() === 'Gerar PPT' && typeof ApresBase.pptx === 'function'));
  // tirar um bloco
  const n0 = E.n; await pg.click('.sq[data-id="ponte"] .sq-b[data-ac="olho"]'); await pg.waitForTimeout(150); E = await estado(pg);
  ok('o olho tira o bloco e renumera', E.n === n0 - 1 && E.seq.includes('–|ponte|off') && E.seq.includes('5|pac:combustiveis|'), E.seq.slice(0, 6).join(' '));
  // mudar a ordem
  await pg.evaluate(() => move('fca', 'resultado')); await pg.waitForTimeout(150); E = await estado(pg);
  ok('arrastar muda a ordem', E.seq[2] === '3|fca|' && E.seq[3] === '4|resultado|', E.seq.slice(0, 6).join(' '));
  // recado
  await pg.evaluate(() => novoRecado()); await pg.fill('#cxT', 'Combinados de novembro'); await pg.fill('#cxX', 'Zerar preventivas vencidas\nReunião com a oficina na terça'); await pg.evaluate(() => salvaRecado()); await pg.waitForTimeout(150);
  E = await estado(pg); const rt = await pg.evaluate(() => { const id = MOD.textos[0].id; const x = document.createElement('div'); x.innerHTML = DECK.find(d => d.item === id).html; return x.textContent.replace(/\s+/g, ' '); });
  ok('recado do gestor vira slide, antes do encerramento', /Combinados de novembro/.test(rt) && /Reunião com a oficina na terça/.test(rt) && E.itens[E.n - 2].startsWith('txt'), E.itens.slice(-3).join(' ') + ' · ' + rt.slice(0, 80));
  await pg.waitForTimeout(900);
  const ups = await pg.evaluate(() => window.__ups);
  ok('o modelo é gravado em apres_modelo, na unidade', ups.length >= 1 && ups[ups.length - 1].unidade === 'GRL' && ups[ups.length - 1].modelo.ordem[0] === 'fca' && ups[ups.length - 1].modelo.off.includes('ponte'), JSON.stringify(ups[ups.length - 1] || {}).slice(0, 120));
  await pg.fill('#inTit', 'Fechamento de Outubro'); await pg.waitForTimeout(600);
  ok('o título da capa acompanha o campo', await pg.evaluate(() => /Fechamento de Outubro/.test(DECK[0].html)));
  // navegar e apresentar
  await pg.click('.sq[data-id="desvios"]'); await pg.waitForTimeout(100);
  const vis = await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument; return [...d.querySelectorAll('.slide')].filter(s => s.style.display !== 'none').map(s => (s.dataset.sk || '') + ' · ' + (s.querySelector('h2') || s).textContent.replace(/\s+/g, ' ').slice(0, 40)); });
  ok('clicar no bloco mostra o slide dele na prévia (um só à vista)', vis.length === 1 && /Maiores desvios/.test(vis[0]), vis.join(' | '));
  await pg.evaluate(() => apresentar()); await pg.waitForTimeout(400); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(100);
  const sh = await pg.evaluate(() => ({ on: document.getElementById('show').classList.contains('on'), c: document.getElementById('showC').textContent, um: [...document.getElementById('showF').contentDocument.querySelectorAll('.slide')].filter(s => s.style.display !== 'none').length }));
  const p0 = await pg.evaluate(() => DECK.findIndex(d => d.item === 'desvios'));
  ok('Apresentar: tela cheia, um slide por vez, as setas passam', sh.on && sh.um === 1 && sh.c === `${p0 + 2} / ${E.n}`, JSON.stringify(sh));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  ok('Esc sai e a prévia fica no slide em que parou', await pg.evaluate(p => !document.getElementById('show').classList.contains('on') && POS === p + 1, p0));
  // mês
  await escolhe(pg, 'un-mes', '2026-09'); await pg.waitForFunction(() => VIG === '2026-09' && /set\/26/.test(document.getElementById('titSub').textContent)); await pronto(pg); await pg.waitForTimeout(200);
  const f9 = await slideTxt(pg, 'fca'), km9 = await slideTxt(pg, 'km');
  ok('trocar o mês troca o fechamento, o FCA e os painéis', /FCA de set\/26/.test(f9) && f9.includes('1 fato e 1 ação') && /vig=painel/.test(km9), f9.slice(0, 100) + ' · ' + km9.slice(0, 80));
  // CBA: a unidade inteira (três tiers)
  await escolhe(pg, 'un-uni', 'CBA'); await pg.waitForFunction(() => COD === 'CBA'); await pronto(pg); await pg.waitForTimeout(200);
  E = await estado(pg);
  const kmC = await pg.evaluate(() => KMP && KMP.lista ? KMP.lista[0].html : ''), scC = await pg.evaluate(() => SCP && SCP.lista ? SCP.lista.map(x => x.html).join(' ') : ''), gC = await pg.evaluate(() => GAV && GAV.lista ? GAV.lista.map(x => x.html).join(' ') : '');
  ok('CBA = a unidade inteira: os três códigos com tier', E.cods === 'CBA T1,CBA T1 WH,CBA T2', E.cods);
  ok('CBA: Painel KM na sigla, Scorecard nas três unidades (com ranking), farol dos três', /und=CBA proj= /.test(kmC) && /uni=CDD CUIABA,CUIABA,CUIABA EMPURRADA/.test(scC) && /Ranking/.test(scC) && /Farol CBA T1 0/.test(gC) && /Farol CBA T2 0/.test(gC), kmC.slice(60, 160));
  // PIR: o farol não abre → aviso; o resto segue
  await escolhe(pg, 'un-uni', 'PIR'); await pg.waitForFunction(() => COD === 'PIR'); await pronto(pg); await pg.waitForTimeout(200);
  E = await estado(pg);
  ok('outra unidade: modelo padrão dela e o painel que não responde vira aviso', E.seq[2] === '3|resultado|' && /Farol de hoje fora da apresentação/.test(E.av) && /Dispersão de km fora da apresentação/.test(E.av), E.av);
  ok('sem erro de JavaScript', !errs.length, errs.join(' | '));
  await ctx.close();
}

console.log('2 · gestor de uma unidade, sem a tabela no banco');
{
  const { ctx, pg, errs } = await abre({ perfil: { nome: 'José Santos', unidade: 'GRL', is_admin: false }, tabela: false });
  await pronto(pg); await pg.waitForTimeout(200);
  const E = await estado(pg);
  ok('abre direto na unidade dele, sem o filtro de unidade', E.cod === 'GRL' && await pg.evaluate(() => document.getElementById('un-uni').style.display === 'none'));
  ok('banco sem resposta: avisa (com o motivo) e guarda neste navegador', /só neste navegador/.test(E.av) && /PGRST205/.test(E.av), E.av);
  await pg.click('.sq[data-id="fca"] .sq-b[data-ac="olho"]'); await pg.waitForTimeout(900);
  ok('a escolha fica no navegador e volta depois do F5', await pg.evaluate(() => JSON.parse(localStorage.getItem('apres_modelo_GRL')).off.includes('fca')));
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => typeof DECK !== 'undefined' && DECK.length > 3); await pg.waitForTimeout(200);
  ok('depois do F5 o bloco continua fora', (await estado(pg)).seq.includes('–|fca|off'));
  ok('sem erro de JavaScript', !errs.length, errs.join(' | '));
  await ctx.close();
}
console.log('2b · gestor só do CBA T2: a Empurrada fica fora');
{
  const { ctx, pg, errs } = await abre({ perfil: { nome: 'João Silva', unidade: 'CBA T2', is_admin: false } });
  await pronto(pg); await pg.waitForTimeout(200);
  const E = await estado(pg), kmC = await pg.evaluate(() => KMP && KMP.lista ? KMP.lista[0].html : ''), scC = await pg.evaluate(() => SCP && SCP.lista ? SCP.lista[0].html : '');
  ok('só o código dele; Painel KM sem a Empurrada; Scorecard só do CDD', E.cod === 'CBA' && E.cods === 'CBA T2' && /und=CBA proj=ROTA /.test(kmC) && /uni=CDD CUIABA vig/.test(scC), E.cods + ' · ' + kmC.slice(60, 150));
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
  await pronto(pg); await pg.waitForTimeout(500);
  const r = await pg.evaluate(() => { const de = document.documentElement, q = document.getElementById('telaQ').getBoundingClientRect(), t = document.getElementById('tela').getBoundingClientRect(), s = document.getElementById('seq'), pt = document.querySelector('.palco-top');
    return { pagina: de.scrollHeight <= de.clientHeight + 1 && de.scrollWidth <= de.clientWidth + 1, prop: Math.abs(q.width / q.height - 16 / 9) < 0.02, cabe: q.width <= t.width + 1 && q.height <= t.height + 1, larg: Math.round(q.width), lateral: s.scrollWidth <= s.clientWidth + 1, topo: pt.scrollWidth <= pt.clientWidth + 1 }; });
  ok(`${w}×${h} ${tema}: sem rolagem de página, prévia em 16:9 dentro do palco, botões do topo cabendo`, r.pagina && r.prop && r.cabe && r.lateral && r.topo && r.larg > 500, JSON.stringify(r));
  // nenhum slide de conteúdo passa da altura do slide
  const alt = await pg.evaluate(() => { const d = document.getElementById('prev').contentDocument, ruins = []; [...d.querySelectorAll('.slide')].forEach((s, i) => { s.style.display = ''; if (s.scrollHeight > 721) ruins.push(DECK[i].item + ' ' + s.scrollHeight); }); mostra(); return ruins; });
  if (w === 1366 && tema === 'dark') ok('nenhum slide passa de 720 px de altura', !alt.length, alt.join(' · '));
  if (SHOT) { await pg.screenshot({ path: path.join(SHOT, `ap-${w}-${tema}.png`) });
    if (w === 1600 && tema === 'dark') { await pg.evaluate(() => abreUn2('un-mes')); await pg.screenshot({ path: path.join(SHOT, 'filtro.png') }); await pg.evaluate(() => fechaUn());
      for (const it of ['capa', 'sumario', 'resultado', 'ponte', 'pac:combustiveis', 'arv', 'km', 'desvios', 'fca', 'fim']) { await pg.click(`.sq[data-id="${it}"]`); await pg.waitForTimeout(250); await pg.locator('#telaQ').screenshot({ path: path.join(SHOT, `slide-${it.replace(':', '-')}.png`) }); }
      await pg.evaluate(() => { const i = DECK.findIndex(d => d.item === 'resultado'); POS = i + 1; mostra(); }); await pg.waitForTimeout(200); await pg.locator('#telaQ').screenshot({ path: path.join(SHOT, 'slide-resultado-projeto.png') }); } }
  ok(`${w}×${h} ${tema}: sem erro de JavaScript`, !errs.length, errs.join(' | '));
  await ctx.close();
}
await br.close(); srv.close();
console.log(`\n${oks} ok · ${falhas} falha(s)`); process.exit(falhas ? 1 : 0);
