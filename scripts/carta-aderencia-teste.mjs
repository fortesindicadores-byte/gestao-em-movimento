import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
// Teste da visão Aderência ao Processo da Carta de Custos (Chromium, banco dublado).
// CHART_JS = caminho do chart.umd.js 4.4.0 (o sandbox não alcança o CDN);
// DATALABELS = caminho do chartjs-plugin-datalabels 2.2.0 (o painel o registra); SHOT_DIR salva um print por tela/tema.
const CHART_JS=process.env.CHART_JS, DL=process.env.DATALABELS, SHOT=process.env.SHOT_DIR, ROOT=process.cwd();
if(!CHART_JS||!DL){ console.error('defina CHART_JS e DATALABELS'); process.exit(2); }
const srv=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  if(!fs.existsSync(f)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html'});r.end(fs.readFileSync(f));}).listen(0);
const port=srv.address().port;
// fixture: PLT set/26 — 6 manuais em etapas diferentes + 1 linha do robô (deve ficar fora)
const L=(id,o)=>Object.assign({id,origem:null,unidade:'PLT',vigencia:'2026-10',pacote:'Manutenção',data:'2026-10-02',projeto:'ROTA',equipamento:'X',fornecedor:'F',conta:'Manutenção de Veículos e Equip.',grupo:'Motor',descricao:'d',valor:100,rc:'',oc:'',nf:'',aprovado:false,aprovado_oc:false},o);
const ROWS=[
  L('a',{rc:'1',valor:100}),                                        // RC aguardando
  L('b',{rc:'2',aprovado:true,valor:200}),                          // OC não lançada
  L('c',{rc:'3',aprovado:true,oc:'9',valor:300,projeto:'APOIO'}),   // OC aguardando
  L('d',{rc:'N/A',aprovado:true,oc:'9',aprovado_oc:true,valor:400}),// NF não lançada
  L('e',{rc:'5',aprovado:true,oc:'9',aprovado_oc:true,nf:'77',valor:500}), // concluído
  L('f',{rc:'6',aprovado:true,oc:'9',aprovado_oc:true,nf:'78',valor:600,projeto:'APOIO'}), // concluído
  L('g',{origem:'contratos-planilha',rc:'N/A',aprovado:true,oc:'',aprovado_oc:true,nf:'1',valor:9999}),
];
const init=`(()=>{const R=${JSON.stringify(ROWS)};
 const q=(t)=>{const o={_t:t,select(){return o},in(){return o},eq(){return o},order(){return o},range(){return o},gte(){return o},lte(){return o},neq(){return o},limit(){return o},
   maybeSingle(){return Promise.resolve({data:t==='fca_profiles'?{is_admin:true,unidade:''}:null,error:null})},single(){return o.maybeSingle()},
   then(res,rej){return Promise.resolve({data:t==='carta_custos'?R:[],error:null,count:0}).then(res,rej)}};return o;};
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u',email:'x@y.z',user_metadata:{nome:'Teste'}}}}}),onAuthStateChange(){}},from:q})};
 try{localStorage.setItem('bi_theme',window.__tema||'escuro')}catch(e){}
})();`;
let ok=0,fail=0;const t=(c,m)=>{c?ok++:fail++;console.log((c?'ok  ':'FALHA ')+m);};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
for(const [w,h] of [[1366,768],[1600,900],[1920,1080]]){
 for(const tema of ['escuro','claro']){
  const pg=await b.newPage({viewport:{width:w,height:h}});
  pg.on('pageerror',e=>console.log('pageerror',e.message));
  await pg.route(/supabase-js/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.route(/chart\.umd/,r=>r.fulfill({path:CHART_JS}));
  await pg.route(/datalabels/,r=>DL?r.fulfill({path:DL}):r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.route(/fonts\.g|html2canvas|jspdf|xlsx/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.addInitScript(`window.__tema=${JSON.stringify(tema)};`+init);
  await pg.goto(`http://localhost:${port}/carta-custos/`);
  await pg.waitForTimeout(800);
  await pg.evaluate(()=>{ if(window.__tema==='claro') document.body.classList.add('claro'); setVw('ader'); });
  await pg.waitForTimeout(600);
  const r=await pg.evaluate(()=>{
    const q=s=>document.querySelector(s);
    const vw=q('#vw-ader'); const tw=q('#vw-ader .twrap');
    const cards=[...document.querySelectorAll('#ad-kpis .kpi')].map(k=>[k.querySelector('.kl').textContent,k.querySelector('.kv').textContent,k.querySelector('.km').textContent]);
    const rows=[...document.querySelectorAll('#tbl-ader tbody tr')].map(tr=>[...tr.cells].map(c=>c.textContent));
    const tot=[...document.querySelectorAll('#tbl-ader tfoot td')].map(c=>c.textContent);
    return {tit:q('#tit').textContent,hval:q('#ad-hval').textContent,hdel:q('#ad-hdel').textContent,cards,rows,tot,
      semGrafico:!q('#ch-ader'), tabW:q('#vw-ader .ad-tab').getBoundingClientRect().width, vwW:vw.clientWidth,
      vwScroll:vw.scrollHeight-vw.clientHeight, twH:tw.scrollWidth-tw.clientWidth, twV:tw.scrollHeight-tw.clientHeight,
      bodyScroll:document.documentElement.scrollHeight-innerHeight, tabH:tw.clientHeight,
      kpiH:q('#ad-kpis .kpi').getBoundingClientRect().height};
  });
  const tag=`${w}x${h} ${tema}`;
  if(w===1366&&tema==='escuro'){
    t(r.tit==='Aderência ao Processo','título da visão');
    t(r.hval==='33.3%','hero: 2 de 6 concluídos = 33.3% (robô fora) → '+r.hval);
    t(/Lançamentos6/.test(r.hdel)&&/Concluídos2/.test(r.hdel),'hero: 6 lançamentos, 2 concluídos');
    t(JSON.stringify(r.cards.map(c=>c[1]))===JSON.stringify(['83.3%','66.7%','50.0%','33.3%']),'cards RC aprov/OC lanç/OC aprov/NF = '+r.cards.map(c=>c[1]));
    t(/1 aguardando/.test(r.cards[0][2])&&/4 sem NF/.test(r.cards[3][2]),'rodapé dos cards');
    t(r.semGrafico,'sem o gráfico "Onde o processo está"');
    t(Math.abs(r.tabW-r.vwW)<=2,'tabela com a largura toda da visão');
    t(r.rows[0][8]==='50.0%'&&r.rows[1][8]==='75.0%','aderência média por linha (ROTA 8/16, APOIO 6/8): '+r.rows.map(x=>x[8]));
    t(r.tot[8]==='58.3%','aderência média do total = 14/24 → '+r.tot[8]);
    t(r.rows.length===2&&r.rows[0][0]==='ROTA'&&r.rows[0][1]==='4','tabela por projeto (uma unidade): '+JSON.stringify(r.rows));
    t(r.rows[1][0]==='APOIO'&&r.rows[1][6]==='50.0%','APOIO: NF 1 de 2');
    t(r.tot[0]==='Total'&&r.tot[1]==='6'&&r.tot[7]===(4*0+1000).toLocaleString('pt-BR'),'total: 6 lanç., sem NF R$ 1.000 → '+r.tot);
  }
  t(r.vwScroll<=1&&r.bodyScroll<=1,tag+': sem rolagem (visão '+r.vwScroll+', página '+r.bodyScroll+')');
  t(r.twH<=1,tag+': tabela sem barra horizontal ('+r.twH+')');
  t(r.tabH>=150,tag+': tabela com altura ('+r.tabH+'px), card '+Math.round(r.kpiH)+'px');
  if(SHOT) await pg.screenshot({path:`${SHOT}/ader-${w}-${tema}.png`});
  await pg.close();
 }
}
// várias unidades: tabela por unidade
{
  const pg=await b.newPage({viewport:{width:1600,height:900}});
  await pg.route(/supabase-js/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.route(/chart\.umd/,r=>r.fulfill({path:CHART_JS}));
  await pg.route(/datalabels|fonts\.g|html2canvas|jspdf|xlsx/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.addInitScript(init);
  await pg.goto(`http://localhost:${port}/carta-custos/`); await pg.waitForTimeout(800);
  const r=await pg.evaluate(()=>{ selUni.add('GRL'); setVw('ader'); render();
    return document.querySelector('#tbl-ader thead th').textContent; });
  t(r==='Unidade','com 2 unidades a tabela abre por unidade');
  const pdf=await pg.evaluate(()=>Object.values(TIT));
  t(pdf.includes('Aderência ao Processo'),'visão entra no PDF (TIT)');
  await pg.close();
}
// janela que diminui: os gráficos do Resumo têm de encolher junto (com 1fr o
// canvas prendia a coluna e o 3º card saía da tela — Renan, 07/10/2026)
{
  const pg=await b.newPage({viewport:{width:2200,height:919}});
  await pg.route(/supabase-js/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.route(/chart\.umd/,r=>r.fulfill({path:CHART_JS}));
  await pg.route(/datalabels|fonts\.g|html2canvas|jspdf|xlsx/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.addInitScript(init);
  await pg.goto(`http://localhost:${port}/carta-custos/`); await pg.waitForTimeout(900);
  await pg.setViewportSize({width:1890,height:919}); await pg.waitForTimeout(900);
  const r=await pg.evaluate(()=>{const v=document.querySelector('#vw-resumo');return v.scrollWidth-v.clientWidth;});
  t(r<=1,'Resumo: janela de 2200 para 1890 px sem barra horizontal ('+r+')');
  await pg.close();
}
await b.close(); srv.close();
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
