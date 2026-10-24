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
//   mapa           — a sonda + percorre a Exportação (Criar Novo Modelo →
//                    Padrão → ROTA → vigência → Marcar todos → 1 aba → 1
//                    tabela) e lista o que cada passo oferece e chama. Não
//                    salva modelo nem exporta.
//   exportar       — exporta de verdade, canal a canal, as tabelas da 1ª rodada
//                    (Renan, 24/10/2026): ROTA Caminhão + Van · AS Caminhão ·
//                    ARMAZEM Equipamento Armazém · EMPURRADA e INSUMOS Cavalo +
//                    Carreta. Uma aba por tabela, com o nome da tabela; vigências
//                    pelo FT_VIGS (nº das mais recentes, padrão 1, no máximo 8).
//                    Baixa o xlsx, mede (abas, linhas, colunas, tamanho) e
//                    APAGA. Ainda não grava no banco: a forma real decide o SQL.
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

// forma da resposta JSON da API (chaves e tamanhos, nunca valores): é o que
// diz se o robô pode pedir lista de tabelas, campos, vigências e unidades direto
const formas = new Map();
let TABELAS = [];   // a lista de tabelas do canal, como a API devolve (só nomes)
page.on('response', async res => {
  const u = res.url();
  if (!/apim\.ambevdevs\.com\.br/.test(u)) return;
  if (!/json/.test(res.headers()['content-type'] || '')) return;
  try {
    const j = await res.json();
    const forma = v => Array.isArray(v)
      ? `[${v.length}]${v.length && v[0] && typeof v[0] === 'object' ? '{' + Object.keys(v[0]).slice(0, 25).join(',') + '}' : ''}`
      : (v && typeof v === 'object')
        ? '{' + Object.entries(v).slice(0, 25).map(([k, x]) => Array.isArray(x) ? `${k}[${x.length}]` : k).join(',') + '}'
        : typeof v;
    formas.set(`${res.request().method()} ${semValores(u)}`, forma(j));
    if (/\/export\/tables\//.test(u) && Array.isArray(j)) TABELAS = j;
  } catch (e) {}
});

// ── modo mapa: percorre a Exportação (ROTA) SEM exportar ─────────────
// Cada passo escolhe uma opção, fotografa e lista o que a tela oferece. As
// chamadas que a tela fizer em cada passo (vigências do canal, unidades,
// tabelas, campos) ficam no relatório de API do fim.
const sel = s => page.locator(s).first();
async function opcoes() {
  return page.$$eval('ng-dropdown-panel .ng-option', els => els.map(e => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
}
async function abre(loc, nome) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  try { await loc.locator('.ng-select-container').first().click({ timeout: 15000 }); }
  catch (e) { log(`${nome}: clique normal falhou (${e.message.split('\n')[0]}), tentando forçado`); await loc.locator('.ng-select-container').first().click({ force: true, timeout: 5000 }); }
  await page.waitForSelector('ng-dropdown-panel .ng-option', { timeout: 20000 });
  await page.waitForTimeout(800);
  const o = await opcoes();
  log(`${nome}: ${o.length} opção(ões)`, o.length > 40 ? `· primeiras: ${o.slice(0, 12).join(' | ')} · últimas: ${o.slice(-6).join(' | ')}` : `· ${o.join(' | ')}`);
  return o;
}
async function escolhe(txt) {
  await page.locator('ng-dropdown-panel .ng-option', { hasText: txt }).first().click({ timeout: 10000 });
  await page.waitForTimeout(2500);
}
async function fecha() { await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(500); }
// índice do ÚLTIMO ng-select cujo rótulo casa: a página tem um conjunto
// escondido (Seleção de Unidades) antes do formulário de Exportação
async function idxDe(rx) {
  return page.$$eval('ng-select', (els, src) => {
    const r = new RegExp(src, 'i'); let achou = -1;
    els.forEach((e, i) => {
      let p = e, txt = '';
      for (let k = 0; k < 5 && p && !txt; k++) { p = p.parentElement; const l = p && p.querySelector('label, p.text'); if (l) txt = l.innerText.trim(); }
      if (r.test(txt)) achou = i;
    });
    return achou;
  }, rx.source);
}
async function selDe(rx) {
  const i = await idxDe(rx);
  if (i < 0) throw new Error('select não achado: ' + rx.source);
  const loc = page.locator('ng-select').nth(i);
  const info = await loc.evaluate(e => {
    const r = e.getBoundingClientRect();
    const topo = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return `idx visível=${r.width > 0 && r.height > 0} caixa=${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)} travado=${e.classList.contains('ng-select-disabled')} por cima=${topo ? topo.tagName + '.' + String(topo.className).slice(0, 60) : '-'}`;
  });
  log(`select ${rx.source} → nº ${i} · ${info}`);
  return loc;
}
async function rotulosDosSelects() {
  return page.$$eval('ng-select', els => els.map((e, i) => {
    let p = e, txt = '';
    for (let k = 0; k < 5 && p && !txt; k++) { p = p.parentElement; const l = p && p.querySelector('label, p.text'); if (l) txt = l.innerText.trim(); }
    return `${i}:${txt || '?'}${e.classList.contains('ng-select-disabled') ? ' (travado)' : ''}${e.classList.contains('ng-select-multiple') ? ' (múltipla)' : ''}`;
  }));
}

async function mapa() {
  log('── MAPA: Criar Novo Modelo → Padrão → ROTA → vigência → unidades → 1 aba');
  const passo = async (nome, fn) => {
    try { await fn(); } catch (e) { log(`passo "${nome}" falhou:`, e.message.split('\n')[0]); await foto(page, 'falha-' + nome.replace(/\W/g, '')); }
  };
  await passo('modelo', async () => {
    await abre(sel('wac-select[bindlabel="modelo"] ng-select'), 'Modelo');
    await escolhe('Criar Novo Modelo');
    await foto(page, 'mapa-modelo');
    log('selects na tela:', (await rotulosDosSelects()).join(' · '));
  });
  await passo('tipo', async () => {
    await abre(await selDe(/tipo de exporta/), 'Tipo de exportação'); await escolhe('Padrão'); await fecha();
  });
  await passo('canal', async () => { await abre(await selDe(/canal/), 'Canal/Segmento'); await escolhe('ROTA'); });
  await passo('vigencia', async () => {
    const o = await abre(await selDe(/vig/), 'Vigência');
    if (o.length) await escolhe(o[0]);
    await fecha();
    await foto(page, 'mapa-vigencia');
  });
  await passo('unidade', async () => {
    await abre(await selDe(/unidade/), 'Unidade');
    const mt = page.getByText(/Marcar todos/i).first();
    if (await mt.count()) { await mt.click(); await page.waitForTimeout(1500); log('Marcar todos: clicado'); }
    else log('botão "Marcar todos" não achado');
    await fecha();
    const v = await page.locator('#unidade').last().innerText().catch(() => '');
    log('campo Unidade depois:', v.replace(/\s+/g, ' ').slice(0, 120));
    await foto(page, 'mapa-unidade');
  });
  await passo('aba', async () => {
    await page.getByText(/Adicionar nova aba/i).first().click({ timeout: 10000 });
    await page.waitForTimeout(3000);
    await foto(page, 'mapa-aba');
    log(`tabelas do canal pela API (${TABELAS.length}):`, TABELAS.map(t => t.comFormatacao || t.semFormatacao).join(' | '));
    log('nomes sem formatação:', TABELAS.map(t => t.semFormatacao).join(' | '));
    const primeira = TABELAS[0] && (TABELAS[0].comFormatacao || TABELAS[0].semFormatacao);
    if (primeira) {
      await page.getByText(primeira, { exact: true }).first().click({ timeout: 10000 });
      await page.waitForTimeout(3500);
      const corpo = await page.locator('body').innerText();
      const i = corpo.search(/Total campos selecionados/i);
      log(`tabela "${primeira}" → trecho dos campos:`, i >= 0 ? corpo.slice(i, i + 1500).replace(/\s*\n\s*/g, ' | ') : '(texto "Total campos selecionados" não achado)');
      await foto(page, 'mapa-campos');
    } else log('a API não devolveu tabela nenhuma')
  });
  log('── MAPA: fim (nada foi salvo nem exportado)');
}


// ── modo exportar ──────────────────────────────────────────────────
// 1ª rodada (Renan, 24/10/2026). Texto = nome exato da tabela; regex = todas
// as tabelas do canal cujo nome casa ("tudo que tiver pneus escrito", "tudo que tiver manutenção")
const RODADA1 = {
  ROTA: ['Caminhão', 'Van', 'Resumo - SRTrans', 'Resumo - SRTrans Van', 'Resumo Rota', 'Resumo Van', 'Combustível', /pneu/i, /manuten/i],
  AS: ['Caminhão', 'Combustível', /pneu/i, /manuten/i],
  ARMAZEM: ['Equipamento Armazém', 'Faturamento'],
  EMPURRADA: ['Cavalo', 'Carreta', 'Trechos', 'Faturamento', 'Combustível', /pneu/i, /manuten/i],
  INSUMOS: ['Cavalo', 'Carreta', 'Trechos', 'Faturamento'],
};
const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const CANAIS = (process.env.FT_CANAIS || Object.keys(RODADA1).join(',')).split(',').map(x => x.trim().toUpperCase()).filter(Boolean);
const NVIG = Math.max(1, Math.min(8, Number(process.env.FT_VIGS || 1)));
const DL = 'freightech-dl';

// o nome da tabela como a API devolve: igual (sem acento/caixa) primeiro, senão o que começa igual
function achaTabela(alvo) {
  const n = norm(alvo);
  const nome = t => t.comFormatacao || t.semFormatacao;
  return TABELAS.find(t => norm(nome(t)) === n) || TABELAS.find(t => norm(t.semFormatacao) === n.replace(/ /g, ''))
    || TABELAS.find(t => norm(nome(t)).startsWith(n)) || null;
}

// clica no elemento visível cujo texto (sem acento/caixa) é exatamente o alvo,
// dentro do painel que contém o rótulo `ancora` (ou na página inteira)
async function clicaTexto(alvo, ancora) {
  const id = await page.evaluate(({ alvo, ancora }) => {
    const nz = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
    let raiz = document.body;
    if (ancora) {
      const a = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && nz(e.textContent).includes(nz(ancora))).pop();
      if (a) { raiz = a; for (let i = 0; i < 6 && raiz.parentElement; i++) { raiz = raiz.parentElement; if (raiz.innerText.length > 200) break; } }
    }
    const cand = [...raiz.querySelectorAll('*')].filter(e => {
      const r = e.getBoundingClientRect();
      return nz(e.innerText) === nz(alvo) && [...e.children].every(c => nz(c.innerText) !== nz(alvo));
    });
    if (!cand.length) return null;
    const k = 'ft' + Math.random().toString(36).slice(2, 8);
    cand[cand.length - 1].setAttribute('data-ft', k);
    return k;
  }, { alvo, ancora });
  if (!id) return false;
  const loc = page.locator(`[data-ft="${id}"]`);
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await loc.click({ timeout: 10000 }).catch(async () => loc.click({ force: true, timeout: 5000 }));
  return true;
}

// dentro do painel "Selecione uma tabela": digita na busca e clica no nome
async function escolheTabela(nome) {
  const busca = await page.evaluate(() => {
    const nz = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const a = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && nz(e.textContent).includes('SELECIONE UMA TABELA')).pop();
    if (!a) return null;
    let p = a; for (let i = 0; i < 6 && p; i++) { p = p.parentElement; const inp = p && [...p.querySelectorAll('input')].filter(x => x.getBoundingClientRect().width > 0).pop(); if (inp) { const k = 'ftb' + Math.random().toString(36).slice(2, 8); inp.setAttribute('data-ft', k); return k; } }
    return null;
  });
  let b2 = busca;
  if (!b2) {
    const ph = page.locator('input[placeholder*="tabela" i]:visible').last();
    if (await ph.count()) b2 = await ph.evaluate(e => { const k = 'ftb' + Math.random().toString(36).slice(2, 8); e.setAttribute('data-ft', k); return k; });
  }
  const busca2 = b2;
  if (busca2) { await page.locator(`[data-ft="${busca2}"]`).fill(''); await page.locator(`[data-ft="${busca2}"]`).fill(nome.slice(0, 40)); await page.waitForTimeout(1500); }
  else log('   busca do painel de tabelas não achada; procurando o nome na lista');
  for (const t of [nome, nome.toUpperCase()]) if (await clicaTexto(t, 'Selecione uma tabela')) return true;
  return false;
}

