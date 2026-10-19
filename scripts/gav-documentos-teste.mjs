// ============================================================
// GESTÃO À VISTA · visão Documentos (Ginfo → 1.1 - DOCUMENTOS)
//
// Renan, 19/10/2026: "Consegue buscar visão de documentos com o robô do ginfo?
// Segue a mesma lógica dos outros painéis". O robô grava dois drills da página
// (documentos-vencimento e documentos-pendentes) em ginfo_snapshot; aqui o
// Gestão à Vista abre com esses dois exports dublados e confere:
//   · a visão aparece no menu (e some quando não há dado);
//   · número grande = documentos que vencem em até 30 dias; cards por tipo;
//   · prazo em dias a partir do Próximo Evento (serial do xlsx → data LOCAL);
//   · tabela do que vence antes para o mais folgado, e a de pendentes;
//   · na unidade (?u=PIR) só os documentos dela, sem a coluna Unidade.
// Uso: CHART_JS=… DATALABELS=… node scripts/gav-documentos-teste.mjs
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
const vista=async pg=>{
  await pg.evaluate(()=>setVw('docs'));
  await pg.waitForFunction(()=>{const e=document.getElementById('body-docs');return e&&!/Carregando/.test(e.textContent);},null,{timeout:20000});
};

// ── 1 · admin ──
{
  const pg=await abre('gestao-a-vista/?u=admin');
  const noMenu=await pg.evaluate(()=>!!document.querySelector('.s-item[data-vw="docs"]'));
  t(noMenu,'item Documentos no menu de indicadores');
  await vista(pg);
  const r=await pg.evaluate(()=>{
    const b=document.getElementById('body-docs');
    const tabs=[...b.querySelectorAll('table')];
    const lin=t=>[...t.querySelectorAll('tbody tr')].map(tr=>[...tr.cells].map(c=>c.textContent.trim()));
    const top=document.getElementById('vw-docs');
    return {hero:(top.querySelector('.mh-val')||{}).textContent, meta:(top.querySelector('.mh-meta')||{}).textContent,
      cards:[...top.querySelectorAll('.ch-min')].map(c=>[...c.children].map(x=>x.textContent.trim()).join(' ')),
      tabs:tabs.map(lin), heads:tabs.map(t=>[...t.querySelectorAll('th')].map(h=>h.textContent.trim())),
      sub:document.getElementById('titSub').textContent, scroll:document.documentElement.scrollWidth>innerWidth};
  });
  t(r.hero==='5','número grande = 5 documentos vencendo em até 30 dias → '+r.hero);
  t(/4 placa/.test(r.meta)&&/1 vencido/.test(r.meta)&&/2 vence\(m\) em até 7 dias/.test(r.meta)&&/2 pendente/.test(r.meta),'meta: placas, vencido, até 7 dias, pendentes → '+r.meta);
  t(r.cards[0]==='CRLV 2'&&r.cards.length===4,'cards por tipo, o mais frequente primeiro → '+r.cards.join(' | '));
  t(r.tabs.length===3,'três tabelas (unidade · documentos · pendentes)');
  const doc=r.tabs[1]||[];
  t(doc[0]&&doc[0][1]==='CBA4D44'&&doc[0][4]==='2d · NOK','1ª linha = o vencido (CBA4D44, 2d · NOK) → '+JSON.stringify(doc[0]));
  t(doc[1]&&doc[1][4]==='0d · OK'&&doc[2]&&doc[2][4]==='3d · OK','depois os que vencem hoje e em 3 dias');
  const prox=new Date(hoje); prox.setDate(prox.getDate()+3);
  t(doc[2]&&doc[2][5]===prox.toLocaleDateString('pt-BR'),'Próximo evento em data local (serial do xlsx sem voltar um dia) → '+(doc[2]&&doc[2][5]));
  t(doc[0]&&doc[0][0]==='CBA T2','unidade pelo de-para (CDD CUIABA → CBA T2) → '+(doc[0]&&doc[0][0]));
  const pend=r.tabs[2]||[];
  t(pend.length===2&&pend.some(l=>l.includes('LAT5E55')&&l.includes('ANTT')),'pendentes de vínculo listados → '+JSON.stringify(pend));
  t(/última exportação do Ginfo/.test(r.sub),'subtítulo com a última exportação do Ginfo');
  t(!r.scroll,'sem rolagem horizontal da página em 1600 px');
  t(pg.__err.length===0,'sem erro de página');
  await pg.close();
}
// ── 2 · unidade PIR ──
{
  const pg=await abre('gestao-a-vista/?u=PIR');
  await vista(pg);
  const r=await pg.evaluate(()=>{const b=document.getElementById('body-docs');
    return {hero:(document.getElementById('vw-docs').querySelector('.mh-val')||{}).textContent,ntab:b.querySelectorAll('table').length,
      head:[...b.querySelectorAll('table')[0].querySelectorAll('th')].map(h=>h.textContent.trim()),
      placas:[...b.querySelectorAll('tbody tr td b')].map(x=>x.textContent)};});
  t(r.hero==='2','PIR: 2 documentos (só os dela) → '+r.hero);
  t(r.ntab===2&&r.head[0]==='Placa','PIR: sem a tabela por unidade e sem a coluna Unidade');
  t(r.placas.includes('LAT5E55')&&!r.placas.includes('GRL2B22'),'PIR: pendente da LATA entra, Guarulhos não');
  await pg.close();
}
// ── 3 · sem dado: a visão some ──
{
  const pg=await abre('gestao-a-vista/?u=admin',false);
  const noMenu=await pg.evaluate(()=>!!document.querySelector('.s-item[data-vw="docs"]'));
  t(!noMenu,'sem coleta do robô, a visão não aparece no menu');
  await pg.close();
}
await b.close(); srv.close();
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
