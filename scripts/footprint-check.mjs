// ============================================================
// Footprint Check — confere a tabela footprint_check no Supabase
// (a que o /footprint-goiania/ grava). Roda no Actions porque o
// sandbox não alcança o Supabase.
//
// O que verifica:
//   1. a tabela existe e tem as colunas que a tela usa;
//   2. escrita com a service key funciona (upsert + delete numa
//      placa de teste, que sai no fim);
//   3. RLS: anon NÃO lê (policy é "to authenticated") e anon NÃO
//      escreve — se algum desses passar, a tabela está aberta;
//   4. quantas células já foram preenchidas, por status.
//
// Não imprime chave nenhuma.
// ============================================================
const URL = process.env.GEM_SUPABASE_URL || 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SERVICE = process.env.GEM_SUPABASE_SERVICE_KEY || '';
const ANON = process.env.GEM_SUPABASE_ANON_KEY || 'sb_publishable_ggKEEebc5zjgQDVsF92Upw_6uoLmKe9';
if (!SERVICE) { console.error('Falta o secret GEM_SUPABASE_SERVICE_KEY.'); process.exit(1); }

const TESTE = '__teste_footprint__';
const req = async (key, path, init = {}) => {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
      Prefer: init.prefer || 'return=representation', ...(init.headers || {}) },
  });
  let body = null; const txt = await r.text();
  try { body = txt ? JSON.parse(txt) : null; } catch { body = txt; }
  return { ok: r.ok, status: r.status, body };
};

let falhas = 0;
const ok  = m => console.log('  ✔ ' + m);
const nok = m => { console.log('  ✘ ' + m); falhas++; };

console.log('── 1. tabela footprint_check ──');
const leitura = await req(SERVICE, 'footprint_check?select=placa,chave,status,updated_at,updated_by,updated_nome&limit=1');
if (!leitura.ok) {
  nok(`não deu para ler: ${leitura.status} ${JSON.stringify(leitura.body)}`);
  console.log('\nRode scripts/footprint-goiania.sql no SQL Editor do Supabase.');
  process.exit(1);
}
ok('existe e tem as 6 colunas que a tela usa');

console.log('\n── 2. escrita com a service key ──');
const linha = { placa: TESTE, chave: 'chk_fisico', status: 'OK', updated_nome: 'Footprint Check' };
const ins = await req(SERVICE, 'footprint_check?on_conflict=placa,chave',
  { method: 'POST', body: JSON.stringify(linha), prefer: 'return=representation,resolution=merge-duplicates' });
ins.ok ? ok('upsert gravou a linha de teste') : nok(`upsert falhou: ${ins.status} ${JSON.stringify(ins.body)}`);
const mau = await req(SERVICE, 'footprint_check?on_conflict=placa,chave',
  { method: 'POST', body: JSON.stringify({ ...linha, chave: 'chk_vamos', status: 'TALVEZ' }), prefer: 'resolution=merge-duplicates' });
mau.ok ? nok('o banco aceitou um status inválido (o CHECK não está valendo)') : ok('status fora de OK/NOK/NA é recusado pelo CHECK');

console.log('\n── 3. RLS (anon não pode nada) ──');
const anonLe = await req(ANON, 'footprint_check?select=placa&limit=5');
(anonLe.ok && Array.isArray(anonLe.body) && anonLe.body.length === 0) || !anonLe.ok
  ? ok('anon não enxerga as linhas')
  : nok(`anon LEU ${anonLe.body && anonLe.body.length} linha(s) — a policy de select está aberta`);
const anonEsc = await req(ANON, 'footprint_check',
  { method: 'POST', body: JSON.stringify({ placa: TESTE, chave: 'anon', status: 'OK' }) });
anonEsc.ok ? nok('anon CONSEGUIU gravar — a policy de insert está aberta') : ok('anon não consegue gravar');

console.log('\n── 4. preenchimento de hoje ──');
const todas = await req(SERVICE, 'footprint_check?select=placa,chave,status,updated_nome,updated_at&limit=2000');
const linhas = (todas.body || []).filter(r => r.placa !== TESTE);
const porStatus = {};
linhas.forEach(r => { porStatus[r.status] = (porStatus[r.status] || 0) + 1; });
const placas = new Set(linhas.map(r => r.placa));
console.log(`  ${linhas.length} célula(s) preenchida(s) em ${placas.size} placa(s)` +
  (linhas.length ? ' · ' + Object.entries(porStatus).map(([s, n]) => `${s}: ${n}`).join(' · ') : ''));
if (linhas.length) {
  const ult = linhas.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  console.log(`  última marcação: ${ult.placa} · ${ult.chave} · ${ult.status} · ${ult.updated_nome || '—'} · ${ult.updated_at}`);
}

// limpeza: a placa de teste nunca fica no banco
await req(SERVICE, `footprint_check?placa=eq.${encodeURIComponent(TESTE)}`, { method: 'DELETE', prefer: 'return=minimal' });
const sobrou = await req(SERVICE, `footprint_check?select=placa&placa=eq.${encodeURIComponent(TESTE)}`);
(sobrou.body || []).length ? nok('a linha de teste não saiu') : console.log('\n  (linha de teste removida)');

console.log(falhas ? `\n${falhas} problema(s).` : '\nTudo certo — a tela já pode gravar.');
process.exit(falhas ? 1 : 0);
