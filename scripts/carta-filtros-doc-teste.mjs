import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
// Carta de Custos: filtros de RC, OC e NF (Renan, 22/10/2026). Pela situação de
// cada documento; com um deles ligado, só os lançamentos à mão ficam na tela,
// e a barra de filtros continua cabendo no topo.
// CHART_JS = chart.umd.js 4.4.0 · DATALABELS = chartjs-plugin-datalabels 2.2.0 · SHOT_DIR salva prints.
const CHART_JS=process.env.CHART_JS, DL=process.env.DATALABELS, SHOT=process.env.SHOT_DIR, ROOT=process.cwd();
if(!CHART_JS||!DL){ console.error('defina CHART_JS e DATALABELS'); process.exit(2); }
const srv=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  if(!fs.existsSync(f)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html'});r.end(fs.readFileSync(f));}).listen(0);
const port=srv.address().port;
const L=(id,o)=>Object.assign({id,origem:null,unidade:'MCC T1',vigencia:'2026-10',pacote:'Manutenção',data:'2026-10-02',projeto:'ROTA',equipamento:'X',fornecedor:'F',conta:'Manutenção de Veículos e Equip.',grupo:'Motor',descricao:'d',valor:100,rc:'1',oc:'2',nf:'3',aprovado:true,aprovado_oc:true},o);
const ROWS=[
  L('a1',{valor:1000}),                                              // tudo pronto
  L('a2',{valor:200,rc:'24298',aprovado:false,aprovado_oc:false,oc:'',nf:''}),   // RC aguardando
  L('a3',{valor:300,rc:'N/A',aprovado:true,aprovado_oc:false,nf:''}),            // sem RC, OC aguardando
  L('a4',{valor:400,rc:'',aprovado:false,aprovado_oc:false,oc:'',nf:''}),        // tudo em branco
  L('a5',{valor:500,nf:'',oc:'4500-771'}),                                         // OC aprovada, sem NF
  L('r1',{valor:900,origem:'contratos-robot'}),                      // linha de robô
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

const lanc=pg=>pg.evaluate(()=>{setVw('lanc');return [...document.querySelectorAll('#tbl-lanc tbody tr')].map(tr=>tr.textContent).filter(t=>/Manuten|Lava/.test(t)).length;});
const marca=(pg,id,v)=>pg.evaluate(([id,v])=>{const s={'ms-rc':selRC,'ms-oc':selOC,'ms-nf':selNF}[id];s.clear();v.forEach(x=>s.add(x));$(id)._render();render();},[id,v]);
const opsMs=(pg,id)=>pg.evaluate(id=>[...document.querySelectorAll('#'+id+' .ms-opt:not(.all-opt)')].map(l=>l.textContent.replace('só','').trim()),id);
{
  const pg=await abre(1600,900,'escuro');
  await pg.waitForFunction(()=>!/Carregando/.test($('titSub').textContent),null,{timeout:10000}).catch(()=>{});
  t((await opsMs(pg,'ms-rc')).join('|')==='APROVADA|AGUARDANDO APROVAÇÃO|N/A (SEM RC)|EM BRANCO','opções do RC → '+(await opsMs(pg,'ms-rc')).join('|'));
  t((await opsMs(pg,'ms-oc')).join('|')==='APROVADA|AGUARDANDO APROVAÇÃO|EM BRANCO','opções da OC');
  t((await opsMs(pg,'ms-nf')).join('|')==='LANÇADA|EM BRANCO','opções da NF');
  const tot=await lanc(pg); t(tot===6,'sem filtro: 6 linhas → '+tot);
  await marca(pg,'ms-rc',['Aguardando aprovação']); let n=await lanc(pg); t(n===1,'RC aguardando: 1 linha → '+n);
  await marca(pg,'ms-rc',['N/A (sem RC)']); n=await lanc(pg); t(n===1,'RC N/A: 1 linha → '+n);
  await marca(pg,'ms-rc',['Em branco']); n=await lanc(pg); t(n===1,'RC em branco: 1 linha (robô fora) → '+n);
  await marca(pg,'ms-rc',[]); await marca(pg,'ms-oc',['Aguardando aprovação']); n=await lanc(pg); t(n===1,'OC aguardando: 1 linha → '+n);
  await marca(pg,'ms-oc',[]); await marca(pg,'ms-nf',['Em branco']); n=await lanc(pg); t(n===4,'NF em branco: 4 linhas → '+n);
  await marca(pg,'ms-nf',['Lançada']); n=await lanc(pg); t(n===1,'NF lançada: 1 linha, robô fora → '+n);
  const c=await pg.evaluate(()=>$('ms-nf').querySelector('.ms-cnt').textContent); t(c==='1','contagem laranja no botão NF → '+c);
  await marca(pg,'ms-nf',[]);
  // busca pelo número (RC, OC ou NF), no cabeçalho dos lançamentos
  const busca=v=>pg.evaluate(v=>{const i=$('lanc-busca');i.value=v;i.dispatchEvent(new Event('input'));
    return {n:[...document.querySelectorAll('#tbl-lanc tbody tr')].filter(tr=>/Manuten/.test(tr.textContent)).length,sub:$('lanc-sub').textContent,
      vazio:(document.querySelector('#tbl-lanc .vazio')||{}).textContent||'',tot:$('lanc-total').textContent};},v);
  let s=await busca('24298'); t(s.n===1&&/^1 de 6/.test(s.sub),'busca RC 24298: 1 linha, "1 de 6" → '+JSON.stringify(s));
  s=await busca('4500771'); t(s.n===1,'busca OC sem o traço acha 4500-771 → '+s.n);
  s=await busca(' 3 '); t(s.n===2,'busca NF 3: as 2 linhas com NF 3 (a1 e o robô) → '+s.n);
  s=await busca('99999'); t(s.n===0&&/Nenhum lançamento com RC, OC ou NF/.test(s.vazio)&&!/lançar custo/.test(s.vazio),'sem resultado: aviso da busca → '+s.vazio);
  s=await busca(''); t(s.n===6&&/^6 lançamento/.test(s.sub),'busca vazia volta tudo → '+s.n);
  await pg.close();
}
for(const [w,h] of [[1366,768],[1600,900],[1920,1080]]) for(const tema of ['escuro','claro']){
  const pg=await abre(w,h,tema);
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{$('ms-contrato').style.display='';});   // em produção o Contrato aparece: 13 filtros
  const m=await pg.evaluate(()=>{const f=document.querySelector('.filtros'),tp=document.querySelector('.top'),r=f.getBoundingClientRect(),b=document.querySelector('.board').getBoundingClientRect();
    const btns=[...f.querySelectorAll('.ms-wrap')].filter(x=>x.offsetParent);const last=btns[btns.length-1].getBoundingClientRect();
    return {sw:f.scrollWidth,cw:f.clientWidth,right:last.right,bright:b.right,top:tp.scrollWidth<=tp.clientWidth+1,linhas:new Set(btns.map(x=>Math.round(x.getBoundingClientRect().top))).size,
      pg:document.documentElement.scrollWidth<=innerWidth,cab:(()=>{setVw('lanc');const c=$('lanc-busca').closest('.thead-row')||$('lanc-busca').closest('.card');const bt=$('add-lanc-btn').getBoundingClientRect(),bs=$('lanc-busca').closest('.busca-doc').getBoundingClientRect();return c.scrollWidth<=c.clientWidth+1&&Math.abs(bt.top-bs.top)<8&&bs.right<=bt.left;})(),tw:Math.round(document.querySelector('.tit-wrap').getBoundingClientRect().width),th:Math.round(document.querySelector('.tit-wrap').getBoundingClientRect().height),topH:Math.round(tp.getBoundingClientRect().height)};});
  t(m.sw<=m.cw+1&&m.right<=m.bright&&m.top&&m.linhas===1&&m.pg&&m.th<=60&&m.topH<=80&&m.cab,`${w}×${h} ${tema}: filtros numa linha, busca ao lado do botão, sem estourar → `+JSON.stringify(m));
  if(SHOT) await pg.screenshot({path:`${SHOT}/carta-filtros-${w}-${tema}.png`});
  await pg.close();
}
await b.close(); srv.close();
console.log(`${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
