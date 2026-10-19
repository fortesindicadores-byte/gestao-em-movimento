// ============================================================
// DISPONIBILIDADE (app da unidade) · filtro Unidade só com a SIGLA e o tier
// pelo PROJETO do veículo (Renan, 19/10/2026: "Não havíamos combinado de não
// ser MCC T1? Só MCC e o projeto que separa? Filtrei T1 e aparece até Van").
//
// Perfil com MCC T1, MCC T2 e CGR; uma VAN do CDI Macacu foi gravada como
// MCC T1 (a unidade saía do filtro da tela). Confere:
//   · o filtro lista CGR e MCC, sem T1/T2;
//   · a van conta no MCC T2 (tier do ativo), não no T1;
//   · Projeto = T1 (Empurrada) mostra só a empurrada;
//   · evento novo e evento editado gravam o código com tier do veículo.
// Uso: node scripts/disp-unidade-sigla-teste.mjs
// ============================================================
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=new URL('..', import.meta.url).pathname;
const srv=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  if(!fs.existsSync(f)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});r.end(fs.readFileSync(f));}).listen(0);
const port=srv.address().port;

const hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const A=(fil,proj,placa,tipo)=>({'Filial':fil,'Projeto':proj,'Placa':placa,'Tipo Veículo':tipo,'Modelo':'X'});
const ATIVOS=[
  A('MACACU EMPURRADA','EMPURRADA','EMP1A11','CAVALO'),
  A('CDI MACACU','ROTA','ROT2B22','TOCO'),
  A('CDI MACACU','VAN','VAN3C33','VAN'),
  A('CDI MACACU','VAN','VAN4D44','VAN'),
  A('CDD RIO DE JANEIRO','ROTA','CGR5E55','TOCO'),
];
const E=(id,placa,uni)=>({id,placa,unidade:uni,projeto:null,data_parada:hoje,data_retorno:null,status:'Em execução',grupo:'CORRETIVA'});
const EVENTOS=[E('e1','EMP1A11','MCC T1'),E('e2','VAN3C33','MCC T1'),E('e3','ROT2B22','MCC T2'),E('e4','CGR5E55','CGR')];

const init=`(()=>{const DB=${JSON.stringify({ginfo_snapshot:[{chave:'ativos',data:ATIVOS}],indisponibilidade:EVENTOS})};
 window.__W=[];
 const q=(t)=>{const f=[];let single=false,op=null,payload=null;
   const o=new Proxy({},{get(_,k){
     if(k==='then') return (res,rej)=>Promise.resolve(run()).then(res,rej);
     if(k==='eq') return (c,v)=>{f.push(r=>String(r[c])===String(v));return o;};
     if(k==='in') return (c,a)=>{f.push(r=>a.map(String).includes(String(r[c])));return o;};
     if(k==='is') return (c,v)=>{f.push(r=>r[c]==v);return o;};
     if(k==='insert'||k==='update') return p=>{op=k;payload=p;return o;};
     if(k==='maybeSingle'||k==='single') return ()=>{single=true;return o;};
     return ()=>o;}});
   function run(){
     if(t==='fca_profiles') return {data:{is_admin:false,unidade:'MCC T1,MCC T2,CGR',nome:'Teste'},error:null};
     if(op){ window.__W.push({t,op,payload});
       if(op==='insert'){const row=Object.assign({id:'n'+window.__W.length},Array.isArray(payload)?payload[0]:payload);(DB[t]=DB[t]||[]).push(row);return {data:row,error:null};}
       (DB[t]||[]).filter(r=>f.every(fn=>fn(r))).forEach(r=>Object.assign(r,payload)); return {data:null,error:null}; }
     let d=(DB[t]||[]).filter(r=>f.every(fn=>fn(r)));
     if(single) return {data:d[0]||null,error:null};
     return {data:d,error:null};}
   return o;};
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u',email:'x@y.z',user_metadata:{}}}}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}},from:q,rpc:()=>q('rpc')})};
 try{localStorage.setItem('bi_theme','dark');}catch(e){}
 window.alert=()=>{}; window.confirm=()=>true;
})();`;

