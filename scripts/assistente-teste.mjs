// Teste da página /assistente/ (Chromium): dono vê a conversa, outro login cai no gate,
// a pergunta vai à Edge Function com o login do hub, a resposta (texto, tabela, consultas
// ao banco e pesquisa na web) aparece e a página não rola em 1366/1920 nos dois temas.
// Uso: SBJS=<supabase.js UMD> node scripts/assistente-teste.mjs   (SHOT_DIR salva prints)
import { chromium } from 'playwright';
import http from 'node:http'; import { readFileSync, existsSync } from 'node:fs'; import path from 'node:path';
const RAIZ = path.resolve(new URL('..', import.meta.url).pathname);
const SBJS = process.env.SBJS || '', SHOT = process.env.SHOT_DIR || '';
let ok = 0, falha = 0; const t = (c, m) => { if (c) { ok++; console.log('ok ', m); } else { falha++; console.log('FALHA', m); } };
const srv = http.createServer((q, s) => { const f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(RAIZ) || !existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'application/javascript' : 'text/html' }); s.end(readFileSync(f)); }).listen(0);
const BASE = 'http://127.0.0.1:' + srv.address().port;
const b = await chromium.launch();
async function abre(email, w, h, tema) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' }); const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(String(e)));
  const pedidos = [];
  await pg.route(/fonts\.g/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await pg.route(/supabase-js@2/, r => r.fulfill({ status: 200, body: SBJS ? readFileSync(SBJS, 'utf8') : '', contentType: 'application/javascript' }));
  await pg.route(/supabase\.co/, async r => { const u = new URL(r.request().url());
    if (u.pathname.endsWith('/functions/v1/rapid-processor')) {
      pedidos.push({ h: r.request().headers(), b: JSON.parse(r.request().postData() || '{}') });
      const corpo = pedidos.at(-1).b, ult = corpo.mensagens.at(-1), per = String(ult.content || '');
      let ev = [{ t: 'ver', v: 2, img: (ult.imagens || []).length },
        { t: 'sql', sql: 'select 1', motivo: 'custo por km em 2026' }, { t: 'res', linhas: 9, truncado: false },
        { t: 'web', q: 'IPCA acumulado 2026' }, { t: 'txt', d: 'O custo subiu **4,1%**, abaixo do IPCA.\n\n| Mês | R$/km |\n|---|---|\n| jan/26 | 2,10 |\n| set/26 | 2,19 |\n' },
        { t: 'fim', consultas: 1, web: 1, custo: 0.31, seg: 22 }];
      if (corpo.titulo) ev.splice(1, 0, { t: 'titulo', d: 'Evolução do custo por km' });
      if (/corta/.test(per)) ev = ev.filter(e => e.t !== 'fim' && e.t !== 'txt');          // a função morreu no meio
      if (/antiga/.test(per)) ev = ev.filter(e => e.t !== 'ver' && e.t !== 'titulo');      // função publicada sem imagens
      if (/demora/.test(per)) await new Promise(z => setTimeout(z, 4000));                 // resposta lenta, para o Parar
      return r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: ev.map(e => JSON.stringify(e)).join('\n') + '\n' }).catch(() => {}); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  await pg.addInitScript(([t0, e0]) => { sessionStorage.setItem('gem_hub', '1'); localStorage.setItem('bi_theme', t0); if (!sessionStorage.getItem('t_ia')) { ['gem_assistente','gem_assistente_conv','gem_assistente_atual'].forEach(x => localStorage.removeItem(x)); sessionStorage.setItem('t_ia', '1'); }
    localStorage.setItem('sb-lozwipoeacpvplgkrxkq-auth-token', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'u1', email: e0, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } })); }, [tema, email]);
  await pg.goto(BASE + '/assistente/'); await pg.waitForTimeout(700);
  return { pg, ctx, erros, pedidos };
}
for (const [w, h] of [[1366, 768], [1920, 1080]]) for (const tema of ['dark', 'light']) {
  const k = `${w} ${tema}`; const { pg, ctx, erros, pedidos } = await abre('fortesindicadores@gmail.com', w, h, tema);
  t(await pg.locator('#miolo').isVisible(), k + ': dono vê a conversa');
  t((await pg.locator('.ia-cards .ia-card').count()) === 4 && /Olá, Fortesindicadores/.test(await pg.locator('.ia-ola h2').textContent()), k + ': saudação e sugestões em cartões');
  await pg.fill('#ia-txt', 'Como o custo por km evoluiu contra o IPCA?'); await pg.click('#ia-env'); await pg.waitForTimeout(600);
  t(pedidos.length === 1 && pedidos[0].h.authorization === 'Bearer tok' && pedidos[0].b.mensagens.at(-1).content.includes('IPCA'), k + ': manda o login e a pergunta');
  const ele = pg.locator('.ia-m.ele').last();
  t((await ele.locator('b').first().textContent()) === '4,1%' && (await ele.locator('td.n').count()) === 2, k + ': negrito e tabela com número à direita');
  const sum = await ele.locator('.ia-q summary').textContent();
  t(/1 consulta ao banco · 1 pesquisa na web/.test(sum), k + ': lista consultas e pesquisa na web — ' + sum);
  t(/1 pesquisa na web/.test(await ele.locator('.ia-pe').textContent()), k + ': rodapé conta a pesquisa na web');
  const rola = await pg.evaluate(() => ({ pag: document.documentElement.scrollHeight <= innerHeight + 1, lat: document.documentElement.scrollWidth <= innerWidth + 1 }));
  t(rola.pag && rola.lat, k + ': sem rolagem de página ' + JSON.stringify(rola));
  if (SHOT) await pg.screenshot({ path: `${SHOT}/assistente-${w}-${tema}.png` });
  await pg.reload(); await pg.waitForTimeout(700);
  t((await pg.locator('.ia-m').count()) === 2, k + ': conversa volta depois do F5');
  t((await pg.locator('#ia-lista .ia-cv').count()) === 1 && /custo por km/.test(await pg.locator('#ia-lista .ia-cv').first().textContent()), k + ': conversa na lista da lateral com o título da pergunta');
  t((await pg.locator('.ia-av').count()) === 1 && (await pg.locator('.ia-copia').count()) === 1, k + ': resposta com o ícone do assistente e Copiar');
  await pg.click('.ia-nova-l'); await pg.waitForTimeout(200);
  t((await pg.locator('.ia-ola').count()) === 1 && (await pg.locator('#ia-lista .ia-cv').count()) === 1, k + ': Nova conversa abre tela vazia e guarda a anterior');
  await pg.locator('#ia-lista .ia-cv').first().click(); await pg.waitForTimeout(200);
  t((await pg.locator('.ia-m').count()) === 2, k + ': clicar na conversa da lista volta a ela');
  t(!erros.length, k + ': sem erro de página ' + erros.join(' | '));
  await ctx.close();
}
{ const { pg, ctx } = await abre('outro@conlogsa.com.br', 1366, 768, 'dark');
  t(await pg.locator('.gate').isVisible() && !(await pg.locator('#miolo').isVisible()), 'outro login: gate'); await ctx.close(); }
