import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
// FCA · filtro Indicador/Conta em cascata (Renan, 13/10/2026: "Filtrei a origem
// Custos e aparecem todos os indicadores no FCA"). Com Origem = Custos, o filtro
// só lista as contas dos FCAs de Custos, e o fato antigo grudado
// ("CombustíveisDesvio de R$ 10.947") vira "Combustíveis".
// ARQ=<pasta> troca o painel (padrão fca-consolidado; fca-preenchimento também).
const ROOT=process.cwd();
const srv=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  if(!fs.existsSync(f)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html'});r.end(fs.readFileSync(f));}).listen(0);
const port=srv.address().port;
const F=(id,o)=>Object.assign({id,unidade:'PIR',vigencia:'ago/26',projeto:'EMPURRADA - PIR',status:'Não iniciada',causa:'',acao:'',responsavel:'',prazo:null,created_at:'2026-09-01T10:00:00Z'},o);
const ROWS=[
  F('r1',{origem:'RPM',fato:'Conformidade',fato_desvio:'Meta: 100% | Real: 80%'}),
  F('r2',{origem:'RPM',fato:'Preventivas',fato_desvio:'Meta: 100% | Real: 90%'}),
  F('c1',{origem:'Custos',fato:'Combustíveis',fato_desvio:'Desvio: ▲ R$ 4.539\nContas:\n- Combustíveis: ▲ 5,8K | ▲ 4%\n- Arla: ▼ 1,3K | ▼ 70% (saving)'}),
  F('c2',{origem:'Custos',fato:'CombustíveisDesvio de R$ 10.947',fato_desvio:''}),
  F('c3',{origem:'Custos',fato:'Manutenções',fato_desvio:'Contas:\n- Lavação de Veículos: ▲ 1K | ▲ 3%'}),
];
const init=`(()=>{window.__FCA=${JSON.stringify(ROWS)};
 const q=t=>{const o={select(){return o},order(){return o},eq(){return o},in(){return o},neq(){return o},gte(){return o},lte(){return o},limit(){return o},range(){return o},
   maybeSingle(){return Promise.resolve({data:t==='fca_profiles'?{is_admin:true,unidade:'PIR'}:null,error:null})},single(){return o.maybeSingle()},
   then(res,rej){return Promise.resolve({data:t==='fca'?JSON.parse(JSON.stringify(window.__FCA)):[],error:null}).then(res,rej)}};return o;};
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u',email:'x@y.z',user_metadata:{nome:'Teste'}}}}}),onAuthStateChange(){}},from:q,channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){}})};
 try{sessionStorage.setItem('gem_hub','1');localStorage.setItem('bi_theme','escuro')}catch(e){}
 window.alert=()=>{};})();`;
let ok=0,fail=0;const t=(c,m)=>{c?ok++:fail++;console.log((c?'ok  ':'FALHA ')+m);};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:1600,height:900}});
pg.on('pageerror',e=>console.log('pageerror',e.message));
await pg.route(/supabase-js|chart\.umd|datalabels|fonts\.g|html2canvas|jspdf|xlsx|cdn\./,r=>r.fulfill({body:'',contentType:'text/javascript'}));
await pg.addInitScript(init);
const ARQ=process.env.ARQ||'fca-consolidado';
await pg.goto(`http://localhost:${port}/${ARQ}/`);
await pg.waitForTimeout(1500);
const opcoes=id=>pg.evaluate(id=>{toggleMs(id);const v=[...document.querySelectorAll('#'+id+' .ms-opt:not(.all-opt)')].map(l=>l.textContent.replace('só','').trim());toggleMs(id);return v;},id);
let todas=await opcoes('ms-conta');
t(todas.includes('Conformidade')&&todas.includes('Combustíveis')&&!todas.includes('Arla')&&!todas.includes('Lavação de Veículos'),'sem filtro: indicadores e pacotes, sem conta contábil → '+JSON.stringify(todas));
t(!todas.some(x=>/desvio/i.test(x)),'nenhuma opção com "Desvio de R$" → '+JSON.stringify(todas.filter(x=>/desvio/i.test(x))));
// marca Origem = Custos (o "só" do filtro)
await pg.evaluate(()=>{toggleMs('ms-org');const s=[...document.querySelectorAll('#ms-org .ms-only')].find(e=>e.dataset.v==='Custos');s.click();toggleMs('ms-org');});
const custos=await opcoes('ms-conta');
t(JSON.stringify(custos)===JSON.stringify(['Combustíveis','Manutenções']),'Origem Custos: só os pacotes → '+JSON.stringify(custos));
await pg.evaluate(()=>{toggleMs('ms-org');const s=[...document.querySelectorAll('#ms-org .ms-only')].find(e=>e.dataset.v==='RPM');s.click();toggleMs('ms-org');});
const rpm=await opcoes('ms-conta');
t(JSON.stringify(rpm)===JSON.stringify(['Conformidade','Preventivas']),'Origem RPM: só os indicadores → '+JSON.stringify(rpm));
await b.close(); srv.close();
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