let ok=0,fail=0;const t=(c,m)=>{c?ok++:fail++;console.log((c?'ok   ':'FALHA ')+m);};
const b=await chromium.launch({executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium'});
const ctx=await b.newContext({viewport:{width:1600,height:900},timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
const pg=await ctx.newPage(); const err=[];
pg.on('pageerror',e=>{err.push(e.message);console.log('  pageerror',e.message.slice(0,160));});
await pg.route(/supabase-js|chart\.js|datalabels|fonts\.g/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
await pg.addInitScript(init);
await pg.goto(`http://localhost:${port}/disponibilidade-preenchimento/`);
await pg.waitForFunction(()=>typeof EVENTS!=='undefined'&&EVENTS.length>0,null,{timeout:20000});
await pg.waitForTimeout(800);

const menu=await pg.evaluate(()=>[...document.querySelectorAll('#lstUni input[data-u]')].map(i=>i.dataset.u));
t(JSON.stringify(menu)==='["CGR","MCC"]','filtro Unidade só com a sigla → '+JSON.stringify(menu));
const placas=()=>pg.evaluate(()=>[...document.querySelectorAll('#cols tr[data-id] td.forte')].map(td=>td.textContent.trim()).sort());
t((await placas()).length===4,'sem filtro: os 4 indisponíveis');

await pg.evaluate(()=>{FUNI.clear();FUNI.add('MCC');render();});
t(JSON.stringify(await placas())==='["EMP1A11","ROT2B22","VAN3C33"]','MCC: empurrada, rota e van → '+JSON.stringify(await placas()));
const porTier=await pg.evaluate(()=>{const o={};abertos().forEach(e=>{const u=uniEv(e);o[u]=(o[u]||[]).concat(e.placa);});return o;});
t(JSON.stringify(porTier['MCC T1'])==='["EMP1A11"]','MCC T1 = só a empurrada (a van gravada como T1 conta no T2) → '+JSON.stringify(porTier));
t((porTier['MCC T2']||[]).includes('VAN3C33'),'a van conta no MCC T2');

const projs=await pg.evaluate(()=>[...document.querySelectorAll('#lstProj input[data-p]')].map(i=>i.dataset.p));
t(projs.includes('T1')&&projs.includes('VAN')&&projs.includes('ROTA'),'filtro Projeto separa T1 · ROTA · VAN → '+JSON.stringify(projs));
await pg.evaluate(()=>{FPROJ.clear();FPROJ.add('T1');render();});
t(JSON.stringify(await placas())==='["EMP1A11"]','Projeto T1: só a empurrada, sem van → '+JSON.stringify(await placas()));
await pg.evaluate(()=>{FPROJ.clear();render();});

// evento novo de van com o filtro em MCC → grava MCC T2
await pg.evaluate(()=>{novoEvento('VAN4D44');});
await pg.evaluate(()=>salvar());
let w=await pg.evaluate(()=>window.__W.filter(x=>x.t==='indisponibilidade'));
t(w.length===1&&w[0].op==='insert'&&w[0].payload.unidade==='MCC T2','van nova grava MCC T2 → '+(w[0]&&w[0].payload.unidade));
// evento novo de empurrada → MCC T1
await pg.evaluate(()=>{FUNI.clear();render();novoEvento('EMP1A11');});
await pg.evaluate(()=>salvar());
w=await pg.evaluate(()=>window.__W.filter(x=>x.t==='indisponibilidade'));
t(w[1]&&w[1].payload.unidade==='MCC T1','empurrada nova grava MCC T1 (mesmo sem filtro) → '+(w[1]&&w[1].payload.unidade));
// editar a van errada → corrige para MCC T2
await pg.evaluate(()=>{abreModal('e2');});
await pg.evaluate(()=>salvar());
w=await pg.evaluate(()=>window.__W.filter(x=>x.t==='indisponibilidade'));
t(w[2]&&w[2].op==='update'&&w[2].payload.unidade==='MCC T2','editar a van gravada como T1 corrige para MCC T2 → '+(w[2]&&w[2].payload.unidade));

// "Sem alterações hoje" por sigla: MCC já teve toque hoje? (eventos sem created_at → não)
await pg.evaluate(()=>{FUNI.clear();FUNI.add('CGR');render();});
await pg.evaluate(()=>confirmarSemAlteracao());
w=await pg.evaluate(()=>window.__W.filter(x=>x.t==='disp_checkins'));
t(w.length===1&&JSON.stringify(w[0].payload.map(l=>l.unidade))==='["CGR"]','check-in de CGR grava CGR');
await pg.evaluate(()=>{FUNI.clear();FUNI.add('MCC');render();});
await pg.evaluate(()=>{window.__W.length=0;CHECKS={};});
await pg.evaluate(()=>{EVENTS.forEach(e=>{delete e.created_at;delete e.updated_at;});});
await pg.evaluate(()=>confirmarSemAlteracao());
w=await pg.evaluate(()=>window.__W.filter(x=>x.t==='disp_checkins'));
t(w.length===1&&JSON.stringify(w[0].payload.map(l=>l.unidade).sort())==='["MCC T1","MCC T2"]','check-in de MCC grava os dois tiers → '+JSON.stringify(w[0]&&w[0].payload.map(l=>l.unidade)));
t(err.length===0,'sem erro de página');

await b.close(); srv.close();
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
