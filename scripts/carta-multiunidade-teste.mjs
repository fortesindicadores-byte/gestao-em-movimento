import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
// Carta de Custos com perfil de DUAS unidades (Erick, Macacu, 13/10/2026):
// a caixa mostra o seletor Unidade com as duas, os projetos seguem a unidade
// escolhida e o insert sai com a unidade da caixa, não com a do filtro.
// CHART_JS = chart.umd.js 4.4.0 · DATALABELS = chartjs-plugin-datalabels 2.2.0 · SHOT_DIR salva prints.
const CHART_JS=process.env.CHART_JS, DL=process.env.DATALABELS, SHOT=process.env.SHOT_DIR, ROOT=process.cwd();
if(!CHART_JS||!DL){ console.error('defina CHART_JS e DATALABELS'); process.exit(2); }
const srv=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  if(!fs.existsSync(f)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html'});r.end(fs.readFileSync(f));}).listen(0);
const port=srv.address().port;
const L=(id,o)=>Object.assign({id,origem:null,unidade:'MCC T1',vigencia:'2026-10',pacote:'Manutenção',data:'2026-10-02',projeto:'ROTA',equipamento:'X',fornecedor:'F',conta:'Manutenção de Veículos e Equip.',grupo:'Motor',descricao:'d',valor:100,rc:'1',oc:'2',nf:'3',aprovado:true,aprovado_oc:true},o);
const ROWS=[
  L('m1',{valor:1000}),
  L('m2',{conta:'Lavação de Veículos',grupo:'Lavação',valor:200}),
  L('p1',{pacote:'Pneus',conta:'Pneus Novos',grupo:'Pneus Novos',valor:3000}),
  L('p2',{pacote:'Pneus',conta:'Recapagens e Outros Serviços',grupo:'Recapagens',valor:400}),
  L('p3',{pacote:null,conta:'Recapagens e Outros Serviços',grupo:'Rodízio',valor:50}),   // linha sem pacote: a conta decide
];
const init=`(()=>{const R=${JSON.stringify(ROWS)}; window.__ins=[];
 const q=(t)=>{const o={_t:t,select(){return o},in(){return o},eq(){return o},order(){return o},range(){return o},gte(){return o},lt(){return o},lte(){return o},neq(){return o},limit(){return o},
   insert(p){window.__ins.push(p);return {select(){return {single(){return Promise.resolve({data:Object.assign({id:'novo'+window.__ins.length},p),error:null})}}}}},
   maybeSingle(){return Promise.resolve({data:t==='fca_profiles'?(window.__perfil||{is_admin:true,unidade:''}):null,error:null})},single(){return o.maybeSingle()},
   then(res,rej){return Promise.resolve({data:t==='carta_custos'?R:[],error:null,count:0}).then(res,rej)}};return o;};
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u',email:'x@y.z',user_metadata:{nome:'Teste'}}}}}),onAuthStateChange(){}},from:q})};
 try{localStorage.setItem('bi_theme',window.__tema||'escuro')}catch(e){}
 window.alert=()=>{};
})();`;
let ok=0,fail=0;const t=(c,m)=>{c?ok++:fail++;console.log((c?'ok  ':'FALHA ')+m);};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
async function abre(w,h,tema,perfil){
  const pg=await b.newPage({viewport:{width:w,height:h}});
  pg.on('pageerror',e=>{console.log('pageerror',e.message);fail++;});
  await pg.route(/supabase-js/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.route(/chart\.umd/,r=>r.fulfill({path:CHART_JS}));
  await pg.route(/datalabels/,r=>r.fulfill({path:DL}));
  await pg.route(/fonts\.g|html2canvas|jspdf|xlsx/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.addInitScript(`window.__tema=${JSON.stringify(tema||'escuro')};window.__perfil=${JSON.stringify(perfil||null)};`+init);
  await pg.goto(`http://localhost:${port}/carta-custos/`);
  await pg.waitForTimeout(900);
  if(tema==='claro') await pg.evaluate(()=>document.body.classList.add('claro'));
  return pg;
}
const tabela=pg=>pg.evaluate(()=>[...document.querySelectorAll('#tbl-conta tbody tr')].map(tr=>[tr.cells[0].textContent,tr.cells[3].textContent]));

// 1 · perfil MCC T1,MCC T2 (não admin)
{
  const pg=await abre(1600,900,'escuro',{is_admin:false,unidade:'MCC T1,MCC T2'});
  let m=await pg.evaluate(()=>({allowed:ALLOWED.slice(),uni:curUnits()}));
  t(JSON.stringify(m.allowed)==='["MCC T1","MCC T2"]'&&m.uni.join()==='MCC T1','abre na 1ª unidade do perfil → '+JSON.stringify(m));
  await pg.evaluate(()=>abrirLanc(''));
  m=await pg.evaluate(()=>({ctx:$('m-ctx').style.display,unis:[...document.querySelectorAll('#f-unidade option')].map(o=>o.value),sel:$('f-unidade').value}));
  t(m.ctx!=='none'&&m.unis.join()==='MCC T1,MCC T2'&&m.sel==='MCC T1','caixa mostra o seletor Unidade com as duas → '+JSON.stringify(m));
  // dublê da Frota: MCC T1 só Empurrada, MCC T2 Rota/Auto Serviço
  await pg.evaluate(()=>{FROTA={header:['NÍVEL 3'],rows:[['EMPURRADA - MCC'],['ROTA - MCC'],['AUTO SERVIÇO - MCC']]};});
  await pg.evaluate(()=>{fecharLanc();abrirLanc('');});
  let p1=await pg.evaluate(()=>[...document.querySelectorAll('#f-projeto option')].map(o=>o.value));
  await pg.selectOption('#f-unidade','MCC T2');
  let p2=await pg.evaluate(()=>[...document.querySelectorAll('#f-projeto option')].map(o=>o.value));
  t(!p1.includes('ROTA')&&p2.includes('ROTA'),'projetos seguem a unidade: T1 '+p1+' · T2 '+p2);
  await pg.selectOption('#f-projeto','ROTA');
  await pg.fill('#f-rc','77'); await pg.fill('#f-valor','10,00');
  await pg.evaluate(()=>salvarLancModal()); await pg.waitForTimeout(200);
  const ins=await pg.evaluate(()=>window.__ins[0]);
  t(ins&&ins.unidade==='MCC T2'&&ins.projeto==='ROTA','insert com MCC T2 / ROTA → '+JSON.stringify(ins&&{u:ins.unidade,p:ins.projeto}));
  await pg.close();
}
// 2 · perfil de uma unidade só: caixa sem seletor (como antes)
{
  const pg=await abre(1600,900,'escuro',{is_admin:false,unidade:'MCC T1'});
  await pg.evaluate(()=>abrirLanc(''));
  t(await pg.evaluate(()=>$('m-ctx').style.display)==='none','uma unidade: caixa sem seletor Unidade');
  await pg.close();
}
// 3 · admin com uma unidade no filtro: caixa sem seletor (como antes)
{
  const pg=await abre(1600,900,'escuro',{is_admin:true,unidade:''});
  await pg.evaluate(()=>abrirLanc(''));
  t(await pg.evaluate(()=>$('m-ctx').style.display)==='none','admin com 1 unidade no filtro: caixa sem seletor');
  await pg.close();
}
await b.close(); srv.close();
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