async function selecionaTodosCampos() {
  const b = page.getByText(/^\s*Selecionar todos\s*$/i).last();
  if (await b.count()) { await b.click({ timeout: 10000 }).catch(() => b.click({ force: true })); await page.waitForTimeout(1500); }
  const corpo = await page.locator('body').innerText();
  const m = corpo.match(/Total campos selecionados:?\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

// renomeia a aba ativa: tenta duplo clique no nome e, se aparecer um campo, escreve
async function renomeiaAba(nome) {
  const info = await page.evaluate(() => {
    const nz = t => String(t || '').toUpperCase();
    const add = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && /ADICIONAR NOVA ABA/.test(nz(e.textContent))).pop();
    if (!add) return null;
    let barra = add; for (let i = 0; i < 4 && barra.parentElement; i++) barra = barra.parentElement;
    return barra.outerHTML.replace(/\s+/g, ' ').replace(/>[^<]{1,40}</g, '>…<').slice(0, 900);
  });
  log('   barra de abas (estrutura):', info || '(não achada)');
  const inp = page.locator('input[placeholder*="aba" i], input[formcontrolname*="aba" i], input[formcontrolname*="nome" i]').last();
  if (await inp.count() && await inp.isVisible().catch(() => false)) { await inp.fill(nome); await inp.press('Enter').catch(() => {}); return 'campo'; }
  return null;
}

// espera o 2º aviso (arquivo pronto), clica e pega o download; reserva: a nuvem
async function esperaArquivo(rotulo, limiteMs) {
  fs.mkdirSync(DL, { recursive: true });
  const t0 = Date.now();
  const vistos = new Set();
  while (Date.now() - t0 < limiteMs) {
    const avisos = await page.$$eval('.toast, .toast-container *, [class*="toast"], [class*="snack"], [class*="notification"], [role="alert"], [class*="swal"]',
      els => [...new Set(els.map(e => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(t => t && t.length < 300))]).catch(() => []);
    for (const a of avisos) if (!vistos.has(a)) { vistos.add(a); log(`   aviso (${Math.round((Date.now() - t0) / 1000)} s): ${a}`); }
    if (avisos.some(a => /com erro|n[aã]o conseguimos/i.test(a))) { log('   o FT recusou a exportação (aviso de erro)'); return null; }
    const pronto = avisos.find(a => /dispon|pronto|conclu|clique|download|baixar/i.test(a) && !/processando|solicitada/i.test(a));
    if (pronto) {
      const alvo = page.locator('.toast, [class*="toast"], [class*="snack"], [class*="notification"], [role="alert"], [class*="swal"]').filter({ hasText: pronto.slice(0, 40) }).last();
      const link = alvo.locator('a, button').first();
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }).catch(() => null),
        (await link.count() ? link : alvo).click({ timeout: 10000 }).catch(e => log('   clique no aviso falhou:', e.message.split('\n')[0])),
      ]);
      if (dl) { const f = `${DL}/${rotulo}.xlsx`; await dl.saveAs(f); log(`   download pelo aviso em ${Math.round((Date.now() - t0) / 1000)} s · nome do FT: ${dl.suggestedFilename()}`); return f; }
      log('   o clique no aviso não gerou download');
    }
    await page.waitForTimeout(5000);
  }
  log(`   nenhum aviso de arquivo pronto em ${Math.round(limiteMs / 1000)} s; tentando pela nuvem (Acompanhamento)`);
  await foto(page, 'sem-aviso-' + rotulo);
  return await pelaNuvem(rotulo);
}

