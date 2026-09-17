// ============================================================
// Carta de Custos — a coluna FAIXA chegou ao banco?
//
// Roda DEPOIS do scripts/contrato-faixa-coluna.sql e responde o que a tela não
// responde sozinha. A pergunta que motiva o script é bem concreta: o SQL tem
// TRÊS blocos, e rodar só o primeiro deixa o rótulo na `vw_contrato_placa_mes`
// sem ele chegar à `custo_vigencia` — nesse caso o painel esconde a coluna e
// fica EXATAMENTE igual a antes, sem erro nenhum na tela. Daí "rodei a query"
// e "a coluna apareceu" não serem a mesma coisa.
//
//   1. ONDE O RÓTULO JÁ ESTÁ: na view por placa/mês, na view de custo, na
//      materializada que o painel lê. São três lugares e o SQL enche os três;
//      se um faltar, o log diz qual bloco não rodou.
//   2. O QUE ELE TEM: os rótulos por vigência, quantas placas em cada um, e
//      quantas atravessaram a faixa no mês (`1 -> 2`).
//   3. A TELA VAI MOSTRAR? repete a regra do painel (`temFaixa`): coluna só
//      aparece se alguma placa do recorte tiver rótulo, no contrato variável.
//
// Não grava nada. Roda no GitHub Actions — o sandbox não alcança o Supabase.
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

const n = v => (v == null ? '—' : Math.round(+v).toLocaleString('pt-BR'));

// o PostgREST corta em 1.000 linhas e ignora um limit maior — paginar é obrigatório
async function todas(tabela, cols, extra = '') {
  const passo = 1000, out = [];
  for (let off = 0; ; off += passo) {
    const r = await fetch(`${SB_URL}/rest/v1/${tabela}?select=${cols}${extra}`,
      { headers: { ...H, Range: `${off}-${off + passo - 1}` } });
    if (!r.ok) {
      const t = await r.text();
      const e = new Error(`${tabela} → ${r.status} ${t.slice(0, 200)}`);
      e.status = r.status; e.corpo = t; throw e;
    }
    const p = await r.json();
    out.push(...p);
    if (p.length < passo) return out;
  }
}
// "a coluna existe?" é uma pergunta de 1 linha: pedir a coluna e ver se o
// PostgREST recusa com 42703. Pedir a tabela inteira para descobrir isso seria
// baixar megabytes para ler um nome.
async function temColuna(tabela, coluna) {
  const r = await fetch(`${SB_URL}/rest/v1/${tabela}?select=${coluna}&limit=1`, { headers: H });
  if (r.ok) return true;
  const t = await r.text();
  if (/42703|does not exist/i.test(t)) return false;
  throw new Error(`${tabela}.${coluna} → ${r.status} ${t.slice(0, 200)}`);
}

console.log('═══ A coluna FAIXA chegou ao banco? ═══\n');

// ── 1) onde o rótulo já está ──────────────────────────────────────────────
const ondes = [
  ['vw_contrato_placa_mes', 'faixa',    'bloco 1 do SQL (a view por placa e mês)'],
  ['custo_vigencia',        'faixa_vw', 'bloco 2 do SQL (a view de custo)'],
  ['custo_vigencia_mv',     'faixa_vw', 'bloco 3 do SQL (a materializada — é ESTA que o painel lê)'],
];
const estado = {};
for (const [tab, col, oque] of ondes) {
  let tem = null, erro = '';
  try { tem = await temColuna(tab, col); }
  catch (e) { erro = e.message; }
  estado[tab] = tem;
  console.log(`  ${tem === true ? '✓' : tem === false ? '✗' : '?'} ${tab}.${col}`
    + `  — ${oque}${erro ? '  · ' + erro : ''}`);
}
console.log('');

if (!estado['custo_vigencia_mv']) {
  console.log('A materializada ainda NÃO tem a coluna, então o painel segue escondendo');
  console.log('a Faixa (e a tabela fica igual a antes, sem erro na tela).');
  console.log(estado['vw_contrato_placa_mes']
    ? 'O bloco 1 rodou; faltam o 2 e o 3 do scripts/contrato-faixa-coluna.sql.'
    : 'Nenhum bloco rodou ainda — rodar o scripts/contrato-faixa-coluna.sql inteiro.');
  process.exit(0);
}

