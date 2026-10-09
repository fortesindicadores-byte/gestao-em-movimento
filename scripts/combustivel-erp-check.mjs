// ============================================================
// Combustível do ERP × DRE — dá para montar a Carta de Combustíveis?
// (Renan, 09/10/2026)
//
// A TI incluiu TIPO_COMBUSTIVEL na query dos abastecimentos e o PowerShell do
// Renan passou a gravar a coluna `tipo_combustivel` em erp_abastecimentos.
// Antes de levar o pacote Combustíveis para a Carta, três perguntas:
//
//   1. A coluna chegou? (linhas de 2026 sem tipo = carga ainda não rodou)
//   2. O VALOR do ERP é confiável? A consulta direta no ERP deu R$ 1,54 bi para
//      6,4 mi de litros de S10 (R$ 240/L), enquanto os outros tipos dão preço
//      normal — então há linhas com valor absurdo. Aqui elas são listadas, com
//      o R$/L de cada uma, para a TI/unidade corrigir no ERP.
//   3. Sem as absurdas, o diesel e o Arla do ERP batem com o realizado do DRE
//      (aba Frota, contas Combustíveis e Arla), mês a mês?
//
// Não grava nada. Imprime placa, data e nº da OS (nada de nome de pessoa).
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const DESDE = process.env.DESDE || '2026-01-01';
const RL_MIN = +process.env.RL_MIN || 1.5;     // R$/L abaixo disso = suspeito
const RL_MAX = +process.env.RL_MAX || 12;      // R$/L acima disso = suspeito

