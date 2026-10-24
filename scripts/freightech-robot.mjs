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
//   carga          — tudo pela API, desde FT_DESDE (2022), gravando em ft_linha/ft_layout
//                    (scripts/freightech-supabase.sql). FT_ULTIMAS=n limita às n últimas quinzenas.
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
let TABELAS = [];
let UNIDADES_API = [];   // a lista de tabelas do canal, como a API devolve (só nomes)
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
    if (/\/export\/tables\/(?!fields)/.test(u) && Array.isArray(j)) TABELAS = j;
    if (/buscar\/unidades/.test(u) && Array.isArray(j)) UNIDADES_API = j;
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



// ── pedido direto pela API (sem clicar na tela) ─────────────────────
// Reaproveita o pedido que a tela acabou de mandar (cabeçalhos e corpo, só em
// memória) e troca a aba. Devolve o caminho do arquivo baixado, ou null.
const API_EXP = 'https://apim.ambevdevs.com.br/freightech-exportacao-importacao-prod/v1';
const API_BACK = 'https://apim.ambevdevs.com.br/freightech-backend-prod/v1';
async function apiExporta(tabela, rotulo) {
  if (!CORPO_EXPORT || !HEAD_API) { log('   API: sem o pedido da tela para reaproveitar'); return null; }
  const head = Object.fromEntries(Object.entries(HEAD_API).filter(([k]) => !/^(host|content-length|sec-|accept-encoding|connection|origin|referer|user-agent|cookie)/i.test(k)));
  const r = await page.evaluate(async ({ API_EXP, API_BACK, head, corpo, tabela, byid, respId, dlTpl }) => {
    const out = { passos: [] };
    const j = async (u, o) => { const x = await fetch(u, { headers: head, ...o }); const t = await x.text(); let v = null; try { v = JSON.parse(t); } catch (e) {} return { st: x.status, v, t }; };
    const f = await j(`${API_BACK}/export/tables/fields/${encodeURIComponent(tabela.semFormatacao)}?onlyExportAllowed=true`);
    out.passos.push(`campos ${f.st} (${Array.isArray(f.v) ? f.v.length : '?'})`);
    if (!Array.isArray(f.v)) return out;
    const tb0 = corpo.abas[0].tabela;
    const tb = { ...tb0, campos: f.v };
    for (const k of Object.keys(tb0)) if (k !== 'campos' && typeof tb0[k] === 'string') { if (tb0[k] === corpo.abas[0].tabela.semFormatacao || /semFormat/i.test(k)) tb[k] = tabela.semFormatacao; if (/comFormat/i.test(k)) tb[k] = tabela.comFormatacao; }
    const body = { ...corpo, abas: [{ nome: tabela.comFormatacao, tabela: tb }] };
    const p = await j(`${API_EXP}/request/export/generic`, { method: 'POST', body: JSON.stringify(body) });
    out.passos.push(`pedido ${p.st} · status ${p.v && p.v.status}`);
    if (!p.v) return out;
    const chave = byid && byid[0] === respId.solicitacaoId ? 'solicitacaoId' : 'id';
    let st = p.v;
    for (let i = 0; i < 60 && st && !/DISPONIVEL|ERRO/i.test(st.status || ''); i++) {
      await new Promise(rr => setTimeout(rr, 3000));
      const b = await j(`${API_EXP}/request-export-import/by-id`, { method: 'POST', body: JSON.stringify([p.v[chave]]) });
      st = Array.isArray(b.v) ? b.v[0] : b.v;
    }
    out.passos.push(`situação ${st && st.status} (by-id por ${chave})`);
    if (st && st.historico) out.erro = st.historico.map(h => h.mensagemUsuario).join(' / ');
    if (!st || !/DISPONIVEL/i.test(st.status || '') || !st.arquivo) return out;
    out.tam = st.arquivo.tamanhoBytes; out.nome = st.arquivo.nomeArquivo;
    if (!dlTpl) { out.passos.push('sem o endereço de download'); return out; }
    const url = dlTpl.url.split(dlTpl.idAntigo).join(st.arquivo.idStorage);
    const d = await fetch(url, { method: dlTpl.method, headers: head });
    out.passos.push(`download ${d.status} · ${(d.headers.get('content-type') || '').split(';')[0]}`);
    let buf = new Uint8Array(await d.arrayBuffer());
    if (/json/.test(d.headers.get('content-type') || '')) {
      const v = JSON.parse(new TextDecoder().decode(buf)); const link = typeof v === 'string' ? v : (v.url || v.link || v.sasUrl || Object.values(v).find(x => typeof x === 'string' && /^https?:/.test(x)));
      if (!link) { out.passos.push('download devolveu JSON sem link: {' + Object.keys(v).join(',') + '}'); return out; }
      const d2 = await fetch(link); buf = new Uint8Array(await d2.arrayBuffer()); out.passos.push(`download pelo link ${d2.status}`);
    }
    let bin = ''; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
    out.b64 = btoa(bin);
    return out;
  }, { API_EXP, API_BACK, head, corpo: CORPO_EXPORT, tabela, byid: CORPO_BYID, respId: RESP_EXPORT || {}, dlTpl: DL_TPL });
  log(`   API ${tabela.comFormatacao}: ${r.passos.join(' → ')}${r.erro ? ' · histórico: ' + r.erro.slice(0, 300) : ''}${r.tam ? ` · ${r.nome} ${r.tam} B` : ''}`);
  if (!r.b64) return null;
  fs.mkdirSync(DL, { recursive: true });
  const fArq = `${DL}/${rotulo}.xlsx`; fs.writeFileSync(fArq, Buffer.from(r.b64, 'base64'));
  return fArq;
}
// o endereço de download: o pedido feito depois do clique que leva o idStorage
let DL_TPL = null;
function aprendeDownload() {
  const id = RESP_ULTIMO && RESP_ULTIMO.arquivo && RESP_ULTIMO.arquivo.idStorage;
  if (!id) return;
  const r = DL_REQ.find(x => x.url.includes(id));
  if (r) { DL_TPL = { method: r.method, url: r.url, idAntigo: id }; log('   endereço de download aprendido: ' + r.method + ' ' + semValores(r.url.split(id).join('{idStorage}'))); }
  else log('   nenhum pedido depois do clique leva o idStorage');
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
    || TABELAS.find(t => norm(nome(t)).startsWith(n))
    || TABELAS.find(t => norm(nome(t)).replace(/S\b/g, '') === n.replace(/S\b/g, ''))
    || TABELAS.find(t => norm(nome(t)).includes(n) || norm(t.semFormatacao).includes(n.replace(/ /g, ''))) || null;
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
  let tentativas = 0;
  while (Date.now() - t0 < limiteMs) {
    const avisos = await page.$$eval('.toast, .toast-container *, [class*="toast"], [class*="snack"], [class*="notification"], [role="alert"], [class*="swal"]',
      els => [...new Set(els.map(e => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(t => t && t.length < 300))]).catch(() => []);
    for (const a of avisos) if (!vistos.has(a)) { vistos.add(a); log(`   aviso (${Math.round((Date.now() - t0) / 1000)} s): ${a}`); }
    if (avisos.some(a => /com erro|n[aã]o conseguimos/i.test(a))) { log('   o FT recusou a exportação (aviso de erro)'); return null; }
    const pronto = avisos.find(a => /dispon|pronto|conclu|clique|download|baixar/i.test(a) && !/processando|solicitada/i.test(a));
    if (pronto && tentativas < 2) {
      tentativas++;
      const baixar = page.getByText(/^\s*Baixar\s+.+\.xlsx\s*$/i).last();
      const est = await baixar.evaluate(e => { let x = e, out = []; for (let i = 0; i < 3 && x; i++) { out.push(x.tagName.toLowerCase() + (x.getAttribute('href') != null ? '[href]' : '') + (x.getAttribute('download') != null ? '[download]' : '') + '.' + String(x.className).slice(0, 40)); x = x.parentElement; } return out.join(' < '); }).catch(() => '(não achado)');
      log('   link "Baixar …": ' + est);
      DL_REQ.length = 0; ESPIA_DL = true;
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
        baixar.click({ timeout: 10000 }).catch(() => baixar.click({ force: true, timeout: 5000 })).catch(e => log('   clique no "Baixar" falhou:', e.message.split('\n')[0])),
      ]);
      await page.waitForTimeout(2000); ESPIA_DL = false;
      aprendeDownload();
      DL_REQ.forEach(r => log(`   pedido depois do clique: ${r.method} ${semValores(r.url)} · ${r.status ?? '?'} · ${r.ct || ''}`));
      if (dl) { const f = `${DL}/${rotulo}.xlsx`; await dl.saveAs(f); log(`   download pelo aviso em ${Math.round((Date.now() - t0) / 1000)} s · nome do FT: ${dl.suggestedFilename()}`); return f; }
      log('   o clique no "Baixar" não gerou download');
    }
    if (pronto && tentativas >= 2) break;
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
      const tb = (j.abas || [])[0] && j.abas[0].tabela;
      if (tb) log('   tabela da aba (sem os campos): ' + JSON.stringify(Object.fromEntries(Object.entries(tb).filter(([k]) => k !== 'campos'))).slice(0, 400) + ` · ${(tb.campos || []).length} campos`);
      const uni = UNIDADES_API.length ? Object.keys(UNIDADES_API[0]).filter(k => UNIDADES_API.some(x => (j.unidades || []).includes(x[k]))) : [];
      log('   unidades[] = campo do buscar/unidades: ' + (uni.join(', ') || '(nenhum casou)'));
    } catch (e) {}
  }
});
let CORPO_EXPORT = null;
let HEAD_API = null;           // cabeçalhos do pedido de exportação (só em memória, nunca no log)
let RESP_EXPORT = null, CORPO_BYID = null, RESP_ULTIMO = null, CORPO_UNID = null;
const DL_REQ = []; let ESPIA_DL = false;
page.on('request', req => {
  const u = req.url();
  if (/\/request\/export\/generic/.test(u) && req.method() === 'POST') HEAD_API = req.headers();
  if (/buscar\/unidades/.test(u) && req.method() === 'POST') { try { CORPO_UNID = JSON.parse(req.postData()); } catch (e) {} }
  if (/request-export-import\/by-id/.test(u) && !CORPO_BYID) { try { CORPO_BYID = JSON.parse(req.postData()); } catch (e) {} }
  if (ESPIA_DL && !/datadoghq|\.(png|svg|woff2?|css|js)(\?|$)/.test(u)) DL_REQ.push({ method: req.method(), url: u, req });
});
page.on('response', res => {
  const r = DL_REQ.find(x => x.req === res.request()); if (r) { r.status = res.status(); r.ct = (res.headers()['content-type'] || '').split(';')[0]; }
});
// a situação do pedido (status, histórico com a mensagem de erro, onde fica o arquivo)
page.on('response', async res => {
  if (!/request-export-import\/by-id|request\/export\/generic/.test(res.url())) return;
  try {
    let j = await res.json(); if (Array.isArray(j)) j = j[0];
    if (!j) return;
    if (/request\/export\/generic/.test(res.url())) RESP_EXPORT = j;
    if (j.arquivo) RESP_ULTIMO = j;
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
      if (f) {
        await mede(f); resumo.push(`${canal}: ${nAbas} aba(s), arquivo em ${Math.round((Date.now() - t0) / 1000)} s`);
        const outras = (process.env.FT_API_TABS || '').split(',').map(x => x.trim()).filter(Boolean);
        for (const nome of outras) {
          const t = achaTabela(nome); if (!t) { log(`   API: "${nome}" não está na lista`); continue; }
          const g = await apiExporta(t, `${canal}-api-${t.semFormatacao}`);
          if (g) { await mede(g); resumo.push(`${canal}: ${t.comFormatacao} pela API OK`); } else resumo.push(`${canal}: ${t.comFormatacao} pela API falhou`);
        }
      }
      else resumo.push(`${canal}: ${nAbas} aba(s), arquivo NÃO baixou`);
    } catch (e) {
      log(`   ${canal} falhou:`, e.message.split('\n')[0]); await foto(page, `falha-${canal}`);
      resumo.push(`${canal}: falhou (${e.message.split('\n')[0].slice(0, 80)})`);
    }
  }
  log('── EXPORTAR: resumo'); resumo.forEach(r => log('   ' + r));
}

