// ============================================================
// Carta de Custos — o que a troca de fonte mudou, e de onde vem cada hodômetro
//
// Roda DEPOIS do scripts/contrato-portal.sql. Três perguntas:
//
//   1. QUANTO MUDOU O DINHEIRO, mês a mês: o total pela regra ANTIGA (só a
//      planilha sobrepondo o cálculo) × o total pela regra NOVA (portal da VW
//      na frente, de fevereiro em diante). É a mesma precedência que o painel
//      aplica — se aqui e lá não baterem, um dos dois está errado.
//
//   2. DE ONDE VEM O `hodo_contrato` de cada placa: da nota da VW ou do
//      `ultimo_km_informado` da planilha (o plano B). Uma coluna que parece
//      cheia mas é metade plano B conta outra história.
//
//   3. POR QUE DUAS PLACAS TÊM O MESMO HODÔMETRO. No primeiro resultado
//      apareceram duas placas do V1673W com 12.253 idêntico — ou é o plano B
//      repetindo um número da planilha, ou é o portal mandando igual, ou é o
//      de-para de chassi juntando o que não devia. São três causas diferentes
//      e só uma delas seria bug meu.
//
// Não grava nada. Roda no GitHub Actions — o sandbox não alcança o Supabase.
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

const VW_INI = '2026-02';          // o MESMO corte do painel
const n   = v => (v == null ? '—' : Math.round(+v).toLocaleString('pt-BR'));
const brl = v => 'R$ ' + (Math.round((+v || 0) * 100) / 100)
  .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// o PostgREST corta em 1.000 linhas e ignora um limit maior — paginar é obrigatório
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

// ── as três leituras ──────────────────────────────────────────────────────
let CV = null, fonte = '';
const COLS = 'vig_cobranca,vig_km,placa,placa_origem,unidade,tipo,taxa_km,km_vig,'
  + 'valor_fixo,custo_vig,previa,contrato,hodo_abast,hodo_contrato,km_vw,valor_vw,faixas_vw';
for (const t of ['custo_vigencia_mv', 'custo_vigencia']) {
  try { CV = await todas(t, COLS, '&order=vig_cobranca.asc'); fonte = t; break; }
  catch (e) { console.log(`${t}: ${e.message}`); }
}
if (!CV) { console.error('custo_vigencia não respondeu'); process.exit(1); }

const PLAN = await todas('carta_custos', 'unidade,vigencia,equipamento,valor',
  '&origem=eq.contratos-planilha');
const PORTAL = await todas('vw_contrato_placa_mes', 'vigencia,placa,contrato,faixas,valor,km_atual');
const REG = await todas('contratos_placa', 'placa,contrato,tipo,ultimo_km_informado');

console.log(`fonte: ${fonte} · ${CV.length} linha(s) · planilha ${PLAN.length} lançamento(s)`
  + ` · portal ${PORTAL.length} linha(s) placa×mês · régua ${REG.length} placa(s)\n`);

// ── 1) o dinheiro: regra antiga × regra nova ──────────────────────────────
// a precedência do painel, na mesma ordem: portal → planilha → cálculo
const cobre = new Set(), val = new Map(), ultFixo = new Map();
PLAN.forEach(r => {
  cobre.add(r.unidade + '|' + r.vigencia);
  const pl = String(r.equipamento || '').toUpperCase();
  val.set(r.vigencia + '|' + pl, (val.get(r.vigencia + '|' + pl) || 0) + (+r.valor || 0));
});
PLAN.forEach(r => ultFixo.set(String(r.equipamento || '').toUpperCase(), +r.valor || 0));

const custoAntigo = r => {
  const pl = String(r.placa_origem || r.placa).toUpperCase();
  if (cobre.has(r.unidade + '|' + r.vig_cobranca)) return val.get(r.vig_cobranca + '|' + pl) || 0;
  if (r.tipo === 'fixo' && ultFixo.has(pl)) return ultFixo.get(pl);
  return +r.custo_vig || 0;
};
const custoNovo = r => (r.valor_vw != null && r.vig_cobranca >= VW_INI)
  ? (+r.valor_vw || 0) : custoAntigo(r);

const porVig = new Map();
CV.forEach(r => {
  const a = porVig.get(r.vig_cobranca) || {
    placas: 0, portal: 0, faixa2: 0, antigo: 0, novo: 0, mudaram: 0, delta: 0, previa: false,
  };
  a.placas++;
  a.previa = a.previa || !!r.previa;
  const vA = custoAntigo(r), vN = custoNovo(r);
  a.antigo += vA; a.novo += vN;
  if (r.valor_vw != null && r.vig_cobranca >= VW_INI) {
    a.portal++;
    if (r.faixas_vw > 1) a.faixa2++;
    if (Math.abs(vN - vA) >= 0.01) { a.mudaram++; a.delta += (vN - vA); }
  }
  porVig.set(r.vig_cobranca, a);
});

console.log('══ 1) O DINHEIRO — regra antiga (planilha) × regra nova (portal da VW)\n');
console.log('vigência  placas  c/portal  2 faixas        antigo            novo'
  + '           Δ (portal − planilha)  placas que mudaram');
