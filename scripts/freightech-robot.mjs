// ============================================================
// Robô Freightech (Ambev) — a remuneração da Ambev, inteira
//
// O Freightech (freightech.ambev.com.br) é o sistema oficial em que a Ambev
// consolida a remuneração: R$/km, custo fixo, R$/hl, Finame, combustível… e o
// relatório "Caminhão", com os parâmetros de cada placa. Hoje o Renan compila
// esses relatórios à mão (Renan, 23/10/2026: "Estava compilando, mas quero
// fazer um robô para buscar").
//
// MODOS (env FT_MODE):
//   sonda (padrão) — alcança o portal? o login passa? como é o menu e que API
//                    a página chama? Não coleta nada.
//
// LOGIN (prints do Renan, 23/10/2026): freightech.ambev.com.br/#/login →
// "Sou Fornecedor - Externo" → Keycloak da Ambev (auth.ambevdevs.com.br,
// realm Third, client ambev-freightech, PKCE) com E-mail + Senha e o botão
// "Entrar". Sem código por SMS/e-mail na tela que ele mostrou.
//
// A SONDA PROCURA A API. O Freightech é um SPA (rota com #) que recebe um
// token do Keycloak; se as telas são montadas por chamadas JSON com esse
// token, o robô pode ler a API direto em vez de clicar em exportar — é mais
// estável que o Power BI do Ginfo. Por isso ela anota cada chamada que a
// página faz: método, caminho, NOMES dos parâmetros, status, tipo e tamanho.
// NUNCA o corpo, nunca o valor dos parâmetros, nunca o token: o repositório
// é público e o log do Actions também.
//
// Segredos: FREIGHTECH_USER · FREIGHTECH_PASS (Secrets do Actions).
// ============================================================
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE  = 'https://freightech.ambev.com.br';
const MODE  = (process.env.FT_MODE || 'sonda').toLowerCase();
const USER  = process.env.FREIGHTECH_USER || '';
const PASS  = process.env.FREIGHTECH_PASS || '';
const SHOTS = 'freightech-shots';

const hora = () => new Date().toLocaleTimeString('pt-BR', { hour12: false });
const log  = (...a) => console.log(hora(), ...a);
fs.mkdirSync(SHOTS, { recursive: true });

if (!USER || !PASS) {
  console.error('::error::faltam os segredos FREIGHTECH_USER / FREIGHTECH_PASS');
  process.exit(1);
}

let nShot = 0;
async function foto(page, nome) {
  nShot++;
  const f = `${SHOTS}/${String(nShot).padStart(2, '0')}-${nome}.png`;
  try { await page.screenshot({ path: f, fullPage: true }); log('print:', f); } catch (e) { log('print falhou:', nome, e.message); }
}

