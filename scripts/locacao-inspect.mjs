// ============================================================
// Locacao Inspect — o que está GRAVADO na conferência de locação
// (tabela locacao_conferencia, a que o /conferencia-locacao/ lê).
// Roda no Actions porque o sandbox não alcança o Supabase.
//
// Responde, mês a mês: quantos ativos, quantos têm prévia, FT e
// faturado, as somas de cada um e QUAIS ARQUIVOS entraram no mês.
// É por aqui que se vê se um mês "não puxou" porque o arquivo não
// entrou, porque entrou e não casou, ou porque ainda não existe.
//
// Não imprime chave nenhuma.
// ============================================================
const URL_SB  = process.env.GEM_SUPABASE_URL || 'https://lozwipoeacpvplgkrxkq.supabase.co';
const SERVICE = process.env.GEM_SUPABASE_SERVICE_KEY || '';
if (!SERVICE) { console.error('Falta o secret GEM_SUPABASE_SERVICE_KEY.'); process.exit(1); }

const req = async path => {
  const r = await fetch(`${URL_SB}/rest/v1/${path}`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const txt = await r.text();
  let body = null; try { body = txt ? JSON.parse(txt) : null; } catch { body = txt; }
  return { ok: r.ok, status: r.status, body };
};

const br  = v => (v == null ? '—' : Math.round(v).toLocaleString('pt-BR'));
const pad = (s, n) => String(s).padEnd(n);
const num = (v, n) => String(v).padStart(n);

const r = await req('locacao_conferencia?select=vigencia,linhas,resumo,arquivos,updated_at,updated_by&order=vigencia');
if (!r.ok) { console.error(`Não deu para ler locacao_conferencia: ${r.status} ${JSON.stringify(r.body)}`); process.exit(1); }
const meses = r.body || [];
if (!meses.length) { console.log('A tabela está vazia — nenhum mês importado.'); process.exit(0); }

// vigência vem 'MM/AAAA'; ordena por ano e mês de verdade, não por texto
const ord = v => { const m = String(v).match(/(\d{1,2})\/(\d{4})/); return m ? +m[2] * 100 + +m[1] : 0; };
meses.sort((a, b) => ord(a.vigencia) - ord(b.vigencia));

console.log('── meses gravados ──\n');
console.log('  vigência    ativos   c/prévia     c/FT  c/faturado        Σ prévia           Σ FT      Σ faturado');
for (const m of meses) {
  const L = Array.isArray(m.linhas) ? m.linhas : [];
  const tem = c => L.filter(l => l[c] != null).length;
  const soma = c => L.reduce((a, l) => a + (+l[c] || 0), 0);
  console.log('  ' + pad(m.vigencia, 10) + num(L.length, 7) + num(tem('prev'), 11) + num(tem('ft'), 9)
    + num(tem('fat'), 12) + num(br(soma('prev')), 16) + num(br(soma('ft')), 15) + num(br(soma('fat')), 16));
}

console.log('\n── detalhe por mês ──');
for (const m of meses) {
  const L = Array.isArray(m.linhas) ? m.linhas : [];
  console.log(`\n  ${m.vigencia}  ·  ${L.length} ativo(s)  ·  gravado ${String(m.updated_at).slice(0, 16).replace('T', ' ')}`);
  const et = {};
  L.forEach(l => {
    const e = l.etapa || '—';
    et[e] = et[e] || { n: 0, prev: 0, ft: 0, fat: 0 };
    et[e].n++;
    if (l.prev != null) et[e].prev++;
    if (l.ft   != null) et[e].ft++;
    if (l.fat  != null) et[e].fat++;
  });
  Object.entries(et).forEach(([e, v]) =>
    console.log(`      etapa ${pad(e, 10)} ${num(v.n, 4)} ativo(s) · com prévia ${num(v.prev, 4)} · com FT ${num(v.ft, 4)} · com faturado ${num(v.fat, 4)}`));

  // de quais vigências do Freightech vieram os valores (vigsFT = quantas
  // vigências casaram; 0 significa que nenhum arquivo do FT bateu o mês)
  const semFT = L.filter(l => l.ft == null).length;
  if (semFT === L.length && L.length) console.log('      ⚠ NENHUM ativo com FT neste mês');
  const arq = m.arquivos || [];
  console.log(`      arquivos (${arq.length}):`);
  if (!arq.length) console.log('         — nenhum arquivo registrado —');
  arq.forEach(a => console.log('         · ' + a));
}

// a regra do painel: prévia Mensal paga o mês ANTERIOR, Provisão paga o corrente.
// Então o FT que um mês precisa pode ser o do mês de trás — é o engano clássico.
console.log('\n── leitura ──');
const ultimo = meses[meses.length - 1];
const LU = Array.isArray(ultimo.linhas) ? ultimo.linhas : [];
const comFT = LU.filter(l => l.ft != null).length;
const comFat = LU.filter(l => l.fat != null).length;
console.log(`  último mês gravado: ${ultimo.vigencia}`);
console.log(`  ${comFT} de ${LU.length} ativo(s) com remuneração do Freightech`);
console.log(`  ${comFat} de ${LU.length} ativo(s) com faturamento da Vamos`);
if (!comFT) {
  const mm = String(ultimo.vigencia).match(/(\d{1,2})\/(\d{4})/);
  const ant = mm ? (+mm[1] === 1 ? `12/${+mm[2] - 1}` : `${String(+mm[1] - 1).padStart(2, '0')}/${mm[2]}`) : '?';
  console.log(`\n  Nenhum FT casou. A prévia MENSAL de ${ultimo.vigencia} é paga pela remuneração de ${ant}`);
  console.log(`  (a Provisão é que usa a do próprio mês). Confira se os arquivos do Freightech`);
  console.log(`  subidos cobrem a vigência certa e se a coluna "Vigencia" termina em _<vig>_<mês>_<ano>.`);
}
