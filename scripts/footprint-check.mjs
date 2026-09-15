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

// ── 5. de onde vem a aderência de cada placa ────────────────────────────────
// Roda a função aderencia() DO PRÓPRIO index.html contra o que está no banco e
// abre a conta: quantos OK, NOK, em branco e N/A entraram em cada linha. É por
// aqui que se enxerga se o N/A está ou não no denominador, sem depender do olho
// no print.
console.log('\n── 5. aderência por placa (a conta aberta) ──');
{
  const fs = await import('node:fs');
  const vm = await import('node:vm');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');   // o `URL` global aqui é a do Supabase
  const raiz = path.dirname(fileURLToPath(import.meta.url));
  const html = fs.readFileSync(path.join(raiz, '..', 'footprint-goiania', 'index.html'), 'utf8');
  const trecho = (de, ate) => {
    const i = html.indexOf(de), f = html.indexOf(ate, i);
    if (i < 0 || f < 0) throw new Error('não achei ' + de + ' no index.html');
    return html.slice(i, f);
  };
  const ctx = { DADOS: {}, console };
  vm.createContext(ctx);
  vm.runInContext(
    trecho('const PLACAS=[', 'const esc=') +
    'const K=(p,c)=>p+"|"+c;' +
    trecho('function aderencia(placa)', 'const faixa='), ctx);

  linhas.forEach(r => { ctx.DADOS[r.placa + '|' + r.chave] = { status: r.status }; });

  let gOk = 0, gDen = 0;
  const larg = Math.max(...ctx.PLACAS.map(p => p.placa.length));
  ctx.PLACAS.forEach(p => {
    const st = c => (ctx.DADOS[p.placa + '|' + c.id] || {}).status || '';
    const n = s => ctx.CHECKS.filter(c => st(c) === s).length;
    const ok = n('OK'), nok = n('NOK'), na = n('NA'), br = n('');
    const den = ok + nok + br;                       // o que a função põe no denominador
    gOk += ok; gDen += den;
    const ad = ctx.aderencia(p.placa);
    const conferido = den ? Math.abs(ad - ok / den) < 1e-9 : ad === null;
    console.log(`  ${p.placa.padEnd(larg)}  ${String(Math.round((ad || 0) * 100)).padStart(3)}%` +
      `   OK ${String(ok).padStart(2)} · NOK ${String(nok).padStart(2)} · em branco ${String(br).padStart(2)}` +
      `   →  ${ok}/${den}     (N/A ${String(na).padStart(2)} fora da conta)` +
      (conferido ? '' : '   ✘ a função não bate com a decomposição'));
    if (!conferido) falhas++;
  });
  console.log(`  ${''.padEnd(larg)}  ${String(Math.round(gOk / gDen * 100)).padStart(3)}%   geral (${gOk}/${gDen})`);
  const semNA = ctx.CHECKS.length * ctx.PLACAS.length - gDen;
  console.log(`\n  ${semNA} célula(s) marcadas N/A ficaram FORA do denominador` +
    ` — se estivessem dentro, o geral cairia para ${Math.round(gOk / (gDen + semNA) * 100)}%.`);
}

// limpeza: a placa de teste nunca fica no banco
await req(SERVICE, `footprint_check?placa=eq.${encodeURIComponent(TESTE)}`, { method: 'DELETE', prefer: 'return=minimal' });
const sobrou = await req(SERVICE, `footprint_check?select=placa&placa=eq.${encodeURIComponent(TESTE)}`);
(sobrou.body || []).length ? nok('a linha de teste não saiu') : console.log('\n  (linha de teste removida)');

console.log(falhas ? `\n${falhas} problema(s).` : '\nTudo certo — a tela já pode gravar.');
process.exit(falhas ? 1 : 0);