let dTot = 0;
[...porVig.keys()].sort().forEach(v => {
  const a = porVig.get(v);
  dTot += a.delta;
  console.log(`${v}  ${String(a.placas).padStart(5)}  ${String(a.portal).padStart(7)}`
    + `  ${String(a.faixa2).padStart(7)}  ${brl(a.antigo).padStart(15)}  ${brl(a.novo).padStart(15)}`
    + `  ${((a.delta >= 0 ? '+' : '') + brl(a.delta)).padStart(20)}`
    + `  ${String(a.mudaram).padStart(5)}${a.previa ? '   (prévia)' : ''}`);
});
console.log(`\nΔ acumulado no ano: ${(dTot >= 0 ? '+' : '') + brl(dTot)}`);
console.log('Δ positivo = o portal cobra MAIS do que a planilha lançava (dinheiro que');
console.log('não estava na Carta). Δ negativo = a planilha lançava a mais.\n');

// ── 2) de onde vem o hodômetro do contrato ────────────────────────────────
const regDe = new Map(REG.map(r => [r.placa, r]));
const portalPlaca = new Set(PORTAL.map(p => p.placa));

console.log('══ 2) DE ONDE VEM O `hodo_contrato`\n');
const ult = [...porVig.keys()].sort().pop();
const doMes = CV.filter(r => r.vig_cobranca === ult);
let vwN = 0, planoB = 0, vazio = 0, abastN = 0;
doMes.forEach(r => {
  if (r.hodo_abast != null) abastN++;
  if (r.hodo_contrato == null) { vazio++; return; }
  // veio do portal se a placa aparece no portal em ALGUMA vigência (o arraste
  // só pode ter herdado de lá); senão só pode ser o `ultimo_km_informado`
  if (portalPlaca.has(r.placa)) vwN++; else planoB++;
});
console.log(`vigência ${ult} · ${doMes.length} placas`);
console.log(`  hodômetro do CONTRATO pela nota da VW ....... ${vwN}`);
console.log(`  hodômetro do CONTRATO pelo Km Informado ..... ${planoB}  (plano B, placa fora do portal)`);
console.log(`  sem hodômetro de contrato .................... ${vazio}`);
console.log(`  hodômetro de ABASTECIMENTO preenchido ........ ${abastN} de ${doMes.length}\n`);

// ── 3) o mesmo hodômetro em placas diferentes ─────────────────────────────
console.log('══ 3) MESMO `hodo_contrato` EM PLACAS DIFERENTES (o caso do 12.253)\n');
const porValor = new Map();
doMes.forEach(r => {
  if (r.hodo_contrato == null) return;
  const k = String(r.hodo_contrato);
  if (!porValor.has(k)) porValor.set(k, []);
  porValor.get(k).push(r);
});
const repetidos = [...porValor.entries()].filter(([, v]) => v.length > 1)
  .sort((a, b) => b[1].length - a[1].length);
if (!repetidos.length) console.log('nenhum valor repetido.\n');
repetidos.slice(0, 10).forEach(([v, rs]) => {
  console.log(`  ${n(v)} km em ${rs.length} placas:`);
  rs.forEach(r => {
    const reg = regDe.get(r.placa) || {};
    const noPortal = PORTAL.filter(p => p.placa === r.placa)
      .sort((a, b) => a.vigencia.localeCompare(b.vigencia));
    const ultP = noPortal[noPortal.length - 1];
    console.log(`     ${String(r.placa_origem || r.placa).padEnd(9)} ${String(r.contrato || '—').padEnd(8)}`
      + ` · Km Informado na planilha: ${String(n(reg.ultimo_km_informado)).padStart(9)}`
      + ` · último no portal: ${ultP ? `${n(ultP.km_atual)} (${ultP.vigencia})` : 'NÃO ESTÁ NO PORTAL'}`);
  });
  console.log('');
});

// ── 4) os maiores descolamentos, com o mês de cada leitura ────────────────
console.log('══ 4) MAIOR DESCOLAMENTO ENTRE OS DOIS HODÔMETROS — vigência ' + ult + '\n');
console.log('ATENÇÃO à leitura: na vigência em PRÉVIA o mês de km ainda está correndo e o');
console.log('portal ainda não emitiu a nota, então os dois lados são de datas diferentes.');
console.log('O que interessa é o descolamento GRANDE, não o sinal de cada linha.\n');
console.log('placa      contrato  hodô. contrato  (mês da nota)  hodô. abast.   diferença');
doMes.filter(r => r.hodo_abast != null && r.hodo_contrato != null)
  .sort((a, b) => Math.abs(b.hodo_abast - b.hodo_contrato) - Math.abs(a.hodo_abast - a.hodo_contrato))
  .slice(0, 15)
  .forEach(r => {
    const noPortal = PORTAL.filter(p => p.placa === r.placa)
      .sort((a, b) => a.vigencia.localeCompare(b.vigencia));
    const ultP = noPortal[noPortal.length - 1];
    const d = r.hodo_abast - r.hodo_contrato;
    console.log(`${String(r.placa_origem || r.placa).padEnd(10)} ${String(r.contrato || '—').padEnd(9)}`
      + ` ${n(r.hodo_contrato).padStart(13)}  ${(ultP ? ultP.vigencia : 'Km Informado').padStart(13)}`
      + ` ${n(r.hodo_abast).padStart(13)}  ${((d >= 0 ? '+' : '') + n(d)).padStart(10)}`);
  });
console.log('\nDiferença NEGATIVA = a VW fechou a nota num hodômetro À FRENTE do que a bomba');
console.log('viu. POSITIVA = o veículo já rodou além do que foi cobrado.');
