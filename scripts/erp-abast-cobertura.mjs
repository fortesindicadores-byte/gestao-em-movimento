// ============================================================
// Até onde o histórico de abastecimentos ALCANÇA no Supabase?
//
// A pergunta que motiva: "consigo ver o km rodado em 2021 no projeto
// INSUMOS - PIR?". As tabelas do ERP (MF_ORDEMSERVICOCOMBUSTIVEIS…) vivem no
// Benner e só respondem lá; o que existe no portal é a `erp_abastecimentos`,
// alimentada pela aba "Query Banco" da planilha Contratos Man. — ou seja, ela
// tem só a JANELA que a query da TI traz, não o histórico inteiro.
//
// Este script diz, sem chute: qual o período coberto, quais projetos existem e
// se algum deles tem 2021. Assim "não dá para ver 2021 no portal" vira uma
// medida, e não uma suposição minha.
//
// Não grava nada. Roda no GitHub Actions — o sandbox não alcança o Supabase.
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

const n = v => (v == null ? '—' : Math.round(+v).toLocaleString('pt-BR'));

async function todas(tabela, cols, extra = '') {
  const passo = 1000, out = [];
  for (let off = 0; ; off += passo) {
    const r = await fetch(`${SB_URL}/rest/v1/${tabela}?select=${cols}${extra}`,
      { headers: { ...H, Range: `${off}-${off + passo - 1}` } });
    if (!r.ok) throw new Error(`${tabela} → ${r.status} ${(await r.text()).slice(0, 200)}`);
    const p = await r.json();
    out.push(...p);
    if (p.length < passo) return out;
  }
}

console.log('═══ Até onde o histórico de abastecimentos alcança ═══\n');

const linhas = await todas('erp_abastecimentos',
  'placa,projeto_os,projeto_veiculo,unidade_prod,data,km_rodado,hodometro');
console.log(`  ${n(linhas.length)} abastecimento(s) na erp_abastecimentos\n`);

// ── 1) o período coberto, ano a ano ───────────────────────────────────────
const porAno = new Map();
linhas.forEach(r => {
  const ano = String(r.data || '').slice(0, 4) || '(sem data)';
  const a = porAno.get(ano) || { n: 0, km: 0, placas: new Set() };
  a.n++; a.km += +r.km_rodado || 0; a.placas.add(r.placa); porAno.set(ano, a);
});
console.log('  ano        linhas    placas    km rodado');
[...porAno.entries()].sort().forEach(([ano, a]) => {
  console.log(`  ${ano.padEnd(10)} ${String(a.n).padStart(6)}    ${String(a.placas.size).padStart(6)}    ${n(a.km).padStart(12)}`);
});
const datas = linhas.map(r => r.data).filter(Boolean).sort();
console.log(`\n  período: ${datas[0] || '—'} → ${datas[datas.length - 1] || '—'}\n`);

// ── 2) os projetos, do jeito que estão escritos ───────────────────────────
// Duas colunas: `projeto_os` é o projeto NA ÉPOCA do abastecimento (vem da
// ordem de serviço) e `projeto_veiculo` é o do CADASTRO de hoje. Para uma
// pergunta histórica vale a primeira — a segunda devolve a frota como está
// agora, não como estava.
for (const col of ['projeto_os', 'projeto_veiculo']) {
  const m = new Map();
  linhas.forEach(r => { const v = r[col] || '(vazio)'; m.set(v, (m.get(v) || 0) + 1); });
  const ins = [...m.entries()].filter(([k]) => /INSUMO/i.test(k));
  console.log(`  ${col}: ${m.size} valor(es) distinto(s)`
    + (ins.length ? ` · com INSUMO: ${ins.map(([k, v]) => `"${k}" (${v})`).join(' · ')}` : ' · NENHUM com "INSUMO"'));
}
console.log('');

// ── 3) a pergunta direta ──────────────────────────────────────────────────
const de2021 = linhas.filter(r => String(r.data || '').startsWith('2021'));
console.log(de2021.length
  ? `  2021 NO PORTAL: ${n(de2021.length)} linha(s).`
  : '  2021 NO PORTAL: NÃO EXISTE — a tabela só tem a janela que a query da TI traz.');
console.log('  O histórico de 2021 só pode ser consultado no BANCO DO ERP (Benner),');
console.log('  que é onde as tabelas MF_ORDEMSERVICOCOMBUSTIVEIS / GN_PROJETOS vivem.\n');
console.log('✓ conferência concluída.');
