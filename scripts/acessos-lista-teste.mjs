// Gerenciar Acessos em lista (hub): roda o index.html com o Supabase dublado. node scripts/acessos-lista-teste.mjs (SHOTS=<pasta> salva prints)
import { chromium } from 'playwright';
import fs from 'fs'; import path from 'path';
const RAIZ = process.cwd(), SHOTS = process.env.SHOTS;
const FONTE = process.env.FONT_DIR;
const nomes = ['ANA PAULA SOUZA','BRUNO LIMA','CARLA MENDES DE OLIVEIRA','DIEGO FARIAS','ELAINE COSTA','FÁBIO RAMOS','GUSTAVO NUNES','HELENA PIRES','IGOR TAVARES','JULIANA ROCHA','KLEBER ALVES','LUANA MOTA'];
const appr = nomes.map((n,i)=>({id:i+1,user_id:'u'+i,name:n,email:n.split(' ')[0].toLowerCase()+'@conlogsa.com.br',phone:'21999'+String(100000+i),
  status: i<9?'approved':(i<11?'pending':'blocked'), created_at:new Date(2026,8,i+1,10,30).toISOString()}));
const prof = appr.slice(0,9).map((u,i)=>({user_id:u.user_id,unidade:i%3===0?'CBA T1,MCC T1':(i%3===1?'PIR':null),is_admin:i===2,farol_unidades:i===4?'TODAS':(i===5?'PIR,GRL':null)}));
const MOCK = `window.supabase={createClient(){const D=${JSON.stringify({user_approvals:appr,fca_profiles:prof})};
 const q=t=>{const o={_d:(D[t]||[]).slice(),select(){return o},order(){return o},eq(k,v){o._d=o._d.filter(r=>r[k]===v);return o},in(){return o},limit(){return o},
  update(){return o},upsert(){return o},single(){return o},maybeSingle(){return o},then(r,j){return Promise.resolve({data:o._d,error:null}).then(r,j)}};return o};
 return {from:q,rpc:async()=>({data:null,error:null}),channel(){return{on(){return this},subscribe(){return this}}},removeChannel(){},
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},getUser:async()=>({data:{user:null}})},
  functions:{invoke:async()=>({})}}}};`;
