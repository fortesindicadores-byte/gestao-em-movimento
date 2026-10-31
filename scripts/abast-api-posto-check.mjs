// Abast API Posto Check — de que sistema e de quais meses vêm os abastecimentos
// de um posto na abast_api, e até onde cada conta do Gasola já foi carregada.
// Só totais no log (sem placa, sem motorista). Não grava nada.
// Uso: GEM_SUPABASE_SERVICE_KEY=… POSTO=allers node scripts/abast-api-posto-check.mjs
const SB = 'https://lozwipoeacpvplgkrxkq.supabase.co', K = process.env.GEM_SUPABASE_SERVICE_KEY;
const POSTO = (process.env.POSTO || '').trim();
const H = { apikey: K, Authorization: 'Bearer ' + K };
async function tudo(q) {
  const out = []; for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SB}/rest/v1/${q}&offset=${off}&limit=1000`, { headers: H });
    if (!r.ok) throw new Error(r.status + ' ' + await r.text()); const d = await r.json(); out.push(...d); if (d.length < 1000) break; }
  return out;
}
const linhas = await tudo(`abast_api?select=sistema,dia,unidade,posto,cnpj_posto,litros,valido&posto=ilike.*${encodeURIComponent(POSTO)}*&order=dia`);
console.log(`postos com "${POSTO}" no nome: ${linhas.length} item(ns)`);
const nomes = {}; linhas.forEach(l => { const k = `${l.posto} · CNPJ ${l.cnpj_posto || '—'}`; nomes[k] = (nomes[k] || 0) + 1; });
Object.entries(nomes).forEach(([k, n]) => console.log('  ', k, '→', n));
const g = {}; linhas.forEach(l => { const k = `${l.sistema}|${l.unidade}|${String(l.dia).slice(0, 7)}`; const a = g[k] || (g[k] = { n: 0, l: 0, inv: 0 }); a.n++; a.l += +l.litros || 0; if (!l.valido) a.inv++; });
console.log('\nsistema | unidade | mês → itens · litros (inválidos)');
Object.keys(g).sort().forEach(k => console.log('  ', k.padEnd(28), g[k].n, '·', Math.round(g[k].l), 'L', g[k].inv ? `(${g[k].inv} inválidos)` : ''));
// mês a mês por sistema na unidade do posto
const unis = [...new Set(linhas.map(l => l.unidade))];
for (const u of unis) {
  const t = await tudo(`abast_api?select=sistema,dia&unidade=eq.${encodeURIComponent(u)}&valido=eq.true&order=dia`);
  const m = {}; t.forEach(l => { const k = l.sistema + '|' + String(l.dia).slice(0, 7); m[k] = (m[k] || 0) + 1; });
  console.log(`\nunidade ${u}, todos os postos: sistema|mês → itens`);
  Object.keys(m).sort().forEach(k => console.log('  ', k.padEnd(20), m[k]));
}
const base = await tudo('abast_api_base?select=sistema,carregado_em,resumo&order=sistema');
console.log('\ncontas do Gasola: o que já foi carregado');
base.filter(b => /^GASOLA:/.test(b.sistema)).forEach(b => { const r = b.resumo || {}; console.log('  ', b.sistema.padEnd(40), r.ok_de || '—', '→', r.ok_ate || '—', '· último pedido', r.ultimo_pedido || '—'); });
