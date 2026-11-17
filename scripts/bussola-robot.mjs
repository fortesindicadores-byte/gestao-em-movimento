// ============================================================
// ROBÔ DA BÚSSOLA GERENCIAL (FP&A da Conlog, bussolagerencial.vercel.app)
//
// A Bússola é de onde sai o DRE Gerencial Sintético (Realizado · Orçado ·
// Remunerado · Forecast por estrutura × projeto × mês). O desenho é o do
// Freightech: a tela é um app React montado por uma API; o robô aprende a
// API na sonda e depois lê direto, em vez de clicar em exportar.
//
// MODOS (env BUSSOLA_MODE):
//   sonda (padrão) — alcança o app? como é a tela de login? com os segredos
//                    BUSSOLA_USER/BUSSOLA_PASS, o login de e-mail + senha passa?
//                    o que o menu oferece? que API a página chama (caminho,
//                    NOMES dos parâmetros, status, tipo, tamanho, Bearer)?
//                    Nada é gravado; nenhum valor, token ou senha vai ao log.
//
// "Entrar com Microsoft" (Azure AD da Conlog, com MFA) NÃO serve para robô:
// o caminho é um usuário de e-mail + senha da própria Bússola.
// ============================================================
import fs from 'node:fs';
import { chromium } from 'playwright';

const URL_APP = process.env.BUSSOLA_URL || 'https://bussolagerencial.vercel.app/';
const MODE = (process.env.BUSSOLA_MODE || 'sonda').toLowerCase();
const USER = process.env.BUSSOLA_USER || '';
const PASS = process.env.BUSSOLA_PASS || '';
const SHOTS = 'bussola-shots';
const hora = () => new Date().toLocaleTimeString('pt-BR', { hour12: false });
const log = (...a) => console.log(hora(), ...a);
fs.mkdirSync(SHOTS, { recursive: true });

let nShot = 0;
async function foto(page, nome) {
  nShot++;
  const f = `${SHOTS}/${String(nShot).padStart(2, '0')}-${nome}.png`;
  try { await page.screenshot({ path: f, fullPage: true }); log('print:', f); } catch (e) { log('print falhou:', nome, e.message); }
}
// caminho + NOMES dos parâmetros (sem os valores)
function semValores(u) {
  try {
    const x = new URL(u);
    const ks = [...x.searchParams.keys()];
    return `${x.host}${x.pathname}${ks.length ? '?' + ks.join('&') : ''}`;
  } catch (e) { return String(u).split('?')[0]; }
}
const forma = v => Array.isArray(v)
  ? `[${v.length}]${v.length && v[0] && typeof v[0] === 'object' ? '{' + Object.keys(v[0]).slice(0, 30).join(',') + '}' : ''}`
  : (v && typeof v === 'object')
    ? '{' + Object.entries(v).slice(0, 30).map(([k, x]) => Array.isArray(x) ? `${k}[${x.length}]` : (x && typeof x === 'object' ? k + '{}' : k)).join(',') + '}'
    : typeof v;

