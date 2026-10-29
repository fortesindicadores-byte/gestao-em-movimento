// Login Diag: entra no portal publicado com um usuário de teste temporário e mostra onde
// a sessão cai (hub → painéis → recarregar → token vencido). No fim apaga o usuário.
// Não imprime senha, token nem chave. Uso: workflow Login Diag (GEM_SUPABASE_SERVICE_KEY).
import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
const SB = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const PUB = 'sb_publishable_ggKEEebc5zjgQDVsF92Upw_6uoLmKe9';
const SVC = process.env.GEM_SUPABASE_SERVICE_KEY;
const SITE = process.env.SITE || 'https://fortesindicadores-byte.github.io/gestao-em-movimento/';
const hS = { apikey: SVC, 'Content-Type': 'application/json', ...(SVC.startsWith('eyJ') ? { Authorization: 'Bearer ' + SVC } : {}) };
const t0 = () => Date.now();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// 1) servidor de login
for (const p of ['/auth/v1/health', '/auth/v1/settings']) {
  const s = t0(); try { const r = await fetch(SB + p, { headers: { apikey: PUB } }); log('auth', p, r.status, (t0() - s) + ' ms'); } catch (e) { log('auth', p, 'ERRO', e.message); }
}
// 2) usuário de teste
const email = `diag-login-${Date.now()}@conlogsa.com.br`, senha = randomBytes(12).toString('base64url');
let uid = null;
try {
  const r = await fetch(SB + '/auth/v1/admin/users', { method: 'POST', headers: hS, body: JSON.stringify({ email, password: senha, email_confirm: true, user_metadata: { name: 'DIAG LOGIN' } }) });
  const j = await r.json(); uid = j.id || (j.user && j.user.id); log('cria usuário de teste', r.status, uid ? 'ok' : JSON.stringify(j).slice(0, 200));
  if (uid) {
    const a = await fetch(SB + '/rest/v1/user_approvals', { method: 'POST', headers: { ...hS, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: uid, email, name: 'DIAG LOGIN', status: 'approved' }) });
    log('aprova usuário de teste', a.status, a.ok ? '' : (await a.text()).slice(0, 200));
  }
} catch (e) { log('ERRO criando usuário', e.message); }

const b = await chromium.launch();
try {
  if (!uid) throw new Error('sem usuário de teste');
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const pg = await ctx.newPage();
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log('  console', m.type(), m.text().slice(0, 220)); });
  pg.on('pageerror', e => log('  PAGEERROR', e.message.slice(0, 220)));
  pg.on('response', r => { const u = r.url(); if (u.includes('/auth/v1/') && !u.includes('/health')) log('  auth →', r.request().method(), u.replace(SB, '').split('?')[0], r.status()); });
  pg.on('requestfailed', r => { if (r.url().includes('supabase.co')) log('  FALHOU', r.url().replace(SB, '').split('?')[0], r.failure() && r.failure().errorText); });
  const estado = async rot => {
    const st = await pg.evaluate(() => {
      const raw = localStorage.getItem('sb-lozwipoeacpvplgkrxkq-auth-token'); let t = null; try { t = JSON.parse(raw); } catch (e) {}
      const vis = id => { const el = document.getElementById(id); return el ? getComputedStyle(el).display !== 'none' : null; };
      return { url: location.pathname, sessao: !!raw, vence: t && t.expires_at ? new Date(t.expires_at * 1000).toISOString().slice(11, 19) : '-', gem_hub: sessionStorage.getItem('gem_hub'), login: vis('auth-screen'), hub: vis('hub-screen'), msg: (document.getElementById('auth-msg') || {}).textContent || '' };
    }).catch(e => ({ erro: e.message }));
    log(rot, JSON.stringify(st));
  };
  log('── abre o hub');
  await pg.goto(SITE, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(6000); await estado('hub antes do login');
  await pg.fill('#login-email', email); await pg.fill('#login-pass', senha);
  const s = t0(); await pg.click('#btn-login');
  await pg.waitForTimeout(8000); log('login levou ~', (t0() - s) + ' ms'); await estado('hub depois do login');
  for (const p of ['visao-financeira/', 'painel-km/', 'combustivel/eficiencia-kml/', 'gestao-a-vista/', 'carta-custos/', 'planner-corporativo/', 'scorecard/']) {
    await pg.goto(SITE + p, { waitUntil: 'domcontentloaded' }).catch(e => log('goto erro', e.message)); await pg.waitForTimeout(9000); await estado('painel ' + p);
  }
  log('── recarrega o hub');
  await pg.goto(SITE, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(7000); await estado('hub recarregado');
  log('── nova aba (sem o gem_hub da sessão) abrindo um painel direto');
  const p2 = await ctx.newPage(); p2.on('console', m => { if (m.type() === 'error') log('  console(aba2)', m.text().slice(0, 200)); });
  await p2.goto(SITE + 'painel-km/', { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(9000);
  const ab = await p2.evaluate(() => { const v = id => { const el = document.getElementById(id); return el ? getComputedStyle(el).display !== 'none' : null; }; return { url: location.pathname, login: v('auth-screen'), hub: v('hub-screen') }; }).catch(e => ({ erro: e.message }));
  log('aba nova', JSON.stringify(ab));
  log('── token vencido (simula 1 h depois) e recarrega');
  await pg.evaluate(() => { const k = 'sb-lozwipoeacpvplgkrxkq-auth-token'; const t = JSON.parse(localStorage.getItem(k)); t.expires_at = Math.floor(Date.now() / 1000) - 120; localStorage.setItem(k, JSON.stringify(t)); });
  const s2 = t0(); await pg.goto(SITE, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(12000); log('depois de', (t0() - s2) + ' ms'); await estado('hub com token vencido');
  await pg.goto(SITE + 'gestao-a-vista/', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(9000); await estado('painel depois da renovação');
} catch (e) { log('ERRO', e.message); }
finally {
  await b.close();
  if (uid) {
    await fetch(SB + '/rest/v1/user_approvals?user_id=eq.' + uid, { method: 'DELETE', headers: hS }).catch(() => {});
    const d = await fetch(SB + '/auth/v1/admin/users/' + uid, { method: 'DELETE', headers: hS }).catch(e => ({ status: e.message }));
    log('apaga usuário de teste', d.status);
  }
}