// ── modo carga: tudo pela API, desde FT_DESDE (padrão 2022), gravando no banco ──
// 1) uma exportação pela tela (ROTA, Caminhão, última quinzena) ensina o
//    pedido: cabeçalhos, corpo, corpo do buscar/unidades (só em memória);
// 2) por canal: lista de tabelas, vigências desde FT_DESDE, de 8 em 8:
//    unidades → pedido com uma aba por tabela → espera → baixa → grava;
// 3) vigência já em ft_layout é pulada (FT_REFAZER=1 refaz).
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SB_KEY = process.env.GEM_SUPABASE_SERVICE_KEY || '';
const DESDE = Number(process.env.FT_DESDE || 2022);
const REFAZER = process.env.FT_REFAZER === '1';
const sbH = extra => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', ...extra });
async function sb(path, o = {}) {
  for (let t = 1; ; t++) {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { ...o, headers: sbH(o.headers) });
    if (r.ok || t >= 4 || r.status < 500) return r;
    await new Promise(x => setTimeout(x, 3000 * t));
  }
}

// chamada à API do FT de dentro da página (cookies do Incapsula + token novo)
async function ftApi(url, opt = {}) {
  const head = Object.fromEntries(Object.entries(HEAD_API || {}).filter(([k]) => !/^(host|content-length|sec-|accept-encoding|connection|origin|referer|user-agent|cookie)/i.test(k)));
  return page.evaluate(async ({ url, opt, head }) => {
    let tok = localStorage.getItem('kc_freightech_token') || '';
    try { const j = JSON.parse(tok); tok = j.token || j.access_token || tok; } catch (e) {}
    if (tok.split('.').length === 3) head.authorization = 'Bearer ' + tok;
    const r = await fetch(url, { ...opt, headers: head });
    if (opt.bin) {
      const buf = new Uint8Array(await r.arrayBuffer()); let bin = '';
      for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
      return { st: r.status, b64: btoa(bin) };
    }
    const t = await r.text(); let v = null; try { v = JSON.parse(t); } catch (e) {}
    return { st: r.status, v };
  }, { url, opt, head });
}
// sessão vencida: o FT responde 401/403 e, no download e nos campos, 400.
// Recarrega a página (o Keycloak renova o token) e tenta de novo, até 3 vezes.
let _ultimaRenov = 0;
async function renova(st) {
  log(`   API ${st}: renovando a sessão`);
  const antes = await page.evaluate(() => localStorage.getItem('kc_freightech_token') || '').catch(() => '');
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  for (let k = 0; k < 15; k++) {
    await page.waitForTimeout(2000);
    const agora = await page.evaluate(() => localStorage.getItem('kc_freightech_token') || '').catch(() => '');
    if (agora && agora !== antes && k >= 2) break;
  }
  _ultimaRenov = Date.now();
}
async function ftApiOk(url, opt) {
  // renova de tempos em tempos, antes de o token vencer no meio de um bloco
  if (Date.now() - _ultimaRenov > 12 * 60 * 1000) { if (_ultimaRenov) await renova('preventivo'); else _ultimaRenov = Date.now(); }
  let r = await ftApi(url, opt);
  for (let n = 0; n < 3 && [400, 401, 403].includes(r.st); n++) {
    await renova(r.st);
    r = await ftApi(url, opt);
  }
  return r;
}

