// ============================================================
// GESTÃO À VISTA · Ranking e Placas cabendo sem rolagem lateral
//
// Renan, 21/10/2026: documentos vencidos no Ranking e em Placas, "se precisar
// diminuir, diminua, mas deixe visivelmente tudo aparecendo, sem depender
// nunca de barra de rolagem horizontal", e a Média em 90/80. Abre o painel
// com o banco dublado, injeta 14 unidades × 22 placas no DATA e confere:
//   · a tabela das duas visões cabe em 1366/1600/1920, nos dois temas, e
//     com a lateral recolhida (o aperto se refaz);
//   · Média: ≥ 90 verde · 80–89,9 amarelo · < 80 vermelho;
//   · coluna Docs vencidos no Ranking.
// Uso: CHART_JS=… DATALABELS=… [SHOT_DIR=…] node scripts/gav-ranking-placas-teste.mjs
// ============================================================
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const CHART_JS=process.env.CHART_JS, DL=process.env.DATALABELS, ROOT=new URL('..', import.meta.url).pathname;
if(!CHART_JS||!DL){ console.error('defina CHART_JS e DATALABELS'); process.exit(2); }

const srv=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  if(!fs.existsSync(f)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});r.end(fs.readFileSync(f));}).listen(0);
const port=srv.address().port;

// serial do Excel de hoje + n dias (data local, como o export do Power BI)
const hoje=new Date(); hoje.setHours(0,0,0,0);
const serial=n=>Math.round((Date.UTC(hoje.getFullYear(),hoje.getMonth(),hoje.getDate())-Date.UTC(1899,11,30))/864e5)+n;
const V=(fil,proj,doc,placa,n,st)=>({'Filial':fil,'Projeto':proj,'Documento':doc,'Placa':placa,'Último Evento':serial(n-365),'Próximo Evento':serial(n),'Status':st||'A Vencer'});
const VENC=[
  V('PIRAI EMPURRADA','EMPURRADA','CRLV','PIR1A11',3),
  V('PIRAI EMPURRADA','EMPURRADA','CRONOTACÓGRAFO','PIR1A11',25),
  V('CDD GUARULHOS','ROTA','ALVARÁ SANITÁRIO','GRL2B22',12),
  V('CDD GUARULHOS','ROTA','CRLV','GRL3C33',0),
  V('CDD CUIABA','ROTA','FROTA LEGAL','CBA4D44',-2,'Vencido'),
];
const PEND=[
  {'Filial':'PIRAI EMPURRADA','Projeto':'LATA','Placa':'LAT5E55','Tipo Veículo':'CAVALO MECANICO','Documento Não Vinculado':'ANTT'},
  {'Filial':'CDD FLORIANOPOLIS','Projeto':'FRETEIRO','Placa':'FLP6F66','Tipo Veículo':'TOCO','Documento Não Vinculado':'CRONOTACÓGRAFO'},
];
const agora=new Date().toISOString();
const SNAP=(com)=>com?[{chave:'documentos-vencimento',data:VENC,updated_at:agora},{chave:'documentos-pendentes',data:PEND,updated_at:agora}]:[];

const init=(com)=>`(()=>{const DB=${JSON.stringify({ginfo_snapshot:SNAP(com)})};
 const q=(t)=>{const f=[];let rng=null,single=false;
   const o=new Proxy({},{get(_,k){
     if(k==='then') return (res,rej)=>Promise.resolve(run()).then(res,rej);
     if(k==='eq') return (c,v)=>{f.push(r=>String(r[c])===String(v));return o;};
     if(k==='in') return (c,a)=>{f.push(r=>a.map(String).includes(String(r[c])));return o;};
     if(k==='range') return (a,b)=>{rng=[a,b];return o;};
     if(k==='maybeSingle'||k==='single') return ()=>{single=true;return o;};
     return ()=>o;}});
   function run(){
     if(t==='fca_profiles'&&single) return {data:{is_admin:true,unidade:'',nome:'Teste'},error:null};
     let d=(DB[t]||[]).filter(r=>f.every(fn=>fn(r)));const n=d.length;
     if(rng) d=d.slice(rng[0],rng[1]+1);
     if(single) return {data:d[0]||null,error:null};
     return {data:d,error:null,count:n};}
   return o;};
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u',email:'x@y.z',user_metadata:{nome:'Teste'}}}}}),onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}},from:q,rpc:()=>q('rpc')})};
 try{localStorage.setItem('bi_theme','dark');sessionStorage.setItem('gem_hub','1');}catch(e){}
 window.alert=()=>{};
})();`;

