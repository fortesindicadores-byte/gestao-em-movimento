// ============================================================
// GESTÃO À VISTA · Custos = a CARTA DE CUSTOS do mês corrente
//
// Renan, 13/10/2026: "Farol semanal custos: deve ser substituída pela carta de
// custos" → "Pode trocar" (mês corrente; só Combustíveis, Manutenção e Pneus).
//
// Abre as DUAS telas no Chromium com os MESMOS dados dublados (banco Supabase
// e gviz do Google) e compara pacote a pacote:
//   · admin (?u=admin): cada unidade da tabela do Gestão à Vista × o Resumo
//     Gerencial da Carta com aquela unidade e o mês corrente no filtro;
//   · unidade (?u=PIR): cada projeto × a Carta filtrada também no projeto, e o
//     hero (unidade inteira) × o Total Geral da Carta;
//   · nenhum pedido vai à aba "Custos" da planilha Farol Semanal;
//   · só os três pacotes aparecem (Seguros do DRE fica de fora).
// O dado cobre as regras que dão número diferente se a conta for copiada
// errado: lançamento sem NF fora, prévia do contrato (variável, fixo do mês
// anterior, portal VW, unidade já fechada pela planilha, placa sem projeto),
// combustível do ERP (PIS/COFINS, CGR sem desconto, preço absurdo, OS de outro
// mês) e Rem (tend.) = Orç do mês × rem/orç do ano, por recorte.
//
// LADO ANTIGO: ANTIGO=<commit> (ex.: ANTIGO=9a62128, o último antes da troca)
// troca farol-core.js e gestao-a-vista/index.html pelos daquele commit durante
// o teste (e devolve no fim) — o antigo lê a aba "Custos" da planilha.
// Uso: CHART_JS=… DATALABELS=… node scripts/gav-custos-carta-teste.mjs
// ============================================================
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { execSync } from 'node:child_process';
const CHART_JS=process.env.CHART_JS, DL=process.env.DATALABELS, ROOT=new URL('..', import.meta.url).pathname;
if(!CHART_JS||!DL){ console.error('defina CHART_JS e DATALABELS'); process.exit(2); }

// ── lado antigo (opcional) ──
const TROCA=['farol-frota/farol-core.js','gestao-a-vista/index.html'];
const guarda={};
if(process.env.ANTIGO){
  const REF=process.env.ANTIGO==='1'?'HEAD':process.env.ANTIGO;
  TROCA.forEach(f=>{ guarda[f]=fs.readFileSync(path.join(ROOT,f)); fs.writeFileSync(path.join(ROOT,f),execSync(`git show ${REF}:${f}`,{cwd:ROOT})); });
  console.log(`LADO ANTIGO: farol-core.js e gestao-a-vista/index.html de ${REF}`);
}
const devolve=()=>{ Object.keys(guarda).forEach(f=>fs.writeFileSync(path.join(ROOT,f),guarda[f])); };
process.on('exit',devolve);

const srv=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  if(!fs.existsSync(f)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});r.end(fs.readFileSync(f));}).listen(0);
const port=srv.address().port;

// ── mês corrente em Brasília (é o que as duas telas usam) ──
const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date());
const ANO=+p.find(x=>x.type==='year').value, MES=+p.find(x=>x.type==='month').value;
const VIG=ANO+'-'+String(MES).padStart(2,'0');
const ANT=MES===1?(ANO-1)+'-12':ANO+'-'+String(MES-1).padStart(2,'0');
const MESN=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MES_TXT=MESN[MES-1].toUpperCase()+'/'+String(ANO).slice(2);

