// ============================================================
// CONFERÊNCIA DAS BASES MANUAIS NO BANCO (Renan, 09/09/2026)
//
// Para cada aba: quantas linhas a PLANILHA tem hoje, quantas o sh_base diz
// ter carregado e quantas estão REALMENTE na tabela. As três têm de bater.
// Também mostra há quanto tempo cada base foi carregada e o que deu erro.
//
// É o termômetro da migração: se um painel aparecer zerado, é aqui que se vê
// se a aba encolheu (filtro no Sheets), se a carga falhou ou se está velha.
// Não grava nada.
// ============================================================
import { BASES, baixa } from './sheets-bases.mjs';

const SUPA = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const SEM_SHEETS = process.env.SHEETS_SEM_PLANILHA === '1';   // só banco (mais rápido)

// conta as linhas da tabela sem trazer o conteúdo
async function conta(tabela) {
  const r = await fetch(`${SUPA}/rest/v1/${tabela}?select=linha&limit=1`,
    { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  if (!r.ok) return { erro: `HTTP ${r.status}` };
  const cr = r.headers.get('content-range') || '';       // "0-0/1234"
  const n = +String(cr).split('/')[1];
  return { n: isFinite(n) ? n : null };
}

const rb = await fetch(`${SUPA}/rest/v1/sh_base?select=*`, { headers: H });
if (!rb.ok) {
  console.error(`sh_base não respondeu (HTTP ${rb.status}). Rodou o scripts/bases-manuais.sql?`);
  process.exit(1);
}
const meta = Object.fromEntries((await rb.json()).map(r => [r.slug, r]));
console.log(`sh_base tem ${Object.keys(meta).length} de ${BASES.length} base(s) registradas\n`);
console.log('base                      planilha    sh_base    tabela   carregado há   situação');

const hMin = t => t ? Math.round((Date.now() - new Date(t)) / 60000) : null;
let problemas = 0;
for (const b of BASES) {
  const m = meta[b.slug];
  let naPlanilha = null;
  if (!SEM_SHEETS) {
    try { naPlanilha = ((await baixa(b)).json.table.rows || []).length; } catch (e) { naPlanilha = 'erro'; }
  }
  const t = await conta(`sh_${b.slug}`);
  const min = m && hMin(m.carregado_em);
  const idade = min == null ? '—' : min < 90 ? `${min}min` : `${Math.round(min / 60)}h`;

  const notas = [];
  if (!m) notas.push('nunca carregada');
  if (t.erro) notas.push(`tabela ${t.erro} (falta o SQL?)`);
  if (m && m.erro) notas.push(m.erro.slice(0, 80));
  if (m && t.n != null && m.linhas != null && m.linhas !== t.n) notas.push(`sh_base diz ${m.linhas}, tabela tem ${t.n}`);
  if (typeof naPlanilha === 'number' && t.n != null && naPlanilha !== t.n) notas.push(`planilha ${naPlanilha} × tabela ${t.n}`);
  if (min != null && min > 180) notas.push(`carga de ${idade} atrás`);
  if (notas.length) problemas++;

  console.log(`${b.slug.padEnd(24)} ${String(naPlanilha ?? '—').padStart(9)} `
    + `${String(m ? m.linhas : '—').padStart(10)} ${String(t.n ?? t.erro ?? '—').padStart(9)} `
    + `${idade.padStart(13)}   ${notas.length ? '⚠ ' + notas.join(' · ') : 'ok'}`);
}
console.log(`\n${BASES.length - problemas} ok · ${problemas} com observação`);
process.exit(problemas ? 1 : 0);
