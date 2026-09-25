// ============================================================
// O que a erp_abastecimentos aguenta para um painel de LITROS e VALOR?
// (Renan, 25/09/2026: "com as informações de abastecimento vindo do banco da
// Conlog, criar dentro do hub de combustível painéis de litros e valor")
//
// Antes de desenhar: por mês, quantos abastecimentos, placas, litros, valor,
// R$/L e km/L; quais filiais e projetos aparecem; quanto vem sem litros, sem
// valor ou com data esquisita. Só estrutura e totais — nada de linha crua no
// log (o repositório é público). Não grava nada.
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const n = v => Math.round(+v || 0).toLocaleString('pt-BR');
const d2 = v => (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const linhas = [];
for (let off = 0; ; off += 1000) {
  const r = await fetch(`${SB_URL}/rest/v1/erp_abastecimentos?select=codigo_filial,filial,placa,modelo,unidade_prod,projeto_os,projeto_veiculo,km_rodado,litros,valor,data,atualizado_em&order=ordem_servico.asc`,
    { headers: { ...H, Range: `${off}-${off + 999}` } });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  const p = await r.json(); linhas.push(...p);
  if (p.length < 1000) break;
}
console.log(`erp_abastecimentos: ${n(linhas.length)} linhas`);

// ── recorte Ambev + Seara (as unidades do portal), pelo projeto da OS ──
// O projeto vem como no DRE ("ROTA - CGR", "EMPURRADA - PIR"); o código da
// unidade é o que vem depois do último hífen, sem o "(INATIVO)".
const COD_PORTAL = new Set(['CGR', 'BLC', 'CBA', 'FLP', 'GRL', 'NFR', 'PLT', 'RON', 'MCC', 'PIR', 'GNA', 'ANG']);
const codDe = p => { const s = String(p || '').replace(/\(INATIVO\)/i, '').trim(); const i = s.lastIndexOf('-'); return i >= 0 ? s.slice(i + 1).trim().toUpperCase() : ''; };
if (process.env.ABAST_RECORTE === 'portal') {
  const antes = linhas.length;
  for (let i = linhas.length - 1; i >= 0; i--) if (!COD_PORTAL.has(codDe(linhas[i].projeto_os))) linhas.splice(i, 1);
  console.log(`recorte Ambev + Seara (projeto da OS): ${n(linhas.length)} de ${n(antes)} linhas`);
  const RS = [3, 12];
  const vig = new Map();
  linhas.forEach(r => {
    if (!r.data || r.data < '2026-01') return;
    const k = r.data.slice(0, 7), grupo = codDe(r.projeto_os) === 'ANG' ? 'seara' : 'ambev';
    const o = vig.get(k) || { ambev: { lit: 0, val: 0, valOk: 0, litOk: 0, n: 0, fora: 0 }, seara: { lit: 0, val: 0, valOk: 0, litOk: 0, n: 0, fora: 0 } };
    const g = o[grupo], L = +r.litros || 0, V = +r.valor || 0;
    g.n++; g.lit += L; g.val += V;
    if (L > 0 && V > 0 && V / L >= RS[0] && V / L <= RS[1]) { g.valOk += V; g.litOk += L; } else g.fora++;
    vig.set(k, o);
  });
  console.log(`\nmês       grupo  abast.     litros       valor bruto   R$/L bruto   valor na régua  R$/L régua  fora da régua`);
  [...vig.keys()].sort().forEach(k => ['ambev', 'seara'].forEach(gr => {
    const g = vig.get(k)[gr];
    console.log(`${k}  ${gr.padEnd(5)}  ${String(g.n).padStart(6)}  ${n(g.lit).padStart(9)}  ${('R$ ' + n(g.val)).padStart(16)}  ${d2(g.lit ? g.val / g.lit : 0).padStart(10)}  ${('R$ ' + n(g.valOk)).padStart(15)}  ${d2(g.litOk ? g.valOk / g.litOk : 0).padStart(10)}  ${String(g.fora).padStart(6)}`);
  }));
  const uni = new Map();
  linhas.forEach(r => { if (!r.data || r.data < '2026-01') return; const c = codDe(r.projeto_os); const o = uni.get(c) || { n: 0, lit: 0 }; o.n++; o.lit += +r.litros || 0; uni.set(c, o); });
  console.log('\npor unidade (2026):');
  [...uni.entries()].sort((a, b) => b[1].lit - a[1].lit).forEach(([c, o]) => console.log(`   ${c.padEnd(5)} ${String(o.n).padStart(6)} abast. ${n(o.lit).padStart(10)} L`));
  process.exit(0);
}
const atual = linhas.map(r => r.atualizado_em).filter(Boolean).sort();
console.log(`gravadas entre ${atual[0]} e ${atual[atual.length - 1]}\n`);

const hoje = new Date().toISOString().slice(0, 10);
let semLit = 0, semVal = 0, semData = 0, futuro = 0, semPlaca = 0;
const mes = new Map();
linhas.forEach(r => {
  if (!r.data) { semData++; return; }
  if (r.data > hoje) { futuro++; return; }
  if (!(+r.litros > 0)) semLit++;
  if (!(+r.valor > 0)) semVal++;
  if (!r.placa) semPlaca++;
  const k = r.data.slice(0, 7);
  const o = mes.get(k) || { n: 0, lit: 0, val: 0, km: 0, placas: new Set(), fil: new Set(), dias: new Set() };
  o.n++; o.lit += +r.litros || 0; o.val += +r.valor || 0; o.km += +r.km_rodado || 0;
  o.placas.add(r.placa); o.fil.add(r.filial); o.dias.add(r.data);
  mes.set(k, o);
});
console.log('mês       abast.  placas  filiais  dias      litros            valor     R$/L   km/L');
[...mes.keys()].sort().forEach(k => {
  const o = mes.get(k);
  console.log(`${k}  ${String(o.n).padStart(6)}  ${String(o.placas.size).padStart(6)}  ${String(o.fil.size).padStart(7)}  ${String(o.dias.size).padStart(4)}  ${n(o.lit).padStart(10)}  ${('R$ ' + n(o.val)).padStart(15)}  ${d2(o.lit ? o.val / o.lit : 0).padStart(7)}  ${d2(o.lit ? o.km / o.lit : 0).padStart(5)}`);
});
console.log(`\nsem data ${semData} · data no futuro ${futuro} · sem litros ${semLit} · sem valor ${semVal} · sem placa ${semPlaca}`);

const conta = col => {
  const m = new Map();
  linhas.forEach(r => { const v = r[col] || '(vazio)'; const o = m.get(v) || { n: 0, lit: 0 }; o.n++; o.lit += +r.litros || 0; m.set(v, o); });
  return [...m.entries()].sort((a, b) => b[1].lit - a[1].lit);
};
for (const col of ['filial', 'unidade_prod', 'projeto_os', 'projeto_veiculo']) {
  const l = conta(col);
  console.log(`\n── ${col}: ${l.length} valor(es) (por litros) ──`);
  l.slice(0, 40).forEach(([k, o]) => console.log(`   ${String(k).slice(0, 45).padEnd(45)} ${String(o.n).padStart(6)} abast. ${n(o.lit).padStart(10)} L`));
}
console.log(`\nmodelos distintos: ${conta('modelo').length}`);