let ok=0,fail=0;const t=(c,m)=>{c?ok++:fail++;console.log((c?'ok   ':'FALHA ')+m);};
const b=await chromium.launch({executablePath:process.env.PW_CHROME||'/opt/pw-browsers/chromium'});
async function abre(url,com=true,w=1600,h=900){
  const ctx=await b.newContext({viewport:{width:w,height:h},timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  const pg=await ctx.newPage(); pg.__err=[];
  pg.on('pageerror',e=>{pg.__err.push(e.message);console.log('  pageerror',e.message.slice(0,140));});
  await pg.route(/supabase-js/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.route(/supabase\.co/,r=>r.abort());
  await pg.route(/chart\.umd/,r=>r.fulfill({path:CHART_JS}));
  await pg.route(/datalabels/,r=>r.fulfill({path:DL}));
  await pg.route(/docs\.google\.com/,r=>{const m=(new URL(r.request().url()).searchParams.get('tqx')||'').match(/responseHandler:([\w$]+)/);
    r.fulfill({body:(m?m[1]:'google.visualization.Query.setResponse')+'({"version":"0.6","status":"ok","table":{"cols":[],"rows":[]}});',contentType:'text/javascript'});});
  await pg.route(/fonts\.g|html2canvas|jspdf|xlsx|cdnjs|unpkg/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.addInitScript(init(com));
  await pg.goto(`http://localhost:${port}/${url}`);
  await pg.waitForFunction(()=>typeof setVw==='function'&&document.getElementById('navInd'),null,{timeout:20000});
  await pg.waitForTimeout(3000);
  return pg;
}
// dados sintéticos injetados direto no DATA (o carregamento real fica dublado vazio)
const injeta=async pg=>pg.evaluate(()=>{
  const cods=Object.keys(UNIDADES); const hoje=new Date(); hoje.setHours(0,0,0,0);
  const R=(i,j)=>((i*7+j*13)%17);
  const L=(c,i)=>c.replace(/\s/g,'').slice(0,3).toUpperCase()+String(1000+i);
  DATA.prev=[];DATA.alinh=[];DATA.cifv=[];DATA.stressV=[];DATA.os=[];DATA.blitz=[];DATA.docs=[];DATA.docsPend=[];DATA.dispInd=[];DATA.disp=[];DATA.stressE=[];
  DATA.pneus={tires:[],veic:[],ult:Date.now()};
  cods.forEach((c,ci)=>{ DATA.disp.push({cod:c,ativos:40,indisp:2});
    for(let i=0;i<22;i++){ const p=L(c,i)+ci; const r=R(i,ci);
      DATA.prev.push({placa:p,cod:c,proj:'ROTA - TESTE LONGO',ad:r<15?1:0,dias:r-5});
      DATA.alinh.push({placa:p,cod:c,st:r<14?'OK':'VENCIDO',dias:r*3-10});
      DATA.cifv.push({placa:p,cod:c,proj:'ROTA',ad:r<16?1:0,dt:r<16?0:100});
      DATA.stressV.push({placa:p,cod:c,proj:'ROTA',desc:r<15?0:50});
      if(r%5===0) DATA.os.push({placa:p,cod:c,dias:r,os:'OS'+i});
      DATA.blitz.push({placa:p,cod:c,tipo:'ROTA',nunca:0,nao:r>15?1:0,fora:0,dentro:2,prazo:1,tot:r>15?4:3,dias:r-6});
      if(r%4===0) DATA.docs.push({placa:p,cod:c,proj:'ROTA',doc:'CRLV',dias:r-3});
      if(r===13) DATA.docsPend.push({placa:p,cod:c,proj:'ROTA',doc:'ANTT'});
      if(r===11) DATA.dispInd.push({placa:p,cod:c,proj:'ROTA',dias:4});
      for(let k=0;k<4;k++) DATA.pneus.tires.push({placa:p,cod:c,dt:new Date(hoje-r*2*864e5).toISOString(),st:k===0&&r>14?'Recapar':'Bom',pIdeal:110,desv:k===1&&r>13?14:3});
      DATA.pneus.veic.push({cod:c,dt:new Date(hoje-r*2*864e5)});
    }});
  PNEUS_OK=true; PINTADA={};
});
const larg=async(pg,v)=>pg.evaluate(v=>{ PINTADA[v]=false; setVw(v); return new Promise(res=>setTimeout(()=>{
  const el=document.getElementById('body-'+v); const ts=[...el.querySelectorAll('table')];
  res(ts.map(t=>({cls:t.className,sw:t.scrollWidth,cw:t.parentElement.clientWidth,ths:[...t.querySelectorAll('thead th')].map(h=>h.textContent)})));},700)); },v);
const S=process.env.SHOT_DIR;
for(const [w,h] of [[1366,768],[1600,900],[1920,1080]]){
  for(const tema of ['dark','light']){
    const pg=await abre('gestao-a-vista/?u=admin',true,w,h);
    if(tema==='light') await pg.evaluate(()=>aplicaTema('light'));
    await injeta(pg);
    for(const v of ['ranking','placas']){
      const r=await larg(pg,v);
      const tb=r[0]; t(tb&&tb.sw<=tb.cw+1, `${w}×${h} ${tema} ${v}: ${tb?tb.sw+' ≤ '+tb.cw+' ('+tb.cls+')':'sem tabela'}`);
      if(w===1366&&tema==='dark') console.log('   colunas:',tb.ths.join(' | '));
      if(S) await pg.screenshot({path:`${S}/${v}-${w}-${tema}.png`});
    }
    // lateral recolhida → reajusta
    if(w===1366&&tema==='dark'){ await pg.evaluate(()=>trocaMini()); await pg.waitForTimeout(600);
      const r=await pg.evaluate(()=>{const t=document.querySelector('#body-placas table');return {sw:t.scrollWidth,cw:t.parentElement.clientWidth,cls:t.className};});
      t(r.sw<=r.cw+1,`1366 mini placas: ${r.sw} ≤ ${r.cw} (${r.cls})`); }
    t(!pg.__err.length,`${w} ${tema} sem pageerror`);
    await pg.context().close();
  }
}
// Média nas faixas novas
{ const pg=await abre('gestao-a-vista/?u=admin',true,1600,900); await injeta(pg); await larg(pg,'ranking');
  const m=await pg.evaluate(()=>[...document.querySelectorAll('#body-ranking tbody tr')].map(tr=>{const s=tr.querySelector('.pill');return s?[s.textContent,s.style.background]:null;}).filter(Boolean));
  const val=s=>parseFloat(s.replace('%','').replace(',','.'));
  const cor=v=>v>=90?'rgb(59, 179, 59)':v>=80?'rgb(234, 179, 8)':'rgb(255, 102, 102)';
  t(m.length&&m.every(([s,bg])=>bg===cor(val(s))),'Média: ≥90 verde · 80–89,9 amarelo · <80 vermelho ('+m.map(x=>x[0]).join(', ')+')');
  const docs=await pg.evaluate(()=>{const ths=[...document.querySelectorAll('#body-ranking thead th')].map(h=>h.textContent);const i=ths.indexOf('Docs vencidos');return [i,...[...document.querySelectorAll('#body-ranking tbody tr')].slice(0,3).map(tr=>tr.children[i].textContent)];});
  t(docs[0]>0,'Ranking tem Docs vencidos: '+docs.join(' / '));
  await pg.context().close(); }
await b.close(); srv.close();
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
