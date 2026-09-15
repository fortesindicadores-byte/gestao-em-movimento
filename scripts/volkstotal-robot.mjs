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

  // ── 3. a tela de consulta ──────────────────────────────────────────────
  /* O LOGIN IGNORA A ReturnUrl (achado na 1ª sonda, 15/09/2026): depois do
     btnLogin o portal cai em Index.aspx, não no destino que a ReturnUrl
     carregava. A 1ª sonda fotografou a home achando que era a consulta — e a
     home TAMBÉM tem o seletor de contratos, então nada parecia errado. Por isso
     a navegação para a consulta é explícita e a URL é conferida. */
  log('');
  log('── 3. a tela de consulta ──');
  await pg.goto(ALVO, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pg.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  log(`  url: ${pg.url()}`);
  if (!/ConsultaValorNotaFiscal/i.test(pg.url())) {
    log('  ✘ não é a tela de consulta — a sessão não seguiu para cá');
    await shot('04-nao-e-consulta');
    await br.close();
    process.exit(1);
  }
  await shot('04-consulta');

  const dump = async rot => {
    // os campos que interessam são os que NÃO são a lista de contratos
    const campos = await pg.$$eval('input,select,textarea', els => els.map(e => ({
      tag: e.tagName.toLowerCase(), id: e.id, name: e.name, type: e.type || '',
      ph: e.placeholder || '', val: (e.value || '').slice(0, 30),
      vis: !!(e.offsetParent || e.type === 'hidden'),
    })));
    const chk = campos.filter(c => c.type === 'checkbox');
    const resto = campos.filter(c => c.type !== 'checkbox' && c.type !== 'hidden' && (c.id || c.name));
    log(`  [${rot}] ${resto.length} campo(s) fora da lista de contratos:`);
    resto.forEach(c => log(`    ${c.tag}/${c.type} id=${c.id || '—'} name=${c.name || '—'}`
      + ` ph="${c.ph}" val="${c.val}"${c.vis ? '' : ' (oculto)'}`));
    // o código do contrato sai do id; desktop e mobile repetem o mesmo código
    const cods = [...new Set(chk.map(c => (c.id || '').replace(/^check-(mob-)?/, '')).filter(Boolean))];
    log(`  [${rot}] ${chk.length} checkbox(es) → ${cods.length} contrato(s): ${cods.join(' · ')}`);
    const clic = await pg.$$eval('input[type=submit],input[type=button],input[type=image],button,a', els =>
      els.map(e => ({ t: (e.value || e.innerText || e.title || e.alt || '').trim().replace(/\s+/g, ' '),
                      id: e.id, tag: e.tagName.toLowerCase(),
                      vis: !!e.offsetParent }))
        .filter(c => c.t && c.t.length < 60 && c.vis));
    log(`  [${rot}] clicáveis: ` + [...new Set(clic.map(c => `${c.t}${c.id ? '#' + c.id : ''}`))].join(' · '));
    return cods;
  };
  const cods = await dump('consulta');

  // ── 4. uma busca de verdade ────────────────────────────────────────────
  /* Uma consulta não muda nada no portal, e é ela que responde o que sobrou:
     como se preenche o Mês/Ano (é campo com máscara), o que acontece quando o
     contrato não tem dado no mês (o Renan disse que aparece um modal com OK),
     quais são as colunas do resultado e se o "Gerar Relatório" só existe quando
     veio linha. Sem isso eu estaria escrevendo a coleta no escuro. */
  const ALVO_CT  = process.env.VT_CONTRATO || cods[0];
  const ALVO_MES = process.env.VT_MESANO   || '092026';
  log('');
  log(`── 4. busca de teste: contrato ${ALVO_CT} · ${ALVO_MES} ──`);
  const box = pg.locator(`#check-${ALVO_CT}`).or(pg.locator(`#check-mob-${ALVO_CT}`));
  const vis = box.filter({ visible: true }).first();
  await (await vis.count() ? vis : box.first()).check({ force: true });
  log('  contrato marcado');

  // o campo do mês tem MÁSCARA: fill() escreve de uma vez e a máscara não roda.
  // Digitar caractere a caractere é o que o Renan descreveu ("092026 já
  // preenche a barra") e o que a máscara espera.
  const cMes = pg.locator('input[type=text]:visible').filter({ hasNot: pg.locator('[readonly]') });
  const nMes = await cMes.count();
  log(`  ${nMes} campo(s) de texto visível(is) — o do mês é o que aceita a máscara`);
  if (nMes) {
    const alvo = cMes.first();
    await alvo.click();
    await alvo.pressSequentially(ALVO_MES, { delay: 60 });
    log(`  mês digitado → campo ficou "${await alvo.inputValue()}"`);
  }
  await shot('05-preenchido');

  const btPesq = pg.locator('input[type=submit],input[type=button],button,a')
    .filter({ hasText: /pesquis/i }).or(pg.locator('input[value*="Pesquis" i]'));
  if (await btPesq.count()) {
    await btPesq.first().click();
    await pg.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    log('  Pesquisar clicado');
  } else {
    log('  ⚠ não achei o botão Pesquisar');
  }
  await pg.waitForTimeout(2500);
  await shot('06-resultado');

  // modal de "sem dados"? é o caso que o robô tem de saber pular
  const modal = await pg.$$eval('.modal,.ui-dialog,[role=dialog],.swal2-popup', els =>
    els.filter(e => e.offsetParent).map(e => e.innerText.replace(/\s+/g, ' ').trim().slice(0, 200)));
  if (modal.length) log(`  MODAL na tela: ${modal.join(' | ')}`);
  else log('  sem modal — a busca deve ter trazido linhas');

  // as tabelas da página, com as colunas de cada uma
  const tabs = await pg.$$eval('table', els => els.filter(e => e.offsetParent).map(t => ({
    id: t.id,
    cab: [...t.querySelectorAll('thead th, tr:first-child th, tr:first-child td')]
      .map(e => e.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean),
    linhas: t.querySelectorAll('tbody tr').length || Math.max(0, t.rows.length - 1),
  })));
  log(`  ${tabs.length} tabela(s) visível(is):`);
  tabs.forEach(t => log(`    ${t.id ? '#' + t.id + ' ' : ''}${t.linhas} linha(s) · ${t.cab.join(' | ')}`));

  await dump('depois da busca');
  log('');
  log('Sonda concluída. Com o DOM acima eu escrevo a coleta sem adivinhar seletor.');
} catch (e) {
  log(`  ✘ falhou: ${e.message}`);
  await shot('99-erro');
  await br.close();
  process.exit(1);
}
await br.close();