// exporta (canal, vigências, tabelas) e devolve o caminho do xlsx, ou {erro}
async function exportaApi(canal, vigs, tabs, unidades, rotulo) {
  const abas = [];
  for (const t of tabs) {
    const f = await ftApiOk(`${API_BACK}/export/tables/fields/${encodeURIComponent(t.semFormatacao)}?onlyExportAllowed=true`);
    if (!Array.isArray(f.v) || !f.v.length) { log(`   campos de ${t.semFormatacao}: HTTP ${f.st}, nenhum`); continue; }
    abas.push({ nome: (t.comFormatacao || t.semFormatacao).slice(0, 31), tabela: { campos: f.v, nome: { semFormatacao: t.semFormatacao, comFormatacao: t.comFormatacao } } });
  }
  if (!abas.length) return { erro: 'nenhuma aba' };
  const body = { ...CORPO_EXPORT, abas, tipoCanal: canal, unidades, vigencias: vigs, comparacoesBenchmark: [], exportarFormulas: false };
  const p = await ftApiOk(`${API_EXP}/request/export/generic`, { method: 'POST', body: JSON.stringify(body) });
  if (!p.v || !p.v.id) return { erro: `pedido HTTP ${p.st}` };
  const chave = CORPO_BYID && RESP_EXPORT && CORPO_BYID[0] === RESP_EXPORT.solicitacaoId ? 'solicitacaoId' : 'id';
  let st = p.v; const t0 = Date.now();
  while (!/DISPONIVEL|ERRO/i.test(st.status || '') && Date.now() - t0 < 15 * 60 * 1000) {
    await page.waitForTimeout(4000);
    const b = await ftApiOk(`${API_EXP}/request-export-import/by-id`, { method: 'POST', body: JSON.stringify([p.v[chave]]) });
    st = (Array.isArray(b.v) ? b.v[0] : b.v) || st;
  }
  if (!/DISPONIVEL/i.test(st.status || '') || !st.arquivo) {
    const h = (st.historico || []).slice(-1)[0] || {};
    return { erro: `${st.status} · ${h.mensagemUsuario || ''} ${h.mensagemInterna ? '(' + String(h.mensagemInterna).replace(/Placa:\s*\S+/g, 'Placa: …') + ')' : ''}` };
  }
  const d = await ftApiOk(`https://apim.ambevdevs.com.br/freightech-integracao-externa-prod/v1/storage/${st.arquivo.idStorage}`, { bin: true });
  if (d.st !== 200 || !d.b64) return { erro: `download HTTP ${d.st}` };
  fs.mkdirSync(DL, { recursive: true });
  const f = `${DL}/${rotulo}.xlsx`; fs.writeFileSync(f, Buffer.from(d.b64, 'base64'));
  log(`   arquivo em ${Math.round((Date.now() - t0) / 1000)} s · ${(st.arquivo.tamanhoBytes / 1024).toFixed(0)} KB · ${abas.length} aba(s)`);
  return { f, abas };
}