async function pelaNuvem(rotulo) {
  const nuvem = page.locator('[class*="cloud"], [mattooltip*="xport" i], [title*="xport" i], [aria-label*="xport" i]').first();
  if (!(await nuvem.count())) { log('   ícone da nuvem não achado'); return null; }
  await nuvem.click({ timeout: 10000 }).catch(e => log('   clique na nuvem falhou:', e.message.split('\n')[0]));
  await page.waitForTimeout(4000);
  await foto(page, 'nuvem-' + rotulo);
  const linha = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr, [role="row"], mat-row')].filter(r => /dispon/i.test(r.innerText));
    return rows.length ? rows[0].outerHTML.replace(/\s+/g, ' ').replace(/>[^<]{1,40}</g, '>…<').slice(0, 800) : null;
  });
  log('   1ª linha disponível na nuvem (estrutura):', linha || '(nenhuma)');
  const botao = page.locator('tr, [role="row"], mat-row').filter({ hasText: /dispon/i }).first().locator('button, a, i, mat-icon, svg').first();
  if (!(await botao.count())) return null;
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }).catch(() => null), botao.click({ timeout: 10000 }).catch(() => {})]);
  if (!dl) { log('   o 1º ícone da linha não baixou nada'); return null; }
  const f = `${DL}/${rotulo}.xlsx`; await dl.saveAs(f); log('   download pela nuvem · nome do FT:', dl.suggestedFilename()); return f;
}

