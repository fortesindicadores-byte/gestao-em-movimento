// Parâmetros Seara (/parametros-seara/): abre a tela no Chromium com o banco
// dublado e confere o gate, a tabela de modelos, a edição em linha, a nova
// vigência e o estado das bases automáticas (o automático é o padrão, sem chave). Uso: node scripts/parametros-seara-teste.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SBJS = process.env.SBJS || '';
let ok = 0, falha = 0;
const t = (nome, cond, extra = '') => { if (cond) ok++; else falha++; console.log(`${cond ? 'ok ' : 'FALHA'} ${nome}${extra ? ' — ' + extra : ''}`); };

const PARAMS = [
  { id: 1, modelo: 'VW 11.180', vigencia_inicio: '2026-09', kmporlitro: 4.0, precodiesel: 7.58, precoarla: 3.2, reaisporkm: 3.1, totalreaisporkm: 5.2, campos: { reaisporkmmanutecao: 0.4, reaisporkmpneu: 0.2, reaisporkmdiesel: 1.895 }, ativo: true, obs: 'semente' },
  { id: 2, modelo: 'VW 17.190', vigencia_inicio: '2026-09', kmporlitro: 2.99, precodiesel: 7.58, precoarla: 3.2, reaisporkm: 3.6, totalreaisporkm: 6.1, campos: { reaisporkmmanutecao: 0.5 }, ativo: true, obs: 'semente' },
];
const BASES = [{ slug: 'consumo_km_litro', tabela: 'ca_consumo_km_litro', linhas: 4700, carregado_em: '2026-10-27T09:05:00Z', erro: null, resumo: { comum: 4000, litOk: 3600, kmOk: 3500, rsOk: 3400, dados_ate: '2026-10-08' } },
  { slug: 'seara_remunerado', tabela: 'ca_seara_remunerado', linhas: 60, carregado_em: '2026-10-27T09:05:00Z', erro: 'FALHOU: teste', resumo: null }];
const updates = [], inserts = [], flags = [];

