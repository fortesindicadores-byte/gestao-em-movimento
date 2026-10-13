import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
// Carta de Custos: SÓ UNIDADE E SÓ PROJETO (Renan, 13/10/2026, caso do Erick,
// Macacu, perfil MCC T1,MCC T2). O filtro Unidade mostra MACACU (sem tier), o
// Projeto mostra Empurrada e Rota, e o tier gravado sai do projeto.
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
 window.alert=m=>{(window.__al=window.__al||[]).push(m)};
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

const FROTA_D=()=>{FROTA={header:['NÍVEL 3'],rows:[['EMPURRADA - MCC'],['ROTA - MCC'],['AUTO SERVIÇO - MCC'],['ROTA - PIR'],['EMPURRADA - PIR'],['EMPURRADA - CBA'],['APOIO - CBA'],['ROTA - CBA']]};refreshProjetos();};
const opsMs=(pg,id)=>pg.evaluate(id=>[...document.querySelectorAll('#'+id+' .ms-opt:not(.all-opt)')].map(l=>l.textContent.replace('só','').trim()),id);
const opsSel=(pg,id)=>pg.evaluate(id=>[...document.querySelectorAll('#'+id+' option')].map(o=>o.value),id);
async function lanca(pg,proj){
  await pg.evaluate(()=>{window.__ins=[];abrirLanc('');});
  await pg.selectOption('#f-projeto',proj);
  await pg.fill('#f-rc','77'); await pg.fill('#f-valor','10,00');
  await pg.evaluate(()=>salvarLancModal()); await pg.waitForTimeout(400);
  return pg.evaluate(()=>window.__ins[0]?{u:window.__ins[0].unidade,p:window.__ins[0].projeto}:{al:window.__al,mbg:$('mbg').className,proj:$('f-projeto').value});
}
// 1 · perfil MCC T1,MCC T2 (o caso do Erick): filtro MACACU, projetos Empurrada e Rota
{
  const pg=await abre(1600,900,'escuro',{is_admin:false,unidade:'MCC T1,MCC T2'});
  await pg.evaluate(FROTA_D.toString().replace(/^\(\)=>/,''));
  await pg.waitForFunction(()=>!/Carregando/.test($('titSub').textContent),null,{timeout:10000}).catch(()=>{});
  let m=await pg.evaluate(()=>({uni:curUnits(),bases:typeof curBases==='function'?curBases():[],sub:$('titSub').textContent}));
  t(m.uni.join()==='MCC T1,MCC T2'&&m.bases.join()==='MCC','abre com a unidade inteira (os dois tiers) → '+JSON.stringify(m.uni));
  const u=await opsMs(pg,'ms-uni');
  t(u.join()==='MACACU','filtro Unidade só com MACACU, sem tier → '+JSON.stringify(u));
  const pr=await opsMs(pg,'ms-proj');
  t(pr.includes('EMPURRADA')&&pr.includes('ROTA'),'filtro Projeto com Empurrada e Rota → '+JSON.stringify(pr));
  t(/^MACACU ·/.test(m.sub),'subtítulo diz MACACU → '+m.sub);
  await pg.evaluate(()=>abrirLanc(''));
  const c=await pg.evaluate(()=>$('m-ctx').style.display);
  const pc=await opsSel(pg,'f-projeto');
  t(c==='none'&&pc.includes('ROTA')&&pc.includes('EMPURRADA'),'caixa sem seletor de unidade, projetos Empurrada e Rota → '+JSON.stringify(pc));
  await pg.evaluate(()=>fecharLanc());
  let ins=await lanca(pg,'ROTA');
  t(ins&&ins.u==='MCC T2'&&ins.p==='ROTA','ROTA grava MCC T2 → '+JSON.stringify(ins));
  ins=await lanca(pg,'EMPURRADA');
  t(ins&&ins.u==='MCC T1'&&ins.p==='EMPURRADA','EMPURRADA grava MCC T1 → '+JSON.stringify(ins));
  const th=await pg.evaluate(()=>[...document.querySelectorAll('#tbl-lanc thead th')].map(x=>x.textContent));
  t(!th.includes('Unidade'),'lançamentos sem coluna Unidade (uma unidade só) → '+JSON.stringify(th.slice(0,3)));
  await pg.close();
}
// 2 · perfil MCC T1 só: a caixa oferece só os projetos do tier liberado
{
  const pg=await abre(1600,900,'escuro',{is_admin:false,unidade:'MCC T1'});
  await pg.evaluate(FROTA_D.toString().replace(/^\(\)=>/,''));
  await pg.evaluate(()=>abrirLanc(''));
  const c=await pg.evaluate(()=>$('m-ctx').style.display), pc=await opsSel(pg,'f-projeto');
  t(c==='none'&&pc.join()==='EMPURRADA','MCC T1 só: caixa sem seletor e só Empurrada → '+JSON.stringify(pc));
  await pg.close();
}
// 3 · perfil de duas unidades diferentes: seletor com os nomes, projetos seguem a unidade
{
  const pg=await abre(1600,900,'escuro',{is_admin:false,unidade:'PIR,MCC T2'});
  await pg.evaluate(FROTA_D.toString().replace(/^\(\)=>/,''));
  const u=await opsMs(pg,'ms-uni');
  t(u.join()==='PIRAI,MACACU','filtro Unidade PIRAI e MACACU → '+JSON.stringify(u));
  await pg.evaluate(()=>abrirLanc(''));
  const m=await pg.evaluate(()=>({ctx:$('m-ctx').style.display,ops:[...document.querySelectorAll('#f-unidade option')].map(o=>o.value+':'+o.textContent)}));
  t(m.ctx!=='none'&&m.ops.join()==='PIR:PIRAI,MCC:MACACU','caixa com o seletor Unidade pelo nome → '+JSON.stringify(m.ops));
  await pg.selectOption('#f-unidade','MCC');
  const pc=await opsSel(pg,'f-projeto');
  t(pc.includes('ROTA')&&!pc.includes('EMPURRADA'),'MACACU com só T2 liberado: sem Empurrada → '+JSON.stringify(pc));
  await pg.selectOption('#f-projeto','ROTA');
  await pg.fill('#f-rc','77'); await pg.fill('#f-valor','10,00');
  await pg.evaluate(()=>salvarLancModal()); await pg.waitForTimeout(400);
  const ins=await pg.evaluate(()=>window.__ins[0]);
  t(ins&&ins.unidade==='MCC T2','grava MCC T2 → '+(ins&&ins.unidade));
  await pg.close();
}
// 4 · admin: CUIABA e MACACU uma vez cada; MACACU marcado = caixa sem seletor
{
  const pg=await abre(1600,900,'escuro',{is_admin:true,unidade:''});
  const u=await opsMs(pg,'ms-uni');
  t(u.filter(x=>x==='CUIABA').length===1&&u.filter(x=>x==='MACACU').length===1&&!u.some(x=>/ T\d/.test(x)),'admin: unidades sem tier → '+JSON.stringify(u));
  await pg.evaluate(()=>abrirLanc(''));
  t(await pg.evaluate(()=>$('m-ctx').style.display)==='none','admin com 1 unidade no filtro: caixa sem seletor');
  await pg.evaluate(FROTA_D.toString().replace(/^\(\)=>/,''));
  await pg.evaluate(()=>{fecharLanc();selUni.clear();selUni.add('CBA');abrirLanc('');});
  const pc=await opsSel(pg,'f-projeto');
  t(pc.includes('APOIO')&&pc.includes('ROTA')&&pc.includes('EMPURRADA'),'CUIABA: Apoio, Empurrada e Rota → '+JSON.stringify(pc));
  await pg.evaluate(()=>fecharLanc());
  const ins=await lanca(pg,'APOIO');
  t(ins&&ins.u==='CBA T1 WH','APOIO em CUIABA grava CBA T1 WH → '+JSON.stringify(ins));
  await pg.close();
}
await b.close(); srv.close();
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
