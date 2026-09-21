// ============================================================================
// Conf Placa Inspect — o que o export do Ginfo (conformidade-detalhe) diz de
// UMA placa, coluna por coluna, na vigência mais nova, e a régua que ele
// aplica por projeto/tipo (Tipo Aderência × Prazo).
//
// Renan, 21/09/2026: a EMP0383 vence em 23/09 no Power BI (WH · 30d) e o app
// do Ginfo diz "vence em 32 dias" (= 60d). "Acho que tem a regra no relatório
// em uma coluna. Valide no banco." Roda no Actions (o sandbox não alcança o
// Supabase). Só leitura.
//
// Uso: CONF_PLACA=EMP0383 node scripts/conf-placa-inspect.mjs
// ============================================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('Falta GEM_SUPABASE_SERVICE_KEY'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const PLACA = String(process.env.CONF_PLACA || 'EMP0383').replace(/[^A-Z0-9]/gi, '').toUpperCase();

const dSerial = v => (typeof v === 'number' && v > 20000 && v < 80000)
  ? new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5) : null;
const fd = d => d ? d.toISOString().slice(0, 10) : '—';

const res = await fetch(`${SB_URL}/rest/v1/elite_snapshot?indicador=eq.conformidade-detalhe&escopo=eq.mes&select=vigencia,data,updated_at&order=vigencia`, { headers: H });
if (!res.ok) { console.error('REST', res.status, await res.text()); process.exit(1); }
const rows = await res.json();
// vigência mais nova por (ano, mês) — a string 'MM/AAAA' ordenada erra na virada do ano
const chave = v => { const [m, a] = String(v).split('/'); return (+a) * 100 + (+m); };
rows.sort((a, b) => chave(a.vigencia) - chave(b.vigencia));
console.log(`vigências gravadas: ${rows.map(r => r.vigencia).join(' · ')}\n`);

const norm = s => String(s || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
for (const r of rows.slice(-2)) {
  const d = Array.isArray(r.data) ? r.data : [];
  console.log(`══ ${r.vigencia} · ${d.length} linha(s) · coleta ${r.updated_at}`);
  if (d.length) console.log('   colunas do export:', Object.keys(d[0]).join(' | '));
  const mine = d.filter(x => norm(x['Placa']) === PLACA);
  console.log(`\n   ── ${PLACA}: ${mine.length} linha(s)`);
  mine.forEach((x, i) => {
    console.log(`   linha ${i + 1}:`);
    Object.entries(x).forEach(([k, v]) => {
      const extra = (typeof v === 'number' && v > 20000 && v < 80000) ? `   (= ${fd(dSerial(v))})` : '';
      console.log(`      ${k.padEnd(28)} ${JSON.stringify(v)}${extra}`);
    });
    const real = dSerial(x['Checklist Realizado em']), venc = dSerial(x['Vencimento Vigente']), prox = dSerial(x['Próximo Vencimento']);
    if (real && (venc || prox)) {
      const dias = t => t ? Math.round((t - real) / 864e5) : null;
      console.log(`      → do checklist (${fd(real)}) até o Vencimento Vigente: ${dias(venc)} dia(s) · até o Próximo Vencimento: ${dias(prox)} dia(s)`);
    }
  });

  // a régua por Projeto × Tipo Veículo: Tipo Aderência e Prazo que o export carrega
  const reg = {};
  d.forEach(x => {
    const k = `${String(x['Filial'] || '').trim()} | ${String(x['Projeto'] || '').trim()} | ${String(x['Tipo Veículo'] || '').trim()}`;
    const v = `${String(x['Tipo Aderência'] || '?').trim()} · ${x['Prazo'] ?? '?'}d`;
    (reg[k] = reg[k] || {})[v] = ((reg[k] || {})[v] || 0) + 1;
  });
  const fil = mine.length ? String(mine[0]['Filial'] || '').trim() : null;
  console.log(`\n   ── régua (Tipo Aderência · Prazo) por Filial | Projeto | Tipo Veículo${fil ? ' — filial da placa: ' + fil : ''}`);
  Object.entries(reg).filter(([k]) => !fil || k.startsWith(fil + ' |')).sort().forEach(([k, v]) => {
    console.log(`   ${k.padEnd(60)} ${Object.entries(v).map(([a, n]) => `${a} ×${n}`).join(' · ')}`);
  });
  // e no portal inteiro: Tipo Aderência × Prazo × Projeto (para ver se ARMAZEM é sempre WH 30)
  const geral = {};
  d.forEach(x => {
    const k = `${String(x['Projeto'] || '').trim()} → ${String(x['Tipo Aderência'] || '?').trim()} · ${x['Prazo'] ?? '?'}d`;
    geral[k] = (geral[k] || 0) + 1;
  });
  console.log('\n   ── no export inteiro, Projeto → régua:');
  Object.entries(geral).sort().forEach(([k, n]) => console.log(`   ${k.padEnd(50)} ×${n}`));
  console.log('');
}