// ── 1) alcance ──
const t0 = Date.now();
try {
  const r = await fetch(URL_APP, { redirect: 'manual' });
  log(`app: HTTP ${r.status} em ${Date.now() - t0} ms · ${r.headers.get('content-type') || ''} · server ${r.headers.get('server') || '?'}`);
} catch (e) { log('app NÃO alcançado:', e.message); process.exit(1); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
const page = await ctx.newPage();

// chamadas XHR/fetch por caminho, e a forma do JSON (chaves, nunca valores)
const chamadas = new Map(); const formas = new Map(); const hosts = new Set();
page.on('response', async res => {
  const req = res.request(); const t = req.resourceType();
  if (t !== 'xhr' && t !== 'fetch') return;
  const k = `${req.method()} ${semValores(res.url())}`;
  const ct = (res.headers()['content-type'] || '').split(';')[0];
  let tam = Number(res.headers()['content-length'] || 0); let corpo = null;
  try { corpo = await res.body(); if (!tam) tam = corpo.length; } catch (e) {}
  const c = chamadas.get(k) || { n: 0, status: new Set(), ct: new Set(), bytes: 0, bearer: false, cookie: false };
  c.n++; c.status.add(res.status()); if (ct) c.ct.add(ct); c.bytes = Math.max(c.bytes, tam);
  const h = req.headers();
  c.bearer = c.bearer || /^bearer\s/i.test(h.authorization || '');
  c.cookie = c.cookie || !!h.cookie;
  chamadas.set(k, c);
  try { hosts.add(new URL(res.url()).host); } catch (e) {}
  if (/json/.test(ct) && corpo) { try { formas.set(k, forma(JSON.parse(corpo.toString('utf8')))); } catch (e) {} }
});
page.on('console', m => { if (m.type() === 'error') log('console:', m.text().slice(0, 160)); });

// ── 2) a tela de login ──
await page.goto(URL_APP, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
await foto(page, 'inicio');
log('url:', page.url(), '· título:', await page.title());
const campos = await page.evaluate(() => [...document.querySelectorAll('input,button,a[href],select,textarea')].map(e => ({
  tag: e.tagName.toLowerCase(), type: e.type || '', name: e.name || '', id: e.id || '', ph: e.placeholder || '',
  txt: (e.innerText || e.value || '').trim().slice(0, 60), href: e.tagName === 'A' ? (e.getAttribute('href') || '').slice(0, 80) : ''
})).filter(x => x.txt || x.name || x.id || x.ph || x.href));
log('elementos da tela:'); campos.forEach(c => log('  ', JSON.stringify(c)));
// os bundles e os hosts que eles citam (só hosts/caminhos de API, nunca chaves)
const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src).filter(Boolean));
log('scripts:', scripts.map(semValores).join(' · '));
const apiRefs = new Set();
for (const s of scripts.slice(0, 6)) {
  try {
    const txt = await (await fetch(s)).text();
    for (const m of txt.matchAll(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:\/[a-z0-9_./-]*)?/gi)) {
      const u = m[0];
      if (/vercel\.app|supabase|firebase|azure|microsoft|amazonaws|googleapis|api|graph|\/rest|\/v1/i.test(u) && !/w3\.org|reactjs|github\.com|npmjs|mozilla|schema\.org/i.test(u)) apiRefs.add(u.slice(0, 120));
    }
    for (const m of txt.matchAll(/["'`](\/api\/[a-z0-9_./-]+)/gi)) apiRefs.add(m[1].slice(0, 120));
  } catch (e) { log('bundle não lido:', semValores(s), e.message); }
}
log(`hosts/caminhos de API citados nos bundles (${apiRefs.size}):`); [...apiRefs].sort().forEach(u => log('  ', u));

// ── 3) login por e-mail + senha, se houver segredos ──
if (USER && PASS) {
  const email = page.locator('input[type=email], input[name*=mail i], input[placeholder*=mail i], input[type=text]').first();
  const senha = page.locator('input[type=password]').first();
  if (await email.count() && await senha.count()) {
    await email.fill(USER); await senha.fill(PASS);
    const bt = page.locator('button:has-text("Entrar"):not(:has-text("Microsoft")), button[type=submit]').first();
    await Promise.all([page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}), bt.click()]);
    await page.waitForTimeout(6000);
    await foto(page, 'depois-login');
    const txt = (await page.locator('body').innerText().catch(() => '')) || '';
    const ainda = await senha.isVisible().catch(() => false);
    log('depois do login: url', page.url(), '· campo de senha ainda na tela:', ainda);
    const erro = txt.match(/inv[aá]lid[oa]s?|incorret[oa]|n[aã]o encontrado|erro|unauthorized/i);
    if (erro) log('aviso na tela:', erro[0]);
    if (!ainda) {
      const menu = await page.evaluate(() => [...document.querySelectorAll('nav a, aside a, nav button, aside button, [role=menuitem], header a, header button, a[href^="#"], a[href^="/"]')]
        .map(e => ({ txt: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60), href: (e.getAttribute('href') || '').slice(0, 80) })).filter(x => x.txt));
      log(`menu (${menu.length}):`); menu.forEach(m => log('  ', JSON.stringify(m)));
      const titulos = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3')].map(e => e.innerText.trim().replace(/\s+/g, ' ').slice(0, 80)).filter(Boolean).slice(0, 40));
      log('títulos:', titulos.join(' · '));
      const chaves = await page.evaluate(() => ({ ls: Object.keys(localStorage), ss: Object.keys(sessionStorage) }));
      log('localStorage:', chaves.ls.join(', ') || '(vazio)', '· sessionStorage:', chaves.ss.join(', ') || '(vazio)');
      // percorre os itens do menu (até 12), fotografando e deixando a API aparecer
      for (const m of menu.slice(0, 12)) {
        if (!m.txt || /sair|logout/i.test(m.txt)) continue;
        try {
          await page.locator(`nav a, aside a, nav button, aside button, [role=menuitem], header a, header button, a[href^="#"], a[href^="/"]`).filter({ hasText: m.txt }).first().click({ timeout: 5000 });
          await page.waitForTimeout(4000);
          await foto(page, 'menu-' + m.txt.replace(/[^a-z0-9]+/gi, '-').slice(0, 30).toLowerCase());
          const bts = await page.evaluate(() => [...document.querySelectorAll('button, a')].map(e => (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 50)).filter(t => /export|baix|download|xlsx|excel|csv|gerar|filtr|per[ií]odo|m[eê]s/i.test(t)));
          log(`  ${m.txt} → url ${page.url()} · botões de export/filtro: ${[...new Set(bts)].join(' · ') || '—'}`);
        } catch (e) { log('  ', m.txt, '→ não abriu:', e.message.slice(0, 80)); }
      }
    }
  } else log('não achei os campos de e-mail/senha na tela');
} else log('sem BUSSOLA_USER/BUSSOLA_PASS: só a tela de login foi mapeada');

// ── 4) relatório da API ──
log(`\nhosts chamados pela página: ${[...hosts].join(' · ') || '(nenhum XHR/fetch)'}`);
log(`chamadas XHR/fetch (${chamadas.size}):`);
for (const [k, c] of chamadas) log(`  ${k} · ${c.n}× · ${[...c.status].join('/')} · ${[...c.ct].join('/') || '?'} · ${(c.bytes / 1024).toFixed(1)} KB${c.bearer ? ' · Bearer' : ''}${c.cookie ? ' · cookie' : ''}${formas.has(k) ? ' · ' + formas.get(k) : ''}`);
await browser.close();
log('modo', MODE, 'concluído');
