// ============================================================
// DISPONIBILIDADE · a tela mostra a base do APP, e diz qual base é
//
// Contexto (19/09/2026): o app de Indisponibilidade entrou em 14/08 e as
// unidades lançam nele, mas o Gestão à Vista continuou lendo as abas do
// Consolidado Geral por 36 dias. Medido no dia: 59 placas na planilha × 61
// eventos no banco, SEIS em comum — a tela mostrava uma base e a unidade
// escrevia na outra, sem nada na tela denunciando a diferença.
//
// O teste roda os DOIS LADOS, como o do Frota de Elite: banco respondendo e
// banco falhando. Um teste que só exercita o caminho bom não prova que a
// reserva funciona — e é a reserva que decide se o painel abre zerado.
//
// O código sob teste é o farol-core.js de verdade (loadDisp → loadDispBanco
// / loadDispSheet → renderDisp), num harness mínimo: o gate e a casca do
// Gestão à Vista não participam da troca de fonte.
//
// Uso: node scripts/disp-fonte-teste.mjs
// ============================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;

/* ---------- o que cada lado devolve ---------- */
// eventos abertos, como o app grava (unidade JÁ é o código do portal)
// 'ontem' em BRT, para o teste não envelhecer (a fixture tinha 18/09 fixo)
const ONTEM=(()=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
const EVENTOS = [
  { unidade:'GRL', unidade_nome:'CDD GUARULHOS', projeto:'ROTA', placa:'CIS7492', modelo:'VW 17.190',
    grupo:'CORRETIVA', descricao_problema:'Troca de embreagem', local_manutencao:'EXTERNO',
    status:'Aguardando peça', data_parada:'2026-09-05', previsao_retorno:'2026-09-22',
    data_retorno:null, updated_at:'2026-09-19T15:43:57.000Z' },
  { unidade:'GRL', unidade_nome:'CDD GUARULHOS', projeto:'ROTA', placa:'RUR5G11', modelo:'VW 26.260',
    grupo:'PREVENTIVA', descricao_problema:'Revisão programada', local_manutencao:'INTERNO',
    status:'Em execução', data_parada:ONTEM, previsao_retorno:null,
    data_retorno:null, updated_at:'2026-09-19T12:10:00.000Z' },
  // ANG: a unidade que na planilha aparecia como "ANHANGUERA" e não casava
  { unidade:'ANG', unidade_nome:'ANHANGUERA', projeto:'ROTA', placa:'CNT2D51', modelo:'MB ATEGO',
    grupo:'SINISTRO', descricao_problema:'Colisão traseira', local_manutencao:'EXTERNO',
    status:'Em orçamento', data_parada:'2026-08-30', previsao_retorno:'2026-09-25',
    data_retorno:null, updated_at:'2026-09-17T14:37:57.000Z' },
  // empilhadeira: no banco o identificador é EMP0857; a planilha "mercosuliza"
  // e grava EMP0I57, o que fazia o MESMO veículo não casar entre os lados
  { unidade:'CBA T1', unidade_nome:'CUIABA EMPURRADA', projeto:'EMPURRADA', placa:'EMP0857',
    modelo:'HYSTER', grupo:'CORRETIVA', descricao_problema:'Vazamento hidráulico',
    local_manutencao:'INTERNO', status:'Em execução', data_parada:'2026-09-15',
    previsao_retorno:'2026-09-20', data_retorno:null, updated_at:'2026-09-18T15:04:33.000Z' },
];
// foto de ativos do pg_cron (só o denominador sai daqui)
const SNAP = [
  { data:'2026-09-19', unidade:'GRL',    ativos:120 },
  { data:'2026-09-19', unidade:'ANG',    ativos: 51 },
  { data:'2026-09-19', unidade:'CBA T1', ativos: 30 },
  { data:'2026-09-18', unidade:'GRL',    ativos:119 },   // dia anterior: não deve entrar
];
// a aba do Apps Script — UMA LINHA POR DIA (é o que infla o hero se a chave
// for mensal). 3 dias × 2 unidades.
const ABA_DISP = (() => {
  const rows = [];
  ['Date(2026,8,17)','Date(2026,8,18)','Date(2026,8,19)'].forEach(d => {
    rows.push([d, 'CDD GUARULHOS', 'ROTA', 'CAVALO', 120, 10]);
    rows.push([d, 'ANHANGUERA',    'ROTA', 'TRUCK',   51,  13]);
  });
  return { cols:['Data','Unidade','Projeto','Tipo Veículo','Ativos','Indisponíveis'], rows };
})();
const ABA_IND = { cols:['Data','Unidade','Projeto','Tipo Veículo','Placa Mercosul','Grupo','Descrição do Problema','Data Parada','Previsão Retorno','Status'],
  rows:[
    ['Date(2026,8,19)','CDD GUARULHOS','ROTA','CAVALO','RUR5G13','CORRETIVA','Motor','01/09/2026','30/09/2026','Parado'],
    ['Date(2026,8,19)','ANHANGUERA','ROTA','TRUCK','DWQ6D45','CORRETIVA','Freio','10/09/2026','','Parado'],
    ['Date(2026,8,18)','CDD GUARULHOS','ROTA','CAVALO','XXX1A11','CORRETIVA','Velha','01/09/2026','','Parado'],
  ] };

/* gviz JSONP, no formato que o farol-core consome */
const jsonp = (fn, T) => {
  const cols = T.cols.map(l => ({ label:l, id:l, type:'string' }));
  const rows = T.rows.map(r => ({ c: r.map(v => ({ v })) }));
  return `${fn}(${JSON.stringify({ status:'ok', table:{ cols, rows } })});`;
};

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="alvo"></div>
<script src="/harness-stub.js"></script>
<script src="/farol-frota/farol-core.js"></script>
<script>
  // o DATA do farol-core é ligação LÉXICA (const no topo): não fica no window.
  // Quem a enxerga é um script no mesmo escopo global — este.
  window.__pronto = (async () => {
    await loadDisp();
    renderDisp(document.getElementById('alvo'), null, true);
    window.__D = DATA;
    return true;
  })();
</script>
</body></html>`;

/* O stub do Supabase imita o encadeamento que o farol-core usa:
   from(t).select(c).is(...).limit(n)  e  from(t).select(c).order(...).limit(n).
   Cada um TEM de resolver como promessa no fim da cadeia. */
const stub = cenario => `
window.__cenario = ${JSON.stringify(cenario)};
window.supabase = { createClient: function(){
  return {
    auth: { getSession: () => Promise.resolve({ data:{ session:{ user:{ id:'u1' } } } }) },
    from: function(tab){
      const c = window.__cenario;
      const resp = () => {
        if (tab === 'indisponibilidade') {
          if (c.evErro)  return { data:null, error:{ message:'permission denied' } };
          return { data: c.eventos, error:null };
        }
        if (tab === 'disp_snapshot') {
          if (c.snapErro) return { data:null, error:{ message:'permission denied' } };
          return { data: c.snap, error:null };
        }
        return { data: [], error:null };
      };
      const o = {};
      ['select','is','limit','order','eq','in','gte','lte'].forEach(m => { o[m] = () => o; });
      o.maybeSingle = () => Promise.resolve({ data:null, error:null });
      o.then = (res, rej) => Promise.resolve(resp()).then(res, rej);
      return o;
    },
  };
}};`;

let ok = 0, ruim = 0;
const af = (c, t, d) => { if (c) { ok++; console.log('  ok   ' + t); }
  else { ruim++; console.log('  FALHA ' + t + (d != null ? '  → ' + d : '')); } };

const srv = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  if (p === '/farol-frota/farol-core.js') {
    const b = await readFile(join(RAIZ, 'farol-frota/farol-core.js'), 'utf8');
    res.writeHead(200, { 'content-type':'text/javascript' }); return res.end(b);
  }
  if (p === '/harness-stub.js') {
    res.writeHead(200, { 'content-type':'text/javascript' }); return res.end(srv.__stub);
  }
  if (p === '/') { res.writeHead(200, { 'content-type':'text/html;charset=utf-8' }); return res.end(HARNESS); }
  res.writeHead(404); res.end('nao');
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });

async function roda(cenario) {
  srv.__stub = stub(cenario);
  const ctx = await nav.newContext();
  // o gviz é JSONP: o farol-core injeta <script src=docs.google...&responseHandler=fn>
  let gviz = 0;
  await ctx.route('**/docs.google.com/**', r => {
    gviz++;
    const url = r.request().url();
    const fn = (url.match(/responseHandler:([A-Za-z0-9_]+)/) || [])[1] || 'cb';
    if (cenario.gvizErro) return r.fulfill({ status:500, body:'erro' });
    const aba = decodeURIComponent((url.match(/[?&]sheet=([^&]*)/) || [])[1] || '');
    const T = aba === 'Disponibilidade' ? ABA_DISP : ABA_IND;
    r.fulfill({ status:200, contentType:'text/javascript', body: jsonp(fn, T) });
  });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', e => erros.push(e.message));
  await pg.goto(BASE + '/', { waitUntil:'load' });
  await pg.waitForFunction(() => window.__pronto, { timeout: 15000 });
  await pg.evaluate(() => window.__pronto);
  const out = await pg.evaluate(() => ({
    html: document.getElementById('alvo').innerHTML,
    texto: document.getElementById('alvo').innerText,
    fonte: (window.__D.fonte || {}).disp || null,
    disp: window.__D.disp || [],
    ind: window.__D.dispInd || [],
  }));
  await ctx.close();
  return { ...out, erros, gviz };
}

/* ═════ 1) banco respondendo — é o caminho que passa a valer ═════ */
console.log('\n═══ banco respondendo (o app das unidades) ═══');
{
  const r = await roda({ eventos: EVENTOS, snap: SNAP });
  af(r.erros.length === 0, 'a página não quebra', r.erros.join(' | '));
  af(r.fonte && r.fonte.src === 'app', 'a fonte registrada é o app', JSON.stringify(r.fonte));
  af(r.ind.length === 4, 'as 4 placas do app entram', r.ind.length);
  af(/CIS7492/.test(r.texto) && /RUR5G11/.test(r.texto),
     'as placas que a unidade lançou aparecem na tela');
  af(!/RUR5G13/.test(r.texto),
     'e a placa que só existe na planilha NÃO aparece — era a queixa do coordenador');
  af(/EMP0857/.test(r.texto) && !/EMP0I57/.test(r.texto),
     'a empilhadeira aparece como a unidade digitou, sem a "mercosulização" da planilha');
  // ativos: só o dia mais recente da foto (120+51+30 = 201), nunca a soma dos dias
  const at = r.disp.reduce((s, x) => s + x.ativos, 0);
  af(at === 201, 'o denominador é a foto do dia mais recente, não a soma dos dias', at);
  const ind = r.disp.reduce((s, x) => s + x.indisp, 0);
  af(ind === 4, 'e os indisponíveis do hero são os eventos de agora — hero e tabela batem', ind);
  af(/201/.test(r.texto) && /\b4\b/.test(r.texto), 'os dois números chegam à tela');
  // 201 ativos, 4 parados → 98%
  af(/98%/.test(r.texto), 'o percentual sai de 201 e 4', (r.texto.match(/\d+%/) || [])[0]);
  const ang = r.disp.find(x => x.cod === 'ANG');
  af(!!ang && ang.ativos === 51 && ang.indisp === 1,
     'ANG vem como ANG (na planilha vinha "ANHANGUERA" e ficava fora do filtro)', JSON.stringify(ang));
  const cba = r.ind.find(x => x.placa === 'EMP0857');
  af(!!cba && cba.cod === 'CBA T1' && cba.tier === 'T1', 'o tier sai do próprio código', JSON.stringify(cba && cba.tier));
  const g = r.ind.find(x => x.placa === 'RUR5G11');
  af(g && g.dias === 1, 'dias parado = hoje − data_parada (ontem → 1)', g && g.dias);
  af(g && g.prev === '—', 'sem previsão vira travessão, não data inválida', g && g.prev);
  af(/app de Indisponibilidade/.test(r.texto), 'a tela DIZ que está mostrando o app');
  af(/ativos da foto de 19\/09/.test(r.texto), 'e diz de quando é a foto dos ativos');
}

/* ═════ 2) tabela vazia — anon sem sessão do hub recebe [], não 401 ═════ */
/* A RESERVA DA PLANILHA SAIU (24/09/2026): banco mudo é dito na tela, não
   trocado pela aba congelada do Apps Script — e NENHUM pedido vai ao Google. */
console.log('\n═══ banco vazio (anon sem sessão): a tela diz, sem cair para planilha ═══');
{
  const r = await roda({ eventos: [], snap: [] });
  af(r.fonte && r.fonte.src === 'erro', 'a fonte é marcada como erro', JSON.stringify(r.fonte));
  af(/Banco de dados sem resposta/.test(r.texto), 'e a tela avisa, em destaque, que o banco não respondeu');
  af(!/planilha do Apps Script/.test(r.texto) && !/RUR5G13/.test(r.texto), 'sem a base antiga na tela');
  af(r.gviz === 0, 'e nenhum pedido foi ao Google', r.gviz);
}

/* ═════ 3) banco recusando a leitura ═════ */
console.log('\n═══ banco recusando (RLS/erro) ═══');
{
  const r = await roda({ evErro: true, eventos: [], snap: SNAP });
  af(r.fonte && r.fonte.src === 'erro' && r.gviz === 0, 'erro nos eventos: aviso na tela e nada no Google', JSON.stringify(r.fonte));
  const r2 = await roda({ eventos: EVENTOS, snapErro: true });
  af(r2.fonte && r2.fonte.src === 'erro' && r2.gviz === 0,
     'sem a foto de ativos não há percentual: aviso, em vez de inventar denominador',
     JSON.stringify(r2.fonte));
}

/* ═════ 4) o banco inteiro fora do ar ═════ */
console.log('\n═══ banco fora ═══');
{
  const r = await roda({ evErro: true, eventos: [], snap: [], gvizErro: true });
  af(r.erros.length === 0, 'a página não quebra', r.erros.join(' | '));
  af(/Sem dados de disponibilidade|Banco de dados sem resposta/.test(r.texto), 'a tela diz que não tem dado, em vez de mostrar 100%');
  af(r.gviz === 0, 'e o Google não é chamado', r.gviz);
}

await nav.close();
srv.close();
console.log(`\n${ok} ok · ${ruim} falha(s)`);
process.exit(ruim ? 1 : 0);