// ── DRE (aba Frota): um ano de orçado, remunerado até o mês anterior ──
const DRE=[];
const dre=(nv3,conta,orc,rem)=>{ for(let m=1;m<=MES;m++) DRE.push([-orc*(1+m/50),m<MES?-rem*(1+m/50):null,null,nv3,conta,MESN[m-1],ANO]); };
dre('EMPURRADA - PIR','Manutenção de Veículos e Equipamentos',20000,18000);
dre('EMPURRADA - PIR','Combustíveis Veiculos e Equipamentos',30000,33000);
dre('EMPURRADA - PIR','Fluídos (Arla)',1500,1400);
dre('EMPURRADA - PIR','Pneus e Camaras',8000,7000);
dre('EMPURRADA - PIR','Contratos de Manutenção Fabricante',5000,5200);
dre('INSUMOS - PIR','Manutenção de Veículos e Equipamentos',4000,5000);
dre('INSUMOS - PIR','Consertos e Recapagens de Pneus',900,700);
dre('EMPURRADA - PIR','Seguro de Veículos e Equipamentos',7000,7000);   // fora dos pacotes
dre('EMPURRADA - CBA','Manutenção de Veículos e Equipamentos',12000,11000);
dre('EMPURRADA - CBA','Contratos de Manutenção Fabricante',3000,3000);
dre('ROTA - CBA','Manutenção de Veículos e Equipamentos',9000,9500);     // CBA T2, não CBA T1
dre('ROTA - MCC','Combustíveis Veiculos e Equipamentos',15000,14000);
dre('ROTA - MCC','Contratos de Manutenção Fabricante',2000,2100);
dre('ROTA - CGR','Combustíveis Veiculos e Equipamentos',10000,9000);
const FROTA_COLS=['ORÇADO','REMUNERADO','REALIZADO','NÍVEL 3','CONTA GERENCIAL','MÊS','ANO'];

// ── lançamentos da Carta ──
const L=(id,o)=>Object.assign({id,origem:null,unidade:'PIR',vigencia:VIG,pacote:'Manutenção',data:VIG+'-02',projeto:'EMPURRADA',equipamento:'X',fornecedor:'F',
  conta:'Manutenção de Veículos e Equip.',grupo:'Motor',descricao:'d',valor:1000,rc:'1',oc:'2',nf:'3',aprovado:true,aprovado_oc:true,created_at:VIG+'-02T10:00:00Z'},o);
const CARTA=[
  L('m1',{valor:4321}),
  L('m2',{valor:999,nf:''}),                                                       // sem NF: não conta
  L('m3',{projeto:'INSUMOS',conta:'Lavação de Veículos',grupo:'Lavação',valor:800}),
  L('m4',{projeto:'',valor:150}),                                                   // sem projeto: só na unidade
  L('p1',{pacote:'Pneus',conta:'Pneus Novos',grupo:'Pneus Novos',valor:6000}),
  L('p2',{pacote:null,conta:'Recapagens e Outros Serviços',grupo:'Recapagens',valor:450,projeto:'INSUMOS'}), // sem pacote: a conta decide
  L('c1',{unidade:'CBA T1',valor:2500}),
  L('c2',{unidade:'CBA T1',origem:'contratos-planilha',conta:'Contratos de Manutenção Fabricante',grupo:'Contrato',equipamento:'CBA1A11',valor:650,data:VIG+'-01'}),
  L('o1',{vigencia:ANT,data:ANT+'-10',valor:77777}),                                // outro mês: fora
  // planilha do contrato do mês anterior: dá o "fixo do mês anterior" da FIX1A11
  L('f1',{vigencia:ANT,data:ANT+'-01',origem:'contratos-planilha',conta:'Contratos de Manutenção Fabricante',equipamento:'FIX1A11',valor:800}),
];
// ── contrato (custo_vigencia_mv) ──
const CV=(o)=>Object.assign({vig_cobranca:VIG,vig_km:ANT,placa:'AAA1A11',placa_origem:'AAA1A11',unidade:'PIR',projeto:'EMPURRADA',tipo:'variavel',taxa_km:0.4,km_vig:3000,
  valor_fixo:0,km_hodometro:null,divergencia_pct:null,origem_km:'erp',custo_vig:1200,abastecimentos:3,ultimo_abast:null,previa:true,modelo:'VW',
  contrato:'X1',hodo_abast:null,hodo_contrato:null,km_vw:null,valor_vw:null,faixas_vw:null,faixa_vw:null},o);
