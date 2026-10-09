import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
// Teste do pacote Combustíveis na Carta de Custos (Chromium, banco e DRE dublados).
// O realizado vem dos abastecimentos do ERP (erp_abastecimentos): unidade e tier
// pelo projeto da OS, Arla × diesel, PIS/COFINS 9,25% fora (menos Campo Grande e
// o diesel de Florianópolis), preço por litro absurdo trocado pelo mediano da
// filial no mês e listado, GLP "(SEM CUSTO)" e filiais fora do portal ignorados,
// GLP e gasolina ficam fora (só diesel e Arla), e Combustíveis fora da caixa de lançamento. Resumo com três pacotes sem rolar.
// CHART_JS = chart.umd.js 4.4.0 · DATALABELS = chartjs-plugin-datalabels 2.2.0 · SHOT_DIR salva prints.
const CHART_JS=process.env.CHART_JS, DL=process.env.DATALABELS, SHOT=process.env.SHOT_DIR, ROOT=process.cwd();
if(!CHART_JS||!DL){ console.error('defina CHART_JS e DATALABELS'); process.exit(2); }
const srv=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  if(!fs.existsSync(f)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html'});r.end(fs.readFileSync(f));}).listen(0);
const port=srv.address().port;
const VIG='2026-09';
const L=(id,o)=>Object.assign({id,origem:null,unidade:'PIR',vigencia:VIG,pacote:'Manutenção',data:VIG+'-02',projeto:'EMPURRADA',equipamento:'X',fornecedor:'F',conta:'Manutenção de Veículos e Equip.',grupo:'Motor',descricao:'d',valor:1000,rc:'1',oc:'2',nf:'3',aprovado:true,aprovado_oc:true},o);
const ROWS=[ L('m1',{}), L('p1',{pacote:'Pneus',conta:'Pneus Novos',grupo:'Pneus Novos',valor:3000}) ];
let os=1000;
const A=(o)=>Object.assign({ordem_servico:String(++os),data:VIG+'-10',placa_origem:'AAA1A11',placa:'AAA1A11',filial:'FILIAL AMBEV PIRAÍ - RJ',projeto_os:'EMPURRADA - PIR',litros:100,valor:700,tipo_combustivel:'OLEO DIESEL S10'},o);
const ABAST=[
  A({}),                                                                                   // PIR diesel 700 → 635,25
  A({tipo_combustivel:'ARLA - 32',litros:10,valor:39}),                                    // PIR Arla 39 → 35,39
  A({filial:'FILIAL AMBEV CUIABÁ - MT',projeto_os:'ROTA - CBA',litros:50,valor:340,placa_origem:'CBA0001'}),            // CBA T2 340 (6,80/L)
  A({filial:'FILIAL AMBEV CUIABÁ - MT',projeto_os:'ROTA - CBA',litros:144.381,valor:1489344208.99,placa_origem:'JBD7A17',ordem_servico:'1281195'}), // absurdo → 144,381 × 6,80
  A({filial:'FILIAL AMBEV CUIABÁ - MT',projeto_os:'EMPURRADA - CBA',litros:100,valor:690,placa_origem:'CBA0002'}),      // CBA T1
  A({filial:'FILIAL AMBEV CAMPO GRANDE - RJ',projeto_os:'ROTA - CGR',litros:100,valor:650}),                           // CGR diesel sem desconto
  A({filial:'FILIAL AMBEV CAMPO GRANDE - RJ',projeto_os:'ROTA - CGR',tipo_combustivel:'ARLA 32 - LITRO',litros:10,valor:40}), // CGR Arla sem desconto
  A({filial:'FILIAL AMBEV PALHOÇA - SC',projeto_os:'ROTA - FLP',litros:100,valor:660}),                               // FLP diesel sem desconto
  A({filial:'FILIAL AMBEV PALHOÇA - SC',projeto_os:'ROTA - FLP',tipo_combustivel:'ARLA - 32',litros:10,valor:40}),       // FLP Arla com desconto → 36,30
  A({filial:'FILIAL AMBEV GOIÂNIA - GO',projeto_os:'AUTO SERVIÇO - GOI',litros:10,valor:70}),                          // GOI → GNA 63,53
  A({tipo_combustivel:'GAS EMPILHADEIRA - USAR APENAS PARA AQUELE DISPONIBILIZADO PELA AMBEV (SEM CUSTO)',litros:50,valor:300}), // fora
  A({tipo_combustivel:'GAS (GLP) EMPILHADEIRA',litros:50,valor:200}),                                                   // fora: só diesel e Arla
  A({tipo_combustivel:'GASOLINA COMUM',litros:30,valor:200}),                                                           // fora: só diesel e Arla
  A({filial:'FILIAL TEODORO SAMPAIO - SP',projeto_os:'OPERACIONAL - UTS',litros:100,valor:575480}),                    // fora do portal
  A({data:'2026-08-30',valor:9999}),                                                        // fora do mês
];
// DRE (aba Frota) mínimo: orçado/remunerado de Combustíveis e Arla em PIR, set/26
const gviz={version:'0.6',status:'ok',table:{cols:['ORÇADO','REMUNERADO','REALIZADO','NÍVEL 3','CONTA GERENCIAL','MÊS','ANO'].map(l=>({label:l,type:'string'})),
  rows:[['-800','-750','-700','EMPURRADA - PIR','Combustíveis Veiculos e Equipamentos','set',2026],['-40','-38','-35','EMPURRADA - PIR','Fluídos (Arla)','set',2026]]
    .map(r=>({c:r.map(v=>({v}))}))}};
const init=`(()=>{const R=${JSON.stringify(ROWS)}, AB=${JSON.stringify(ABAST)}; window.__ins=[]; window.__abQ=[];
 const q=(t)=>{const f=[];const o={_t:t,select(){return o},in(){return o},eq(c,v){f.push(['eq',c,v]);return o},order(){return o},range(){return o},gte(c,v){f.push(['gte',c,v]);return o},lt(c,v){f.push(['lt',c,v]);return o},lte(){return o},neq(){return o},limit(){return o},
   insert(p){window.__ins.push(p);return {select(){return {single(){return Promise.resolve({data:Object.assign({id:'novo'+window.__ins.length},p),error:null})}}}}},
   maybeSingle(){return Promise.resolve({data:t==='fca_profiles'?{is_admin:true,unidade:''}:null,error:null})},single(){return o.maybeSingle()},
   then(res,rej){ let d=[];
     if(t==='carta_custos') d=R;
     if(t==='erp_abastecimentos'){ window.__abQ.push(f.slice()); const g=f.find(x=>x[0]==='gte'), l=f.find(x=>x[0]==='lt');
       d=AB.filter(a=>(!g||a.data>=g[2])&&(!l||a.data<l[2])); if(window.__abErro) return Promise.resolve({data:null,error:{message:'banco fora'},count:0}).then(res,rej); }
     return Promise.resolve({data:d,error:null,count:d.length}).then(res,rej)}};return o;};
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u',email:'x@y.z',user_metadata:{nome:'Teste'}}}}}),onAuthStateChange(){}},from:q})};
 try{localStorage.setItem('bi_theme',window.__tema||'escuro');localStorage.removeItem('cc_frota_v1')}catch(e){}
 window.alert=()=>{};
})();`;
let ok=0,fail=0;const t=(c,m)=>{c?ok++:fail++;console.log((c?'ok  ':'FALHA ')+m);};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
async function abre(w,h,tema,extra){
  const pg=await b.newPage({viewport:{width:w,height:h}});
  pg.on('pageerror',e=>{console.log('pageerror',e.message);fail++;});
  await pg.route(/supabase-js/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.route(/supabase\.co/,r=>r.abort());
  await pg.route(/chart\.umd/,r=>r.fulfill({path:CHART_JS}));
  await pg.route(/datalabels/,r=>r.fulfill({path:DL}));
  await pg.route(/docs\.google\.com/,r=>r.fulfill({body:'google.visualization.Query.setResponse('+JSON.stringify(gviz)+');',contentType:'text/javascript'}));
  await pg.route(/fonts\.g|html2canvas|jspdf|xlsx/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.addInitScript(`window.__tema=${JSON.stringify(tema||'escuro')};`+(extra||'')+init);
  await pg.goto(`http://localhost:${port}/carta-custos/`);
  await pg.waitForTimeout(700);
  await pg.evaluate(v=>{selUni.clear();selVig.clear();selVig.add(v);buildVigFilter();return loadRows();},VIG);
  await pg.waitForTimeout(400);
  if(tema==='claro') await pg.evaluate(()=>document.body.classList.add('claro'));
  return pg;
}
const tabela=pg=>pg.evaluate(()=>[...document.querySelectorAll('#tbl-conta tbody tr')].map(tr=>[tr.cells[0].textContent,tr.cells.length>3?tr.cells[3].textContent:'',tr.cells.length>1?tr.cells[1].textContent:'',tr.cells.length>2?tr.cells[2].textContent:'']));
const R2=x=>Math.round(x*100)/100;

// 1 · todas as unidades: o que entra, com que valor
{
  const pg=await abre(1600,900);
  const q=await pg.evaluate(()=>window.__abQ[window.__abQ.length-1]);
  t(q&&q.some(x=>x[0]==='eq'&&x[1]==='encerrada'&&x[2]==='S'),'leitura pede só OS encerradas → '+JSON.stringify(q));
  t(q&&q.some(x=>x[0]==='gte'&&x[2]==='2026-09-01')&&q.some(x=>x[0]==='lt'&&x[2]==='2026-10-01'),'leitura recorta o mês (gte 2026-09-01, lt 2026-10-01)');
  const C=await pg.evaluate(()=>COMB.map(r=>({u:r.unidade,c:r.conta,g:r.grupo,v:Math.round(r.valor*100)/100,p:r.projeto,corr:r.corrigido})));
  const soma=(u,c)=>R2(C.filter(r=>r.u===u&&(!c||r.c===c)).reduce((s,r)=>s+r.v,0));
  t(soma('PIR','Combustíveis')===635.25,'PIR diesel 700 − 9,25% = 635,25 → '+soma('PIR','Combustíveis'));
  t(soma('PIR','Arla')===35.39,'PIR Arla 39 − 9,25% = 35,39 → '+soma('PIR','Arla'));
  t(soma('CGR','Combustíveis')===650&&soma('CGR','Arla')===40,'Campo Grande sem desconto (diesel 650 · Arla 40) → '+soma('CGR','Combustíveis')+' · '+soma('CGR','Arla'));
  t(soma('FLP','Combustíveis')===660&&soma('FLP','Arla')===36.3,'Florianópolis: diesel sem desconto 660, Arla com desconto 36,30 → '+soma('FLP','Combustíveis')+' · '+soma('FLP','Arla'));
  t(soma('GNA')===63.53,'Goiânia (projeto GOI) entra como GNA 63,53 → '+soma('GNA'));
  // mediana de [6,80 · 6,90] (ROTA e EMPURRADA da mesma filial) = 6,90, o do meio pela posição
  const cbaT2=R2(340*0.9075+144.381*6.9*0.9075);
  t(soma('CBA T2')===cbaT2,`CBA T2: 340 + absurdo trocado por 144,381 × 6,90, menos 9,25% = ${cbaT2} → ${soma('CBA T2')}`);
  t(soma('CBA T1')===R2(690*0.9075),'EMPURRADA - CBA vai para CBA T1 → '+soma('CBA T1'));
  t(C.filter(r=>r.corr).length===1,'um abastecimento corrigido (o de R$ 1,49 bi)');
  t(!C.some(r=>/GLP|Gasolina/i.test(r.g))&&C.every(r=>r.c==='Combustíveis'||r.c==='Arla'),'só diesel e Arla: GLP e gasolina ficam fora');
  t(C.length===10,'10 abastecimentos entram (fora: GLP, gasolina, Teodoro Sampaio, agosto) → '+C.length);
  t(C.find(r=>r.u==='PIR').p==='EMPURRADA','projeto = prefixo do projeto da OS (EMPURRADA)');
  const tb=await tabela(pg); const nomes=tb.map(x=>x[0]);
  t(nomes.includes('Total Combustíveis')&&nomes.includes('Total Manutenção')&&nomes.includes('Total Pneus')&&nomes[nomes.length-1]==='Total Geral','Resumo com os três pacotes e o Total Geral → '+nomes.join(' | '));
  const nota=await pg.evaluate(()=>{const n=document.querySelector('#tbl-conta tr.nota-comb');return n?{txt:n.textContent,tit:n.title}:null;});
  t(nota&&/1 abastecimento/.test(nota.txt)&&/1281195/.test(nota.tit),'nota lista o abastecimento corrigido (OS 1281195) → '+(nota&&nota.txt));
  const conta=await pg.evaluate(()=>[...document.querySelectorAll('#ms-conta .ms-opt')].map(o=>o.textContent.replace('só','').trim()));
  t(conta.some(c=>/COMBUST/i.test(c))&&conta.some(c=>/ARLA/i.test(c)),'filtro Conta traz Combustíveis e Arla → '+conta.join(', '));
  const lanc=await pg.evaluate(()=>[...document.querySelectorAll('#tbl-lanc tbody tr.clicavel')].length);
  t(lanc===2,'Lançamentos continua só com os lançados à mão ('+lanc+')');
  await pg.evaluate(()=>setVw('graficos')); await pg.waitForTimeout(200);
  t(await pg.evaluate(()=>document.querySelector('#vw-graficos').classList.contains('on')&&!document.querySelector('#vw-resumo .gr3')),'gráficos ficam na visão Gráficos, fora do Resumo');
  const placas=await pg.evaluate(()=>charts['ch-placa']?charts['ch-placa'].data.labels:[]);
  t(placas.includes('JBD7A17'),'gráfico por placa inclui o combustível → '+placas.slice(0,5).join(', '));
  await pg.close();
}
// 2 · só PIR: DRE de Combustíveis e Arla aparece no bloco
{
  const pg=await abre(1600,900);
  await pg.evaluate(()=>{selUni.clear();selUni.add('PIR');return loadRows();}); await pg.waitForTimeout(300);
  const tb=await tabela(pg); const linha=n=>tb.find(x=>x[0]===n)||[];
  t(linha('Combustíveis')[1]==='635'&&linha('Arla')[1]==='35','PIR: realizado Combustíveis 635 · Arla 35 → '+linha('Combustíveis')[1]+' · '+linha('Arla')[1]);
  t(linha('Combustíveis')[2]==='800'&&linha('Arla')[2]==='40','PIR: orçado do DRE pelas contas do DRE (Combustíveis Veiculos…, Fluídos (Arla)) → '+linha('Combustíveis')[2]+' · '+linha('Arla')[2]);
  t(linha('Total Combustíveis')[1]==='671','PIR: Total Combustíveis 670,64 → 671 → '+linha('Total Combustíveis')[1]);
  t(!(await pg.$('#tbl-conta tr.nota-comb')),'PIR: sem nota (nenhum abastecimento corrigido)');
  // filtro Pacote = Combustíveis e a caixa de lançamento
  await pg.evaluate(()=>{selPac.add('Combustíveis');render();});
  const nomes=(await tabela(pg)).map(x=>x[0]).join('|');
  t(nomes==='Combustíveis|Arla|Total Combustíveis','Pacote = Combustíveis: só o bloco dele → '+nomes);
  await pg.evaluate(()=>abrirLanc(''));
  const contas=await pg.evaluate(()=>[...document.querySelectorAll('#f-conta option')].map(o=>o.value));
  t(!contas.includes('Combustíveis')&&!contas.includes('Arla')&&contas.includes('Pneus Novos'),'caixa de lançamento sem as contas de Combustíveis → '+contas.length+' contas');
  await pg.close();
}
// 3 · banco recusando a leitura dos abastecimentos
{
  const pg=await abre(1600,900,'escuro','window.__abErro=true;');
  const nota=await pg.evaluate(()=>{const n=document.querySelector('#tbl-conta tr.nota-comb');return n?n.textContent:'';});
  t(/indisponíveis/.test(nota),'banco fora: o Resumo avisa em vez de mostrar zero calado → '+nota);
  const tb=await tabela(pg);
  t(tb.some(x=>x[0]==='Total Manutenção'&&x[1]!=='—'),'banco fora: Manutenção continua aparecendo');
  await pg.close();
}
// 4 · Resumo com os três pacotes sem rolar
for(const [w,h] of [[1366,768],[1600,900],[1920,1080]]) for(const tema of ['escuro','claro']){
  const pg=await abre(w,h,tema);
  const r=await pg.evaluate(()=>{const v=document.querySelector('#vw-resumo'),tw=document.querySelector('#vw-resumo .twrap');
    return {vs:v.scrollHeight-v.clientHeight,bs:document.documentElement.scrollHeight-innerHeight,hs:v.scrollWidth-v.clientWidth,ts:tw.scrollHeight-tw.clientHeight};});
  t(r.vs<=1&&r.bs<=1&&r.hs<=1&&r.ts<=1,`${w}x${h} ${tema}: Resumo só com a tabela, sem rolagem (v ${r.vs} · pág ${r.bs} · h ${r.hs} · tabela ${r.ts})`);
  await pg.evaluate(()=>setVw('graficos')); await pg.waitForTimeout(250);
  const g=await pg.evaluate(()=>{const v=document.querySelector('#vw-graficos'),g=v.querySelector('.gr3');
    return {vs:v.scrollHeight-v.clientHeight,bs:document.documentElement.scrollHeight-innerHeight,gh:g.getBoundingClientRect().height,vh:v.getBoundingClientRect().height};});
  t(g.vs<=1&&g.bs<=1&&g.gh>=g.vh*0.9,`${w}x${h} ${tema}: Gráficos ocupam a visão (${Math.round(g.gh)} de ${Math.round(g.vh)}px) sem rolagem`);
  if(SHOT) await pg.screenshot({path:`${SHOT}/comb-graficos-${w}-${tema}.png`});
  await pg.evaluate(()=>setVw('resumo'));
  if(SHOT) await pg.screenshot({path:`${SHOT}/comb-resumo-${w}-${tema}.png`});
  await pg.close();
}
await b.close(); srv.close();
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