async function cenario(admin, vp = { width: 1366, height: 768 }, tema = 'dark') {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: vp, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  await pg.route(/fonts\.g/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  if (SBJS) await pg.route(/supabase-js@2/, r => r.fulfill({ status: 200, body: readFileSync(SBJS, 'utf8'), contentType: 'application/javascript' }));
  await pg.route(/supabase\.co/, async r => {
    const u = new URL(r.request().url()); const p = u.pathname; const m = r.request().method();
    const json = (o, st = 200) => r.fulfill({ status: st, body: JSON.stringify(o), contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range' } });
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (p.endsWith('/auth/v1/user')) return json({ id: 'u1', email: 'x@conlogsa.com.br' });
    if (p.includes('/rest/v1/fca_profiles')) return json({ is_admin: admin });
    if (p.includes('/rest/v1/portal_flags')) { flags.push(m); return json([]); }
    if (p.includes('/rest/v1/consumo_auto_base')) return json(BASES);
    if (p.includes('/rest/v1/seara_param')) {
      if (m === 'PATCH') { const body = JSON.parse(r.request().postData()); const id = +u.searchParams.get('id').replace('eq.', ''); updates.push({ id, body }); const row = PARAMS.find(x => x.id === id); Object.assign(row, body); return json([row]); }
      if (m === 'POST') { const body = JSON.parse(r.request().postData()); inserts.push(body); PARAMS.push({ id: 9, ...body }); return json([{ id: 9, ...body }], 201); }
      if (m === 'DELETE') return json([]);
      return json(PARAMS);
    }
    return json([]);
  });
  await pg.addInitScript(t => { window.__tema = t; }, tema);
  await pg.addInitScript(() => {
    sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', window.__tema || 'dark');
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u1', email: 'x@conlogsa.com.br', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } }));
  });
  const erros = []; pg.on('pageerror', e => erros.push(String(e)));
  await pg.goto('file://' + join(RAIZ, 'parametros-seara/index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1500);
  return { b, pg, erros };
}

{ // admin
  const { b, pg, erros } = await cenario(true);
  t('admin: sem erro de página', !erros.length, erros.join(' | '));
  t('admin: miolo aberto', await pg.locator('#miolo').isVisible());
  t('admin: 2 modelos na tabela', await pg.locator('#tab tbody tr').count() === 2);
  t('admin: campos editáveis', await pg.locator('#tab input[data-c="kmporlitro"]').count() === 2);
  t('admin: sem chave: nenhum pedido ao portal_flags', flags.length === 0);
  t('admin: base ok diz que os painéis leem o automático', /lendo o automático/.test(await pg.locator('#bases .pill.ok').first().textContent()));
  t('admin: a coluna Dados até mostra o corte do robô (08/10/2026)', /08\/10\/2026/.test(await pg.locator('#bases tbody tr').first().textContent()));
  t('admin: bases do robô na tabela', await pg.locator('#bases tbody tr').count() === 2);
  t('admin: base com erro marcada', await pg.locator('#bases .pill.err').count() === 1);
  t('admin: casca padrão (lateral, Voltar ao Hub no rodapé, abre no Resumo Gerencial)', await pg.evaluate(() => !!document.querySelector('.app .side .s-volta') && document.getElementById('tit').textContent === 'Resumo Gerencial' && document.querySelector('#vw-resumo').classList.contains('on')));
  t('admin: hero com o corte do robô', /08\/10\/2026/.test(await pg.locator('#h-ate').textContent()));
  t('admin: KPIs dos modelos vigentes', (await pg.locator('#k-mod').textContent()) === '2' && /2,99 a 4,00/.test(await pg.locator('#k-kml-m').textContent()));
  t('admin: nenhum texto acima das tabelas', await pg.evaluate(() => [...document.querySelectorAll('.tsec')].every(c => !c.firstElementChild || c.firstElementChild.classList.contains('twrap'))));
  await pg.click('.s-item[data-vw="param"]'); await pg.waitForTimeout(200);
  t('admin: visão Parâmetros por modelo', await pg.locator('#vw-param').isVisible() && (await pg.locator('#tit').textContent()) === 'Parâmetros por modelo');
  t('admin: modelo vigente marcado como coluna Situação', await pg.locator('#tab .chip.at').count() === 2);
  // editar km/L da 1ª linha → PATCH com o R$/km do diesel recalculado
  const inp = pg.locator('#tab input[data-c="kmporlitro"]').first();
  await inp.fill('4,20'); await inp.dispatchEvent('change'); await pg.waitForTimeout(400);
  const up = updates.find(u => u.id === 1);
  t('admin: grava Km/L por PATCH', !!up && up.body.kmporlitro === 4.2, JSON.stringify(up && up.body));
  t('admin: R$/km diesel recalculado (7,58 ÷ 4,2)', !!up && Math.abs(up.body.campos.reaisporkmdiesel - 1.8048) < 0.001);
  t('admin: campo fica verde', await inp.evaluate(e => e.classList.contains('ok')));
  // nova vigência
  await pg.click('#bt-nova'); await pg.waitForTimeout(200);
  t('admin: caixa aberta com o modelo preenchido', await pg.locator('#ov').evaluate(e => e.classList.contains('on')) && (await pg.inputValue('#nv-kml')) !== '');
  await pg.fill('#nv-vig', '2026-11'); await pg.fill('#nv-kml', '4,5');
  await pg.click('.mdl .pe .bt:not(.ghost)'); await pg.waitForTimeout(500);
  const ins = inserts[0];
  t('admin: nova vigência gravada por upsert', !!ins && ins.vigencia_inicio === '2026-11' && ins.kmporlitro === 4.5 && ins.modelo === 'VW 11.180', JSON.stringify(ins));
  t('admin: campos copiados da vigência anterior', !!ins && ins.campos && ins.campos.reaisporkmmanutecao === 0.4);
  t('admin: tabela relida com 3 linhas', await pg.locator('#tab tbody tr').count() === 3);
  t('admin: não existe botão Ligar/Desligar', await pg.locator('#bt-chave').count() === 0);
  t('admin: cabe em 1366×768 sem rolagem lateral', await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await b.close();
}
for (const [w, h] of [[1366, 768], [1600, 900], [1920, 1000]]) for (const tema of ['dark', 'light']) {
  const { b, pg, erros } = await cenario(true, { width: w, height: h }, tema);
  const med = async () => pg.evaluate(() => {
    const d = document.documentElement, tw = [...document.querySelectorAll('.vw.on .twrap')];
    return { pag: d.scrollHeight <= innerHeight + 1 && d.scrollWidth <= innerWidth + 1, lat: tw.every(x => x.scrollWidth <= x.clientWidth + 1), vrola: tw.every(x => x.scrollHeight <= x.clientHeight + 1) };
  });
  const r1 = await med(); await pg.click('.s-item[data-vw="param"]'); await pg.waitForTimeout(200); const r2 = await med();
  t(`${w}×${h} ${tema}: sem rolagem de página nem barra lateral nas tabelas`, r1.pag && r1.lat && r2.pag && r2.lat && !erros.length, JSON.stringify({ r1, r2, erros }));
  t(`${w}×${h} ${tema}: tabelas inteiras sem rolar`, r1.vrola && r2.vrola, JSON.stringify({ r1, r2 }));
  if (process.env.SHOT) { await pg.screenshot({ path: `${process.env.SHOT}/ps-${w}-${tema}-param.png` }); await pg.click('.s-item[data-vw="resumo"]'); await pg.waitForTimeout(150); await pg.screenshot({ path: `${process.env.SHOT}/ps-${w}-${tema}-resumo.png` }); }
  await b.close();
}
{ // não admin
  const { b, pg } = await cenario(false);
  t('gestor: gate "só para administradores"', /administradores/.test(await pg.locator('#gate').textContent()));
  t('gestor: miolo fechado', !(await pg.locator('#miolo').isVisible()));
  await b.close();
}
console.log(`\n${ok} ok · ${falha} falha(s)`);
process.exit(falha ? 1 : 0);