const CONTR=[
  CV({}),                                                                   // PIR EMPURRADA, prévia 1.200
  CV({placa:'SEM0P00',placa_origem:'SEM0P00',projeto:null,custo_vig:200}),  // sem projeto: entra em todo projeto (como na Carta)
  CV({placa:'FIX1A11',placa_origem:'FIX1A11',tipo:'fixo',custo_vig:999}),   // fixo → 800 do mês anterior
  CV({placa:'INS0A00',placa_origem:'INS0A00',projeto:'INSUMOS',custo_vig:300}),
  CV({placa:'MCC1A11',placa_origem:'MCC1A11',unidade:'MCC T2',projeto:'ROTA',custo_vig:500,valor_vw:1234}), // portal VW manda
  CV({placa:'CBA1A11',placa_origem:'CBA1A11',unidade:'CBA T1',custo_vig:700}),   // CBA T1 fechado pela planilha: não é prévia
  CV({vig_cobranca:ANT,custo_vig:5555}),                                    // outro mês
];
// ── abastecimentos do ERP ──
let os=5000;
const A=o=>Object.assign({ordem_servico:String(++os),data:VIG+'-03',placa_origem:'AAA1A11',placa:'AAA1A11',filial:'FILIAL AMBEV PIRAÍ - RJ',projeto_os:'EMPURRADA - PIR',litros:1000,valor:6500,tipo_combustivel:'OLEO DIESEL S10',encerrada:'S'},o);
const ERP=[
  A({}), A({litros:2000,valor:13200}),
  A({tipo_combustivel:'ARLA - 32',litros:100,valor:390}),
  A({litros:150,valor:1489344208.99}),                                     // preço absurdo → mediano
  A({encerrada:'N',valor:99999}),                                          // OS aberta: fora
  A({data:ANT+'-28',valor:88888}),                                         // outro mês: fora
  A({tipo_combustivel:'GASOLINA COMUM',litros:20,valor:130}),              // só diesel e Arla
  A({filial:'FILIAL AMBEV CACHOEIRAS DE MACACU - RJ',projeto_os:'ROTA - MCC',litros:1500,valor:9900}),
  A({filial:'FILIAL AMBEV CAMPO GRANDE - RJ',projeto_os:'ROTA - CGR',litros:1000,valor:6400}),   // CGR sem PIS/COFINS
];

// ── a aba "Custos" da planilha Farol Semanal (só o lado antigo lê) ──
const FAROL_ID='1xOv7OJzErGV3vNCMOY_5O6px7vFvC990CW-1vGul5sY';
const CUSTOS_ABA={cols:['Vigência','UNIDADE','NÍVEL 3','CONTA GERENCIAL','ORÇADO','REMUNERADO','REALIZADO'],
  rows:[[`Date(${ANO},${MES-2},1)`,'PIRAI','EMPURRADA - PIR','Manutenção de Veículos e Equipamentos',-11111,-10000,-12345]]};

const DB={carta_custos:CARTA,custo_vigencia_mv:CONTR,erp_abastecimentos:ERP};
const init=`(()=>{const DB=${JSON.stringify(DB)};
 window.__q=[];
 const q=(t)=>{const f=[];let rng=null,single=false;const reg={t,ops:[]};window.__q.push(reg);
   const val=(r,c)=>r[c];
   const o=new Proxy({},{get(_,k){
     if(k==='then') return (res,rej)=>Promise.resolve(run()).then(res,rej);
     if(k==='eq') return (c,v)=>{reg.ops.push(['eq',c,v]);f.push(r=>String(val(r,c))===String(v));return o;};
     if(k==='in') return (c,a)=>{reg.ops.push(['in',c,a]);f.push(r=>a.map(String).includes(String(val(r,c))));return o;};
     if(k==='gte') return (c,v)=>{f.push(r=>String(val(r,c))>=String(v));return o;};
     if(k==='lt') return (c,v)=>{f.push(r=>String(val(r,c))<String(v));return o;};
     if(k==='lte') return (c,v)=>{f.push(r=>String(val(r,c))<=String(v));return o;};
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
 try{localStorage.setItem('bi_theme','dark');localStorage.removeItem('cc_frota_v1');sessionStorage.setItem('gem_hub','1');}catch(e){}
 window.alert=()=>{};
})();`;

