// ============================================================
// Robô Volks|Total (VW Caminhões e Ônibus) — contrato de manutenção por km
//
// O portal da VW (volkstotal.vwco.com.br) tem, em Consulta Valor da Nota
// Fiscal, o que hoje é digitado à mão na planilha "Contratos Man.": por
// contrato e por mês, uma linha por chassi com km anterior, km atual, km
// rodado e o valor cobrado.
//
// MODOS (env VT_MODE):
//   sonda  (padrão) — só olha: alcança o portal? o login passa? o que tem no
//                     DOM (nomes dos campos, lista de contratos, botões)?
//                     NÃO coleta e NÃO grava nada.
//   run             — coleta de verdade (escrito depois que a sonda mostrar
//                     o DOM real; adivinhar seletor de ASP.NET é desperdício).
//
// POR QUE A SONDA VEM PRIMEIRO: o robô do Qlik foi 100% codificado e só
// então descobrimos que o servidor não era acessível de fora. Aqui a
// primeira pergunta é essa, e ela custa 30 segundos.
//
// Segredos: VOLKSTOTAL_USER · VOLKSTOTAL_PASS (Secrets do Actions, nunca no
// código — o repositório é público). O log NUNCA imprime a senha.
// ============================================================
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE  = 'https://volkstotal.vwco.com.br';
const ALVO  = `${BASE}/ConsultaValorNotaFiscal.aspx`;
const MODE  = (process.env.VT_MODE || 'sonda').toLowerCase();
const USER  = process.env.VOLKSTOTAL_USER || '';
const PASS  = process.env.VOLKSTOTAL_PASS || '';
const SHOTS = 'volkstotal-shots';

const hora = () => new Date().toLocaleTimeString('pt-BR', { hour12: false });
const log  = (...a) => console.log(hora(), ...a);
fs.mkdirSync(SHOTS, { recursive: true });

// ── 1. o portal responde de fora? ────────────────────────────────────────
// Antes de subir browser: se o domínio não abre daqui, o resto não importa.
log('── 1. o portal responde ao Actions? ──');
let alcanca = false;
try {
  const t0 = Date.now();
  const r = await fetch(ALVO, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  const ms = Date.now() - t0;
  const loc = r.headers.get('location') || '';
  log(`  HTTP ${r.status} em ${ms} ms${loc ? ' → ' + loc : ''}`);
  alcanca = true;
  if (r.status >= 300 && r.status < 400 && /login/i.test(loc)) {
    log('  redireciona para o login, como esperado (a ReturnUrl preserva o destino)');
  }
} catch (e) {
  log(`  ✘ NÃO alcança: ${e.message}`);
  log('');
  log('  O GitHub Actions não chega no portal. As saídas são as mesmas do Qlik:');
  log('   · a VW liberar acesso externo (se houver bloqueio por IP);');
  log('   · um runner self-hosted dentro da rede da Conlog;');
  log('   · rodar na máquina do Renan por tarefa agendada.');
  process.exit(1);
}

if (!USER || !PASS) {
  log('');
  log('  Portal alcançável. Falta cadastrar os segredos para testar o login:');
  log('    Settings → Secrets and variables → Actions → New repository secret');
  log('    VOLKSTOTAL_USER  e  VOLKSTOTAL_PASS');
  process.exit(0);
}

// ── 2. o login passa? ────────────────────────────────────────────────────
log('');
log('── 2. login (Acesso Clientes) ──');
const br = await chromium.launch();
const ctx = await br.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 900 } });
const pg = await ctx.newPage();
const shot = async n => { await pg.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true }); log(`  screenshot: ${n}`); };

try {
  await pg.goto(ALVO, { waitUntil: 'domcontentloaded', timeout: 60000 });
  log(`  caiu em: ${pg.url()}`);
  await shot('01-entrada');

  // a escolha do perfil: Acesso Clientes (não Dealer, não CloudIDP)
  const btCliente = pg.getByRole('link', { name: /acesso\s*clientes/i })
    .or(pg.getByRole('button', { name: /acesso\s*clientes/i }))
    .or(pg.locator('a,input[type=submit],button').filter({ hasText: /acesso\s*clientes/i }));
  if (await btCliente.count()) {
    await btCliente.first().click();
    await pg.waitForLoadState('domcontentloaded');
    log(`  após "Acesso Clientes": ${pg.url()}`);
  } else {
    log('  ⚠ não achei "Acesso Clientes" — talvez já esteja na tela de usuário/senha');
  }
  await shot('02-login-cliente');

  // ASP.NET nomeia os campos com ids longos (ctl00_...): pega pelo tipo, que
  // é estável, e registra os nomes reais para o modo run usar depois
  const campos = await pg.$$eval('input', els => els.map(e => ({
    id: e.id, name: e.name, type: e.type, ph: e.placeholder || '',
  })).filter(c => ['text', 'password', 'submit', 'email'].includes(c.type)));
  log('  campos da tela de login:');
  campos.forEach(c => log(`    ${c.type.padEnd(8)} id=${c.id || '—'} name=${c.name || '—'}`));

  const inUser = pg.locator('input[type=text]:visible, input[type=email]:visible').first();
  const inPass = pg.locator('input[type=password]:visible').first();
  await inUser.fill(USER);
  await inPass.fill(PASS);                       // a senha nunca vai ao log
  const btLogar = pg.locator('input[type=submit], button, a').filter({ hasText: /logar|entrar/i }).first();
  await btLogar.click();
  await pg.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  log(`  depois de Logar: ${pg.url()}`);
  await shot('03-pos-login');

  const logado = !/login/i.test(pg.url());
  if (!logado) {
    const erro = await pg.locator('body').innerText().catch(() => '');
    log('  ✘ continuamos na tela de login — credencial recusada ou etapa a mais');
    log('    texto da tela: ' + erro.replace(/\s+/g, ' ').slice(0, 300));
    await br.close();
    process.exit(1);
  }
  log('  ✔ login OK');

  // ── 3. o que a tela de consulta oferece ────────────────────────────────
  log('');
  log('── 3. a tela de consulta ──');
  const inputs = await pg.$$eval('input,select,textarea', els => els.map(e => ({
    tag: e.tagName.toLowerCase(), id: e.id, name: e.name, type: e.type || '',
    val: (e.value || '').slice(0, 30),
  })).filter(c => c.id || c.name));
  log(`  ${inputs.length} campo(s) na página:`);
  inputs.slice(0, 40).forEach(c => log(`    ${c.tag}/${c.type} id=${c.id || '—'} val="${c.val}"`));

  const botoes = await pg.$$eval('input[type=submit],input[type=button],button,a.btn', els =>
    els.map(e => (e.value || e.innerText || '').trim()).filter(Boolean));
  log(`  botões: ${[...new Set(botoes)].join(' · ')}`);

  // o seletor de contratos do topo — é dele que sai a lista a percorrer
  const contratos = await pg.$$eval('input[type=checkbox]', els => els.map(e => {
    const lbl = e.closest('label') || e.parentElement;
    return ((lbl && lbl.innerText) || e.value || '').trim();
  }).filter(Boolean));
  log(`  ${contratos.length} contrato(s) no seletor` + (contratos.length ? ': ' + contratos.join(' · ') : ''));

  await shot('04-consulta');
  log('');
  log('Sonda concluída. Com o DOM acima eu escrevo a coleta sem adivinhar seletor.');
} catch (e) {
  log(`  ✘ falhou: ${e.message}`);
  await shot('99-erro');
  await br.close();
  process.exit(1);
}
await br.close();
