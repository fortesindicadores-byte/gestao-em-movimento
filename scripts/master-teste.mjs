// Gerenciar Acessos · aba Master (hub): roda o index.html com o Supabase dublado e confere
// a aba, a lista e as chamadas master_* que cada botão manda. node scripts/master-teste.mjs (SHOTS=<pasta>)
import { chromium } from 'playwright';
import path from 'path';
const RAIZ = process.cwd(), SHOTS = process.env.SHOTS;
const U = [
  { id:'a1', email:'andre.pompeu@conlogsa.com.br', nome:'ANDRÉ POMPEU', telefone:'21999990000', criado:'2026-10-15T12:00:00Z', confirmado:null, ultimo:null, status:null, unidade:null, admin:false, master:false, sessoes:0 },
  { id:'r1', email:'fortesindicadores@gmail.com', nome:'RENAN', telefone:null, criado:'2026-01-01T12:00:00Z', confirmado:'2026-01-01T12:00:00Z', ultimo:'2026-10-16T12:00:00Z', status:'approved', unidade:null, admin:true, master:true, sessoes:2 },
  { id:'g1', email:'gestor@conlogsa.com.br', nome:'GESTOR PIR', telefone:null, criado:'2026-03-01T12:00:00Z', confirmado:'2026-03-01T12:00:00Z', ultimo:'2026-10-10T12:00:00Z', status:'approved', unidade:'PIR', admin:false, master:false, sessoes:1 },
];
const mock = master => `window.__rpc=[];window.supabase={createClient(){
 const D={user_approvals:[],fca_profiles:[]};
 const q=t=>{const o={_d:(D[t]||[]).slice(),select(){return o},order(){return o},eq(){return o},in(){return o},limit(){return o},
  update(){return o},upsert(){return o},single(){return o},maybeSingle(){return o},then(r,j){return Promise.resolve({data:o._d,error:null}).then(r,j)}};return o};
 const R={master_eu:()=>${master},master_usuarios:()=>${JSON.stringify(U)},master_senha:a=>a.p_senha||'Gx7kPq2mZr',
  master_criar:a=>({id:'n1',senha:a.p_senha||'Nv4bTt9wQe'}),master_encerrar:()=>2,
  master_altera:a=>a.p_dados.email==='gestor@conlogsa.com.br'?{__err:'Já existe um cadastro com o e-mail gestor@conlogsa.com.br.'}:null};
 return {from:q,rpc:async(n,a)=>{window.__rpc.push([n,a]);const f=R[n];const v=f?f(a||{}):null;
   if(v&&v.__err) return {data:null,error:{message:v.__err}}; return {data:v,error:null}},
  channel(){return{on(){return this},subscribe(){return this}}},removeChannel(){},
  auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},getUser:async()=>({data:{user:null}})},
  functions:{invoke:async()=>({})}}}};`;
const b = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
let ok = 0, falha = 0;
const ck = (c, m) => { if (c) { ok++; console.log('ok  ', m); } else { falha++; console.log('FALHA', m); } };
async function abre(master, W = 1366, H = 768, tema = 'escuro') {
  const pg = await b.newPage({ viewport: { width: W, height: H } });
  pg.on('pageerror', e => console.log('pageerror', e.message));
  await pg.route('**/*', r => { const u = r.request().url();
    if (u.includes('supabase-js')) return r.fulfill({ body: mock(master), contentType: 'text/javascript' });
    if (u.startsWith('file:')) return r.continue();
    return r.fulfill({ status: 404, body: '' }); });
  await pg.addInitScript(t => localStorage.setItem('bi_theme', t === 'claro' ? 'light' : 'dark'), tema);
  await pg.goto('file://' + path.join(RAIZ, 'index.html'));
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { currentUser = { email: 'renan@x', user_metadata: { name: 'Renan' } }; showAdmin(); });
  await pg.waitForTimeout(300);
  return pg;
}
const rpcs = pg => pg.evaluate(() => window.__rpc.map(x => x[0]));
const ultimo = (pg, n) => pg.evaluate(n => { const a = window.__rpc.filter(x => x[0] === n); return a.length ? a[a.length - 1][1] : null; }, n);