const n = (v, d = 0) => (v == null || !isFinite(v) ? '—'
  : (+v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const num = v => {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/\s|R\$/g, '');
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  const f = parseFloat(s); return isNaN(f) ? 0 : f;
};

async function todas(caminho) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SB_URL}/rest/v1/${caminho}`, { headers: { ...H, Range: `${off}-${off + 999}` } });
    if (!r.ok) throw new Error(`${caminho.split('?')[0]} → ${r.status} ${(await r.text()).slice(0, 200)}`);
    const p = await r.json(); out.push(...p);
    if (p.length < 1000) return out;
  }
}

// classe do produto → conta da Carta (as mesmas contas do pacote na Visão Financeira)
function classe(tipo) {
  const t = norm(tipo);
  if (!t) return '(sem tipo)';
  if (t.includes('arla')) return 'Arla';
  if (t.includes('diesel')) return 'Diesel';
  if (t.includes('glp') || t.includes('gas empilhadeira') || t.startsWith('gas ')) return 'GLP';
  if (t.includes('gasolina') || t.includes('etanol')) return 'Gasolina/Etanol';
  return 'Outro';
}

console.log(`═══ Combustível do ERP × DRE (desde ${DESDE}) ═══\n`);

// ── 1) abastecimentos ──
let ab;
try {
  ab = await todas(`erp_abastecimentos?select=ordem_servico,data,placa_origem,filial,projeto_os,litros,valor,tipo_combustivel,projeto_veiculo,encerrada,status_os,atualizado_em&data=gte.${DESDE}${process.env.SO_ENCERRADAS ? '&encerrada=eq.S' : ''}&order=data.asc`);
} catch (e) {
  console.log('ERRO lendo erp_abastecimentos:', e.message);
  if (/tipo_combustivel/.test(e.message)) console.log('→ a coluna tipo_combustivel não existe: rodar o ALTER no Supabase.');
  process.exit(1);
}
const semTipo = ab.filter(r => !r.tipo_combustivel);
const ultCarga = ab.reduce((m, r) => (r.atualizado_em > m ? r.atualizado_em : m), '');
console.log(`━━ 1) Carga${process.env.SO_ENCERRADAS ? ' (só OS encerradas)' : ''}`);
console.log(`   ${n(ab.length)} abastecimento(s) desde ${DESDE} · última gravação ${ultCarga}`);
console.log(`   sem tipo de combustível: ${n(semTipo.length)}${semTipo.length ? ' ← a carga com a coluna nova ainda não passou por essas linhas' : ''}\n`);

// ── 2) preço por litro e linhas absurdas ──
const L = ab.map(r => {
  const litros = num(r.litros), valor = num(r.valor);
  return { ...r, litros, valor, rl: litros > 0 ? valor / litros : null, cls: classe(r.tipo_combustivel), vig: String(r.data).slice(0, 7) };
});
const suspeita = r => r.cls !== 'GLP' && (r.litros <= 0 || r.rl == null || r.rl < RL_MIN || r.rl > RL_MAX);

console.log(`━━ 2) Por tipo (R$/L fora de ${RL_MIN}–${RL_MAX} = suspeito; GLP não entra na régua)`);
const porTipo = new Map();
for (const r of L) {
  const k = r.tipo_combustivel || '(sem tipo)';
  const a = porTipo.get(k) || { cls: r.cls, n: 0, lit: 0, val: 0, ns: 0, vs: 0, rls: [] };
  a.n++; a.lit += r.litros; a.val += r.valor;
  if (suspeita(r)) { a.ns++; a.vs += r.valor; } else if (r.rl != null) a.rls.push(r.rl);
  porTipo.set(k, a);
}
const med = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
for (const [k, a] of [...porTipo].sort((x, y) => y[1].val - x[1].val)) {
  console.log(`   ${k}  [${a.cls}]`);
  console.log(`      ${n(a.n)} abast · ${n(a.lit)} L · R$ ${n(a.val, 2)} · mediana R$/L ${n(med(a.rls), 2)}`);
  if (a.ns) console.log(`      suspeitos: ${n(a.ns)} linha(s) somando R$ ${n(a.vs, 2)}`);
}
const susp = L.filter(suspeita).sort((a, b) => b.valor - a.valor);
console.log(`\n   ${n(susp.length)} linha(s) suspeita(s) · R$ ${n(susp.reduce((s, r) => s + r.valor, 0), 2)}`);
console.log('   as 25 de maior valor (OS · data · placa · tipo · litros · valor · R$/L · filial):');
susp.slice(0, 25).forEach(r => console.log(`      ${r.ordem_servico} · ${r.data} · ${r.placa_origem} · ${r.tipo_combustivel} · ${n(r.litros, 1)} L · R$ ${n(r.valor, 2)} · ${n(r.rl, 2)} · ${r.filial}`));
const susPorVig = new Map();
susp.forEach(r => susPorVig.set(r.vig, (susPorVig.get(r.vig) || 0) + 1));
console.log('   suspeitos por mês: ' + [...susPorVig].sort().map(([v, c]) => `${v}=${c}`).join(' · '));
console.log('');

// ── 3) ERP (sem suspeitos) × DRE, mês a mês ──
console.log('━━ 3) ERP × DRE (aba Frota, realizado) — mês a mês, frota inteira');
let dre = [];
try { dre = await todas('sh_dre_frota?select=*&order=linha.asc'); }
catch (e) { console.log('   ERRO lendo sh_dre_frota:', e.message); }
if (dre.length) {
  const ks = Object.keys(dre[0]);
  const kCta = ks.find(k => norm(k).includes('conta')) || ks.find(k => norm(k).includes('cta'));
  const kUni = ks.find(k => norm(k) === 'unidade') || ks.find(k => norm(k).includes('unidade'));
  console.log(`   colunas usadas no DRE: conta=${kCta} · unidade=${kUni} · realizado · remunerado · vigencia`);
  const vigDe = v => { const s = String(v || ''); const m = s.match(/^(\d{4})-(\d{2})/); return m ? `${m[1]}-${m[2]}` : s.slice(0, 7); };
  const contaCls = c => {
    const t = norm(c);
    if (t.includes('arla')) return 'Arla';
    if (t.startsWith('combustiveis')) return 'Diesel';
    return null;
  };
  const D = new Map(), contasVistas = new Map();
  for (const l of dre) {
    const cls = contaCls(l[kCta]);
    if (!cls) continue;
    contasVistas.set(l[kCta], (contasVistas.get(l[kCta]) || 0) + 1);
    const vig = vigDe(l.vigencia_orig || l.vigencia);
    if (vig < DESDE.slice(0, 7)) continue;
    const k = vig + '|' + cls;
    const a = D.get(k) || { real: 0, rem: 0 };
    a.real += -num(l.realizado); a.rem += -num(l.remunerado);   // despesa vem negativa na aba
    D.set(k, a);
  }
  console.log('   contas do DRE consideradas: ' + [...contasVistas].map(([c, q]) => `${c} (${q})`).join(' · '));
  const E = new Map(), Es = new Map();
  for (const r of L) {
    if (r.cls !== 'Diesel' && r.cls !== 'Arla') continue;
    const k = r.vig + '|' + r.cls;
    E.set(k, (E.get(k) || 0) + r.valor);
    if (!suspeita(r)) Es.set(k, (Es.get(k) || 0) + r.valor);
  }
  const vigs = [...new Set([...D.keys(), ...E.keys()].map(k => k.split('|')[0]))].sort();
  for (const cls of ['Diesel', 'Arla']) {
    console.log(`\n   ${cls}:   vig      ERP bruto        ERP sem suspeitos   DRE realizado    Δ (sem susp. − DRE)`);
    for (const v of vigs) {
      const k = v + '|' + cls, d = D.get(k), e = E.get(k) || 0, es = Es.get(k) || 0;
      const dr = d ? d.real : null;
      const pct = dr ? ` (${n((es / dr - 1) * 100, 1)}%)` : '';
      console.log(`            ${v}  R$ ${n(e, 0).padStart(14)}  R$ ${n(es, 0).padStart(14)}  R$ ${n(dr, 0).padStart(13)}  ${dr == null ? '—' : 'R$ ' + n(es - dr, 0)}${pct}`);
    }
  }

  // por unidade no último mês completo, para enxergar o de-para filial → unidade
  // último mês que o DRE já fechou (o mês corrente e o anterior ainda vêm zerados)
  const ultimo = vigs.filter(v => (D.get(v + '|Diesel') || {}).real > 0).pop();
  if (ultimo) {
    console.log(`\n   ${ultimo} — Diesel por unidade, para montar o de-para (ERP pela filial · DRE pela unidade):`);
    const ef = new Map();
    L.filter(r => r.vig === ultimo && r.cls === 'Diesel' && !suspeita(r))
      .forEach(r => ef.set(r.filial || '(sem filial)', (ef.get(r.filial || '(sem filial)') || 0) + r.valor));
    [...ef].sort((a, b) => b[1] - a[1]).forEach(([f, v]) => console.log(`      ERP  ${f}: R$ ${n(v, 0)}`));
    const du = new Map();
    for (const l of dre) {
      if (contaCls(l[kCta]) !== 'Diesel' || vigDe(l.vigencia_orig || l.vigencia) !== ultimo) continue;
      du.set(l[kUni] || '(vazio)', (du.get(l[kUni] || '(vazio)') || 0) - num(l.realizado));
    }
    [...du].sort((a, b) => b[1] - a[1]).forEach(([u, v]) => console.log(`      DRE  ${u}: R$ ${n(v, 0)}`));
  }
}
// ── PROJETOS: como o ERP escreve filial × projeto (para o de-para da Carta) ──
if (process.env.PROJETOS) {
  console.log('\n━━ Filial × projeto da OS × projeto do veículo (contagem, R$)');
  const m = new Map();
  for (const r of L) { const k = `${r.filial}|${r.projeto_os}|${r.projeto_veiculo}`; const a = m.get(k) || [0, 0]; a[0]++; a[1] += r.valor; m.set(k, a); }
  [...m].sort().forEach(([k, a]) => console.log(`PRJ|${k}|${a[0]}|${a[1].toFixed(0)}`));
}
// ── 4) DUMP: linhas cruas agregadas, para comparar com relatório de fora (Qlik) ──
if (process.env.DUMP) {
  console.log('\n━━ 4) DUMP (ERP por filial e DRE por unidade, mês a mês)');
  const e = new Map();
  for (const r of L) {
    if (r.cls !== 'Diesel' && r.cls !== 'Arla') continue;
    const k = `${r.vig}|${r.filial || ''}|${r.cls}`;
    const a = e.get(k) || { n: 0, lit: 0, val: 0, vs: 0 };
    a.n++; a.lit += r.litros; a.val += r.valor; if (!suspeita(r)) a.vs += r.valor;
    e.set(k, a);
  }
  [...e].sort().forEach(([k, a]) => console.log(`ERP|${k}|${a.n}|${a.lit.toFixed(1)}|${a.val.toFixed(2)}|${a.vs.toFixed(2)}`));
  if (dre.length) {
    const ks = Object.keys(dre[0]);
    const kCta = ks.find(k => norm(k).includes('conta'));
    const d = new Map();
    for (const l of dre) {
      const t = norm(l[kCta]); const cls = t.includes('arla') ? 'Arla' : t.startsWith('combustiveis') ? 'Diesel' : null;
      if (!cls) continue;
      const vig = String(l.vigencia_orig || l.vigencia || '').slice(0, 7);
      if (vig < DESDE.slice(0, 7)) continue;
      const k = `${vig}|${l.unidade || ''}|${cls}`;
      const a = d.get(k) || { real: 0, rem: 0 }; a.real -= num(l.realizado); a.rem -= num(l.remunerado); d.set(k, a);
    }
    [...d].sort().forEach(([k, a]) => console.log(`DRE|${k}|${a.real.toFixed(2)}|${a.rem.toFixed(2)}`));
  }
}
console.log('\nFim. Nada foi gravado.');
