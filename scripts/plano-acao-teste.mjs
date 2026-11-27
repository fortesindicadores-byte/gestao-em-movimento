// Teste do Plano de Ação (/plano-acao/): FCA + RPS + dia a dia numa tela, cada gravação na tabela certa.
// Chromium com o banco dublado. Uso: node scripts/plano-acao-teste.mjs   (CHART_JS opcional)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHART = process.env.CHART_JS && fs.existsSync(process.env.CHART_JS) ? fs.readFileSync(process.env.CHART_JS, 'utf8') : 'window.Chart=function(){return {destroy(){},update(){}}};Chart.register=function(){};';
let ok = 0, falha = 0;
const t = (c, m, x) => { if (c) { ok++; console.log('   ✓ ' + m); } else { falha++; console.log('   ✗ ' + m + (x !== undefined ? '  (' + JSON.stringify(x) + ')' : '')); } };

const hoje = new Date(); const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const VIG = MES[hoje.getMonth()] + '/' + String(hoje.getFullYear()).slice(2);
const T0 = {
  fca: [
    { id: 'f1', unidade: 'MCC T2', vigencia: 'out/26', origem: 'Custos', fato: 'Combustíveis', projeto: 'ROTA - MCC', fato_desvio: 'Desvio: ▲ R$ 10.000 · ▲ 8%', causa: '1. Km/L abaixo', acao: '1.1. Vistoriar placas', responsavel: 'ERICK SILVA', prazo: '2026-11-10', status: 'Em andamento', acompanhamento: null, created_at: '2026-11-03T10:00:00Z' },
    { id: 'f2', unidade: 'MCC T2', vigencia: 'out/26', origem: 'RPM', fato: 'Preventivas', projeto: 'ROTA - MCC', fato_desvio: 'Meta: 100% | Real: 90%', causa: null, acao: null, responsavel: null, prazo: null, status: 'Não iniciada', acompanhamento: null, created_at: '2026-11-03T10:00:00Z' },
    { id: 'f3', unidade: 'CGR', vigencia: 'out/26', origem: 'Custos', fato: 'Pneus', projeto: 'ROTA - CGR', fato_desvio: '', causa: null, acao: null, responsavel: null, prazo: null, status: 'Não iniciada', acompanhamento: null, created_at: '2026-11-03T10:00:00Z' },
  ],
  plano_acao: [
    { id: 'p1', unidade: 'MCC T2', vigencia: VIG, origem: 'RPS', fato: 'Saída sem checklist', projeto: 'ROTA - MCC', fato_desvio: null, causa: '1. Motorista sem treinamento', acao: '1.1. Treinar a equipe', responsavel: 'ERICK SILVA', prazo: '2026-12-05', status: 'Não iniciada', acompanhamento: null, created_at: '2026-11-20T10:00:00Z' },
    { id: 'p2', unidade: 'MCC T2', vigencia: VIG, origem: 'Dia a dia', fato: 'Pátio sem sinalização', projeto: null, fato_desvio: null, causa: '1. Faixas apagadas', acao: '1.1. Pintar o pátio', responsavel: 'ERICK SILVA', prazo: '2026-11-01', status: 'Em andamento', acompanhamento: null, created_at: '2026-11-15T10:00:00Z' },
  ],
};
const SHIM = (planoErr) => `window.__T=${JSON.stringify(T0)};window.__ins=[];window.__upd=[];window.__del=[];
window.supabase={createClient:()=>({
  auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'gestor@conlogsa.com.br'}}}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}},
  rpc:async()=>({data:[{nome:'ERICK SILVA',unidade:'MCC T1,MCC T2',is_admin:false}],error:null}),
  from:(tab)=>{const T=window.__T;let rows=(T[tab]||[]).slice();const erro=${planoErr}&&tab==='plano_acao'?{message:'relation "public.plano_acao" does not exist'}:null;
    const q={select(){return q;},order(){return q;},not(){return q;},gte(){return q;},lt(){return q;},
      eq(c,v){if(tab==='fca_profiles')rows=[{user_id:'u1',unidade:'MCC T1,MCC T2',is_admin:false,nome:'ERICK SILVA'}];else rows=rows.filter(r=>r[c]===v);return q;},
      in(c,vs){rows=rows.filter(r=>vs.includes(r[c]));return q;},
      maybeSingle:async()=>({data:rows[0]||null,error:null}),
      range:async(a,b)=>erro?{data:null,error:erro}:{data:rows.slice(a,b+1),error:null},
      then(res,rej){return Promise.resolve(erro?{data:null,error:erro}:{data:rows,error:null}).then(res,rej);},
      insert:(r0)=>{const r=Object.assign({id:'n'+(window.__ins.length+1),created_at:new Date().toISOString()},r0);window.__ins.push({tab,r:r0});(T[tab]=T[tab]||[]).push(r);
        const q2={select:()=>q2,single:async()=>erro?{data:null,error:erro}:{data:Object.assign({},r),error:null}};return q2;},
      update:(p)=>{const rec={tab,p};window.__upd.push(rec);const q2={eq:(c,v)=>{rec.ids=[v];(T[tab]||[]).filter(r=>r[c]===v).forEach(r=>Object.assign(r,p));return q2;},
        in:(c,vs)=>{rec.ids=vs;(T[tab]||[]).filter(r=>vs.includes(r[c])).forEach(r=>Object.assign(r,p));return q2;},then:(a,b)=>Promise.resolve({data:null,error:null}).then(a,b)};return q2;},
      delete:()=>({eq:async(c,v)=>{window.__del.push({tab,id:v});T[tab]=(T[tab]||[]).filter(r=>r[c]!==v);return {error:null};}})};
    return q;}})};`;

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
async function abre({ w = 1600, h = 900, tema = 'dark', planoErr = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.addInitScript(tm => { try { sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', tm); localStorage.removeItem('fca_mini'); } catch (e) {} window.confirm = () => true; }, tema === 'light' ? 'light' : 'dark');
  await ctx.route(/^https?:\/\//, r => { const u = r.request().url();
    if (u.includes('supabase')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: u.includes('jsdelivr') ? SHIM(planoErr) : '[]' });
    if (/chart\.js|chart\.umd/i.test(u)) return r.fulfill({ status: 200, contentType: 'application/javascript', body: CHART });
    r.fulfill({ status: 200, contentType: /\.css|fonts/.test(u) ? 'text/css' : 'application/javascript', body: '' }); });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + RAIZ + '/plano-acao/index.html?u=MCC%20T2');
  await pg.waitForFunction(() => document.querySelector('table.rel tbody.fg') || document.querySelector('.empty'), null, { timeout: 15000 });
  await pg.waitForTimeout(400);
  return { ctx, pg, errs };
}

console.log('1 · MCC T2: FCA + RPS + dia a dia numa tabela');
{
  const { ctx, pg, errs } = await abre();
  const fatos = await pg.$$eval('table.rel tbody.fg td.fato .fa-pac', l => l.map(e => e.textContent.trim()));
  t(fatos.includes('Combustíveis') && fatos.includes('Saída sem checklist') && fatos.includes('Pátio sem sinalização'), 'as ações do FCA e do plano aparecem juntas', fatos);
  t(!fatos.includes('Pneus'), 'só a unidade aberta (CGR fora)');
  const orgs = await pg.$$eval('table.rel tbody.fg td.fato .fg-org', l => l.map(e => e.textContent.trim()).sort());
  t(JSON.stringify(orgs) === JSON.stringify(['Dia a dia', 'FCA · Custos', 'FCA · RPM', 'RPS']), 'cada fato diz a origem', orgs);
  const orig = await pg.evaluate(() => { toggleMs('ms-org'); const v = [...document.querySelectorAll('#ms-org .ms-opt input[data-v]')].map(i => i.dataset.v); toggleMs('ms-org'); return v.sort(); });
  t(JSON.stringify(orig) === JSON.stringify(['Dia a dia', 'FCA · Custos', 'FCA · RPM', 'RPS']), 'filtro de origem: FCA · Custos · FCA · RPM · RPS · Dia a dia', orig);
  // filtrar só RPS
  await pg.evaluate(() => { const w = document.getElementById('ms-org'); w._sel = new Set(['RPS']); aplicar(); });
  const soRps = await pg.$$eval('table.rel tbody.fg td.fato .fa-pac', l => l.map(e => e.textContent.trim()));
  t(soRps.length === 1 && soRps[0] === 'Saída sem checklist', 'filtro RPS deixa só a ação da RPS', soRps);
  await pg.evaluate(() => { const w = document.getElementById('ms-org'); w._sel = new Set(); aplicar(); });

  // ação do FCA: status muda na tabela fca, com a origem certa
  await pg.evaluate(() => openKModal('f1'));
  t(await pg.$eval('#km-fato-ed', e => e.readOnly), 'no FCA o fato é só leitura');
  await pg.evaluate(() => { const s = document.getElementById('km-status'); s.value = 'Concluída'; s.dispatchEvent(new Event('change')); });
  await pg.waitForTimeout(200);
  let u = await pg.evaluate(() => window.__upd.slice(-1)[0]);
  t(u && u.tab === 'fca' && u.p.status === 'Concluída' && u.ids[0] === 'f1' && !('origem' in u.p), 'ação do FCA grava na tabela fca', u);
  await pg.evaluate(() => closeKModal());

  // ação do plano: grava em plano_acao; o assunto muda em todas as ações dele
  await pg.evaluate(() => openKModal('p1'));
  t(!(await pg.$eval('#km-fato-ed', e => e.readOnly)), 'no plano o assunto se edita');
  await pg.evaluate(() => { const s = document.getElementById('km-status'); s.value = 'Em andamento'; s.dispatchEvent(new Event('change')); });
  await pg.waitForTimeout(200);
  u = await pg.evaluate(() => window.__upd.slice(-1)[0]);
  t(u && u.tab === 'plano_acao' && u.p.status === 'Em andamento', 'ação da RPS grava em plano_acao', u);
  await pg.evaluate(() => { const f = document.getElementById('km-fato-ed'); f.value = 'Saída sem checklist de cabine'; f.dispatchEvent(new Event('change')); });
  await pg.waitForTimeout(300);
  u = await pg.evaluate(() => window.__upd.filter(x => x.p.fato).slice(-1)[0]);
  t(u && u.tab === 'plano_acao' && u.p.fato === 'Saída sem checklist de cabine', 'assunto novo gravado em plano_acao', u);
  const f2 = await pg.$$eval('table.rel tbody.fg td.fato .fa-pac', l => l.map(e => e.textContent.trim()));
  t(f2.includes('Saída sem checklist de cabine'), 'a tabela mostra o assunto novo', f2);
  await pg.evaluate(() => closeKModal());

  // + nova ação do dia a dia
  await pg.click('#btNova'); await pg.waitForSelector('#naOv.on');
  await pg.fill('#naFato', 'Lavar a frota da Rota');
  await pg.evaluate(() => { document.getElementById('naProj').value = 'ROTA - MCC'; });
  await pg.click('#naOk'); await pg.waitForTimeout(400);
  const ins = await pg.evaluate(() => window.__ins.slice(-1)[0]);
  t(ins && ins.tab === 'plano_acao' && ins.r.origem === 'Dia a dia' && ins.r.unidade === 'MCC T2' && ins.r.projeto === 'ROTA - MCC' && ins.r.causa === '1. ' && ins.r.acao === '1.1. ', 'nova ação do dia a dia em plano_acao, numerada e na unidade', ins);
  t(await pg.$eval('#kmodal-ov', e => getComputedStyle(e).display !== 'none'), 'a caixa da ação abre em seguida');
  // + ação dentro do mesmo assunto vai para plano_acao com a origem certa
  await pg.evaluate(() => novaAcaoDoModal()); await pg.waitForTimeout(400);
  const ins2 = await pg.evaluate(() => window.__ins.slice(-1)[0]);
  t(ins2 && ins2.tab === 'plano_acao' && ins2.r.origem === 'Dia a dia' && ins2.r.fato === 'Lavar a frota da Rota' && !('_tab' in ins2.r), '+ ação no mesmo assunto fica no plano', ins2);
  // + ação numa ação do FCA vai para a fca com a origem do FCA
  await pg.evaluate(() => { closeKModal(); openKModal('f2'); }); await pg.evaluate(() => novaCausaDoModal()); await pg.waitForTimeout(400);
  const ins3 = await pg.evaluate(() => window.__ins.slice(-1)[0]);
  t(ins3 && ins3.tab === 'fca' && ins3.r.origem === 'RPM' && ins3.r.fato === 'Preventivas', '+ causa numa ação do FCA grava na fca com a origem RPM', ins3);
  // excluir uma ação do plano
  await pg.evaluate(() => { closeKModal(); openKModal('p2'); }); await pg.evaluate(() => excluirDoModal()); await pg.waitForTimeout(300);
  const del = await pg.evaluate(() => window.__del.slice(-1)[0]);
  t(del && del.tab === 'plano_acao' && del.id === 'p2', 'excluir uma ação do plano apaga em plano_acao', del);

  // visões
  for (const v of ['resumo', 'kanban', 'gantt', 'flat']) {
    await pg.evaluate(v => vaiPara(v), v); await pg.waitForTimeout(400);
    const n = await pg.evaluate(() => document.getElementById('list').innerText.length);
    t(n > 30, 'visão ' + v + ' desenha', n);
  }
  t(!errs.length, 'sem erro de JavaScript', errs);
  await ctx.close();
}

console.log('2 · sem a tabela plano_acao no banco');
{
  const { ctx, pg, errs } = await abre({ planoErr: true });
  const fatos = await pg.$$eval('table.rel tbody.fg td.fato .fa-pac', l => l.map(e => e.textContent.trim()));
  t(fatos.includes('Combustíveis') && !fatos.includes('Saída sem checklist'), 'as do FCA aparecem mesmo sem a tabela nova', fatos);
  t(await pg.$eval('#planoAviso', e => e.style.display !== 'none' && /SQL/.test(e.textContent)), 'aviso para rodar o SQL');
  t(!errs.length, 'sem erro de JavaScript', errs);
  await ctx.close();
}

console.log('3 · telas');
for (const [w, h, tema] of [[1366, 768, 'dark'], [1920, 1080, 'light']]) {
  const { ctx, pg, errs } = await abre({ w, h, tema });
  for (const v of ['resumo', 'kanban', 'flat']) {
    await pg.evaluate(v => vaiPara(v), v); await pg.waitForTimeout(300);
    const r = await pg.evaluate(() => ({ pagina: document.documentElement.scrollHeight <= innerHeight + 1, lado: document.documentElement.scrollWidth <= innerWidth + 1 }));
    t(r.pagina && r.lado, `${w}×${h} ${tema} ${v}: sem rolagem de página`, r);
  }
  if (process.env.SHOT_DIR) { fs.mkdirSync(process.env.SHOT_DIR, { recursive: true }); await pg.evaluate(() => vaiPara('flat')); await pg.screenshot({ path: path.join(process.env.SHOT_DIR, `plano-${w}-${tema}.png`) }); }
  t(!errs.length, `${w}×${h}: sem erro de JavaScript`, errs);
  await ctx.close();
}
await nav.close();
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);
