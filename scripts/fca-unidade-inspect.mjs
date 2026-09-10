// ============================================================
// FCA por UNIDADE — só leitura.
// "FCA do Marcio de BLC está aparecendo assim... e só aparece agosto"
// (Renan, 10/09/2026). A tela vazia era a pré-visualização falsa; esta sonda
// responde a segunda metade: quantos fatos cada unidade tem, por vigência e
// por origem, para separar "a tela quebrou" de "não foi gerado".
//
// Não imprime responsável nem causa — o repositório é público e o log do
// Actions fica visível.
//
// Uso: GEM_SUPABASE_SERVICE_KEY=... [FCA_UNI=BLC] node scripts/fca-unidade-inspect.mjs
// ============================================================
const SB = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const FOCO = (process.env.FCA_UNI || '').toUpperCase().trim();

async function tudo(tabela, cols) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const r = await fetch(`${SB}/rest/v1/${tabela}?select=${cols}&order=id.asc&offset=${de}&limit=1000`, { headers: H });
    if (!r.ok) throw new Error(`${tabela} → ${r.status} ${(await r.text()).slice(0, 200)}`);
    const p = await r.json(); out.push(...p);
    if (p.length < 1000) break;
  }
  return out;
}

const fatos = await tudo('fca_fatos', 'id,vigencia,unidade,projeto,origem,fato');
console.log(`fca_fatos: ${fatos.length} linha(s)\n`);

// ── quadro unidade × vigência ──
const vigs = [...new Set(fatos.map(f => f.vigencia).filter(Boolean))].sort();
const unis = [...new Set(fatos.map(f => (f.unidade || '(sem unidade)')))].sort();
const cel = {};
fatos.forEach(f => { const k = (f.unidade || '(sem unidade)') + '|' + f.vigencia; cel[k] = (cel[k] || 0) + 1; });

console.log('fatos por unidade × vigência');
console.log('unidade'.padEnd(12) + vigs.map(v => v.padStart(9)).join('') + '     total');
unis.forEach(u => {
  const linha = vigs.map(v => String(cel[u + '|' + v] || 0).padStart(9)).join('');
  const tot = vigs.reduce((s, v) => s + (cel[u + '|' + v] || 0), 0);
  console.log(u.padEnd(12) + linha + String(tot).padStart(10));
});

// vigência que só tem uma unidade, ou unidade que só tem uma vigência, é o
// sintoma de geração que rodou pela metade — vale dizer em voz alta
console.log('');
vigs.forEach(v => {
  const comDado = unis.filter(u => cel[u + '|' + v]);
  if (comDado.length < unis.length)
    console.log(`⚠ ${v}: só ${comDado.length} de ${unis.length} unidades têm fato (${comDado.join(', ')})`);
});
unis.forEach(u => {
  const q = vigs.filter(v => cel[u + '|' + v]);
  if (q.length === 1) console.log(`⚠ ${u}: fato em uma vigência só (${q[0]})`);
});

// ── o recorte pedido ──
if (FOCO) {
  const meus = fatos.filter(f => (f.unidade || '').toUpperCase() === FOCO);
  console.log(`\n── ${FOCO}: ${meus.length} fato(s) ──`);
  const porVig = {};
  meus.forEach(f => {
    const a = porVig[f.vigencia] || (porVig[f.vigencia] = { n: 0, org: {}, proj: {} });
    a.n++; a.org[f.origem || '—'] = (a.org[f.origem || '—'] || 0) + 1;
    a.proj[f.projeto || '—'] = (a.proj[f.projeto || '—'] || 0) + 1;
  });
  Object.keys(porVig).sort().forEach(v => {
    const a = porVig[v];
    console.log(`   ${v}: ${a.n} fato(s) · origem ${Object.entries(a.org).map(([k, q]) => k + '=' + q).join(' · ')}`
      + ` · projeto ${Object.entries(a.proj).map(([k, q]) => k + '=' + q).join(' · ')}`);
  });
  if (!meus.length) console.log('   nenhum fato gravado para esta unidade');
}

// ── quem pode abrir cada unidade (sem nome nem e-mail) ──
const perfis = await tudo('fca_profiles', 'user_id,unidade,is_admin');
const porUni = {};
perfis.forEach(p => String(p.unidade || '').toUpperCase().split(',').map(s => s.trim()).filter(Boolean)
  .forEach(u => { porUni[u] = (porUni[u] || 0) + 1; }));
const admins = perfis.filter(p => p.is_admin).length;
const semUni = perfis.filter(p => !p.is_admin && !String(p.unidade || '').trim()).length;
console.log(`\nperfis: ${perfis.length} · admin ${admins} · sem unidade ${semUni}`);
console.log('gestores por unidade: ' + (Object.entries(porUni).sort().map(([u, q]) => u + '=' + q).join(' · ') || '—'));
if (FOCO && !porUni[FOCO]) console.log(`⚠ nenhum perfil não-admin com a unidade ${FOCO} — quem abrir cai no hub de unidades vazio`);
