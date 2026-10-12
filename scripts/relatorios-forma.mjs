// ============================================================
// Relatorios Forma — como cada fonte do /relatorios/ chega do banco
// (12/10/2026, Renan: "Os relatórios não ficaram limpos e com cara de
// relatório em excel… tabelas dos dados, para utilizar em análises").
//
// Antes de limpar, medir o que suja. Para cada fonte que a página exporta,
// imprime SÓ a forma, nunca o conteúdo de pessoa:
//   · abas do Sheets (sh_*): rótulos vazios, rótulo repetido, se a 1ª linha
//     parece cabeçalho (só os textos dela, que são títulos de coluna);
//   · tabelas do portal: cada coluna com o tipo do valor, % vazio e se é
//     UUID / JSON;
//   · JSON por linha (Ginfo, Frota de Elite, Prolog, Conferência de Locação):
//     as chaves das linhas, o tipo de cada uma e, só quando é número ou data,
//     um exemplo (é por ali que aparece data gravada como serial do Excel).
//
// Roda no Actions (o sandbox não alcança o Supabase). Não imprime chave.
// ============================================================
const URL_SB  = process.env.GEM_SUPABASE_URL || 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SERVICE = process.env.GEM_SUPABASE_SERVICE_KEY || '';
if (!SERVICE) { console.error('Falta o secret GEM_SUPABASE_SERVICE_KEY.'); process.exit(1); }

async function req(path, range) {
  const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
  if (range) h.Range = range;
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, { headers: h });
  const txt = await r.text();
  let body = null; try { body = txt ? JSON.parse(txt) : null; } catch { body = txt; }
  return { ok: r.ok, status: r.status, body };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;
const DMY = /^\d{1,2}\/\d{1,2}\/\d{2,4}/;
function tipo(v) {
  if (v == null || v === '') return 'vazio';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'num';
  if (typeof v === 'boolean') return 'bool';
  if (Array.isArray(v)) return 'lista';
  if (typeof v === 'object') return 'objeto';
  const s = String(v);
  if (UUID.test(s)) return 'uuid';
  if (ISO.test(s)) return 'data-iso';
  if (DMY.test(s)) return 'data-dmy';
  if (/^-?[\d.]+,\d+$/.test(s) || /^-?\d+(\.\d+)?$/.test(s)) return 'num-texto';
  if (/%$/.test(s.trim())) return 'pct-texto';
  return 'texto';
}
function perfil(linhas, mostraEx) {
  const cols = new Map();
  linhas.forEach(l => { for (const k in l) { if (!cols.has(k)) cols.set(k, {}); const t = tipo(l[k]); const c = cols.get(k); c[t] = (c[t] || 0) + 1;
    if (mostraEx && (t === 'int' || t === 'num' || t.startsWith('data')) && c._ex == null) c._ex = l[k]; } });
  const n = linhas.length;
  return [...cols].map(([k, c]) => {
    const ex = c._ex; delete c._ex;
    const vaz = c.vazio || 0;
    const tipos = Object.entries(c).filter(([t]) => t !== 'vazio').sort((a, b) => b[1] - a[1]).map(([t, q]) => `${t}${q < n - vaz ? ':' + q : ''}`).join('/');
    return `    ${JSON.stringify(k)} → ${tipos || 'só vazio'}${vaz ? ` · vazio ${Math.round(vaz / n * 100)}%` : ''}${ex != null ? ` · ex ${JSON.stringify(ex)}` : ''}`;
  }).join('\n');
}

// ── 1) abas do Sheets no banco ──
console.log('═══ ABAS DO SHEETS (sh_base) ═══');
const sb = await req('sh_base?select=slug,nome,colunas,linhas,erro&order=slug');
for (const b of sb.body || []) {
  const cols = (b.colunas || []).slice().sort((a, c) => a.i - c.i);
  const vazios = cols.filter(c => !String(c.label || '').trim()).length;
  const rep = {}; cols.forEach(c => { const l = String(c.label || '').trim(); if (l) rep[l] = (rep[l] || 0) + 1; });
  const dup = Object.entries(rep).filter(([, q]) => q > 1).map(([l, q]) => `${l}×${q}`);
  console.log(`\n· ${b.slug} — ${b.nome} · ${b.linhas} linhas · ${cols.length} col · rótulos vazios ${vazios}${dup.length ? ' · repetidos ' + dup.join(', ') : ''}${b.erro ? ' · ERRO ' + String(b.erro).slice(0, 60) : ''}`);
  console.log('    rótulos: ' + cols.map(c => `${c.label || '∅'}[${c.tipo}]`).join(' | '));
  if (vazios) {
    const r = await req(`sh_${b.slug}?select=*&order=linha.asc&limit=2`);
    const l0 = (r.body || [])[0] || {};
    const textos = cols.filter(c => !String(c.label || '').trim()).map(c => `${c.col}=${typeof l0[c.col] === 'string' ? JSON.stringify(l0[c.col].slice(0, 30)) : tipo(l0[c.col])}`);
    console.log('    1ª linha nas colunas sem rótulo: ' + textos.join(' | '));
  }
}

