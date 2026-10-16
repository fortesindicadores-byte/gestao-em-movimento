// Gerenciar Acessos · lista e caixa de alterações (desenho do app de checklist) + Master.
// Roda o index.html com o Supabase dublado. node scripts/master-teste.mjs (SHOTS=<pasta> salva prints)
import { chromium } from 'playwright';
import path from 'path';
const RAIZ = process.cwd(), SHOTS = process.env.SHOTS;
const AP = [
  { id:1, user_id:'g1', name:'GESTOR PIR', email:'gestor@conlogsa.com.br', phone:'21999990000', status:'approved', created_at:'2026-03-01T12:00:00Z' },
  { id:2, user_id:'a2', name:'ADMIN DOIS', email:'admin2@conlogsa.com.br', phone:'', status:'approved', created_at:'2026-02-01T12:00:00Z' },
  { id:3, user_id:'p3', name:'NOVO PENDENTE', email:'pend@conlogsa.com.br', phone:'', status:'pending', created_at:'2026-10-10T12:00:00Z' },
  { id:4, user_id:'r1', name:'RENAN FORTES', email:'fortesindicadores@gmail.com', phone:'', status:'approved', created_at:'2026-01-01T12:00:00Z' },
];
const PROF = [ { user_id:'g1', unidade:'PIR', is_admin:false, farol_unidades:'PIR' }, { user_id:'a2', unidade:null, is_admin:true, farol_unidades:null },
  { user_id:'r1', unidade:null, is_admin:true, farol_unidades:'TODAS' } ];
const MU = [
  { id:'a1', email:'andre.pompeu@conlogsa.com.br', nome:'ANDRÉ POMPEU', telefone:'21999990000', criado:'2026-10-15T12:00:00Z', confirmado:null, ultimo:null, status:null, unidade:null, admin:false, master:false, troca_senha:false, sessoes:0 },
  { id:'g1', email:'gestor@conlogsa.com.br', nome:'GESTOR PIR', telefone:'21999990000', criado:'2026-03-01T12:00:00Z', confirmado:'2026-03-01T12:00:00Z', ultimo:'2026-10-10T12:00:00Z', status:'approved', unidade:'PIR', admin:false, master:false, troca_senha:true, sessoes:1 },
  { id:'a2', email:'admin2@conlogsa.com.br', nome:'ADMIN DOIS', criado:'2026-02-01T12:00:00Z', confirmado:'2026-02-01T12:00:00Z', ultimo:null, status:'approved', admin:true, master:false, sessoes:0 },
  { id:'p3', email:'pend@conlogsa.com.br', nome:'NOVO PENDENTE', criado:'2026-10-10T12:00:00Z', confirmado:'2026-10-10T12:00:00Z', ultimo:null, status:'pending', admin:false, master:false, sessoes:0 },
  { id:'r1', email:'fortesindicadores@gmail.com', nome:'RENAN FORTES', criado:'2026-01-01T12:00:00Z', confirmado:'2026-01-01T12:00:00Z', ultimo:'2026-10-16T12:00:00Z', status:'approved', admin:true, master:true, sessoes:2 },
];
const mock = master => `window.__ops=[];window.supabase={createClient(){
 const D=${JSON.stringify({user_approvals:AP,fca_profiles:PROF})}, M=${master};
 const q=t=>{const o={_d:(D[t]||[]).slice(),_op:null,select(){return o},order(){return o},in(){return o},limit(){return o},
  eq(k,v){o._f=[k,v];if(!o._op)o._d=o._d.filter(r=>r[k]===v);return o},
  update(x){o._op=['update',t,x];return o},upsert(x){o._op=['upsert',t,x];return o},single(){return o},maybeSingle(){return o},
  then(r,j){let res={data:o._d,error:null};if(o._op){const op=[...o._op,o._f];window.__ops.push(op);
    const alvo=(o._f&&o._f[1])||(o._op[2]&&o._op[2].user_id);
    if(!M&&(alvo==='a2'||alvo==='r1'))res={data:null,error:{message:'Só o Master pode alterar, bloquear ou remover um Admin.'}};}
    return Promise.resolve(res).then(r,j)}};return o};
 const R={master_eu:()=>M,master_usuarios:()=>M?${JSON.stringify(MU)}:{__err:'Só o administrador Master pode fazer isso.'},
  master_senha:a=>a.p_senha||'Gx7kPq2mZr',master_criar:a=>({id:'n1',senha:a.p_senha||'Nv4bTt9wQe'}),master_encerrar:()=>2,
  master_altera:a=>a.p_dados.email==='gestor@conlogsa.com.br'?{__err:'Já existe um cadastro com o e-mail gestor@conlogsa.com.br.'}:null};
 return {from:q,rpc:async(n,a)=>{window.__ops.push(['rpc',n,a]);const f=R[n];const v=f?f(a||{}):null;
   if(v&&v.__err) return {data:null,error:{message:v.__err}}; return {data:v,error:null}},
  channel(){return{on(){return this},subscribe(){return this}}},removeChannel(){},
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},getUser:async()=>({data:{user:null}})},
  functions:{invoke:async()=>({})}}}};`;
