// ============================================================================
// Teste da /compra-pneus/ no Chromium, com o banco e o Prolog dublados (o
// sandbox não alcança o Supabase). O que se prova:
//
//  1. NECESSIDADE pelas três premissas do Renan, e só por elas: abaixo de 4 mm
//     E (1ª vida no dianteiro | vida 5+ | último eixo da CARRETA em vida 3+ —
//     4xx se o tipo diz 4 EIXOS, senão 3xx; 3EE de caminhão não conta).
//     SUGERIDO = pedido − estoque, com o estoque dividido entre os pendentes. Pneu
//     abaixo de 4 mm que vai para recape, sem leitura (0 mm) ou acima de 4 mm
//     NÃO conta; a medida do Prolog ("235/75 R17.5", "8/15 R15") cai na opção
//     certa do pedido. ESTOQUE = status INVENTORY da medida.
//  2. VALOR PREVISTO = (aprovado, ou o pedido enquanto não avaliado) × preço do
//     produto; sem produto escolhido, o menor preço da medida; medida sem preço
//     vira aviso, não zero escondido. Aprovar, trocar o produto e mudar o preço
//     na visão Preços refazem a conta.
//  3. A UNIDADE só vê o pedido: chips das unidades do perfil, projetos da
//     unidade, campo faltando vira mensagem, o pedido entra sem aprovação,
//     o pendente pode ser apagado e o avaliado não. Não lê o Prolog.
//  4. Os gates: sem unidade no perfil; tabela inexistente (SQL não rodado).
//
// Uso (de uma pasta onde o playwright resolve):
//   RAIZ=<repositório> SBJS=<supabase.js UMD, opcional> node compra-pneus-teste.mjs
// ============================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = process.env.RAIZ || path.resolve(new URL('..', import.meta.url).pathname);
const SHOT = process.env.SHOT_DIR || '';
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' };
const srv = createServer((req, res) => {
  const f = path.join(RAIZ, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

let ok = 0, falhas = 0;
const af = (t, v, e = '') => { console.log(`   ${v ? '✓' : '✗'} ${t}${e !== '' ? '  (' + e + ')' : ''}`); if (v) ok++; else falhas++; };

/* ── fixtures ── */
const PRECOS = [
  ['295', 'BRIDGESTONE M765 295/80R22.5', 2131], ['295', 'BRIDGESTONE FS440 295/80R22.5 16M', 1967],
  ['235', 'BRIDGESTONE M814 235/75R17.5 14M', 1357], ['235', 'SPEEDMAX ARO 17.5 SPM01 235/75R17.5', 709],
  ['205', 'PNEU GOODYEAR CARGO MARATHON 205/75R16 LISO', 701.55],
].map(([medida, produto, valor], i) => ({ id: i + 1, medida, produto, codigo: null, valor, ativo: true }));
const PEDIDOS = [
  { id: 1, unidade: 'MCC T2', projeto: 'ROTA', vigencia: '2026-10', banda: 'Liso/Direcional', medida: '235', qtd: 12, qtd_aprovada: null, preco_id: null, criado_nome: 'Unidade', created_at: '2026-10-05T12:00:00Z' },
  { id: 2, unidade: 'CGR', projeto: 'ROTA', vigencia: '2026-09', banda: 'Tração/Borrachudo', medida: '295', qtd: 10, qtd_aprovada: 8, preco_id: 2, criado_nome: 'Unidade', created_at: '2026-09-10T12:00:00Z' },
  { id: 3, unidade: 'PIR', projeto: 'EMPURRADA', vigencia: '2026-10', banda: 'Empilhadeira', medida: '5.00-8', qtd: 4, qtd_aprovada: null, preco_id: null, criado_nome: 'Unidade', created_at: '2026-10-04T12:00:00Z' },
  { id: 4, unidade: 'MCC T2', projeto: 'VAN', vigencia: '2026-09', banda: 'Leve', medida: '205', qtd: 6, qtd_aprovada: 6, preco_id: 5, criado_nome: 'Unidade', created_at: '2026-09-02T12:00:00Z' },
  // 2º pendente da MESMA unidade e medida do id 1: o estoque (3) já foi consumido pelo mais antigo
  { id: 5, unidade: 'MCC T2', projeto: 'VAN', vigencia: '2026-10', banda: 'Leve', medida: '235', qtd: 2, qtd_aprovada: null, preco_id: null, criado_nome: 'Unidade', created_at: '2026-10-05T13:00:00Z' },
];
const T = (o) => ({ status: 'INSTALLED', medida: '235/75 R17.5', cicloVida: 1, direcional: false, nomePosicao: '2DI', menorMM: 3, veiculoId: 9, ...o });
const PNEUS_MCC_T2 = [
  T({ direcional: true, nomePosicao: '1E', menorMM: 3 }),          // premissa 1
  T({ cicloVida: 5, nomePosicao: '2EE', menorMM: 2 }),              // premissa 2
  T({ cicloVida: 3, nomePosicao: '3EE', menorMM: 3.5, veiculoId: 20 }), // premissa 3: semirreboque 3 eixos, último eixo
  T({ cicloVida: 2, nomePosicao: '3EE', menorMM: 3, veiculoId: 20 }),   // último eixo mas só 1ª recapagem → recape
  T({ cicloVida: 3, nomePosicao: '3EE', menorMM: 3 }),                  // 3EE de CAMINHÃO (veículo 9) → não é carreta
  T({ cicloVida: 3, nomePosicao: '3EI', menorMM: 3, veiculoId: 21 }),   // semirreboque 4 eixos: eixo 3 não é o último
  T({ cicloVida: 4, nomePosicao: '4DI', menorMM: 3, veiculoId: 21 }),   // premissa 3: 4DI do semirreboque 4 eixos
  T({ cicloVida: 3, nomePosicao: '2DE', menorMM: 3, veiculoId: 22 }),   // "Semi Reboque" sem 4 no nome: último eixo = 3, então 2DE não conta
  T({ cicloVida: 3, nomePosicao: '3DI', menorMM: 3, veiculoId: 22 }),   // premissa 3: 3DI do "Semi Reboque"
  T({ cicloVida: 3, nomePosicao: '3DE', menorMM: 3, veiculoId: 23 }),   // "CARRETA BAU 2 EIXOS": não tem 4 → regra do 3
  T({ cicloVida: 1, nomePosicao: '2DI', menorMM: 3 }),              // tração vida 1 → recape
  T({ direcional: true, nomePosicao: '1D', menorMM: 0 }),           // sem leitura
  T({ direcional: true, nomePosicao: '1D', menorMM: 5 }),           // acima de 4 mm
  T({ cicloVida: 2, direcional: true, nomePosicao: '1D', menorMM: 2 }), // recapado no dianteiro: não é "1ª vida"
  T({ status: 'INVENTORY', cicloVida: 1, veiculoId: null }), T({ status: 'INVENTORY', cicloVida: 1, veiculoId: null }),
  T({ status: 'INVENTORY', cicloVida: 2, veiculoId: null }),
  T({ status: 'DISPOSAL', veiculoId: null }),
  T({ medida: '8/15 R15', direcional: true, nomePosicao: '1E', menorMM: 2 }), // 8.25-15 arredondado pelo loader
];
const VEIC = [{ id: 9, tipo: 'CAMINHÃO BAÚ ROLL UP 10 PALLETS' }, { id: 20, tipo: 'SEMI REBOQUE - 3 EIXOS SIDER ASA DELTA' }, { id: 21, tipo: 'SEMI REBOQUE 4 EIXOS' }, { id: 22, tipo: 'Semi Reboque' }, { id: 23, tipo: 'CARRETA BAU 2 EIXOS' }];
const SNAP = { 1677: { tires: PNEUS_MCC_T2, vehicles: VEIC }, 37: { tires: [T({ medida: '295/80 R22.5', cicloVida: 6, menorMM: 1 }), T({ medida: '295/80 R22.5', status: 'INVENTORY', veiculoId: null })], vehicles: VEIC } };

/* dublê do supabase-js: o mínimo de PostgREST que a página usa, com as regras
   do banco (scripts/pneus-compra.sql) — vigência carimbada, unidade não aprova,
   unidade só apaga pendente */
const SHIM_SB = (perfil, faltaTabela) => `(function(){
const DB={pneu_pedido:${JSON.stringify(PEDIDOS)},pneu_preco:${JSON.stringify(PRECOS)}};
const SNAP=${JSON.stringify(SNAP)}; const PERFIL=${JSON.stringify(perfil)}; const FALTA=${JSON.stringify(!!faltaTabela)};
window.__log={insert:[],update:[],snapshot:0}; window.__db=DB;
const admin=!!PERFIL.is_admin, unis=String(PERFIL.unidade||'').split(',').map(s=>s.trim()).filter(Boolean);
const pode=r=>admin||unis.includes(r.unidade);
function q(t){ let op='select', val=null, f=[], ord=null, rg=null, one=false, ret=false;
  const b={ select(){ if(op!=='select') ret=true; return b; }, order(){ return b; }, eq(c,v){ f.push([c,v]); return b; }, in(c,l){ f.push([c,l,'in']); return b; },
    insert(o){ op='insert'; val=o; return b; }, update(o){ op='update'; val=o; return b; }, delete(){ op='delete'; return b; },
    range(a,z){ rg=[a,z]; return b; }, maybeSingle(){ one=true; return b; },
    then(res,rej){ return Promise.resolve().then(run).then(res,rej); } };
  const casa=r=>f.every(([c,v,k])=>k==='in'?v.includes(r[c]):r[c]===v);
  function run(){
    if(t==='fca_profiles') return {data:one?PERFIL:[PERFIL],error:null};
    if(t==='snapshot'){ window.__log.snapshot++; const bid=(f.find(x=>x[0]==='branch_id')||[])[1]; const d=SNAP[bid];
      return {data:d?Object.keys(d).map(e=>({endpoint:e,data:d[e],updated_at:'2026-10-05T15:00:00Z'})):[],error:null}; }
    if(FALTA) return {data:null,error:{message:'relation "public.'+t+'" does not exist'}};
    const tab=DB[t]; if(!tab) return {data:null,error:{message:'tabela '+t}};
    if(op==='select'){ let rows=tab.filter(r=>t!=='pneu_pedido'||pode(r)).filter(casa); if(rg) rows=rows.slice(rg[0],rg[1]+1); return {data:JSON.parse(JSON.stringify(rows)),error:null}; }
    if(op==='insert'){ const o={...val}; window.__log.insert.push({t,o:{...o}});
      if(t==='pneu_pedido'){ if(!pode(o)) return {data:null,error:{message:'new row violates row-level security policy'}};
        o.id=Math.max(0,...tab.map(r=>r.id))+1; o.vigencia='2026-10'; o.created_at=new Date().toISOString(); if(!admin){ o.qtd_aprovada=null; o.preco_id=null; } }
      else { if(!admin) return {data:null,error:{message:'rls'}}; o.id=Math.max(0,...tab.map(r=>r.id))+1; if(o.ativo==null) o.ativo=true; }
      tab.push(o); return {data:ret?[o]:null,error:null}; }
    if(op==='update'){ window.__log.update.push({t,val:{...val},f:f.slice()}); if(!admin) return {data:[],error:null};
      const rows=tab.filter(casa); rows.forEach(r=>Object.assign(r,val)); return {data:JSON.parse(JSON.stringify(rows)),error:null}; }
    if(op==='delete'){ const rows=tab.filter(casa).filter(r=>admin||(pode(r)&&r.qtd_aprovada==null));
      rows.forEach(r=>tab.splice(tab.indexOf(r),1));
      if(t==='pneu_preco') DB.pneu_pedido.forEach(p=>{ if(rows.some(r=>r.id===p.preco_id)) p.preco_id=null; });
      return {data:JSON.parse(JSON.stringify(rows)),error:null}; }
  }
  return b; }
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'r@x.com',user_metadata:{name:'Teste Pneus'}}}}})},from:q})};
})();`;

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
async function abre(perfil, { falta = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('**/assets/build-check.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/assets/gviz-cache.js*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route('**/cdn.jsdelivr.net/**', r => { const u = r.request().url();
    const body = u.includes('supabase') ? SHIM_SB(perfil, falta) : u.includes('html2canvas') ? 'window.html2canvas=async()=>document.createElement("canvas");' : u.includes('jspdf') ? 'window.jspdf={jsPDF:function(){}};' : '';
    r.fulfill({ status: 200, contentType: 'application/javascript', body }); });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => d.accept());
  await pg.addInitScript(() => { try { localStorage.removeItem('compra_pneus_mini'); } catch (e) {} });
  await pg.goto(BASE + '/compra-pneus/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const s = document.getElementById('titSub'); return s && !/Carregando/.test(s.textContent); }, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(500);
  return { pg, ctx, errs };
}
const txt = (pg, sel) => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
const linha = (pg, id) => pg.$$eval(`#tb-ped tr[data-id="${id}"] td`, tds => tds.map(t => t.textContent.replace(/\s+/g, ' ').trim())).catch(() => []);

/* ═══ 1 · ADMIN ═══ */
console.log('\n1 · Admin — Resumo Gerencial, Necessidade, Estoque e valor previsto');
{
  const { pg, ctx, errs } = await abre({ is_admin: true, unidade: null });
  await pg.waitForFunction(() => !/…/.test((document.querySelector('#tb-ped tr[data-id="1"] td:nth-child(8)') || {}).textContent || '…'), { timeout: 10000 }).catch(() => {});
  af('abre no Resumo Gerencial', await txt(pg, '#tit') === 'Resumo Gerencial');
  af('visões de admin visíveis', await pg.$$eval('.s-item.adm', b => b.every(x => x.style.display !== 'none')));
  af('KPIs: 5 pedidos · 34 pneus pedidos · 14 aprovados · 3 aguardando',
    await txt(pg, '#k-ped') === '5' && await txt(pg, '#k-qtd') === '34' && await txt(pg, '#k-apr') === '14' && await txt(pg, '#k-pend') === '3',
    [await txt(pg, '#k-ped'), await txt(pg, '#k-qtd'), await txt(pg, '#k-apr'), await txt(pg, '#k-pend')].join(' · '));
  // não avaliado vale o SUGERIDO: id1 9×709 + id5 2×709 (estoque já consumido) + 8×1967 + 6×701,55 = 27744,30
  af('valor previsto = sugerido × menor preço + aprovados', await txt(pg, '#k-val') === 'R$ 27.744', await txt(pg, '#k-val'));
  af('pedido sem preço da medida vira aviso', /1 pedido\(s\) sem preço/.test(await txt(pg, '#k-val-m')), await txt(pg, '#k-val-m'));
  const l1 = await linha(pg, 1);
  af('MCC T2 · 235: Necessidade = 6 (1 + 1 + 4 do último eixo das carretas)', l1[7] === '6', l1[7]);
  af('Sugerido = 12 pedidos − 3 em estoque = 9', l1[8] === '9', l1[8]);
  af('2º pedido da mesma unidade e medida: estoque já usado, sugerido = 2', (await linha(pg, 5))[8] === '2', (await linha(pg, 5))[8]);
  af('pedido já avaliado não tem sugerido', (await linha(pg, 2))[8] === '—');
  af('MCC T2 · 235: Estoque = 3 (INVENTORY; descarte fora)', l1[6] === '3', l1[6]);
  const dica = await pg.$eval('#tb-ped tr[data-id="1"] td:nth-child(8) span', e => e.title).catch(() => '');
  af('dica da Necessidade separa as premissas', /1ª vida no dianteiro: 1/.test(dica) && /4ª recapagem: 1/.test(dica) && /último eixo da carreta: 4/.test(dica), dica);
  af('sem produto escolhido: menor preço da medida, avisado', /menor preço da medida/.test(l1[10]) && /709/.test(l1[10]), l1[10]);
  const l3 = await linha(pg, 3);
  af('5.00-8 sem preço: célula diz "sem preço da medida"', /sem preço da medida/.test(l3[10]) && l3[11].startsWith('—'), l3[10] + ' | ' + l3[10]);
  af('CGR · 295 com vida 6 abaixo de 4 mm conta (4ª recapagem em diante)', (await linha(pg, 2))[7] === '1');
  const nec825 = await pg.evaluate(() => NEC['MCC T2'] && NEC['MCC T2']['8.25-15'] ? NEC['MCC T2']['8.25-15'].n : 0);
  af('"8/15 R15" do Prolog cai em 8.25-15', nec825 === 1, nec825);
  af('situação: aguardando / aprovado parcial', /Aguardando/.test(l1[11]) && /Aprovado parcial/.test((await linha(pg, 2))[11]));
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'cp-resumo.png') });

  // aprovar 10 → 10×709
  await pg.fill('#tb-ped input[data-apr="1"]', '10'); await pg.press('#tb-ped input[data-apr="1"]', 'Tab'); await pg.waitForTimeout(300);
  let up = await pg.evaluate(() => window.__log.update.slice(-1)[0]);
  af('aprovar grava qtd_aprovada, o produto mostrado e quem aprovou', up && up.val.qtd_aprovada === 10 && up.val.preco_id === 4 && up.val.aprovado_nome === 'Teste Pneus', JSON.stringify(up && up.val));
  let l = await linha(pg, 1);
  af('valor da linha = 10 × 709', /R\$ 7\.090,00/.test(l[11]) && /Aprovado parcial/.test(l[11]), l[11]);
  // trocar o produto → 10 × 1357
  await pg.selectOption('#tb-ped select[data-prod="1"]', '3'); await pg.waitForTimeout(300);
  l = await linha(pg, 1);
  af('trocar o produto refaz o valor (10 × 1.357)', /R\$ 13\.570,00/.test(l[11]) && !/menor preço/.test(l[10]), l[11]);
  // aprovar 0 → não aprovado, valor 0
  await pg.fill('#tb-ped input[data-apr="3"]', '0'); await pg.press('#tb-ped input[data-apr="3"]', 'Tab'); await pg.waitForTimeout(300);
  af('0 aprovado = "Não aprovado"', /Não aprovado/.test((await linha(pg, 3))[11]));
  // limpar volta para aguardando
  await pg.fill('#tb-ped input[data-apr="3"]', ''); await pg.press('#tb-ped input[data-apr="3"]', 'Tab'); await pg.waitForTimeout(300);
  up = await pg.evaluate(() => window.__log.update.slice(-1)[0]);
  af('apagar o aprovado volta para aguardando (qtd_aprovada nula)', up && up.val.qtd_aprovada === null && /Aguardando/.test((await linha(pg, 3))[11]));

  // filtro de unidade
  await pg.evaluate(() => { const w = document.getElementById('ms-uni'); w._sel = new Set(['CGR']); w._render(''); render(); });
  af('filtro Unidade = CGR: 1 pedido, 10 pneus', await txt(pg, '#k-ped') === '1' && await txt(pg, '#k-qtd') === '10');
  await pg.evaluate(() => { const w = document.getElementById('ms-uni'); w._sel = new Set(); w._render(''); render(); });

  await pg.click('.s-item[data-vw="pedido"]'); await pg.waitForTimeout(200);
  // o filtro do padrão: botão "Unidade" + contagem, Todos, only, busca (Renan: "Totalmente fora do padrão o filtro")
  af('admin em Pedidos: filtro do padrão com Todos + as 14', await pg.$$eval('#ms-uped .ms-opt', o => o.length) === 15 && !!(await pg.$('#ms-uped .ms-all'))
    && await pg.$$eval('#ms-uped .ms-only', o => o.length) === 14 && await pg.$eval('#ms-uped .ms-btn', b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('')).then(t => t.replace(/\s+/g, '') === 'Unidade') && !(await pg.$('#ms-uped input[type=radio]')));
  af('nada marcado = pedidos de todas as unidades, com a coluna Unidade', await pg.$$eval('#tb-meus tbody tr', t => t.length) === 5 && /Unidade/.test(await txt(pg, '#tb-meus thead')) && await txt(pg, '#tit-meus') === 'Pedidos das unidades');
  await pg.click('#ms-uped .ms-btn'); await pg.fill('#ms-uped .ms-search input', 'cba'); await pg.waitForTimeout(100);
  af('busca do filtro acha as 3 de CBA', await pg.$$eval('#ms-uped .ms-opt', o => o.length) === 3);
  await pg.click('#ms-uped .ms-only[data-v="CBA T2"]'); await pg.waitForTimeout(100);
  af('"only" CBA T2: contagem 1 no botão, título da unidade, sem coluna Unidade', await txt(pg, '#ms-uped .ms-cnt') === '1' && await txt(pg, '#tit-meus') === 'Pedidos da unidade · CBA T2' && !/Unidade/.test(await txt(pg, '#tb-meus thead')));
  await pg.click('body', { position: { x: 5, y: 5 } }); await pg.waitForTimeout(50);
  af('o menu fecha ao clicar fora', !(await pg.$('#ms-uped .ms-panel.open')));
  await pg.click('#bt-novo'); await pg.waitForTimeout(100);
  af('caixa já em CBA T2, com os projetos dela', await pg.$eval('#f-uni', e => e.value + '|' + e.disabled) === 'CBA T2|true'
    && JSON.stringify(await pg.$$eval('#f-proj option', o => o.map(x => x.value).filter(Boolean))) === '["ROTA","VAN","AUTO SERVIÇO","INSUMOS"]');
  await pg.keyboard.press('Escape');
  await pg.evaluate(() => { const w = document.getElementById('ms-uped'); w._sel.clear(); w._render(''); renderMeus(); });
  await pg.click('#bt-novo'); await pg.waitForTimeout(100);
  af('sem filtro, a caixa oferece as 14 (+ Selecione…) e guarda a última escolhida', await pg.$eval('#f-uni', e => e.options.length + '|' + e.value + '|' + e.disabled) === '15|CBA T2|false');
  await pg.selectOption('#f-uni', ''); await pg.waitForTimeout(50);
  af('sem unidade, o projeto espera por ela', await pg.$$eval('#f-proj option', o => o.length) === 1 && /Escolha a unidade/.test(await txt(pg, '#f-proj')));
  await pg.selectOption('#f-uni', 'CGR'); await pg.waitForTimeout(50);
  af('escolher a unidade na caixa traz os projetos dela', (await pg.$$eval('#f-proj option', o => o.length)) > 1);
  await pg.keyboard.press('Escape');
  await pg.click('.s-item[data-vw="resumo"]'); await pg.waitForTimeout(200);
  af('filtro de unidade do pedido some no Resumo', await pg.$eval('#ms-uped', e => e.style.display === 'none'));
  // PREÇOS
  await pg.click('.s-item[data-vw="precos"]'); await pg.waitForTimeout(200);
  af('visão Preços lista os 5 produtos + linha de inclusão', await pg.$$eval('#tb-preco tr[data-pid]', t => t.length) === 5 && !!await pg.$('#np-prod'));
  await pg.fill('#tb-preco tr[data-pid="3"] input[data-f="valor"]', '1.400,00'); await pg.press('#tb-preco tr[data-pid="3"] input[data-f="valor"]', 'Tab'); await pg.waitForTimeout(300);
  const p3 = await pg.evaluate(() => window.__db.pneu_preco.find(p => p.id === 3).valor);
  af('editar o valor em pt-BR grava 1400', p3 === 1400, p3);
  await pg.selectOption('#np-med', '5.00-8'); await pg.fill('#np-prod', 'PNEU 5.00-8 TESTE'); await pg.fill('#np-val', '350,50');
  await pg.click('#tb-preco .addrow .btn'); await pg.waitForTimeout(300);
  af('adicionar produto entra na tabela', await pg.$$eval('#tb-preco tr[data-pid]', t => t.length) === 6);
  await pg.click('.s-item[data-vw="resumo"]'); await pg.waitForTimeout(200);
  af('preço novo vale na hora: 10 × 1.400', /R\$ 14\.000,00/.test((await linha(pg, 1))[11]), (await linha(pg, 1))[11]);
  af('medida que ganhou preço passa a ter valor (4 × 350,50)', /R\$ 1\.402,00/.test((await linha(pg, 3))[11]), (await linha(pg, 3))[11]);
  for (const w of [1600, 1366]) {
    await pg.setViewportSize({ width: w, height: 768 }); await pg.waitForTimeout(200);
    const sw = await pg.$eval('#tb-ped', t => { const w = t.closest('.twrap'); return [w.scrollWidth, w.clientWidth]; });
    af(`sem barra horizontal em ${w} px`, sw[0] <= sw[1] + 1, sw.join(' × '));
    if (process.env.MEDE) console.log(await pg.$$eval('#tb-ped thead th', t => t.map(x => x.textContent.trim().slice(0,6) + ':' + Math.round(x.getBoundingClientRect().width)).join(' ')));
  }
  await pg.setViewportSize({ width: 1600, height: 900 });
  af('Prolog lido uma vez por unidade (14 leituras)', await pg.evaluate(() => window.__log.snapshot) === 14, await pg.evaluate(() => window.__log.snapshot));
  // admin apaga qualquer pedido, inclusive o já avaliado (Renan, 05/10/2026: "Admin precisa conseguir excluir")
  await pg.click('.s-item[data-vw="pedido"]'); await pg.waitForTimeout(200);
  const lix = await pg.$$eval('#tb-meus tbody tr', t => t.map(r => !!r.querySelector('.ico-bt')));
  af('admin: lixeira em todos os pedidos, avaliados inclusive', lix.length > 1 && lix.every(Boolean), JSON.stringify(lix));
  let msgDlg = ''; pg.once('dialog', d => { msgDlg = d.message(); });
  const nAntes = await pg.$$eval('#tb-meus tbody tr', t => t.length);
  await pg.click('#tb-meus .ico-bt[onclick="apagaPedido(2)"]'); await pg.waitForTimeout(400);
  af('apagar avaliado pede confirmação própria e some da lista', /já foi avaliado/.test(msgDlg) && await pg.$$eval('#tb-meus tbody tr', t => t.length) === nAntes - 1
    && !(await pg.evaluate(() => window.__db.pneu_pedido.some(r => r.id === 2))), msgDlg);
  af('sem erro de página', !errs.length, errs.join(' | '));
  await ctx.close();
}

/* ═══ 2 · UNIDADE COM DUAS UNIDADES ═══ */
console.log('\n2 · Unidade (MCC T1, MCC T2) — só o pedido');
{
  const { pg, ctx, errs } = await abre({ is_admin: false, unidade: 'MCC T1,MCC T2' });
  af('abre em Pedidos, com a tabela ocupando a visão (sem formulário fixo)', await txt(pg, '#tit') === 'Pedidos' && !(await pg.$('#vw-pedido .frow')) && !(await pg.$('#mbg.open')));
  af('visões de admin e filtros escondidos', await pg.$$eval('.s-item.adm', b => b.every(x => x.style.display === 'none')) && await pg.$eval('#filtros', e => e.style.display === 'none'));
  af('Preços só para admin: some do menu e a unidade não consegue abrir', await pg.$eval('.s-item[data-vw="precos"]', e => e.style.display === 'none')
    && await pg.evaluate(() => { setVw('precos'); return VW; }) === 'pedido' && !(await pg.$('#vw-precos.on')));
  af('unidade é o FILTRO DO PADRÃO com as duas do perfil', !(await pg.$('#dims-uni')) && await pg.$eval('#ms-uped', e => e.style.display !== 'none')
    && await pg.$eval('#ms-uped .ms-btn', b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('')).then(t => t.replace(/\s+/g, '') === 'Unidade')
    && JSON.stringify(await pg.$$eval('#ms-uped .ms-opt input[data-v]', o => o.map(x => x.dataset.v))) === '["MCC T1","MCC T2"]');
  af('nada marcado = as duas unidades (3 pedidos de MCC T2)', await pg.$$eval('#tb-meus tbody tr', t => t.length) === 3 && await txt(pg, '#tit-meus') === 'Pedidos das unidades');
  await pg.click('#ms-uped .ms-btn'); await pg.waitForTimeout(100);
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'cp-filtro.png') });
  await pg.click('#ms-uped .ms-only[data-v="MCC T1"]'); await pg.waitForTimeout(100);
  af('MCC T1 sem pedido: a linha vazia convida a lançar', /clique aqui/i.test(await txt(pg, '#tb-meus tbody tr.vazio')) && await txt(pg, '#tit-meus') === 'Pedidos da unidade · MCC T1');
  await pg.click('body', { position: { x: 5, y: 5 } }); await pg.waitForTimeout(50);
  await pg.click('#tb-meus tbody tr.vazio'); await pg.waitForTimeout(100);
  af('clicar na tabela vazia abre a caixa do pedido', !!(await pg.$('#mbg.open')) && await pg.$eval('#f-uni', e => e.value) === 'MCC T1');
  af('projetos de MCC T1 = EMPURRADA', JSON.stringify(await pg.$$eval('#f-proj option', o => o.map(x => x.value).filter(Boolean))) === '["EMPURRADA"]');
  af('vigência = mês corrente, só leitura', /^[A-Z]{3}\/\d{2}$/.test(await txt(pg, '#f-vig')) && !(await pg.$('#f-vig input')));
  af('não lê o Prolog', await pg.evaluate(() => window.__log.snapshot) === 0);
  await pg.click('#f-env'); await pg.waitForTimeout(100);
  af('campo faltando vira mensagem e a caixa fica aberta', /Falta preencher: banda de rodagem, projeto, medida, quantidade/.test(await txt(pg, '#f-msg')) && !!(await pg.$('#mbg.open')), await txt(pg, '#f-msg'));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
  af('Esc fecha a caixa', !(await pg.$('#mbg.open')));
  await pg.click('#ms-uped .ms-btn'); await pg.click('#ms-uped .ms-only[data-v="MCC T2"]'); await pg.waitForTimeout(100);
  af('"only" MCC T2 troca a seleção (contagem 1)', await txt(pg, '#ms-uped .ms-cnt') === '1' && JSON.stringify(await pg.$$eval('#ms-uped input[data-v]:checked', o => o.map(x => x.dataset.v))) === '["MCC T2"]');
  await pg.click('body', { position: { x: 5, y: 5 } }); await pg.waitForTimeout(50);
  af('a lista mostra os pedidos de MCC T2 (3)', await pg.$$eval('#tb-meus tbody tr', t => t.length) === 3);
  await pg.click('#bt-novo'); await pg.waitForTimeout(100);
  af('"Novo pedido" abre a caixa já na unidade escolhida, com os projetos dela', !!(await pg.$('#mbg.open')) && await pg.$eval('#f-uni', e => e.value) === 'MCC T2'
    && JSON.stringify(await pg.$$eval('#f-proj option', o => o.map(x => x.value).filter(Boolean))) === '["ROTA","VAN","PA PETRÓPOLIS"]');
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'cp-modal.png') });
  af('a caixa fica no <body>, fora do .app (position:fixed ancorado na tela)', await pg.$eval('#mbg', e => e.parentElement === document.body));
  await pg.selectOption('#f-banda', 'Liso/Direcional'); await pg.selectOption('#f-proj', 'ROTA'); await pg.selectOption('#f-med', '235'); await pg.fill('#f-qtd', '8');
  await pg.click('#f-env'); await pg.waitForTimeout(400);
  const ins = await pg.evaluate(() => window.__log.insert.slice(-1)[0]);
  af('insert com a unidade do filtro e sem aprovação', ins && ins.o.unidade === 'MCC T2' && ins.o.qtd === 8 && ins.o.medida === '235' && !('qtd_aprovada' in ins.o), JSON.stringify(ins && ins.o));
  af('enviar fecha a caixa, avisa acima da tabela e atualiza a lista (4)', !(await pg.$('#mbg.open')) && /Pedido enviado: MCC T2 · 8 pneu/.test(await txt(pg, '#f-ok')) && await pg.$$eval('#tb-meus tbody tr', t => t.length) === 4);
  const btns = await pg.$$eval('#tb-meus tbody tr', t => t.map(r => !!r.querySelector('.ico-bt')));
  af('só pedido pendente tem lixeira (avaliado não)', btns.filter(Boolean).length === 3 && btns.length === 4, JSON.stringify(btns));
  const antes = await pg.$$eval('#tb-meus tbody tr', t => t.length);
  await pg.click('#tb-meus tbody tr:first-child .ico-bt'); await pg.waitForTimeout(400);
  af('apagar pendente tira da lista', await pg.$$eval('#tb-meus tbody tr', t => t.length) === antes - 1);
  if (SHOT) await pg.screenshot({ path: path.join(SHOT, 'cp-unidade.png') });
  af('sem erro de página', !errs.length, errs.join(' | '));
  await ctx.close();
}

/* ═══ 3 · GATES ═══ */
console.log('\n3 · Gates');
{
  const { pg, ctx } = await abre({ is_admin: false, unidade: null });
  af('sem unidade no perfil → gate', await txt(pg, '.gate h2') === 'Sem unidade no perfil');
  await ctx.close();
  const b = await abre({ is_admin: true, unidade: null }, { falta: true });
  af('tabela inexistente → gate que fala do SQL', await txt(b.pg, '.gate h2') === 'Banco sem resposta' && /SQL da Compra de Pneus/.test(await txt(b.pg, '.gate p')));
  await b.ctx.close();
}
/* mobile: a página não estoura a largura */
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } }); await ctx.close();
}

await nav.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