// ── 2) tabelas do portal ──
const TABS = ['fca', 'carta_custos', 'custo_vigencia_mv', 'erp_abastecimentos', 'contratos_placa', 'vw_contrato_km',
  'forecast_scenarios', 'balanco_massa', 'ativos_manual', 'indisponibilidade', 'indisp_snapshot', 'disp_snapshot', 'disp_resumo',
  'disp_checkins', 'mpr_fields', 'planner', 'pneu_pedido', 'pneu_preco', 'preventiva_lanc', 'hodometro_leitura',
  'seara_remunerado', 'ce_scores_mensais', 'ce_diario', 'ce_motoristas', 'ce_app_log', 'access_log', 'locacao_obs',
  'locacao_benner', 'locacao_modelos', 'historico_mensal', 'saude_wf', 'saude_dia', 'saude_base', 'saude_painel', 'saude_coleta',
  'cat_item', 'cat_aplicacao', 'cat_modelo', 'cat_sinonimo', 'cat_placa'];
console.log('\n\n═══ TABELAS DO PORTAL (amostra de 300 linhas) ═══');
for (const t of TABS) {
  const r = await req(`${t}?select=*`, '0-299');
  if (!r.ok) { console.log(`\n· ${t} — HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`); continue; }
  const l = r.body || [];
  console.log(`\n· ${t} — ${l.length} linha(s) na amostra`);
  if (l.length) console.log(perfil(l, false));
}

// ── 3) JSON por linha ──
console.log('\n\n═══ GINFO (ginfo_snapshot) ═══');
const gi = await req('ginfo_snapshot?select=chave,updated_at,data&order=chave');
for (const g of gi.body || []) {
  const d = Array.isArray(g.data) ? g.data : [];
  console.log(`\n· ${g.chave} — ${d.length} linhas · ${g.updated_at}`);
  if (d.length) console.log(perfil(d.slice(0, 400), true));
}

console.log('\n\n═══ FROTA DE ELITE (elite_snapshot, a vigência mais recente de cada indicador) ═══');
const el = await req('elite_snapshot?select=indicador,vigencia,escopo&order=indicador');
const ult = {};
(el.body || []).forEach(r => { const k = r.indicador; const v = r.vigencia.split('/').reverse().join(''); if (!ult[k] || v > ult[k].v) ult[k] = { v, vig: r.vigencia, esc: r.escopo }; });
for (const [ind, u] of Object.entries(ult)) {
  const r = await req(`elite_snapshot?select=data&indicador=eq.${encodeURIComponent(ind)}&vigencia=eq.${encodeURIComponent(u.vig)}&escopo=eq.mes`);
  const d = ((r.body || [])[0] || {}).data || [];
  console.log(`\n· ${ind} — ${u.vig} · ${Array.isArray(d) ? d.length : typeof d} linhas`);
  if (Array.isArray(d) && d.length) console.log(perfil(d.slice(0, 400), true));
}

console.log('\n\n═══ PROLOG (snapshot, 1 unidade) ═══');
for (const ep of ['tires', 'vehicles', 'inspections']) {
  const r = await req(`snapshot?select=branch_id,data&endpoint=eq.${ep}&branch_id=eq.38`);
  const d = ((r.body || [])[0] || {}).data || [];
  console.log(`\n· ${ep} — ${d.length} linhas`);
  if (d.length) console.log(perfil(d.slice(0, 400), true));
}

console.log('\n\n═══ CONFERÊNCIA DE LOCAÇÃO (linhas do mês mais recente) ═══');
const lc = await req('locacao_conferencia?select=vigencia,linhas,resumo,arquivos&order=vigencia.desc&limit=1');
const m = (lc.body || [])[0];
if (m) { console.log(`· ${m.vigencia} — ${(m.linhas || []).length} linhas · resumo ${JSON.stringify(Object.keys(m.resumo || {}))}`); console.log(perfil((m.linhas || []).slice(0, 400), true)); }
