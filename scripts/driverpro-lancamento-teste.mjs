/* DriverPro · LANÇAMENTO (Renan, 20/10/2026: "Estou correndo para começar o
   DriverPro em 21/11/2026" → "Pode fazer os cinco"). Abre o app do motorista
   (app-motorista-4 e a cópia em Montserrat, app-motorista-5) no Chromium com o
   banco dublado e confere:
   1. antes de ce_app_regras.inicio o mês é TESTE: "Você teria", o aviso com o
      período 21/11 a 20/12/2026 e a folha de janeiro, e a aba Ganhos sem o
      dinheiro dos meses de teste no total;
   2. sem `inicio` no banco (SQL antigo) vale dez/2026;
   3. mês fechado (ce_app_fechamento) aparece como "fechado" e entra no total;
   4. o título do Ranking sai do grupo e do mês (não mais "Os 15 de Piraí ·
      setembro" fixo);
   5. o admin vê "Zerar senha deste motorista" e o botão chama ce_app_zerar_pin
      com a chave do motorista; o motorista não vê o botão.

   Uso: node scripts/driverpro-lancamento-teste.mjs */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let ok = 0, falhas = 0;
const t = (c, m, extra) => { console.log((c ? '  ✔ ' : '  ✘ ') + m + (c || extra === undefined ? '' : '  → ' + JSON.stringify(extra))); c ? ok++ : falhas++; };

const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(ROOT, u); if (f.endsWith('/')) f += 'index.html';
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  res.end(fs.readFileSync(f));
}).listen(0);
const PORT = srv.address().port;

function dados({ inicio, admin = false, fechado = false } = {}) {
  const regras = { saldo_inicial: 200, piso_nota: 60, km_min: 1000, viagens_min: 0, dias_min: 0, score_min: 0, top_n: 0,
    podio: [300, 150, 100], pesos: { rpm: 50, idle: 30, acel: 20 } };
  if (inicio) regras.inicio = inicio;
  return { ok: true, admin, nome: 'BETO BRAGA', unidade: 'PIRAI', unidade_real: 'EMP PIRAI', chave: 'gt:B',
    vigente: '2026-10', posicao: 1, posicao_geral: 2, regras,
    ranking: [{ pos: 1, pos_geral: 2, disputa: true, nome: 'B. B.', pontuacao: 85, eu: true }],
    meses: [
      { competencia: '2026-10', nota: 85, km: 1200, posicao: 1, posicao_unidade: 1, disputa: true, elegivel: true, carteira: 125, podio: 300, rpm: 85, idle: 85, acel: 85, motivo: null, fechado: false },
      { competencia: '2026-09', nota: 90, km: 1500, posicao: 1, posicao_unidade: 1, disputa: true, elegivel: true, carteira: 150, podio: 300, rpm: 90, idle: 90, acel: 90, motivo: null, fechado },
      { competencia: '2026-08', nota: 70, km: 1100, posicao: 3, posicao_unidade: 3, disputa: true, elegivel: true, carteira: 50, podio: 100, rpm: 70, idle: 70, acel: 70, motivo: null, fechado: false },
    ] };
}

const nav = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium' });
async function abre(app, cen) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const chamadas = [];
  await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, body: '' }));
  await pg.route('**/rest/v1/rpc/**', async r => {
    const fn = r.request().url().split('/rpc/')[1], body = JSON.parse(r.request().postData() || '{}');
    chamadas.push({ fn, body });
    let resp = { ok: true };
    if (fn === 'ce_app_dados') resp = dados(cen);
    if (fn === 'ce_app_zerar_pin') resp = { ok: true, nome: 'BETO BRAGA' };
    if (fn === 'ce_app_motoristas') resp = { ok: true, motoristas: [] };
    if (fn === 'ce_app_unidades') resp = { ok: true, unidades: [] };
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resp) });
  });
  await pg.addInitScript(([adm]) => {
    localStorage.setItem('app4_token', '00000000-0000-0000-0000-00000000000a');
    localStorage.setItem('app4_admin', adm ? '1' : '');
    if (adm) localStorage.setItem('app4_chave', 'gt:B'); else localStorage.removeItem('app4_chave');
  }, [!!cen.admin]);
  const alertas = [];
  pg.on('dialog', d => { alertas.push(d.message()); d.accept(); });
  const erros = [];
  pg.on('pageerror', e => erros.push(e.message));
  await pg.goto(`http://127.0.0.1:${PORT}/${app}/`);
  await pg.waitForFunction(() => document.getElementById('app').style.display === 'flex', null, { timeout: 8000 });
  return { ctx, pg, chamadas, alertas, erros };
}
const tx = (pg, id) => pg.$eval('#' + id, e => e.innerText.trim());