// mede o xlsx (abas, linhas, colunas, nomes das colunas) e apaga: nada de valor no log
async function mede(f) {
  const XLSX = (await import('xlsx')).default;
  const tam = fs.statSync(f).size;
  const wb = XLSX.read(fs.readFileSync(f), { type: 'buffer', dense: true });
  log(`   arquivo: ${(tam / 1024).toFixed(0)} KB · ${wb.SheetNames.length} aba(s)`);
  for (const n of wb.SheetNames) {
    const m = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false });
    const cab = (m[0] || []).map(String);
    log(`   · aba "${n}": ${Math.max(0, m.length - 1)} linhas × ${cab.length} colunas · colunas: ${cab.join(' | ').slice(0, 1500)}`);
  }
  fs.rmSync(f, { force: true });
  log('   arquivo apagado');
}

// pedidos que a tela manda ao serviço de exportação: só as CHAVES do corpo
page.on('request', req => {
  if (req.method() === 'GET' || !/exportacao-importacao|\/export/.test(req.url())) return;
  let forma = '(sem corpo)';
  try {
    const j = JSON.parse(req.postData() || 'null');
    const f = (v, d) => Array.isArray(v) ? `[${v.length}]${v.length ? f(v[0], d + 1) : ''}` : (v && typeof v === 'object' && d < 3) ? '{' + Object.entries(v).map(([k, x]) => k + (x && typeof x === 'object' ? f(x, d + 1) : '')).join(',') + '}' : '';
    if (j) forma = f(j, 0);
  } catch (e) { forma = '(corpo não-JSON, ' + (req.postData() || '').length + ' B)'; }
  log(`   → ${req.method()} ${semValores(req.url())} · corpo ${forma}`);
  if (/\/request\/export\/generic/.test(req.url())) {
    try {
      const j = JSON.parse(req.postData()); CORPO_EXPORT = j;
      const u0 = (j.unidades || [])[0];
      log(`   corpo do pedido: id=${typeof j.id}${j.id == null ? '(vazio)' : ''} · modelo=${JSON.stringify(j.modelo)} · tipoExportacao=${JSON.stringify(j.tipoExportacao)} · tipoCanal=${JSON.stringify(j.tipoCanal)} · vigencias=${JSON.stringify(j.vigencias)} · exportarFormulas=${j.exportarFormulas} · abas=${JSON.stringify(j.abas).slice(0, 900)} · unidade[0]: ${typeof u0}${u0 && typeof u0 === 'object' ? ' {' + Object.keys(u0).join(',') + '}' : typeof u0 === 'string' ? ' com ' + u0.length + ' caracteres' + (/^\d+$/.test(u0) ? ' (só dígitos)' : '') : ''}`);
    } catch (e) {}
  }
});
let CORPO_EXPORT = null;
// a situação do pedido (status, histórico com a mensagem de erro, onde fica o arquivo)
page.on('response', async res => {
  if (!/request-export-import\/by-id|request\/export\/generic/.test(res.url())) return;
  try {
    let j = await res.json(); if (Array.isArray(j)) j = j[0];
    if (!j) return;
    const arq = j.arquivo;
    const arqTxt = arq == null ? 'vazio' : typeof arq === 'string' ? (/^https?:/.test(arq) ? 'URL ' + semValores(arq) : `texto ${arq.length} car.: ${arq.replace(/[?#].*$/, '').slice(0, 120)}`) : 'objeto {' + Object.keys(arq).join(',') + '}';
    log(`   ← ${semValores(res.url())} · status=${JSON.stringify(j.status)} · inicio=${j.inicioProcessamento || '-'} · fim=${j.fimProcessamento || '-'} · envioArquivoParaStorage=${JSON.stringify(j.envioArquivoParaStorage)} · arquivo=${arqTxt} · histórico=${JSON.stringify(j.historico).slice(0, 700)}`);
  } catch (e) {}
});