// grava o xlsx: cada aba = uma tabela; as linhas vão por vigência (coluna Vigencia)
async function grava(f, canal, abas, vigsPedidas, temBanco) {
  const XLSX = (await import('xlsx')).default;
  const wb = XLSX.read(fs.readFileSync(f), { type: 'buffer', dense: true });
  const res = [];
  for (const nomeAba of wb.SheetNames) {
    const ab = abas.find(a => a.nome === nomeAba) || abas[wb.SheetNames.indexOf(nomeAba)];
    const tabela = ab ? ab.tabela.nome.semFormatacao : nomeAba;
    const m = XLSX.utils.sheet_to_json(wb.Sheets[nomeAba], { header: 1, blankrows: false, defval: null, raw: true });
    const cab = (m[0] || []).map(x => String(x ?? ''));
    const iV = cab.findIndex(c => /^vig/i.test(c));
    const iU = cab.findIndex(c => /^unidade - nome$/i.test(c));
    const iP = cab.findIndex(c => /^placa$/i.test(c));
    const porVig = new Map(vigsPedidas.map(v => [v, []]));
    for (const row of m.slice(1)) {
      const v = iV >= 0 ? String(row[iV] ?? '') : vigsPedidas[0];
      if (!porVig.has(v)) porVig.set(v, []);
      porVig.get(v).push(row);
    }
    for (const [vig, rows] of porVig) {
      const mm = vig.match(/_(\d)_(\d{1,2})_(\d{4})$/) || [];
      const per = { ano: +mm[3] || null, mes: +mm[2] || null, quinzena: +mm[1] || null };
      res.push(`${tabela} ${vig}: ${rows.length}`);
      if (!temBanco) continue;
      const k = `canal=eq.${encodeURIComponent(canal)}&tabela=eq.${encodeURIComponent(tabela)}&vigencia=eq.${encodeURIComponent(vig)}`;
      let r = await sb(`ft_linha?${k}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`apagar ${tabela} ${vig}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
      for (let i = 0; i < rows.length; i += 500) {
        const lote = rows.slice(i, i + 500).map((row, j) => ({
          canal, tabela, vigencia: vig, linha: i + j + 1, ...per,
          unidade: iU >= 0 && row[iU] != null ? String(row[iU]) : null,
          placa: iP >= 0 && row[iP] != null ? String(row[iP]).toUpperCase().replace(/[^A-Z0-9]/g, '') : null,
          dados: row.map(x => x === undefined ? null : x),
        }));
        r = await sb('ft_linha', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(lote) });
        if (!r.ok) throw new Error(`gravar ${tabela} ${vig}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
      }
      r = await sb('ft_layout?on_conflict=canal,tabela,vigencia', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ canal, tabela, vigencia: vig, tabela_nome: ab ? ab.tabela.nome.comFormatacao : nomeAba, ...per, colunas: cab, linhas: rows.length, carregado_em: new Date().toISOString() }]) });
      if (!r.ok) throw new Error(`layout ${tabela} ${vig}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
  }
  fs.rmSync(f, { force: true });
  return res;
}

async function carga() {
  // 1) ensina o pedido pela tela
  const so = process.env.FT_TABS; process.env.FT_TABS = 'Caminhão';
  const canaisAntes = CANAIS.splice(0, CANAIS.length, 'ROTA');
  await exportar();
  CANAIS.splice(0, CANAIS.length, ...canaisAntes); process.env.FT_TABS = so || '';
  if (!CORPO_EXPORT || !HEAD_API) { console.error('::error::a exportação pela tela não ensinou o pedido'); process.exitCode = 1; return; }
  log('   corpo do buscar/unidades: ' + (CORPO_UNID ? JSON.stringify(Object.fromEntries(Object.entries(CORPO_UNID).map(([k, v]) => [k, Array.isArray(v) ? `[${v.length}] ${String(v[0]).slice(0, 20)}` : typeof v === 'string' && v.length < 20 ? v : typeof v]))) : '(não capturado)'));
  log(`── CARGA desde ${DESDE} · canais ${CANAIS.join(', ')}${REFAZER ? ' · refazendo o que já existe' : ''}`);

  let temBanco = false, feitas = new Set();
  if (SB_KEY) {
    const r = await sb('ft_layout?select=canal,tabela,vigencia&limit=100000');
    if (r.ok) { temBanco = true; (await r.json()).forEach(x => feitas.add(`${x.canal}|${x.tabela}|${x.vigencia}`)); log(`   banco: ${feitas.size} vigência(s)×tabela já carregadas`); }
    else log(`   banco sem as tabelas ft_* (HTTP ${r.status}): só mede, não grava`);
  } else log('   sem GEM_SUPABASE_SERVICE_KEY: só mede, não grava');

  const resumo = [];
  for (const canal of CANAIS) {
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {}); await page.waitForTimeout(6000);
    const tl = await ftApiOk(`${API_BACK}/export/tables/${canal}`);
    TABELAS = Array.isArray(tl.v) ? tl.v : [];
    const alvos = (process.env.FT_TABS || '').split(',').map(x => x.trim()).filter(Boolean);
    const lista = [], vistos = new Set();
    for (const alvo of (alvos.length ? alvos : RODADA1[canal] || [])) {
      const ts = alvo instanceof RegExp ? TABELAS.filter(x => alvo.test(x.comFormatacao || '') || alvo.test(x.semFormatacao || '')) : [achaTabela(alvo)].filter(Boolean);
      if (!ts.length) log(`   ${canal}: "${alvo}" não está na lista (${TABELAS.length}): ${TABELAS.map(x => x.comFormatacao || x.semFormatacao).join(' | ')}`);
      for (const t of ts) if (!vistos.has(t.semFormatacao)) { vistos.add(t.semFormatacao); lista.push(t); }
    }
    const vr = await ftApiOk(`${API_BACK}/selecao-da-unidade/buscar/vigencias?segmento=${canal}`);
    let vigs = (Array.isArray(vr.v) ? vr.v : []).map(v => v.id).filter(v => { const m = String(v).match(/_(\d)_(\d{1,2})_(\d{4})$/); return m && +m[3] >= DESDE; });
    vigs.sort((a, b) => { const f = v => { const m = v.match(/_(\d)_(\d{1,2})_(\d{4})$/); return +m[3] * 100 + +m[2] * 2 + +m[1]; }; return f(a) - f(b); });
    if (Number(process.env.FT_ULTIMAS) > 0) vigs = vigs.slice(-Number(process.env.FT_ULTIMAS));
    log(`── ${canal}: ${lista.length} tabela(s) (${lista.map(t => t.comFormatacao).join(' | ')}) · ${vigs.length} vigência(s) ${vigs[0] || ''} → ${vigs.slice(-1)[0] || ''}`);
    let lin = 0, err = 0;
    for (let i = 0; i < vigs.length; i += 8) {
      const bloco = vigs.slice(i, i + 8);
      const faltam = lista.filter(t => REFAZER || bloco.some(v => !feitas.has(`${canal}|${t.semFormatacao}|${v}`)));
      if (!faltam.length) { log(`   ${bloco[0]}…: já carregado`); continue; }
      // o buscar/unidades recebe a lista de vigências (como a tela manda)
      let ub = bloco;
      if (CORPO_UNID && !Array.isArray(CORPO_UNID)) { ub = { ...CORPO_UNID }; for (const k of Object.keys(ub)) { if (Array.isArray(ub[k])) ub[k] = bloco; else if (ub[k] === 'ROTA') ub[k] = canal; } }
      const un = await ftApiOk(`${API_BACK}/selecao-da-unidade/buscar/unidades`, { method: 'POST', body: JSON.stringify(ub) });
      const unidades = [...new Set((Array.isArray(un.v) ? un.v : []).map(x => x.cnpjUnidade).filter(Boolean))];
      if (!unidades.length) { log(`   ${bloco[0]}…: nenhuma unidade (HTTP ${un.st})`); err++; continue; }
      let r = await exportaApi(canal, bloco, faltam, unidades, `${canal}-${i}`);
      let partes = r.f ? [r] : [];
      if (r.erro) {   // um pedido com várias abas falhou: tenta tabela a tabela
        log(`   ${bloco[0]}…: ${r.erro} · tentando tabela a tabela`);
        for (const t of faltam) {
          const r1 = await exportaApi(canal, bloco, [t], unidades, `${canal}-${i}-${t.semFormatacao}`);
          if (r1.f) partes.push(r1); else { log(`   ${t.comFormatacao} ${bloco[0]}…: ${r1.erro}`); err++; }
        }
      }
      for (const pt of partes) {
        try { const g = await grava(pt.f, canal, pt.abas, bloco, temBanco); lin += g.reduce((s, x) => s + Number(x.split(': ')[1] || 0), 0); log(`   ${temBanco ? 'gravado' : 'lido'}: ${g.join(' · ')}`); }
        catch (e) { log(`   falha ao gravar: ${e.message}`); err++; }
      }
    }
    resumo.push(`${canal}: ${lin} linhas${err ? ` · ${err} falha(s)` : ''}`);
  }
  log('── CARGA: resumo'); resumo.forEach(r => log('   ' + r));
  if (resumo.some(r => /falha/.test(r))) process.exitCode = 1;
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
  for (const rx of (MODE === 'exportar' || MODE === 'carga' ? [] : [/relat/i, /caminh/i])) {
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
  if (MODE === 'carga') await carga();

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
