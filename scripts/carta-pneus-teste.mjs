import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
// Teste do pacote Pneus na Carta de Custos (Chromium, banco dublado):
// filtro Pacote, contas e grupos da caixa por conta, Pneus Novos com o grupo
// travado, busca no menu de grupos, gravação com o pacote certo e o Resumo
// com um bloco por pacote sem rolar a página.
// CHART_JS = chart.umd.js 4.4.0 · DATALABELS = chartjs-plugin-datalabels 2.2.0 · SHOT_DIR salva prints.
const CHART_JS=process.env.CHART_JS, DL=process.env.DATALABELS, SHOT=process.env.SHOT_DIR, ROOT=process.cwd();
if(!CHART_JS||!DL){ console.error('defina CHART_JS e DATALABELS'); process.exit(2); }
const srv=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';
  if(!fs.existsSync(f)){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':'text/html'});r.end(fs.readFileSync(f));}).listen(0);
const port=srv.address().port;
const L=(id,o)=>Object.assign({id,origem:null,unidade:'PLT',vigencia:'2026-10',pacote:'Manutenção',data:'2026-10-02',projeto:'ROTA',equipamento:'X',fornecedor:'F',conta:'Manutenção de Veículos e Equip.',grupo:'Motor',descricao:'d',valor:100,rc:'1',oc:'2',nf:'3',aprovado:true,aprovado_oc:true},o);
const ROWS=[
  L('m1',{valor:1000}),
  L('m2',{conta:'Lavação de Veículos',grupo:'Lavação',valor:200}),
  L('p1',{pacote:'Pneus',conta:'Pneus Novos',grupo:'Pneus Novos',valor:3000}),
  L('p2',{pacote:'Pneus',conta:'Recapagens e Outros Serviços',grupo:'Recapagens',valor:400}),
  L('p3',{pacote:null,conta:'Recapagens e Outros Serviços',grupo:'Rodízio',valor:50}),   // linha sem pacote: a conta decide
];
const init=`(()=>{const R=${JSON.stringify(ROWS)}; window.__ins=[];
 const q=(t)=>{const o={_t:t,select(){return o},in(){return o},eq(){return o},order(){return o},range(){return o},gte(){return o},lte(){return o},neq(){return o},limit(){return o},
   insert(p){window.__ins.push(p);return {select(){return {single(){return Promise.resolve({data:Object.assign({id:'novo'+window.__ins.length},p),error:null})}}}}},
   maybeSingle(){return Promise.resolve({data:t==='fca_profiles'?{is_admin:true,unidade:''}:null,error:null})},single(){return o.maybeSingle()},
   then(res,rej){return Promise.resolve({data:t==='carta_custos'?R:[],error:null,count:0}).then(res,rej)}};return o;};
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u',email:'x@y.z',user_metadata:{nome:'Teste'}}}}}),onAuthStateChange(){}},from:q})};
 try{localStorage.setItem('bi_theme',window.__tema||'escuro')}catch(e){}
 window.alert=()=>{};
})();`;
let ok=0,fail=0;const t=(c,m)=>{c?ok++:fail++;console.log((c?'ok  ':'FALHA ')+m);};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
async function abre(w,h,tema){
  const pg=await b.newPage({viewport:{width:w,height:h}});
  pg.on('pageerror',e=>{console.log('pageerror',e.message);fail++;});
  await pg.route(/supabase-js/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.route(/chart\.umd/,r=>r.fulfill({path:CHART_JS}));
  await pg.route(/datalabels/,r=>r.fulfill({path:DL}));
  await pg.route(/fonts\.g|html2canvas|jspdf|xlsx/,r=>r.fulfill({body:'',contentType:'text/javascript'}));
  await pg.addInitScript(`window.__tema=${JSON.stringify(tema||'escuro')};`+init);
  await pg.goto(`http://localhost:${port}/carta-custos/`);
  await pg.waitForTimeout(900);
  if(tema==='claro') await pg.evaluate(()=>document.body.classList.add('claro'));
  return pg;
}
const tabela=pg=>pg.evaluate(()=>[...document.querySelectorAll('#tbl-conta tbody tr')].map(tr=>[tr.cells[0].textContent,tr.cells[3].textContent]));

// 1 · Resumo com os dois pacotes, e o filtro Pacote
{
  const pg=await abre(1600,900);
  let r=await tabela(pg);
  const nomes=r.map(x=>x[0]);
  t(nomes.includes('Total Manutenção')&&nomes.includes('Total Pneus')&&nomes[nomes.length-1]==='Total Geral','Resumo: blocos Manutenção, Pneus e Total Geral → '+nomes.join(' | '));
  t(nomes.indexOf('Pneus Novos')>nomes.indexOf('Total Manutenção')&&nomes.indexOf('Recapagens e Outros Serviços')<nomes.indexOf('Total Pneus'),'contas de Pneus dentro do bloco Pneus');
  const v=n=>(r.find(x=>x[0]===n)||[])[1];
  t(v('Total Pneus')==='3.450'&&v('Recapagens e Outros Serviços')==='450','Pneus real 3.450 (linha sem pacote entra pela conta) → '+v('Total Pneus'));
  t(v('Total Manutenção')==='1.200'&&v('Total Geral')==='4.650','Manutenção 1.200, Total Geral 4.650 → '+v('Total Manutenção')+' / '+v('Total Geral'));
  const pac=await pg.evaluate(()=>[...document.querySelectorAll('#ms-pac .ms-opt')].map(o=>o.textContent.replace('só','').trim()));
  t(JSON.stringify(pac)===JSON.stringify(['Todos','MANUTENÇÃO','PNEUS']),'filtro Pacote com Manutenção e Pneus → '+pac);
  await pg.evaluate(()=>{selPac.add('Pneus');render();setVw('lanc');});
  r=await tabela(pg);
  t(r.map(x=>x[0]).join('|')==='Pneus Novos|Recapagens e Outros Serviços|Total Pneus','Pacote = Pneus: só o bloco Pneus, sem Total Geral → '+r.map(x=>x[0]).join('|'));
  const lanc=await pg.evaluate(()=>[...document.querySelectorAll('#tbl-lanc tbody tr')].length);
  t(lanc===3,'Pacote = Pneus: lançamentos só de pneus ('+lanc+')');
  // a caixa com o filtro em Pneus
  await pg.evaluate(()=>abrirLanc(''));
  let m=await pg.evaluate(()=>({contas:[...document.querySelectorAll('#f-conta option')].map(o=>o.value),conta:$('f-conta').value,grupo:$('f-grupo').value,fixo:$('f-grupo').classList.contains('fixo')}));
  t(JSON.stringify(m.contas)===JSON.stringify(['Pneus Novos','Recapagens e Outros Serviços']),'caixa com Pacote = Pneus: só as contas de pneus → '+m.contas);
  t(m.conta==='Pneus Novos'&&m.grupo==='Pneus Novos'&&m.fixo,'Pneus Novos: grupo "Pneus Novos" automático e travado');
  await pg.click('#f-grupo'); await pg.waitForTimeout(100);
  t(!(await pg.evaluate(()=>document.querySelector('#ac-grupo').classList.contains('open'))),'Pneus Novos: o menu de grupos não abre');
  // troca para Recapagens: grupo limpa e o menu traz os grupos de pneus
  await pg.selectOption('#f-conta','Recapagens e Outros Serviços');
  m=await pg.evaluate(()=>({grupo:$('f-grupo').value,fixo:$('f-grupo').classList.contains('fixo')}));
  t(m.grupo===''&&!m.fixo,'Recapagens: o grupo travado sai e o campo fica vazio');
  await pg.click('#f-grupo'); await pg.waitForTimeout(150);
  m=await pg.evaluate(()=>({open:document.querySelector('#ac-grupo').classList.contains('open'),foco:document.activeElement&&document.activeElement.placeholder,
    busca:!!document.querySelector('#ac-grupo .ms-search input'),itens:[...document.querySelectorAll('#ac-grupo .ac-opt')].map(o=>o.textContent)}));
  t(m.open&&m.busca&&m.foco==='Pesquisar…','menu abre com a busca no topo e o cursor nela');
  t(m.itens[0]==='Recapagens'&&m.itens.includes('Rodízio')&&!m.itens.includes('Motor')&&!m.itens.includes('Pneus Novos'),'Recapagens: só grupos de pneus ('+m.itens.length+') → '+m.itens.join(', '));
  await pg.keyboard.type('rod'); await pg.waitForTimeout(80);
  m=await pg.evaluate(()=>[...document.querySelectorAll('#ac-grupo .ac-opt')].map(o=>o.textContent));
  t(JSON.stringify(m)===JSON.stringify(['Rodízio']),'busca "rod" (sem acento) acha Rodízio → '+m);
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(80);
  m=await pg.evaluate(()=>({g:$('f-grupo').value,open:document.querySelector('#ac-grupo').classList.contains('open'),mod:$('mbg').classList.contains('open')}));
  t(m.g==='Rodízio'&&!m.open&&m.mod,'Enter escolhe, fecha só o menu e a caixa continua aberta');
  // salvar grava o pacote Pneus
  await pg.fill('#f-rc','55'); await pg.fill('#f-valor','123,45');
  await pg.evaluate(()=>salvarLancModal()); await pg.waitForTimeout(200);
  const ins=await pg.evaluate(()=>window.__ins[0]);
  t(ins&&ins.pacote==='Pneus'&&ins.conta==='Recapagens e Outros Serviços'&&ins.grupo==='Rodízio','gravado com pacote Pneus → '+JSON.stringify(ins&&{pacote:ins.pacote,conta:ins.conta,grupo:ins.grupo}));
  await pg.close();
}
// 2 · sem filtro: as duas listas na caixa, grupos de Manutenção, texto livre, Esc
{
  const pg=await abre(1600,900);
  await pg.evaluate(()=>abrirLanc(''));
  let m=await pg.evaluate(()=>({gr:[...document.querySelectorAll('#f-conta optgroup')].map(g=>g.label),conta:$('f-conta').value,fixo:$('f-grupo').classList.contains('fixo')}));
  t(JSON.stringify(m.gr)===JSON.stringify(['Manutenção','Pneus'])&&m.conta==='Manutenção de Veículos e Equip.'&&!m.fixo,'sem filtro: contas agrupadas Manutenção · Pneus, nasce na 1ª de Manutenção');
  await pg.click('#f-grupo'); await pg.waitForTimeout(120);
  m=await pg.evaluate(()=>[...document.querySelectorAll('#ac-grupo .ac-opt')].map(o=>o.textContent));
  t(m.length===39&&m.includes('Motor')&&!m.includes('Recapagens'),'conta de Manutenção: os 39 grupos de Manutenção, nenhum de pneus');
  await pg.keyboard.type('frio'); await pg.waitForTimeout(80);
  m=await pg.evaluate(()=>[...document.querySelectorAll('#ac-grupo .ac-opt')].length);
  t(m===5,'busca "frio" → 5 grupos');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(80);
  m=await pg.evaluate(()=>({open:document.querySelector('#ac-grupo').classList.contains('open'),mod:$('mbg').classList.contains('open'),g:$('f-grupo').value}));
  t(!m.open&&m.mod&&m.g==='','Esc fecha só o menu, sem escolher');
  await pg.click('#f-grupo'); await pg.keyboard.type('Xpto livre'); await pg.waitForTimeout(80);
  m=await pg.evaluate(()=>document.querySelector('#ac-grupo .ac-vazio')&&document.querySelector('#ac-grupo .ac-vazio').textContent);
  t(/Enter usa/.test(m||''),'sem grupo que case, o menu diz que Enter usa o texto');
  await pg.keyboard.press('Enter');
  t(await pg.evaluate(()=>$('f-grupo').value)==='Xpto livre','texto livre continua valendo');
  await pg.selectOption('#f-conta','Lavação de Veículos');
  t(await pg.evaluate(()=>$('f-grupo').value)==='Xpto livre','trocar de conta dentro do mesmo pacote mantém o grupo');
  await pg.close();
}
// 3 · trocar de Manutenção para Pneus limpa grupo de Manutenção; filtro Conta decide
{
  const pg=await abre(1600,900);
  await pg.evaluate(()=>abrirLanc(''));
  await pg.click('#f-grupo'); await pg.keyboard.type('motor'); await pg.keyboard.press('Enter');
  await pg.selectOption('#f-conta','Recapagens e Outros Serviços');
  t(await pg.evaluate(()=>$('f-grupo').value)==='','Motor some ao trocar para conta de pneus');
  await pg.evaluate(()=>fecharLanc());
  await pg.evaluate(()=>{selConta.add('Pneus Novos');render();abrirLanc('');});
  const m=await pg.evaluate(()=>({contas:[...document.querySelectorAll('#f-conta option')].map(o=>o.value),conta:$('f-conta').value,g:$('f-grupo').value}));
  t(m.contas.length===2&&m.conta==='Pneus Novos'&&m.g==='Pneus Novos','filtro Conta = Pneus Novos: caixa nasce nela, só contas de pneus');
  await pg.evaluate(()=>fecharLanc());
  // editar um lançamento de Manutenção com o filtro em Pneus: a conta dele continua
  await pg.evaluate(()=>{selConta.clear();selPac.add('Pneus');abrirLanc('m1');});
  const e=await pg.evaluate(()=>({conta:$('f-conta').value,g:$('f-grupo').value}));
  t(e.conta==='Manutenção de Veículos e Equip.'&&e.g==='Motor','editar lançamento de Manutenção mantém conta e grupo');
  await pg.close();
}
// 4 · Resumo com os dois pacotes sem rolar
for(const [w,h] of [[1366,768],[1600,900],[1920,1080]]) for(const tema of ['escuro','claro']){
  const pg=await abre(w,h,tema);
  const r=await pg.evaluate(()=>{const v=document.querySelector('#vw-resumo'),g=document.querySelector('#vw-resumo .gr3');
    return {vs:v.scrollHeight-v.clientHeight,bs:document.documentElement.scrollHeight-innerHeight,hs:v.scrollWidth-v.clientWidth,gh:g.getBoundingClientRect().height};});
  t(r.vs<=1&&r.bs<=1&&r.hs<=1,`${w}x${h} ${tema}: Resumo sem rolagem (v ${r.vs} · pág ${r.bs} · h ${r.hs}), gráficos ${Math.round(r.gh)}px`);
  if(SHOT) await pg.screenshot({path:`${SHOT}/pneus-resumo-${w}-${tema}.png`});
  if(SHOT&&w===1600&&tema==='escuro'){ await pg.evaluate(()=>abrirLanc('')); await pg.selectOption('#f-conta','Recapagens e Outros Serviços'); await pg.click('#f-grupo'); await pg.waitForTimeout(150); await pg.screenshot({path:`${SHOT}/pneus-menu.png`}); }
  await pg.close();
}
await b.close(); srv.close();
console.log(`\n${ok} ok · ${fail} falha(s)`); process.exit(fail?1:0);
