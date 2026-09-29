// ============================================================
// Custo médio por ativo no painel Manutenção: como casar as duas bases?
// (Renan, 29/09/2026: "custo médio por ativo, usando o painel de Ativos como base")
//
// Lista os rótulos de Unidade / Nível 3 que a aba de Manutenção entrega e os
// códigos que o painel de Ativos produz (mesmo mapUni/mapProj do ativos/),
// com a contagem de cada lado — só rótulos e totais, nada de linha crua.
// Não grava nada.
// ============================================================
const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const n = v => Math.round(+v || 0).toLocaleString('pt-BR');

// ── Manutenção (mesma aba que o painel lê) ──
const r = await fetch('https://docs.google.com/spreadsheets/d/1S7L6G3L8bboirAExGPRCITYkWsGoVpjUoXc-aVXdW6k/gviz/tq?gid=0&headers=1&tqx=out:json');
const t = await r.text();
const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
const cols = j.table.cols.map(c => (c.label || '').trim());
const iU = cols.findIndex(c => /^unidade$/i.test(c)), iN = cols.findIndex(c => /n[ií]vel 3/i.test(c));
const iV = cols.findIndex(c => /vig[eê]ncia/i.test(c)), iR = cols.findIndex(c => /realizado/i.test(c));
console.log(`manutenção: ${j.table.rows.length} linhas · Unidade=${iU} Nível3=${iN} Vigência=${iV} Realizado=${iR}`);
const cel = (row, i) => { const c = row.c && row.c[i]; return c ? (c.f != null ? c.f : c.v) : ''; };
const conta = new Map(), vigs = new Map();
j.table.rows.forEach(row => {
  const u = String(cel(row, iU) || '').trim(), n3 = String(cel(row, iN) || '').trim();
  const k = `${u} || ${n3}`; conta.set(k, (conta.get(k) || 0) + 1);
  const v = String(cel(row, iV) || '').trim(); vigs.set(v, (vigs.get(v) || 0) + 1);
});
console.log('\nUnidade || Nível 3 (linhas):');
[...conta.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, q]) => console.log(`   ${k.padEnd(60)} ${q}`));
console.log('\nVigências:', [...vigs.entries()].sort().map(([k, q]) => `${k}:${q}`).join(' · '));

// ── Ativos (o que o painel de Ativos lê) ──
const a = await fetch(`${SUPA}/rest/v1/ginfo_snapshot?chave=eq.ativos&select=data,updated_at`, { headers: H });
const row = (await a.json())[0];
console.log(`\nativos: ${row.data.length} linhas · coletado ${row.updated_at}`);
const fp = new Map();
row.data.forEach(x => { const k = `${x.Filial} || ${x.Projeto}`; fp.set(k, (fp.get(k) || 0) + 1); });
console.log('Filial || Projeto (placas):');
[...fp.entries()].sort((a2, b) => b[1] - a2[1]).forEach(([k, q]) => console.log(`   ${k.padEnd(60)} ${q}`));
const m = await fetch(`${SUPA}/rest/v1/ativos_manual?select=unidade`, { headers: H });
if (m.ok) { const am = await m.json(); console.log(`\nativos_manual: ${n(am.length)} linhas`); }