// ── colar imagem, renomear, título automático, parar e resposta interrompida ──
{ const { pg, ctx, erros, pedidos } = await abre('fortesindicadores@gmail.com', 1366, 768, 'dark');
  await pg.evaluate(() => { ['gem_assistente_conv', 'gem_assistente_atual'].forEach(x => localStorage.removeItem(x)); }); await pg.reload(); await pg.waitForTimeout(700);
  const cola = () => pg.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1200; const x = c.getContext('2d'); x.fillStyle = '#f60'; x.fillRect(0, 0, 2400, 1200);
    const blob = await new Promise(r => c.toBlob(r, 'image/png')); const dt = new DataTransfer(); dt.items.add(new File([blob], 'print.png', { type: 'image/png' }));
    document.getElementById('ia-txt').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await cola(); await pg.waitForSelector('.ia-anx-i', { timeout: 5000 });
  t((await pg.locator('.ia-anx-i').count()) === 1, 'colar imagem: a miniatura aparece acima da caixa');
  await pg.click('#ia-env'); await pg.waitForTimeout(700);
  const m1 = pedidos.at(-1).b.mensagens.at(-1);
  t(m1.imagens && m1.imagens.length === 1 && m1.imagens[0].tipo === 'image/jpeg' && m1.imagens[0].b64.length > 2000 && m1.content === 'Veja a imagem.', 'a imagem vai à função em base64 (JPEG), mesmo sem texto — ' + (m1.imagens ? m1.imagens[0].b64.length : 'sem imagem'));
  const dim = await pg.evaluate(async b64 => { const i = new Image(); i.src = 'data:image/jpeg;base64,' + b64; await i.decode(); return [i.naturalWidth, i.naturalHeight]; }, m1.imagens[0].b64);
  t(dim[0] === 1568 && dim[1] === 784, 'a imagem é reduzida para 1568 px no lado maior — ' + dim.join('×'));
  t(pedidos.at(-1).b.titulo === true, 'a 1ª pergunta da conversa pede o título à função');
  t((await pg.locator('.ia-m.eu .ia-imgs img').count()) === 1 && (await pg.locator('.ia-anx-i').count()) === 0, 'a imagem fica na pergunta e sai da caixa');
  t(/Evolução do custo por km/.test(await pg.locator('#ia-lista .ia-cv').first().textContent()), 'título automático vindo da função — ' + await pg.locator('#ia-lista .ia-cv').first().textContent());
  t(!/ainda não lê imagens/.test(await pg.locator('.ia-m.ele').last().textContent()), 'função nova: sem o aviso de imagem não lida');
  // renomear
  await pg.locator('#ia-lista .ia-cv').first().hover(); await pg.click('#ia-lista .ia-cv-e'); await pg.fill('#ia-lista .ia-cv-in', 'Reembolso do Pedro'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150);
  t(/Reembolso do Pedro/.test(await pg.locator('#ia-lista .ia-cv').first().textContent()), 'renomear a conversa pelo lápis');
  await pg.fill('#ia-txt', 'E no ano?'); await pg.click('#ia-env'); await pg.waitForTimeout(600);
  const p2 = pedidos.at(-1).b;
  t(p2.titulo === false && /Reembolso do Pedro/.test(await pg.locator('#ia-lista .ia-cv').first().textContent()), 'o nome escrito à mão não é trocado pelo automático');
  t(p2.mensagens.some(m => m.imagens && m.imagens.length === 1) && p2.mensagens.some(m => m.role === 'assistant' && m.consultas && m.consultas[0].sql === 'select 1'), 'a pergunta seguinte reenvia a imagem e as consultas já feitas');
  await pg.reload(); await pg.waitForTimeout(700);
  t(/Reembolso do Pedro/.test(await pg.locator('#ia-lista .ia-cv').first().textContent()) && (await pg.locator('.ia-m.eu .ia-imgs img').count()) === 1, 'depois do F5: o nome e a miniatura continuam');
  // parar
  await pg.fill('#ia-txt', 'essa demora'); await pg.click('#ia-env'); await pg.waitForTimeout(400);
  t(await pg.locator('#ia-env').evaluate(b => b.classList.contains('ia-parando') && !b.disabled && /rect/.test(b.innerHTML)), 'enquanto responde, o botão vira Parar');
  await pg.click('#ia-env'); await pg.waitForTimeout(400);
  const par = await pg.locator('.ia-m.ele').last().textContent();
  t(/Consulta interrompida/.test(par) && !/Erro:/.test(par) && await pg.locator('#ia-env').evaluate(b => !b.classList.contains('ia-parando')), 'Parar interrompe sem virar erro e o botão volta — ' + par.slice(0, 60));
  // resposta que morre no meio
  await pg.fill('#ia-txt', 'essa corta'); await pg.click('#ia-env'); await pg.waitForTimeout(600);
  const cor = await pg.locator('.ia-m.ele').last().textContent();
  t(/interrompida antes de terminar/.test(cor) && !/sem resposta/.test(cor), 'conexão fechada sem o fim: diz que parou no tempo limite, não "(sem resposta)"');
  // função antiga (sem o evento ver) com imagem
  await cola(); await pg.waitForSelector('.ia-anx-i'); await pg.fill('#ia-txt', 'função antiga'); await pg.click('#ia-env'); await pg.waitForTimeout(700);
  t(/ainda não lê imagens/.test(await pg.locator('.ia-m.ele').last().textContent()), 'função antiga publicada: avisa que a imagem não foi lida');
  // colar texto continua colando texto
  const colou = await pg.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', 'só texto'); const e = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); document.getElementById('ia-txt').dispatchEvent(e); return e.defaultPrevented; });
  t(colou === false && (await pg.locator('.ia-anx-i').count()) === 0, 'colar texto não vira anexo');
  t((await pg.locator('.ia-clip').count()) === 1, 'botão de anexar imagem na caixa');
  const rola = await pg.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1);
  t(rola, 'sem rolagem de página com imagem na conversa');
  if (SHOT) await pg.screenshot({ path: `${SHOT}/assistente-imagem.png` });
  t(!erros.length, 'sem erro de página ' + erros.join(' | '));
  await ctx.close(); }
