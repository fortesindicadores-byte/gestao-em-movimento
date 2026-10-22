// Gerenciar Acessos: o navegador preencher a busca com o e-mail do login NÃO filtra a lista
// (Renan, 22/10/2026: "Cadê todos os usuários?"). node scripts/acessos-busca-autofill-teste.mjs
import { chromium } from 'playwright';
import path from 'path';
const RAIZ = process.cwd();
const nomes = ['ANA PAULA','BRUNO LIMA','CARLA MENDES','DIEGO FARIAS','ELAINE COSTA'];
const appr = nomes.map((n,i)=>({id:i+1,user_id:'u'+i,name:n,email:n.split(' ')[0].toLowerCase()+'@conlogsa.com.br',phone:'',status:'approved',created_at:new Date(2026,8,i+1).toISOString()}));
const MOCK = `window.supabase={createClient(){const D=${JSON.stringify({user_approvals:appr,fca_profiles:[]})};
 const q=t=>{const o={_d:(D[t]||[]).slice(),select(){return o},order(){return o},eq(k,v){o._d=o._d.filter(r=>r[k]===v);return o},in(){return o},limit(){return o},
  update(){return o},upsert(){return o},single(){return o},maybeSingle(){return o},then(r,j){return Promise.resolve({data:o._d,error:null}).then(r,j)}};return o};
 return {from:q,rpc:async()=>({data:null,error:null}),channel(){return{on(){return this},subscribe(){return this}}},removeChannel(){},
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},getUser:async()=>({data:{user:null}})},
  functions:{invoke:async()=>({})}}}};`;
const b = await chromium.launch({executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium'}); let ok=0, falha=0;
const ck=(c,m)=>{ if(c){ok++;console.log('ok  ',m)} else {falha++;console.log('FALHA',m)} };
const pg = await b.newPage({viewport:{width:1600,height:900}});
pg.on('pageerror',e=>console.log('pageerror',e.message));
await pg.route('**/*',r=>{const u=r.request().url();
  if(u.includes('supabase-js')) return r.fulfill({body:MOCK,contentType:'text/javascript'});
  if(u.startsWith('file:')) return r.continue();
  return r.fulfill({status:404,body:''});});
await pg.addInitScript(()=>localStorage.setItem('gem_acessos_modo','lista'));
await pg.goto('file://'+path.join(RAIZ,'index.html'));
await pg.waitForTimeout(400);
const linhas = ()=>pg.evaluate(()=>document.querySelectorAll('#admin-users-list tbody tr').length);
// 1 · a busca chega preenchida (sobra de antes) e abre vazia
await pg.evaluate(()=>{document.getElementById('admin-search').value='ana@conlogsa.com.br';onAdminSearch('ana@conlogsa.com.br');
  currentUser={email:'ana@conlogsa.com.br',user_metadata:{name:'Ana'}};showAdmin();switchAdminTab('approved');});
await pg.waitForTimeout(300);
ck(await pg.inputValue('#admin-search')==='' && await linhas()===5, `abre com a busca vazia e as 5 linhas (${await linhas()})`);
// 2 · o navegador preenche depois de abrir (valor + evento input, sem tecla)
await pg.evaluate(()=>{const el=document.getElementById('admin-search');el.value='ana@conlogsa.com.br';el.dispatchEvent(new Event('input',{bubbles:true}));});
await pg.waitForTimeout(100);
ck(await pg.inputValue('#admin-search')==='' && await linhas()===5, `preenchimento automático apagado, lista inteira (${await linhas()})`);
// 3 · preenchimento sem evento nenhum, pego pela varredura de 1,2 s
await pg.evaluate(()=>{document.getElementById('admin-search').value='ana@conlogsa.com.br';});
await pg.waitForTimeout(1400);
ck(await pg.inputValue('#admin-search')==='', 'valor posto sem evento também sai');
// 4 · quem digita filtra normalmente
await pg.click('#admin-search'); await pg.keyboard.type('bruno');
await pg.waitForTimeout(200);
ck(await linhas()===1 && await pg.inputValue('#admin-search')==='bruno', `digitar filtra (${await linhas()} linha)`);
await pg.waitForTimeout(3200);
ck(await pg.inputValue('#admin-search')==='bruno', 'o que foi digitado não é apagado depois');
await b.close();
console.log(`\n${ok} ok · ${falha} falha(s)`); process.exit(falha?1:0);