const b = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
let ok = 0, falha = 0;
const ck = (c, m) => { if (c) { ok++; console.log('ok  ', m); } else { falha++; console.log('FALHA', m); } };
async function abre(master, W = 1366, H = 768, tema = 'escuro') {
  const pg = await b.newPage({ viewport: { width: W, height: H } });
  pg.on('pageerror', e => console.log('pageerror', e.message));
  pg.on('dialog', d => d.accept());
  await pg.route('**/*', r => { const u = r.request().url();
    if (u.includes('supabase-js')) return r.fulfill({ body: mock(master), contentType: 'text/javascript' });
    if (u.startsWith('file:')) return r.continue();
    return r.fulfill({ status: 404, body: '' }); });
  await pg.addInitScript(t => { localStorage.setItem('bi_theme', t === 'claro' ? 'light' : 'dark'); localStorage.setItem('gem_acessos_modo', 'lista'); }, tema);
  await pg.goto('file://' + path.join(RAIZ, 'index.html'));
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { currentUser = { id: 'r1', email: 'fortesindicadores@gmail.com', user_metadata: { name: 'Renan' } }; showAdmin(); switchAdminTab('approved'); });
  await pg.waitForTimeout(300);
  return pg;
}
const ops = pg => pg.evaluate(() => window.__ops);
const ultimo = async (pg, n) => (await ops(pg)).filter(o => o[0] === 'rpc' && o[1] === n).pop()?.[2];
const linha = (pg, nome) => pg.locator('#admin-users-list tbody tr', { hasText: nome });