// título de partida (antes do da função): tira o cabeçalho do WhatsApp
{ const { pg, ctx } = await abre('fortesindicadores@gmail.com', 1366, 768, 'dark');
  await pg.evaluate(() => { ['gem_assistente_conv', 'gem_assistente_atual'].forEach(x => localStorage.removeItem(x)); }); await pg.reload(); await pg.waitForTimeout(700);
  await pg.fill('#ia-txt', '[09:52, 17/11/2026] Pedro Coord. Frota: função antiga, qual o desconto de lavagem de outubro? Preciso para hoje.'); await pg.click('#ia-env'); await pg.waitForTimeout(600);
  const tit = await pg.locator('#ia-lista .ia-cv').first().textContent();
  t(/^Função antiga, qual o desconto de lavagem/.test(tit.trim()) && !/09:52/.test(tit), 'título de partida sem o cabeçalho do WhatsApp — ' + tit.trim());
  await ctx.close(); }
// card no hub, cluster Administração, só para o dono
const hub = readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
t(/"t": "Assistente"[^}]*"h": "assistente\/"[^}]*"dono": true/.test(hub), 'card Assistente no hub, só para o dono');
await b.close(); srv.close();
console.log(`\n${ok} ok · ${falha} falha(s)`); process.exit(falha ? 1 : 0);