const b = await chromium.launch({executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium'}); let ok=0, falha=0;
const ck=(c,m)=>{ if(c){ok++;console.log('ok  ',m)} else {falha++;console.log('FALHA',m)} };
for (const [W,H,tema] of [[1366,768,'escuro'],[1600,900,'claro'],[1920,1080,'escuro']]) {
  const pg = await b.newPage({viewport:{width:W,height:H}});
  pg.on('pageerror',e=>console.log('pageerror',e.message));
  await pg.route('**/*',r=>{const u=r.request().url();
    if(u.includes('supabase-js')) return r.fulfill({body:MOCK,contentType:'text/javascript'});
    if(u.includes('fonts.googleapis')) return r.fulfill({body:'',contentType:'text/css'});
    if(u.startsWith('file:')) return r.continue();
    return r.fulfill({status:404,body:''});});
  await pg.addInitScript(t=>{localStorage.setItem('bi_theme',t==='claro'?'light':'dark');localStorage.setItem('gem_acessos_modo','lista');},tema);
  await pg.goto('file://'+path.join(RAIZ,'index.html'));
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{currentUser={email:'renan@x',user_metadata:{name:'Renan'}};showAdmin();switchAdminTab('approved');});
  await pg.waitForTimeout(400);
  const r = await pg.evaluate(()=>{const L=document.getElementById('admin-users-list');const t=L.querySelector('table.acc-tbl');
    const m=document.querySelector('.adm-main');
    return {tbl:!!t,linhas:t?t.tBodies[0].rows.length:0,ths:t?[...t.tHead.rows[0].cells].map(c=>c.textContent):[],
      scrollX:m.scrollWidth>m.clientWidth+1, pagina:document.documentElement.scrollHeight>innerHeight+1,
      btn:document.getElementById('btAccModo').title, fca:t?t.querySelectorAll('.user-fca').length:0, farol:t?t.querySelectorAll('.user-farol').length:0}});
  ck(r.tbl && r.linhas===9, `${W}×${H} ${tema}: lista com 9 ativos (${r.linhas})`);
  ck(JSON.stringify(r.ths)===JSON.stringify(['Usuário','Telefone','Cadastro','Acesso FCA','Recebe Farol','']), `${W}: cabeçalhos ${r.ths.join('|')}`);
  ck(r.fca===9 && r.farol===9, `${W}: seletores FCA/Farol em cada linha`);
  ck(!r.scrollX, `${W}: sem rolagem horizontal`); ck(!r.pagina, `${W}: página não rola`);
  ck(r.btn==='Ver em cards', `${W}: botão diz ${r.btn}`);
  // abre o seletor FCA da 1ª linha
  await pg.click('#admin-users-list tbody tr:first-child .user-fca .farol-btn');
  const ab = await pg.evaluate(()=>{const p=document.querySelector('#admin-users-list tbody tr:first-child .farol-panel');const r=p.getBoundingClientRect();
    const tr=p.closest('tr'); const el=document.elementFromPoint(r.left+20,r.top+30);
    return {open:p.classList.contains('open'),tr:tr.classList.contains('farol-open'),topo:p.contains(el)}});
  ck(ab.open && ab.tr && ab.topo, `${W}: menu FCA abre por cima das outras linhas`);
  if (SHOTS) await pg.screenshot({path:`${SHOTS}/acc-lista-${W}-${tema}.png`});
  await pg.mouse.click(5,H-5);
  // pendentes: sem colunas de acesso
  await pg.evaluate(()=>switchAdminTab('pending'));
  const pe = await pg.evaluate(()=>[...document.querySelectorAll('#admin-users-list thead th')].map(c=>c.textContent));
  ck(pe.length===4 && !pe.includes('Acesso FCA'), `${W}: pendentes sem colunas de acesso (${pe.join('|')})`);
  const btns = await pg.evaluate(()=>[...document.querySelectorAll('#admin-users-list tbody tr:first-child button')].map(b=>b.textContent.trim()));
  ck(btns.includes('Aprovar')&&btns.includes('Rejeitar'), `${W}: pendente com Aprovar/Rejeitar`);
  // busca
  await pg.evaluate(()=>{switchAdminTab('approved');onAdminSearch('bruno');});
  const nb = await pg.evaluate(()=>document.querySelectorAll('#admin-users-list tbody tr').length);
  ck(nb===1, `${W}: busca filtra a lista (${nb})`);
  await pg.evaluate(()=>onAdminSearch(''));
  // volta para cards
  await pg.click('#btAccModo');
  const g = await pg.evaluate(()=>({cards:document.querySelectorAll('#admin-users-list .user-card').length,tbl:!!document.querySelector('.acc-tbl'),m:localStorage.getItem('gem_acessos_modo')}));
  ck(g.cards===9 && !g.tbl && g.m==='grade', `${W}: botão volta para cards e grava a escolha`);
  await pg.close();
}
// celular: sempre cards
const pm = await b.newPage({viewport:{width:390,height:800}});
await pm.route('**/*',r=>{const u=r.request().url(); if(u.includes('supabase-js')) return r.fulfill({body:MOCK,contentType:'text/javascript'}); if(u.startsWith('file:')) return r.continue(); return r.fulfill({status:404,body:''});});
await pm.addInitScript(()=>localStorage.setItem('gem_acessos_modo','lista'));
await pm.goto('file://'+path.join(RAIZ,'index.html')); await pm.waitForTimeout(300);
await pm.evaluate(()=>{currentUser={email:'r'};showAdmin();switchAdminTab('approved');}); await pm.waitForTimeout(300);
const mob = await pm.evaluate(()=>({cards:document.querySelectorAll('.user-card').length,btn:getComputedStyle(document.getElementById('btAccModo')).display}));
ck(mob.cards===9 && mob.btn==='none', `celular: cards e sem botão (${mob.cards}, ${mob.btn})`);
await b.close(); console.log(`\n${ok} ok · ${falha} falha(s)`); process.exit(falha?1:0);