for (const [W, H, tema] of [[1366, 768, 'escuro'], [1920, 1080, 'claro']]) {
  const pg = await abre(true, W, H, tema);
  const t = await pg.evaluate(() => { const T = document.querySelector('#admin-users-list table.acc-tbl'), m = document.querySelector('.adm-main');
    return { ths: [...T.tHead.rows[0].cells].map(c => c.textContent), n: T.tBodies[0].rows.length, pick: T.querySelectorAll('.farol-btn,.fcnt,select').length,
      av: T.querySelectorAll('.user-avatar').length, sub: document.querySelector('.acc-sub').textContent, sx: m.scrollWidth > m.clientWidth + 1,
      novo: !!document.querySelector('.acc-head .ubtn.pri'), masterTab: !!document.getElementById('atab-master') }; });
  ck(JSON.stringify(t.ths) === JSON.stringify(['Nome','E-mail','Telefone','Acesso FCA','Recebe Farol','Cadastro','Último acesso','']), `${W}: colunas ${t.ths.join('|')}`);
  ck(t.n === 3 && t.pick === 0 && t.av === 0, `${W}: 3 ativos, sem seletores coloridos nem inicial na linha`);
  ck(t.sub.startsWith('3 ativos · 2 aguardando aprovação · 0 bloqueados'), `${W}: resumo ${t.sub}`);
  ck(t.novo && !t.masterTab, `${W}: "+ Novo usuário" no card e sem aba Master separada`);
  ck(!t.sx, `${W}: sem rolagem horizontal`);
  const gl = await linha(pg, 'GESTOR PIR').innerText();
  ck(/PIR/.test(gl) && /senha provisória/i.test(gl), `${W}: linha do gestor em texto (PIR) com chip`);
  ck(/master/i.test(await linha(pg, 'RENAN').innerText()) && /você/i.test(await linha(pg, 'RENAN').innerText()), `${W}: chips "você" e "master"`);
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/acc-lista-${W}-${tema}.png` });
  // ordenação
  await pg.click('#admin-users-list thead th:nth-child(1)');
  const nomes = await pg.evaluate(() => [...document.querySelectorAll('#admin-users-list tbody td.conta span:first-child')].map(e => e.textContent));
  ck(JSON.stringify(nomes) === JSON.stringify(['ADMIN DOIS', 'GESTOR PIR', 'RENAN FORTES']), `${W}: Nome ordena (${nomes.join(', ')})`);
  // pendentes: o Master vê quem travou fora da aprovação
  await pg.click('#atab-pending');
  const pend = await pg.evaluate(() => [...document.querySelectorAll('#admin-users-list tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')));
  ck(pend.length === 2 && pend.some(x => /ANDRÉ POMPEU.*sem aprovação/i.test(x)), `${W}: Pendentes com o André (sem aprovação)`);
  await linha(pg, 'ANDRÉ POMPEU').locator('button', { hasText: 'Aprovar' }).click(); await pg.waitForTimeout(100);
  ck((await ultimo(pg, 'master_liberar'))?.p_user === 'a1', `${W}: Aprovar o travado chama master_liberar`);
  await linha(pg, 'NOVO PENDENTE').locator('button', { hasText: 'Aprovar' }).click(); await pg.waitForTimeout(100);
  ck((await ops(pg)).some(o => o[0] === 'update' && o[1] === 'user_approvals' && o[2].status === 'approved' && o[3][1] === 'p3'), `${W}: Aprovar pendente grava approved`);
  await pg.click('#atab-approved');
  // clicar na linha abre a caixa
  await linha(pg, 'GESTOR PIR').locator('td').nth(2).click();
  const cx = await pg.evaluate(() => { const c = document.querySelector('#mdl-usr .mdl-cx').getBoundingClientRect();
    return { v: document.getElementById('mdl-usr').style.display, nome: document.getElementById('uc-nome').value, email: document.getElementById('uc-email').readOnly,
      pf: document.querySelector('#uc-pf button.on').textContent, fca: [...document.querySelectorAll('#uc-fca .uc-it.on')].map(b => b.textContent),
      far: [...document.querySelectorAll('#uc-far .uc-it.on')].map(b => b.textContent), cabe: c.bottom <= innerHeight + 1 && c.top >= -1,
      pass: getComputedStyle(document.getElementById('uc-pass-fld')).display, ops: getComputedStyle(document.getElementById('uc-ops')).display }; });
  ck(cx.v === 'flex' && cx.nome === 'GESTOR PIR' && !cx.email, `${W}: clicar na linha abre a caixa (e-mail editável pelo Master)`);
  ck(cx.pf === 'Gestor de Frota' && cx.fca.join() === 'PIR' && cx.far.join() === 'PIR', `${W}: perfil e unidades marcadas`);
  ck(cx.pass !== 'none' && cx.ops !== 'none', `${W}: senha, liberar e sessões para o Master`);
  ck(cx.cabe, `${W}: caixa cabe na tela`);
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/acc-caixa-${W}-${tema}.png` });
  // altera tudo e salva
  await pg.fill('#uc-tel', '21988887777');
  await pg.click('#uc-fca .uc-it:has-text("GRL")');
  await pg.click('#uc-far-todas');
  await pg.click('#uc-salvar'); await pg.waitForTimeout(150);
  const alt = await ultimo(pg, 'master_altera');
  ck(alt && alt.p_user === 'g1' && alt.p_dados.telefone === '21988887777' && /PIR/.test(alt.p_dados.unidade) && /GRL/.test(alt.p_dados.unidade) && !('nome' in alt.p_dados), `${W}: Salvar manda só o que mudou (${JSON.stringify(alt && alt.p_dados)})`);
  ck((await ops(pg)).some(o => o[0] === 'upsert' && o[1] === 'fca_profiles' && o[2].farol_unidades === 'TODAS'), `${W}: Farol "Todas" gravado`);
  ck(await pg.evaluate(() => document.getElementById('uc-msg').textContent) === 'Salvo ✓', `${W}: "Salvo ✓"`);
  // perfil Time Frota: mesmo acesso do gestor, grava time_frota
  ck(await pg.evaluate(() => [...document.querySelectorAll('#uc-pf button')].map(b => b.textContent).join('|')) === 'Gestor de Frota|Time Frota|Admin|Master', `${W}: perfis Gestor de Frota · Time Frota · Admin · Master`);
  await pg.click('#uc-pf button:has-text("Time Frota")');
  ck(await pg.evaluate(() => document.querySelectorAll('#uc-fca .uc-it:not(:disabled)').length > 0), `${W}: Time Frota escolhe as unidades como o gestor`);
  await pg.click('#uc-salvar'); await pg.waitForTimeout(150);
  ck((await ops(pg)).some(o => o[0] === 'upsert' && o[1] === 'fca_profiles' && o[2].time_frota === true && o[2].user_id === 'g1'), `${W}: Time Frota gravado (time_frota = true)`);
  // nome digitado em minúsculo vira maiúsculo
  await pg.fill('#uc-nome', ''); await pg.type('#uc-nome', 'gestor pir');
  ck(await pg.evaluate(() => document.getElementById('uc-nome').value) === 'GESTOR PIR', `${W}: nome digitado sai em maiúsculo`);
  // perfil Admin / Master
  await pg.click('#uc-pf button:has-text("Master")');
  ck(await pg.evaluate(() => document.querySelectorAll('#uc-fca .uc-it:disabled').length > 0), `${W}: com Admin/Master as unidades do FCA ficam todas`);
  await pg.click('#uc-salvar'); await pg.waitForTimeout(150);
  ck((await ultimo(pg, 'master_altera'))?.p_dados.admin === true && (await ultimo(pg, 'master_define'))?.p_master === true, `${W}: Master marcado vira admin + master_define`);
  // senha
  await pg.click('#uc-pass-bt'); await pg.waitForTimeout(150);
  ck((await ultimo(pg, 'master_senha'))?.p_senha === null && await pg.evaluate(() => document.getElementById('uc-senha-v').textContent) === 'Gx7kPq2mZr', `${W}: Trocar senha em branco gera uma e mostra`);
  await pg.fill('#uc-pass', '123'); await pg.click('#uc-pass-bt');
  ck(/6 caracteres/.test(await pg.evaluate(() => document.getElementById('uc-msg').textContent)), `${W}: senha curta recusada`);
  await pg.fill('#uc-pass', 'Conlog2026'); await pg.click('#uc-pass-bt'); await pg.waitForTimeout(150);
  ck((await ultimo(pg, 'master_senha'))?.p_senha === 'Conlog2026', `${W}: senha digitada vai para master_senha`);
  await pg.click('#uc-ops button:has-text("Encerrar")'); await pg.waitForTimeout(150);
  ck((await ultimo(pg, 'master_encerrar'))?.p_user === 'g1', `${W}: Encerrar sessões`);
  // e-mail repetido: erro do banco na caixa
  await pg.fill('#uc-email', 'gestor@conlogsa.com.br'); await pg.evaluate(() => { UC.o.email = 'outro@x'; });
  await pg.click('#uc-salvar'); await pg.waitForTimeout(150);
  ck(/Já existe/.test(await pg.evaluate(() => document.getElementById('uc-msg').textContent)), `${W}: erro do banco aparece na caixa`);
  await pg.evaluate(() => fechaUsuario());
  // novo usuário
  await pg.click('.acc-head .ubtn.pri');
  ck(await pg.evaluate(() => document.getElementById('uc-tit').textContent) === 'Novo usuário', `${W}: Novo usuário abre a caixa vazia`);
  await pg.fill('#uc-nome', 'João Silva'); await pg.fill('#uc-email', 'joao@conlogsa.com.br');
  await pg.click('#uc-fca .uc-it:has-text("CGR")');
  await pg.click('#uc-salvar'); await pg.waitForTimeout(200);
  const cr = await ultimo(pg, 'master_criar');
  ck(cr && cr.p_nome === 'JOÃO SILVA' && cr.p_unidade === 'CGR' && cr.p_senha === null, `${W}: master_criar com unidade (${cr && cr.p_unidade})`);
  ck(await pg.evaluate(() => document.getElementById('uc-senha-v').textContent) === 'Nv4bTt9wQe', `${W}: senha do novo aparece`);
  await pg.evaluate(() => fechaUsuario());
  await pg.close();
}