// 1. quem não é Master não vê a aba e nem chama a lista
{ const pg = await abre(false);
  const vis = await pg.evaluate(() => getComputedStyle(document.getElementById('atab-master')).display);
  ck(vis === 'none', `sem Master: aba escondida (${vis})`);
  ck(!(await rpcs(pg)).includes('master_usuarios'), 'sem Master: não pede master_usuarios');
  await pg.close(); }

// 2. Master: aba, lista, novo, editar, senha, liberar, encerrar
for (const [W, H, tema] of [[1366, 768, 'escuro'], [1920, 1080, 'claro']]) {
  const pg = await abre(true, W, H, tema);
  const vis = await pg.evaluate(() => getComputedStyle(document.getElementById('atab-master')).display);
  ck(vis !== 'none', `${W}: Master vê a aba`);
  await pg.click('#atab-master');
  const l = await pg.evaluate(() => { const t = document.querySelector('#admin-users-list table.mst-tbl'); const m = document.querySelector('.adm-main');
    return { n: t ? t.tBodies[0].rows.length : 0, cnt: document.getElementById('admin-cnt-master').textContent,
      bar: document.querySelector('.mst-bar span').textContent, sx: m.scrollWidth > m.clientWidth + 1,
      andre: t ? t.tBodies[0].rows[0].cells[1].textContent : '' }; });
  ck(l.n === 3 && l.cnt === '3', `${W}: lista com os 3 cadastros (${l.n}, contagem ${l.cnt})`);
  ck(l.bar.includes('1 sem e-mail confirmado') && l.bar.includes('1 sem aprovação'), `${W}: resumo ${l.bar}`);
  ck(l.andre.includes('Sem aprovação') && l.andre.includes('E-mail não confirmado'), `${W}: André aparece travado (${l.andre})`);
  ck(!l.sx, `${W}: sem rolagem horizontal`);
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/master-lista-${W}-${tema}.png` });
  // busca
  await pg.evaluate(() => onAdminSearch('andre'));
  ck(await pg.evaluate(() => document.querySelectorAll('.mst-tbl tbody tr').length) === 1, `${W}: busca filtra`);
  await pg.evaluate(() => onAdminSearch(''));

  // editar o André
  await pg.click('.mst-tbl tbody tr[data-id="a1"] button');
  const m = await pg.evaluate(() => { const c = document.querySelector('#mdl-master .mdl-cx').getBoundingClientRect();
    return { vis: document.getElementById('mdl-master').style.display, nome: document.getElementById('mst-nome').value,
      ops: document.getElementById('mst-ops').style.display, cabe: c.bottom <= innerHeight && c.top >= 0 }; });
  ck(m.vis === 'flex' && m.nome === 'ANDRÉ POMPEU' && m.ops === '', `${W}: Editar abre com os dados`);
  ck(m.cabe, `${W}: caixa cabe na tela`);
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/master-caixa-${W}-${tema}.png` });
  await pg.click('text=Liberar cadastro');
  await pg.waitForTimeout(100);
  ck((await ultimo(pg, 'master_liberar'))?.p_user === 'a1', `${W}: Liberar chama master_liberar(a1)`);
  await pg.click('text=Gerar senha nova');
  await pg.waitForTimeout(100);
  const g = await pg.evaluate(() => ({ v: document.getElementById('mst-senha-v').textContent, d: document.getElementById('mst-senha').style.display }));
  ck((await ultimo(pg, 'master_senha'))?.p_senha === null && g.v === 'Gx7kPq2mZr' && g.d === '', `${W}: Gerar senha mostra a senha nova (${g.v})`);
  await pg.fill('#mst-pass', '123');
  await pg.click('text=Definir senha');
  ck((await pg.evaluate(() => document.getElementById('mst-st').textContent)).includes('6 caracteres'), `${W}: senha curta recusada na tela`);
  await pg.fill('#mst-pass', 'Conlog2026');
  await pg.click('text=Definir senha');
  await pg.waitForTimeout(100);
  ck((await ultimo(pg, 'master_senha'))?.p_senha === 'Conlog2026', `${W}: Definir senha manda a digitada`);
  // salvar: só o que mudou
  await pg.fill('#mst-tel', '21988887777'); await pg.fill('#mst-uni', 'cba t1, mcc t2'); await pg.check('#mst-master');
  await pg.click('#mst-salvar'); await pg.waitForTimeout(100);
  const alt = await ultimo(pg, 'master_altera'), def = await ultimo(pg, 'master_define');
  ck(alt && alt.p_dados.telefone === '21988887777' && alt.p_dados.unidade === 'cba t1, mcc t2' && !('nome' in alt.p_dados) && !('email' in alt.p_dados),
    `${W}: Salvar manda só o que mudou (${JSON.stringify(alt && alt.p_dados)})`);
  ck(alt && alt.p_dados.status === 'approved', `${W}: depois de Liberar a situação vai como Ativo`);
  ck(def && def.p_user === 'a1' && def.p_master === true, `${W}: Master marcado chama master_define`);
  // e-mail repetido: erro do banco aparece
  await pg.fill('#mst-email', 'gestor@conlogsa.com.br'); await pg.click('#mst-salvar'); await pg.waitForTimeout(100);
  const st = await pg.evaluate(() => ({ t: document.getElementById('mst-st').textContent, e: document.getElementById('mst-st').classList.contains('err') }));
  ck(st.e && st.t.includes('Já existe'), `${W}: erro do banco aparece (${st.t})`);
  // encerrar
  pg.once('dialog', d => d.accept());
  await pg.click('text=Encerrar sessões'); await pg.waitForTimeout(150);
  ck((await ultimo(pg, 'master_encerrar'))?.p_user === 'a1', `${W}: Encerrar chama master_encerrar`);
  await pg.evaluate(() => fechaMaster());

  // novo usuário
  await pg.click('text=+ Novo usuário');
  const nv = await pg.evaluate(() => ({ t: document.getElementById('mst-tit').textContent, ops: document.getElementById('mst-ops').style.display,
    sn: document.getElementById('mst-senha-nova').style.display }));
  ck(nv.t === 'Novo usuário' && nv.ops === 'none' && nv.sn === '', `${W}: Novo usuário abre limpo`);
  await pg.click('#mst-salvar'); await pg.waitForTimeout(80);
  ck((await pg.evaluate(() => document.getElementById('mst-st').textContent)).includes('nome e e-mail'), `${W}: novo sem nome/e-mail recusado`);
  await pg.fill('#mst-nome', 'João Silva'); await pg.fill('#mst-email', 'joao@conlogsa.com.br'); await pg.fill('#mst-uni', 'PIR');
  await pg.click('#mst-salvar'); await pg.waitForTimeout(150);
  const cr = await ultimo(pg, 'master_criar');
  const sv = await pg.evaluate(() => ({ v: document.getElementById('mst-senha-v').textContent, st: document.getElementById('mst-st').textContent,
    ops: document.getElementById('mst-ops').style.display }));
  ck(cr && cr.p_email === 'joao@conlogsa.com.br' && cr.p_nome === 'João Silva' && cr.p_unidade === 'PIR' && cr.p_senha === null, `${W}: master_criar com os campos`);
  ck(sv.v === 'Nv4bTt9wQe' && sv.st.includes('criado') && sv.ops === '', `${W}: senha do novo aparece e a caixa vira edição`);
  await pg.evaluate(() => fechaMaster());
  // volta para Pendentes sem quebrar a grade
  await pg.click('#atab-pending');
  ck(await pg.evaluate(() => !document.querySelector('.mst-tbl')), `${W}: outra aba some com a lista Master`);
  await pg.close();
}

// 3. celular: lista sem colunas extras
{ const pg = await abre(true, 390, 800);
  await pg.evaluate(() => switchAdminTab('master'));
  const r = await pg.evaluate(() => { const m = document.querySelector('.adm-main');
    return { sx: m.scrollWidth > m.clientWidth + 1, hide: getComputedStyle(document.querySelector('.mst-tbl th.mst-hide')).display }; });
  ck(!r.sx && r.hide === 'none', `celular: cabe sem rolagem lateral (${r.hide})`);
  await pg.close(); }

await b.close();
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);
