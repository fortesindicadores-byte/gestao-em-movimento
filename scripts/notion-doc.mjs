/*******************************************************************************
 * Notion Doc — imprime no log o texto de uma página PÚBLICA do Notion.
 *
 * Serve para ler documentação de API publicada no Notion (ex.: Gasola), que o
 * sandbox de desenvolvimento não alcança. Só use com páginas públicas de
 * documentação: o log do Actions é público.
 *
 * Env: NOTION_URL (o link da página), NOTION_FUNDO (níveis de subpágina, 2)
 ******************************************************************************/

const URL_PG = (process.env.NOTION_URL || '').trim();
const FUNDO = Number(process.env.NOTION_FUNDO || 2);
// só imprime as subpáginas cujo título contém este texto (e o que está dentro delas)
const SO = (process.env.NOTION_SO || '').trim().toLowerCase();
let ligado = !SO;
if (!URL_PG) { console.error('NOTION_URL vazio'); process.exit(1); }

const host = new URL(URL_PG).origin;
const hex = (URL_PG.match(/([0-9a-f]{32})(?:[?#]|$)/i) || [])[1];
if (!hex) { console.error('id da página não achado no link'); process.exit(1); }
const uid = h => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

const BLOCOS = {};
async function api(rota, corpo) {
  for (const base of [host, 'https://www.notion.so']) {
    const r = await fetch(`${base}/api/v3/${rota}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
    if (r.ok) return r.json();
    console.error(`${base} ${rota}: HTTP ${r.status}`);
  }
  throw new Error('Notion não respondeu');
}
const valor = b => b && (b.value && b.value.value ? b.value.value : b.value);
function guarda(rm) { for (const [id, b] of Object.entries((rm && rm.block) || {})) { const v = valor(b); if (v) BLOCOS[id] = v; } }

async function carregaPagina(id) {
  let cursor = { stack: [] }, n = 0;
  do {
    const j = await api('loadPageChunk', { pageId: id, limit: 100, cursor, chunkNumber: n++, verticalColumns: false });
    guarda(j.recordMap); cursor = j.cursor;
  } while (cursor && cursor.stack && cursor.stack.length && n < 50);
}
async function faltantes(ids) {
  // o syncRecordValues dá 403 em site público; bloco que faltou (subpágina) se lê pelo loadPageChunk dele
  for (const i of ids.filter(x => !BLOCOS[x])) {
    try { await carregaPagina(i); } catch (e) { console.error(`bloco ${i}: ${e.message}`); }
  }
}

const txt = t => (t || []).map(s => {
  let x = s[0];
  for (const f of (s[1] || [])) if (f[0] === 'a') x += ` (${f[1]})`;
  return x;
}).join('');

const PRE = { header: '# ', sub_header: '## ', sub_sub_header: '### ', bulleted_list: '- ', numbered_list: '1. ', to_do: '[ ] ', toggle: '▸ ', quote: '> ', callout: '💡 ' };
const out = (...a) => { if (ligado) console.log(...a); };
async function imprime(id, nivel, fundo) {
  const b = BLOCOS[id]; if (!b) return;
  const p = b.properties || {};
  const ind = '  '.repeat(nivel);
  const antes = ligado;
  if (SO && b.type === 'page' && nivel > 0 && txt(p.title).toLowerCase().includes(SO)) ligado = true;
  if (b.type === 'page' && nivel > 0) {
    out(`\n${'='.repeat(70)}\nSUBPÁGINA: ${txt(p.title)}\n${'='.repeat(70)}`);
    if (fundo >= FUNDO) return;
  } else if (b.type === 'code') {
    out(`${ind}\`\`\`${(p.language && txt(p.language)) || ''}\n${txt(p.title)}\n${ind}\`\`\``);
  } else if (b.type === 'table_row') {
    const fmt = (BLOCOS[b.parent_id] && BLOCOS[b.parent_id].format && BLOCOS[b.parent_id].format.table_block_column_order) || Object.keys(p);
    out(ind + '| ' + fmt.map(c => txt(p[c])).join(' | ') + ' |');
  } else if (p.title) {
    out(ind + (PRE[b.type] || '') + txt(p.title));
  } else if (b.type === 'divider') out(ind + '---');
  else if (['image', 'file', 'bookmark', 'embed'].includes(b.type)) out(ind + `[${b.type}] ${(p.source && txt(p.source)) || ''}`);
  const filhos = b.content || [];
  await faltantes(filhos);
  for (const f of filhos) await imprime(f, b.type === 'page' ? nivel : nivel + 1, b.type === 'page' && nivel > 0 ? fundo + 1 : fundo);
  ligado = antes;
}

const raiz = uid(hex);
await carregaPagina(raiz);
await faltantes([raiz]);
const r = BLOCOS[raiz];
console.log(`PÁGINA: ${r ? txt((r.properties || {}).title) : '(não carregou)'}\n`);
await imprime(raiz, 0, 0);