// Admin comum (não Master): vê, altera gestor, não mexe em Admin
{ const pg = await abre(false);
  const t = await pg.evaluate(() => ({ ths: [...document.querySelectorAll('#admin-users-list thead th')].map(c => c.textContent), novo: !!document.querySelector('.acc-head .ubtn.pri') }));
  ck(!t.ths.includes('Último acesso') && !t.novo, 'admin: sem Último acesso e sem Novo usuário');
  ck(await linha(pg, 'ADMIN DOIS').locator('button').count() === 0, 'admin: linha de outro Admin sem botões');
  await linha(pg, 'GESTOR PIR').locator('td').nth(1).click();
  const cx = await pg.evaluate(() => ({ email: document.getElementById('uc-email').readOnly, pf: [...document.querySelectorAll('#uc-pf button')].map(b => b.disabled).join() === 'false,false,true,true',
    pass: getComputedStyle(document.getElementById('uc-pass-fld')).display, salvar: getComputedStyle(document.getElementById('uc-salvar')).display }));
  ck(cx.email && cx.pf && cx.pass === 'none' && cx.salvar !== 'none', 'admin: caixa do gestor editável, sem e-mail/senha, perfil só Gestor ↔ Time Frota');
  await pg.click('#uc-fca .uc-it:has-text("GRL")'); await pg.click('#uc-salvar'); await pg.waitForTimeout(150);
  ck((await ops(pg)).some(o => o[0] === 'upsert' && o[1] === 'fca_profiles' && o[2].unidade === 'PIR,GRL' && o[2].is_admin === false), 'admin: unidades gravadas no fca_profiles');
  await pg.click('#uc-pf button:has-text("Time Frota")'); await pg.click('#uc-salvar'); await pg.waitForTimeout(150);
  ck((await ops(pg)).some(o => o[0] === 'upsert' && o[1] === 'fca_profiles' && o[2].time_frota === true), 'admin: passa o gestor para Time Frota');
  await pg.evaluate(() => fechaUsuario());
  await linha(pg, 'ADMIN DOIS').locator('td').nth(1).click();
  const ad = await pg.evaluate(() => ({ salvar: getComputedStyle(document.getElementById('uc-salvar')).display, nota: document.getElementById('uc-nota').textContent }));
  ck(ad.salvar === 'none' && /Só o Master/.test(ad.nota), 'admin: Admin abre só leitura');
  await pg.close(); }

// celular
{ const pg = await abre(true, 390, 800);
  await pg.evaluate(() => { localStorage.setItem('gem_acessos_modo', 'lista'); renderAdminUsers(); });
  const r = await pg.evaluate(() => { const m = document.querySelector('.adm-main'); return { sx: m.scrollWidth > m.clientWidth + 1, cards: document.querySelectorAll('.user-card').length }; });
  ck(!r.sx && r.cards === 3, `celular: cards, sem rolagem lateral (${r.cards})`);
  await pg.close(); }

await b.close();
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);
