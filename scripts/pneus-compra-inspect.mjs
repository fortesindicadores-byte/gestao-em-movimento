// ============================================================
// COMPRA DE PNEUS — o que o Prolog entrega para Estoque e Necessidade
// (Renan, 05/10/2026). Só leitura, imprime estrutura e contagens.
//
// - status dos pneus (qual é o "estoque")
// - medidas como o loader as grava (para casar com 295, 6.00-9, 28x9-15…)
// - vidas (cicloVida) e posições (nomePosicao do eixo 1 e do eixo 3)
// - tipos de veículo (para separar carreta)
// - projetos de cada unidade no DRE Frota (Nível 3)
//
// Roda no GitHub Actions: o sandbox não alcança o Supabase.
// ============================================================
const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

const UNI = { 1676: 'MCC T1', 1677: 'MCC T2', 37: 'CGR', 1906: 'CBA T1 WH', 1907: 'CBA T1', 1878: 'CBA T2',
  20: 'FLP', 30: 'GRL', 24: 'BLC', 2517: 'NFR', 26: 'PLT', 38: 'PIR', 2277: 'RON', 2550: 'ANG' };

const conta = (arr, f) => { const m = {}; arr.forEach(x => { const k = f(x); m[k] = (m[k] || 0) + 1; }); return m; };
const top = (m, n = 60) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n)
  .map(([k, v]) => `   ${String(v).padStart(6)}  ${k}`).join('\n');

async function snap(bid) {
  for (let a = 0; a < 5; a++) {
    const r = await fetch(`${SB_URL}/rest/v1/snapshot?branch_id=eq.${bid}&select=endpoint,data,updated_at`, { headers: H });
    if (r.ok) return r.json();
    await new Promise(s => setTimeout(s, 1500));
  }
  return [];
}

const tires = [], vehicles = [];
for (const bid of Object.keys(UNI)) {
  const rows = await snap(bid);
  for (const r of rows) {
    const arr = Array.isArray(r.data) ? r.data : [];
    if (r.endpoint === 'tires') arr.forEach(t => tires.push({ ...t, unidade: UNI[bid] }));
    if (r.endpoint === 'vehicles') arr.forEach(v => vehicles.push({ ...v, unidade: UNI[bid] }));
  }
  console.log(`${UNI[bid].padEnd(10)} ${rows.map(r => `${r.endpoint}=${Array.isArray(r.data) ? r.data.length : '?'}`).join(' ')}`);
}
console.log(`\nTOTAL pneus ${tires.length} · veículos ${vehicles.length}`);

console.log('\n== status dos pneus ==\n' + top(conta(tires, t => t.status || '(vazio)')));
console.log('\n== medida (todas) ==\n' + top(conta(tires, t => t.medida || '(vazio)'), 80));
console.log('\n== medida × status ESTOQUE ==\n' + top(conta(tires.filter(t => /STOCK|ESTOQUE/i.test(t.status || '')), t => t.medida || '(vazio)'), 60));
console.log('\n== cicloVida (todos) ==\n' + top(conta(tires, t => `vida ${t.cicloVida} / max ${t.maxCiclos}`)));
console.log('\n== cicloVida × ESTOQUE ==\n' + top(conta(tires.filter(t => /STOCK|ESTOQUE/i.test(t.status || '')), t => `vida ${t.cicloVida}`)));
const inst = tires.filter(t => t.veiculoId);
console.log(`\ninstalados (com veículo): ${inst.length}`);
console.log('\n== nomePosicao (instalados) ==\n' + top(conta(inst, t => `${t.nomePosicao || '(vazio)'} · pos ${t.posicao}`), 80));
console.log('\n== direcional × eixo do nomePosicao ==\n' + top(conta(inst, t => `dir=${t.direcional} · eixo ${(String(t.nomePosicao || '').match(/^\d+/) || ['?'])[0]}`)));

const vPorId = {}; vehicles.forEach(v => { vPorId[v.id] = v; });
console.log('\n== tipo de veículo ==\n' + top(conta(vehicles, v => v.tipo || '(vazio)'), 60));
const eixo3 = inst.filter(t => /^3/.test(String(t.nomePosicao || '')));
console.log('\n== eixo 3: tipo do veículo × posição ==\n' + top(conta(eixo3, t => `${(vPorId[t.veiculoId] || {}).tipo || '?'} · ${t.nomePosicao}`), 60));
console.log('\n== banda (modelo de recape) / modelo do pneu ==\n' + top(conta(tires, t => `${t.marca} | ${t.modelo}`), 50));

// abaixo de 4 mm, como a Necessidade vai contar
const baixo = inst.filter(t => +t.menorMM > 0 && +t.menorMM < 4);
console.log(`\ninstalados abaixo de 4 mm: ${baixo.length} (menorMM 0 = sem leitura: ${inst.filter(t => !(+t.menorMM > 0)).length})`);
console.log('\n== abaixo de 4 mm × unidade ==\n' + top(conta(baixo, t => t.unidade)));
console.log('\n== abaixo de 4 mm × vida × eixo ==\n' + top(conta(baixo, t => `vida ${t.cicloVida} · eixo ${(String(t.nomePosicao || '').match(/^\d+/) || ['?'])[0]} · dir=${t.direcional}`), 40));

// projetos por unidade (DRE Frota, coluna Nível 3)
try {
  const b = await (await fetch(`${SB_URL}/rest/v1/sh_base?slug=eq.dre_frota&select=colunas`, { headers: H })).json();
  const cols = (b[0] && b[0].colunas) || [];
  const c3 = cols.find(c => /n[ií]vel\s*3/i.test(c.label || ''));
  console.log(`\nDRE Frota: coluna do Nível 3 = ${c3 ? c3.col + ' (' + c3.label + ')' : 'NÃO ACHEI'} · ${cols.length} colunas`);
  if (c3) {
    const vals = {};
    for (let off = 0; off < 40000; off += 1000) {
      const r = await fetch(`${SB_URL}/rest/v1/sh_dre_frota?select=${c3.col}&order=linha&offset=${off}&limit=1000`, { headers: H });
      const j = r.ok ? await r.json() : [];
      j.forEach(x => { const v = x[c3.col]; if (v) vals[v] = (vals[v] || 0) + 1; });
      if (j.length < 1000) break;
    }
    console.log('\n== Nível 3 distintos ==\n' + Object.keys(vals).sort().map(k => `   ${k}`).join('\n'));
  }
} catch (e) { console.log('DRE Frota falhou: ' + e.message); }