// caminho + NOMES dos parâmetros (sem os valores): o que basta para enxergar a API
function semValores(u) {
  try {
    const x = new URL(u);
    const ks = [...x.searchParams.keys()];
    return `${x.host}${x.pathname}${ks.length ? '?' + ks.join('&') : ''}`;
  } catch (e) { return String(u).split('?')[0]; }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
const page = await ctx.newPage();

// chamadas que a página faz (XHR/fetch), agrupadas por caminho
const chamadas = new Map();
let comBearer = 0;
page.on('request', req => {
  const t = req.resourceType();
  if (t !== 'xhr' && t !== 'fetch') return;
  const h = req.headers();
  if (/^bearer\s/i.test(h.authorization || '')) comBearer++;
});
page.on('response', async res => {
  const req = res.request();
  const t = req.resourceType();
  if (t !== 'xhr' && t !== 'fetch') return;
  const k = `${req.method()} ${semValores(res.url())}`;
  const ct = (res.headers()['content-type'] || '').split(';')[0];
  let tam = Number(res.headers()['content-length'] || 0);
  if (!tam) { try { tam = (await res.body()).length; } catch (e) {} }
  const c = chamadas.get(k) || { n: 0, status: new Set(), ct: new Set(), bytes: 0, bearer: false };
  c.n++; c.status.add(res.status()); if (ct) c.ct.add(ct); c.bytes = Math.max(c.bytes, tam);
  c.bearer = c.bearer || /^bearer\s/i.test(req.headers().authorization || '');
  chamadas.set(k, c);
});

async function textosVisiveis(sel) {
  return page.$$eval(sel, els => [...new Set(els
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .map(e => (e.innerText || e.getAttribute('aria-label') || e.title || '').replace(/\s+/g, ' ').trim())
    .filter(t => t && t.length <= 80))]);
}

try {
  // ── 1) portal ───────────────────────────────────────────────
  log('abrindo', BASE + '/#/login');
  const t0 = Date.now();
  const r0 = await page.goto(BASE + '/#/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  log(`portal respondeu HTTP ${r0 && r0.status()} em ${Date.now() - t0} ms`);
  await page.waitForTimeout(2500);
  await foto(page, 'login-tipo');

  // ── 2) "Sou Fornecedor - Externo" → Keycloak ───────────────
  const forn = page.getByText(/Sou Fornecedor/i).first();
  await forn.waitFor({ timeout: 30000 });
  await forn.click();
  await page.waitForURL(/auth\.ambevdevs\.com\.br|openid-connect/, { timeout: 45000 });
  log('tela de login:', semValores(page.url()));
  await page.waitForTimeout(1500);
  await foto(page, 'keycloak');

  // o Keycloak padrão usa #username / #password / #kc-login; o tema da Ambev
  // pode trocar os ids, então cai no tipo do campo e no rótulo do botão
  const campoUser = page.locator('#username, input[name="username"], input[type="email"]').first();
  const campoPass = page.locator('#password, input[name="password"], input[type="password"]').first();
  await campoUser.fill(USER);
  await campoPass.fill(PASS);
  const entrar = page.locator('#kc-login, button[type="submit"], input[type="submit"]').first();
  await entrar.click();

  // ── 3) de volta ao Freightech ───────────────────────────────
  try {
    await page.waitForURL(u => String(u).startsWith(BASE) && !/#\/login/.test(String(u)), { timeout: 60000 });
  } catch (e) {
    await foto(page, 'pos-login-falhou');
    const erro = await page.locator('.alert-error, #input-error, .kc-feedback-text, [class*="error"]').allInnerTexts().catch(() => []);
    log('o login NÃO voltou ao Freightech. URL:', semValores(page.url()), '· mensagem:', erro.join(' | ').slice(0, 200) || '(nenhuma)');
    const otp = await page.locator('input[name="otp"], #otp, input[autocomplete="one-time-code"]').count();
    if (otp) log('a tela pede CÓDIGO (OTP) — o login tem segundo fator');
    throw new Error('login não concluiu');
  }
  log('login OK →', semValores(page.url()));
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await foto(page, 'home');

  // ── 4) o que a home mostra ──────────────────────────────────
  log('título:', await page.title());
  const menu = await textosVisiveis('nav a, nav button, aside a, aside button, [role="menuitem"], .menu a, .sidebar a, .p-menuitem-link, .v-list-item, li a');
  log(`itens de menu visíveis (${menu.length}):`);
  menu.forEach(t => log('   ·', t));
  const botoes = await textosVisiveis('button, [role="button"], [role="tab"]');
  log(`botões/abas visíveis (${botoes.length}):`, botoes.slice(0, 60).join(' | '));

  // abre o que parecer relatório, para listar o submenu (sem exportar nada)
  for (const rx of [/relat/i, /caminh/i]) {
    const el = page.getByText(rx).first();
    if (await el.count()) {
      try {
        await el.click({ timeout: 5000 });
        await page.waitForTimeout(3000);
        log(`clicado "${rx}" → URL:`, semValores(page.url()));
        await foto(page, 'menu-' + rx.source.replace(/\W/g, ''));
        const sub = await textosVisiveis('nav a, aside a, [role="menuitem"], .menu a, .sidebar a, .p-menuitem-link, .v-list-item, li a, button');
        log(`   itens visíveis depois do clique (${sub.length}):`, sub.slice(0, 80).join(' | '));
      } catch (e) { log(`clique em "${rx}" falhou:`, e.message.split('\n')[0]); }
    } else log(`nada com "${rx}" na tela`);
  }

  // ── 4b) a tela de Exportação: como são os campos (para o robô saber clicar) ──
  await page.goto(BASE + '/#/exportacao-dados', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(5000);
  await foto(page, 'exportacao');
  const campos = await page.evaluate(() => {
    const rot = ['Modelo', 'Tipo de exportação', 'Canal/Segmento', 'Vigência', 'Unidade'];
    const out = [];
    for (const r of rot) {
      const lab = [...document.querySelectorAll('label, span, div, p')].find(e => e.children.length === 0 && e.textContent.trim() === r);
      if (!lab) { out.push(`${r}: (rótulo não achado)`); continue; }
      let box = lab.parentElement;
      for (let i = 0; i < 4 && box && !box.querySelector('input, select, [role="combobox"], ng-select, mat-select, p-dropdown, p-multiselect'); i++) box = box.parentElement;
      const html = box ? box.outerHTML.replace(/\s+/g, ' ').replace(/>[^<]{1,60}</g, '>…<').slice(0, 700) : '(sem campo)';
      out.push(`${r}: ${html}`);
    }
    return out;
  });
  campos.forEach(c => log('campo', c));

  // ── 5) onde mora a sessão (só os NOMES) ─────────────────────
  const armaz = await page.evaluate(() => ({
    local: Object.keys(localStorage), sessao: Object.keys(sessionStorage),
  }));
  log('localStorage:', armaz.local.join(', ') || '(vazio)');
  log('sessionStorage:', armaz.sessao.join(', ') || '(vazio)');
  log('cookies:', (await ctx.cookies()).map(c => `${c.name}@${c.domain}`).join(', ') || '(nenhum)');
} catch (e) {
  console.error('::error::' + e.message.split('\n')[0]);
  process.exitCode = 1;
} finally {
  // ── 6) a API que a página chamou ────────────────────────────
  log(`chamadas XHR/fetch: ${chamadas.size} caminhos · com Bearer: ${comBearer}`);
  [...chamadas.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, c]) =>
    log(`   ${k} · ${c.n}× · HTTP ${[...c.status].join('/')} · ${[...c.ct].join('/') || '?'} · até ${c.bytes} B${c.bearer ? ' · Bearer' : ''}`));
  await browser.close();
  log('modo', MODE, '· fim');
}