const gvizResp=(url)=>{
  const u=new URL(url); const tqx=u.searchParams.get('tqx')||''; const sheet=u.searchParams.get('sheet')||'';
  let T={cols:[],rows:[]};
  if(url.includes(FAROL_ID)&&sheet==='Custos') T=CUSTOS_ABA;
  else if(sheet==='Frota') T={cols:FROTA_COLS,rows:DRE};
  const payload={version:'0.6',status:'ok',table:{cols:T.cols.map(l=>({label:l,id:l,type:'string'})),rows:T.rows.map(r=>({c:r.map(v=>v==null?null:{v})}))}};
  const m=tqx.match(/responseHandler:([\w$]+)/);
  return (m?m[1]:'google.visualization.Query.setResponse')+'('+JSON.stringify(payload)+');';
};

let ok=0,fail=0;const t=(c,m)=>{c?ok++:fail++;console.log((c?'ok   ':'FALHA ')+m);};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
async function abre(url){
  const ctx=await b.newContext({viewport:{width:1600,height:900},timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  const pg=await ctx.newPage(); pg.__gviz=[];
  pg.on('pageerror',e=>console.log('  pageerror',e.message.slice(0,140)));
  await pg.route(/supabase-js/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.route(/supabase\.co/,r=>r.abort());
  await pg.route(/chart\.umd/,r=>r.fulfill({path:CHART_JS}));
  await pg.route(/datalabels/,r=>r.fulfill({path:DL}));
  await pg.route(/docs\.google\.com/,r=>{pg.__gviz.push(r.request().url());r.fulfill({body:gvizResp(r.request().url()),contentType:'text/javascript'});});
  await pg.route(/fonts\.g|html2canvas|jspdf|xlsx|cdnjs|unpkg/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.addInitScript(init);
  await pg.goto(`http://localhost:${port}/${url}`);
  return pg;
}
// número da tela → inteiro ('—' = 0)
const n=s=>{s=String(s||'').trim(); if(!s||s==='—') return 0; const neg=/^-/.test(s); const v=+s.replace(/[^\d]/g,''); return neg?-v:v;};

// ── 1 · a Carta: Total de cada pacote por unidade e por projeto ──
const carta=await abre('carta-custos/');
await carta.waitForTimeout(1200);
await carta.waitForFunction(()=>typeof CONTR_OK!=='undefined'&&CONTR_OK,null,{timeout:15000});
const totaisCarta=async(u,proj)=>carta.evaluate(async([u,v,proj])=>{
  selUni.clear();selUni.add(u);selVig.clear();selVig.add(v);selProj.clear();if(proj)selProj.add(proj);
  await loadRows();
  const o={};document.querySelectorAll('#tbl-conta tbody tr.total').forEach(tr=>{o[tr.cells[0].textContent.replace(/^Total\s+/,'')]=[1,2,3].map(i=>tr.cells[i].textContent);});
  return o;},[u,VIG,proj||null]);
const C={};
for(const u of ['PIR','CBA T1','MCC T2','CGR']) C[u]=await totaisCarta(u);
const CP={PIR:{}};
for(const pj of ['EMPURRADA','INSUMOS']) CP.PIR[pj]=await totaisCarta('PIR',pj);
console.log('Carta PIR:',JSON.stringify(C.PIR));
t(C.PIR&&n(C.PIR['Geral'][2])>0,'Carta de referência montada (PIR com realizado) → '+JSON.stringify(C.PIR&&C.PIR['Geral']));
await carta.close();

// lê a tabela de Custos do Gestão à Vista: grupo → pacote → [orc, rem, real]
const tabelaGav=pg=>pg.evaluate(()=>{
  const o={};let g='';
  document.querySelectorAll('#body-custos tbody tr').forEach(tr=>{
    if(tr.classList.contains('tot-row')) return;
    const c=[...tr.cells]; if(c[0].hasAttribute('rowspan')){g=c[0].textContent.trim();c.shift();}
    (o[g]=o[g]||{})[c[0].textContent.trim()]=[c[1].textContent,c[2].textContent,c[3].textContent];
  });return o;});
const espera=async pg=>{
  await pg.waitForFunction(()=>typeof setVw==='function'&&document.getElementById('body-custos'),null,{timeout:20000});
  await pg.waitForTimeout(2500);
  await pg.evaluate(()=>setVw('custos'));
  await pg.waitForFunction(()=>{const e=document.getElementById('body-custos');return e&&!/Carregando/.test(e.textContent);},null,{timeout:20000});
  await pg.waitForTimeout(300);
};
const confere=(rot,gav,ref)=>{
  const pacs=['Combustíveis','Manutenção','Pneus'];
  pacs.forEach(pc=>{
    const a=(gav||{})[pc]||['—','—','—'], e=(ref||{})[pc]||['—','—','—'];
    const igual=[0,1,2].every(i=>n(a[i])===n(e[i]));
    t(igual,`${rot} · ${pc}: Gestão à Vista [Orç ${a.join(' · ')}] × Carta [${e.join(' · ')}]`);
  });
};

// ── 2 · Gestão à Vista, admin: uma unidade por grupo ──
{
  const pg=await abre('gestao-a-vista/?u=admin');
  await espera(pg);
  const T=await tabelaGav(pg);
  for(const u of ['PIR','CBA T1','MCC T2','CGR']) confere('admin '+u,T[u],C[u]);
  const pacsVistos=new Set(Object.values(T).flatMap(x=>Object.keys(x)));
  t([...pacsVistos].every(p=>['Combustíveis','Manutenção','Pneus'].includes(p))&&pacsVistos.size>0,'só os três pacotes da Carta → '+[...pacsVistos].join(', '));
  t(!Object.keys(T).includes('BLC'),'unidade sem nada no mês não aparece');
  const sub=await pg.evaluate(()=>document.getElementById('titSub').textContent);
  t(/Carta de Custos, mês corrente/.test(sub)&&sub.includes(`(${'__MES__'})`.replace('__MES__',MES_TXT)),'subtítulo diz que vem da Carta, mês corrente → '+sub.slice(0,110));
  const hero=await pg.evaluate(()=>{const h=document.getElementById('hero-custos');return h?h.textContent.replace(/\s+/g,' '):'';});
  t(hero.includes('REALIZADO · '+MES_TXT),'hero com o mês: REALIZADO · '+MES_TXT+' → '+hero.slice(0,60));
  const custos=pg.__gviz.filter(u=>u.includes(FAROL_ID)&&/sheet=Custos(&|$)/.test(u));
  t(custos.length===0,'nenhum pedido à aba "Custos" da planilha Farol Semanal ('+custos.length+')');
  const cu=await pg.evaluate(()=>unitStats('PIR').cu);
  const ref=C.PIR&&C.PIR['Geral']?(n(C.PIR['Geral'][2])-n(C.PIR['Geral'][0]))/n(C.PIR['Geral'][0])*100:null;
  t(cu!=null&&ref!=null&&Math.abs(cu-ref)<0.5,`chip Custos Δ Orç da PIR segue a Carta (${cu==null?'—':cu.toFixed(1)}% × ${ref==null?'—':ref.toFixed(1)}%)`);
  await pg.close();
}
// ── 3 · Gestão à Vista, unidade PIR: hero = unidade inteira; tabela por projeto ──
{
  const pg=await abre('gestao-a-vista/?u=PIR');
  await espera(pg);
  const T=await tabelaGav(pg);
  for(const pj of ['EMPURRADA','INSUMOS']) confere('PIR · projeto '+pj,T[pj],CP.PIR[pj]);
  const hv=await pg.evaluate(()=>{const h=document.querySelector('#hero-custos .hero-value');return h?h.textContent:'';});
  const real=n(C.PIR&&C.PIR['Geral']&&C.PIR['Geral'][2]);
  const brl=v=>{const a=Math.abs(v);if(a>=1e6)return 'R$ '+(a/1e6).toFixed(2).replace('.',',')+' mi';if(a>=1e3)return 'R$ '+Math.round(a/1e3).toLocaleString('pt-BR')+'k';return 'R$ '+Math.round(a).toLocaleString('pt-BR');};
  t(hv.trim()===brl(real),`hero da unidade = Total Geral da Carta (${hv.trim()} × ${brl(real)})`);
  await pg.close();
}
await b.close(); srv.close(); devolve();
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
