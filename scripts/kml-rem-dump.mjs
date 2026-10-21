// ============================================================
// Km/L REMUNERADO · dump de apoio (só leitura)
//
// Para a análise do consumo remunerado (planilha "Análise Km/L Remunerado",
// que o Renan exporta do FT): imprime no log, em texto simples, o que a
// planilha NÃO traz e que a análise precisa cruzar por placa —
//   1) a aba Km/L do Consumo (sh_consumo_km_litro): vigência, projeto, unidade,
//      placa, modelo, tipo, km, litros, Km/L rem médio, rem modelo, real, ativo;
//   2) a base Ativos do Ginfo (ginfo_snapshot['ativos']): placa, filial,
//      projeto, marca, modelo, tipo, ano.
// Nada é gravado. Roda no Actions porque o sandbox não alcança o Supabase.
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

async function rest(q) {
  const r = await fetch(`${SB_URL}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(`${r.status} ${q} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function tudo(tabela, order) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const p = await rest(`${tabela}?select=*&order=${order}&offset=${off}&limit=1000`);
    out.push(...p);
    if (p.length < 1000) break;
  }
  return out;
}
const lim = s => String(s ?? '').replace(/[|\r\n]+/g, ' ').trim();

// ── 1) aba Km/L ──
const [base] = await rest('sh_base?select=slug,colunas,linhas,erro,carregado_em&slug=eq.consumo_km_litro');
console.log(`sh_base consumo_km_litro: ${base.linhas} linhas · carga ${base.carregado_em} · erro ${base.erro || '—'}`);
const cols = base.colunas.slice().sort((a, b) => a.i - b.i);
console.log('colunas:', cols.map(c => `${c.i}:${c.label || '(sem rótulo)'}:${c.col}`).join(' · '));
const linhas = await tudo('sh_consumo_km_litro', 'linha.asc');
console.log(`linhas lidas: ${linhas.length}`);
// posições da aba conferidas no KmL Aba Inspect (05/10/2026):
// A vig · E rem médio · F rem modelo · G real · L ativo · O projeto-unidade · P unidade · Q placa · T modelo · V tipo · W km · X litros
const IDX = { vig: 0, remM: 4, remMod: 5, real: 6, ativo: 11, projUni: 14, uni: 15, placa: 16, modelo: 19, tipo: 21, km: 22, lit: 23 };
const colDe = i => (cols.find(c => c.i === i) || {}).col;
console.log('#### KML ####');
console.log('vig|projUni|uni|placa|modelo|tipo|km|lit|remM|remMod|real|ativo');
for (const r of linhas) {
  const g = k => r[colDe(IDX[k])];
  console.log([g('vig'), g('projUni'), g('uni'), g('placa'), g('modelo'), g('tipo'), g('km'), g('lit'), g('remM'), g('remMod'), g('real'), g('ativo')].map(lim).join('|'));
}
console.log('#### FIM KML ####');

// ── 2) ativos do Ginfo ──
const [gs] = await rest('ginfo_snapshot?chave=eq.ativos&select=data,updated_at');
console.log(`ginfo ativos: ${gs.data.length} linhas · ${gs.updated_at}`);
console.log('#### ATIVOS ####');
console.log('placa|filial|projeto|marca|modelo|tipo|ano');
for (const a of gs.data) {
  console.log([a['Placa'], a['Filial'], a['Projeto'], a['Marca'], a['Modelo'], a['Tipo Veículo'], a['Ano Fabricação']].map(lim).join('|'));
}
console.log('#### FIM ATIVOS ####');