// "Adicionar nova aba" abre a caixa NOVA ABA (Nome da aba · SALVAR · CANCELAR):
// escreve o nome da tabela e salva SÓ nessa caixa (o outro SALVAR grava o modelo)
async function criaAba(nome) {
  await semSpinner();
  await page.getByText(/Adicionar nova aba/i).first().click({ timeout: 15000 });
  await page.waitForTimeout(1500);
  const k = await page.evaluate(() => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const lab = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && /^\s*Nome da aba\s*$/i.test(e.textContent) && vis(e)).pop();
    if (!lab) return null;
    let box = lab; for (let i = 0; i < 8 && box; i++) { box = box.parentElement; if (box && /CANCELAR/i.test(box.innerText) && box.querySelector('input')) break; }
    if (!box) return null;
    const id = 'ftc' + Math.random().toString(36).slice(2, 8);
    box.setAttribute('data-ft', id);
    return id;
  });
  if (!k) { log('   caixa "Nova aba" não achada'); return false; }
  const caixa = page.locator(`[data-ft="${k}"]`);
  await caixa.locator('input:visible').first().fill(nome.slice(0, 60));
  await caixa.getByText(/^\s*Salvar\s*$/i).last().click({ timeout: 10000 });
  await page.waitForTimeout(2000);
  await semSpinner();
  return true;
}
async function semSpinner() {
  await page.waitForFunction(() => ![...document.querySelectorAll('.ngx-spinner-overlay')].some(e => e.getBoundingClientRect().width > 0), null, { timeout: 60000 }).catch(() => log('   (spinner ainda na tela depois de 60 s)'));
}
let dumpFeito = false;
async function dumpAba() {
  if (dumpFeito) return; dumpFeito = true;
  const d = await page.evaluate(() => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const inputs = [...document.querySelectorAll('input, textarea')].filter(vis).map(e => `${e.tagName.toLowerCase()}[${e.type}] ph="${e.placeholder || ''}" fc="${e.getAttribute('formcontrolname') || ''}"`);
    const t = document.body.innerText; const i = t.search(/Adicionar nova aba/i);
    return { inputs, texto: i >= 0 ? t.slice(i, i + 2500) : t.slice(0, 1500) };
  });
  log('   inputs visíveis:', d.inputs.join(' · '));
  log('   texto depois de "Adicionar nova aba":', d.texto.replace(/\s*\n\s*/g, ' | '));
}
async function exportar() {
  log(`── EXPORTAR: canais ${CANAIS.join(', ')} · ${NVIG} vigência(s) mais recente(s) · tabelas da 1ª rodada`);
  const resumo = [];
  for (const canal of CANAIS) {
    const SO = (process.env.FT_TABS || '').split(',').map(x => x.trim()).filter(Boolean);
    const alvos = SO.length ? SO : (RODADA1[canal] || []);
    log(`── ${canal}: ${alvos.join(', ')}`);
    try {
      await page.goto(BASE + '/#/home', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.goto(BASE + '/#/exportacao-dados', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
      TABELAS = [];
      await abre(sel('wac-select[bindlabel="modelo"] ng-select'), 'Modelo'); await escolhe('Criar Novo Modelo');
      await abre(await selDe(/tipo de exporta/), 'Tipo'); await escolhe('Padrão'); await fecha();
      await abre(await selDe(/canal/), 'Canal'); await page.locator('ng-dropdown-panel .ng-option').filter({ hasText: new RegExp(`^\\s*${canal}\\s*$`) }).first().click({ timeout: 10000 }); await page.waitForTimeout(2500);
      const vs = (await abre(await selDe(/vig/), 'Vigência')).filter(v => /_\d_\d{1,2}_\d{4}$/.test(v)).slice(0, NVIG);
      for (const v of vs) {
        if (!(await page.locator('ng-dropdown-panel .ng-option').count())) await abre(await selDe(/vig/), 'Vigência');
        await page.locator('ng-dropdown-panel .ng-option').filter({ hasText: new RegExp(`^\\s*${v}\\s*$`) }).first().click({ timeout: 10000 });
        await page.waitForTimeout(800);
      }
      await fecha(); log(`   vigências: ${vs.join(', ')}`);
      await abre(await selDe(/unidade/), 'Unidade');
      await page.getByText(/Marcar todos/i).last().click({ timeout: 10000 }); await page.waitForTimeout(1500); await fecha();
      log('   unidades:', (await (await selDe(/unidade/)).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120));
      let nAbas = 0;
      // a lista de tabelas do canal: já vem quando o canal é escolhido; senão, espera
      for (let i = 0; i < 30 && !TABELAS.length; i++) await page.waitForTimeout(500);
      const lista = [], vistos = new Set();
      for (const alvo of alvos) {
        const ts = alvo instanceof RegExp ? TABELAS.filter(x => alvo.test(x.comFormatacao || '') || alvo.test(x.semFormatacao || '')) : [achaTabela(alvo)].filter(Boolean);
        if (!ts.length) log(`   "${alvo}" NÃO está na lista do ${canal} (${TABELAS.length}): ${TABELAS.map(x => x.comFormatacao || x.semFormatacao).join(' | ')}`);
        for (const t of ts) { const k = norm(t.semFormatacao); if (!vistos.has(k)) { vistos.add(k); lista.push(t); } }
      }
      log(`   tabelas a exportar (${lista.length}): ${lista.map(t => t.comFormatacao || t.semFormatacao).join(' | ')}`);
      for (const t of lista) {
        const nome = t.comFormatacao || t.semFormatacao;
        if (!(await criaAba(nome))) { dumpFeito = false; await dumpAba(); break; }
        if (!nAbas) { dumpFeito = false; await dumpAba(); await foto(page, `aba-${canal}`); }
        if (!(await escolheTabela(nome))) { log(`   NÃO consegui clicar na tabela "${nome}"`); await foto(page, `sem-tabela-${canal}`); dumpFeito = false; await dumpAba(); break; }
        await page.waitForTimeout(2500);
        const n = await selecionaTodosCampos();
        log(`   tabela "${nome}" (${t.semFormatacao}) · campos selecionados: ${n ?? '?'}`);
        nAbas++;
      }
      await foto(page, `pronto-${canal}`);
      if (!nAbas) { resumo.push(`${canal}: nenhuma aba montada`); continue; }
      const t0 = Date.now();
      await page.getByText(/^\s*Exportar valores\s*$/i).last().click({ timeout: 15000 });
      log('   "Exportar valores" clicado');
      const f = await esperaArquivo(`${canal}-valores`, 15 * 60 * 1000);
      if (f) { await mede(f); resumo.push(`${canal}: ${nAbas} aba(s), arquivo em ${Math.round((Date.now() - t0) / 1000)} s`); }
      else resumo.push(`${canal}: ${nAbas} aba(s), arquivo NÃO baixou`);
    } catch (e) {
      log(`   ${canal} falhou:`, e.message.split('\n')[0]); await foto(page, `falha-${canal}`);
      resumo.push(`${canal}: falhou (${e.message.split('\n')[0].slice(0, 80)})`);
    }
  }
  log('── EXPORTAR: resumo'); resumo.forEach(r => log('   ' + r));
}

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
  for (const rx of (MODE === 'exportar' ? [] : [/relat/i, /caminh/i])) {
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

  if (MODE === 'mapa') await mapa();
  if (MODE === 'exportar') await exportar();

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
    log(`   ${k} · ${c.n}× · HTTP ${[...c.status].join('/')} · ${[...c.ct].join('/') || '?'} · até ${c.bytes} B${c.bearer ? ' · Bearer' : ''}${formas.has(k) ? ' · forma ' + formas.get(k) : ''}`));
  await browser.close();
  log('modo', MODE, '· fim');
}