for (const app of ['app-motorista-4', 'app-motorista-5']) {
  console.log(`═══ ${app} ═══`);
  // 1 · antes do início: teste
  {
    const { ctx, pg, erros } = await abre(app, { inicio: '2026-12' });
    t(!erros.length, 'sem erro de página', erros);
    t(await tx(pg, 'rotSaldo') === 'Você teria', 'antes do início o saldo é "Você teria"', await tx(pg, 'rotSaldo'));
    const av = await tx(pg, 'avisoEleg');
    t(/Período de teste/.test(av) && /21\/11 a 20\/12\/2026/.test(av) && /folha de janeiro/.test(av), 'aviso do teste com o período e a folha', av);
    t(await tx(pg, 'rankTit') === 'Ranking · Piraí · outubro', 'título do ranking pelo grupo e pelo mês', await tx(pg, 'rankTit'));
    t(await pg.$eval('#btZerar', e => e.style.display) === 'none', 'motorista não vê o Zerar senha');
    await pg.evaluate(() => irPara('ganhos'));
    t(/R\$\s*0,00/.test(await tx(pg, 'ganhoAno')), 'Ganhos: meses de teste fora do total', await tx(pg, 'ganhoAno'));
    const meses = await tx(pg, 'meses');
    t(/período de teste · não é pago/.test(meses) && /período de teste · não foi pago/.test(meses) && /teria R\$/.test(meses), 'Ganhos: linhas de teste com o "teria"', meses);
    await ctx.close();
  }
  // 2 · banco sem `inicio` (SQL antigo): vale dez/2026
  {
    const { ctx, pg } = await abre(app, {});
    t(/Período de teste/.test(await tx(pg, 'avisoEleg')), 'sem inicio no banco, dez/2026 é o padrão');
    await ctx.close();
  }
  // 3 · programa valendo e mês fechado
  {
    const { ctx, pg } = await abre(app, { inicio: '2026-01', fechado: true });
    t(await tx(pg, 'rotSaldo') === 'Saldo atual', 'depois do início, "Saldo atual"', await tx(pg, 'rotSaldo'));
    t(await pg.$eval('#avisoEleg', e => e.style.display) === 'none', 'sem aviso de teste depois do início');
    await pg.evaluate(() => irPara('ganhos'));
    const tot = await tx(pg, 'ganhoAno');
    t(/600,00/.test(tot), 'Ganhos: total = set (150+300) + ago (50+100)', tot);
    t(/· fechado/.test(await tx(pg, 'meses')), 'mês fechado marcado como "fechado"', await tx(pg, 'meses'));
    await ctx.close();
  }
  // 4 · admin zera a senha
  {
    const { ctx, pg, chamadas, alertas } = await abre(app, { inicio: '2026-12', admin: true });
    t(await pg.$eval('#btZerar', e => e.style.display) === '', 'admin vê o Zerar senha');
    await pg.evaluate(() => zerarSenha());
    await pg.waitForTimeout(400);
    const z = chamadas.find(c => c.fn === 'ce_app_zerar_pin');
    t(z && z.body.p_chave === 'gt:B' && !!z.body.p_token, 'chama ce_app_zerar_pin com a chave do motorista', z);
    t(alertas.some(a => /zerada/.test(a)), 'confirma que zerou', alertas);
    await ctx.close();
  }
}
// 6 · painel Condução Econômica: pódio entre quem disputa e mês fechado vindo do fechamento
console.log('═══ painel: carteiraDe (pódio entre quem disputa · mês fechado) ═══');
{
  const vm = await import('node:vm');
  const src = fs.readFileSync(path.join(ROOT, 'combustivel/conducao-economica/index.html'), 'utf8');
  const ini = src.indexOf('function pisoNota(){'), fim = src.indexOf('function renderCarteira(data){');
  const ctx = { CRIT: { regras: { saldo_inicial: 200, podio: [300, 150, 100], piso_nota: 60 } },
    critDe: () => ({ km_min: 1000, top_n: 0, grupo: 'PIRAI' }), UNI_OF: {}, COD_OF: {}, FECH: {}, Math, Object };
  vm.createContext(ctx); vm.runInContext(src.slice(ini, fim) + ';this.carteiraDe=carteiraDe;', ctx);
  const v = '2026/09/01', L = (unit, pont, km) => ({ vig: v, unit, pont, km, semLogin: false });
  const rows = [L('ALFA', 99, 300), L('BETO', 90, 1500), L('CAIO', 80, 1200), L('DINO', 70, 1100)];
  const por = Object.fromEntries(ctx.carteiraDe(rows).map(r => [r.unit, r]));
  t(por.ALFA.total === 0 && por.BETO.pod === 300 && por.CAIO.pod === 150 && por.DINO.pod === 100,
    'quem não bateu o km não toma o pódio (1º de 300 km fica sem nada; o pódio é de quem disputa)', Object.values(por).map(r => [r.unit, r.cart, r.pod]));
  ctx.FECH = { [v]: { BETO: { elegivel: true, carteira: 150, podio: 300 }, CAIO: { elegivel: true, carteira: 100, podio: 150 } } };
  rows[1].pont = 70;   // o robô recalculou depois do fechamento
  const f = Object.fromEntries(ctx.carteiraDe(rows).map(r => [r.unit, r]));
  t(f.BETO.cart === 150 && f.BETO.pod === 300 && f.DINO.total === 0, 'mês fechado: vale o que está no fechamento, não o recálculo', Object.values(f).map(r => [r.unit, r.cart, r.pod]));
}

await nav.close(); srv.close();
console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
