// ============================================================
// Uma placa "não está buscando o abastecimento" — onde ela existe?
//
// O km atual das Preventivas Seara vem de hodometro_leitura (API Pró-Frotas,
// pelos CNPJs da aba Base CNPJ). Quando a placa aparece com "—", há três
// explicações possíveis, e a tela não separa nenhuma: (1) a placa não
// abastece pelo Pró-Frotas (outro cartão/CNPJ); (2) abastece, mas o robô
// ainda não coletou (roda uma vez por dia, ~11h BRT); (3) a placa está
// grafada de um jeito no cadastro e de outro na API.
//
// Este check responde por placa, lendo o que o portal já tem:
//   · hodometro_leitura  — última leitura do Pró-Frotas e quantas há;
//   · erp_abastecimentos — o abastecimento no ERP (Benner), que é OUTRA
//                          fonte: se o ERP tem e o Pró-Frotas não, o veículo
//                          abastece fora do cartão;
//   · ativos_manual      — como a placa está cadastrada na unidade, e se
//                          existe uma "irmã" a um caractere de distância
//                          (RYM0B07 × RYM0B87 já aconteceu na Carta).
//
// Uso: PLACAS="FQT4F96,FQT4E96" node scripts/placa-abast-check.mjs
// Não grava nada. Roda no Actions — o sandbox não alcança o Supabase.
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

const MERCOSUL = 'ABCDEFGHIJ';
const normP = p => { const s = String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{3}\d{4}$/.test(s) ? s.slice(0, 4) + MERCOSUL[+s[4]] + s.slice(5) : s; };
const PLACAS = (process.env.PLACAS || '').split(/[,;\s]+/).filter(Boolean).map(normP);
if (!PLACAS.length) { console.error('PLACAS vazio'); process.exit(1); }

async function q(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path.split('?')[0]} → ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
const dt = s => (s ? String(s).slice(0, 16).replace('T', ' ') : '—');
const n = v => (v == null ? '—' : Math.round(+v).toLocaleString('pt-BR'));
const lista = a => `in.(${a.map(p => `"${p}"`).join(',')})`;

console.log('═══ Onde cada placa abastece ═══\n');
console.log('placas procuradas:', PLACAS.join(' · '), '\n');

// ── cadastro da unidade ──────────────────────────────────────────────────
const ativos = await q('ativos_manual?select=placa,unidade,filial,projeto,marca,modelo,tipo_veiculo');
const porPlaca = new Map(ativos.map(a => [normP(a.placa), a]));
// irmãs a um caractere: mesmo tamanho, uma posição diferente
const irmas = p => ativos.map(a => normP(a.placa)).filter(x => x !== p && x.length === p.length && [...x].filter((c, i) => c !== p[i]).length === 1);

for (const p of PLACAS) {
  console.log(`━━ ${p}`);
  const a = porPlaca.get(p);
  console.log(a ? `  cadastro (ativos_manual): ${a.unidade} · ${a.filial}/${a.projeto} · ${a.marca} ${a.modelo} · ${a.tipo_veiculo}`
                : '  cadastro (ativos_manual): NÃO ESTÁ');
  const ir = irmas(p);
  if (ir.length) console.log(`  irmã(s) a UM caractere no cadastro: ${ir.map(x => `${x} (${(porPlaca.get(x) || {}).modelo || '?'})`).join(' · ')}`);

  // ── Pró-Frotas ──
  const hl = await q(`hodometro_leitura?select=placa,km,data,unidade&placa=eq.${p}&order=data.desc&limit=3`);
  const hlN = await fetch(`${SB_URL}/rest/v1/hodometro_leitura?select=placa&placa=eq.${p}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  const total = (hlN.headers.get('content-range') || '').split('/')[1];
  console.log(hl.length
    ? `  Pró-Frotas (hodometro_leitura): ${total} leitura(s) · última ${dt(hl[0].data)} km ${n(hl[0].km)} · unidade ${hl[0].unidade}`
    : '  Pró-Frotas (hodometro_leitura): NENHUMA leitura — a placa não abastece pelos CNPJs da Base CNPJ (ou a API a grafa diferente)');

  // ── ERP ──
  let erp = [];
  try {
    erp = await q(`erp_abastecimentos?select=placa,data,hodometro,km_rodado,litros,projeto_os,unidade_prod&placa=eq.${p}&order=data.desc&limit=5`);
  } catch (e) {
    // a tabela tem as colunas que a query da TI trouxe; se o nome mudou, cai para o mínimo
    try { erp = await q(`erp_abastecimentos?select=*&placa=eq.${p}&order=data.desc&limit=5`); }
    catch (e2) { console.log('  ERP (erp_abastecimentos): não deu para ler —', e2.message); }
  }
  if (erp.length) {
    console.log(`  ERP (erp_abastecimentos): ${erp.length}+ abastecimento(s); os últimos:`);
    erp.forEach(r => console.log(`     ${dt(r.data)} · hodômetro ${n(r.hodometro)} · ${r.projeto_os || r.projeto || ''} ${r.unidade_prod || ''}`));
  } else console.log('  ERP (erp_abastecimentos): nenhum abastecimento com esta placa');
  console.log('');
}

// ── leitura ─────────────────────────────────────────────────────────────
console.log('Como ler:');
console.log('  · Pró-Frotas vazio + ERP com abastecimento recente → o veículo abastece FORA do cartão Pró-Frotas (outro CNPJ/cartão): o painel nunca vai ter o km dele por essa via.');
console.log('  · Pró-Frotas vazio + ERP vazio → a placa não abastece em lugar nenhum com essa grafia: conferir a placa (irmã a um caractere?).');
console.log('  · Pró-Frotas com leitura antiga → coleta parou para ela; o robô roda 1×/dia (~11h BRT), abastecimento de ontem à tarde só entra hoje.');
console.log('\n✓ conferência concluída.');