// ── 2) o que o rótulo tem ─────────────────────────────────────────────────
const linhas = await todas('custo_vigencia_mv',
  'vig_cobranca,placa_origem,placa,unidade,tipo,contrato,faixa_vw,faixas_vw,km_vig,valor_vw');

const comPortal = linhas.filter(r => r.valor_vw != null);
const comRotulo = linhas.filter(r => r.faixa_vw);
console.log(`  ${n(linhas.length)} linha(s) na materializada · ${n(comPortal.length)} com nota da VW`
  + ` · ${n(comRotulo.length)} com rótulo de faixa\n`);

const porVig = new Map();
comPortal.forEach(r => {
  const k = r.vig_cobranca;
  const a = porVig.get(k) || { total: 0, rot: new Map(), atravessou: 0 };
  a.total++;
  const rot = r.faixa_vw || '(sem rótulo)';
  a.rot.set(rot, (a.rot.get(rot) || 0) + 1);
  if (+r.faixas_vw > 1) a.atravessou++;
  porVig.set(k, a);
});
console.log('  vigência   placas   rótulos');
[...porVig.entries()].sort().forEach(([vig, a]) => {
  const rot = [...a.rot.entries()].sort()
    .map(([k, v]) => `${k}: ${v}`).join(' · ');
  console.log(`  ${vig}   ${String(a.total).padStart(5)}   ${rot}`);
});
console.log('');

// ── 3) quem atravessou, com o km do mês contra o que a placa costuma rodar ──
// É a leitura que o Renan descreveu: "se rodar mais que o usual foi de faixa 1
// para 2 e vice versa". O km médio vem de TODA a base, não do mês.
const med = new Map();
linhas.filter(r => r.km_vig != null).forEach(r => {
  const a = med.get(r.placa) || { n: 0, km: 0 };
  a.n++; a.km += +r.km_vig || 0; med.set(r.placa, a);
});
const cruz = comPortal.filter(r => +r.faixas_vw > 1)
  .sort((a, b) => (b.vig_cobranca + '').localeCompare(a.vig_cobranca + '') || (+b.km_vig || 0) - (+a.km_vig || 0));
if (!cruz.length) console.log('  Nenhuma placa foi cobrada em duas faixas no mês.\n');
else {
  console.log(`  ${cruz.length} placa-mês cobradas em DUAS faixas:\n`);
  console.log('  vigência   placa       contrato   faixa      km do mês   km médio da placa');
  cruz.slice(0, 25).forEach(r => {
    const m = med.get(r.placa);
    console.log(`  ${r.vig_cobranca}   ${String(r.placa_origem || r.placa).padEnd(10)}`
      + `  ${String(r.contrato || '—').padEnd(9)}  ${String(r.faixa_vw || '—').padEnd(9)}`
      + `  ${n(r.km_vig).padStart(9)}   ${m && m.n ? n(m.km / m.n).padStart(9) : '        —'}`);
  });
  if (cruz.length > 25) console.log(`  … e mais ${cruz.length - 25}`);
  console.log('');
}

// ── 4) a tela vai mostrar? a MESMA regra do painel ────────────────────────
// `temFaixa = CONTR_FX && !fixo && rows.some(r => r.faixa_vw)` — a coluna some
// no contrato fixo (que não está no portal da VW) e quando nenhuma placa do
// recorte tem rótulo. Repetir a regra aqui é o que separa "o dado existe" de
// "o usuário vai ver".
const vigs = [...new Set(linhas.map(r => r.vig_cobranca))].sort();
console.log('  a coluna aparece na tela? (regra do painel, contrato variável)\n');
console.log('  vigência   placas variáveis   com rótulo   coluna');
vigs.slice(-6).forEach(vig => {
  const rows = linhas.filter(r => r.vig_cobranca === vig && r.tipo !== 'fixo');
  const com = rows.filter(r => r.faixa_vw).length;
  console.log(`  ${vig}   ${String(rows.length).padStart(15)}   ${String(com).padStart(10)}`
    + `   ${com ? 'SIM' : 'não (nenhum rótulo)'}`);
});
console.log('\n✓ conferência concluída.');
