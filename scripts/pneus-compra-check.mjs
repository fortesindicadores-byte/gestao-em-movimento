// ============================================================
// COMPRA DE PNEUS — conferência com o dado REAL (Renan, 05/10/2026)
//
// Roda as regras da PRÓPRIA página (/compra-pneus/index.html, em node:vm —
// uma cópia das regras aqui mediria a cópia) contra o snapshot do Prolog e
// imprime, por unidade × medida, Estoque e Necessidade (com as três
// premissas separadas). Confere também as tabelas pneu_preco / pneu_pedido e
// que o anônimo não lê pedido. Não grava nada.
//
// Roda no GitHub Actions: o sandbox não alcança o Supabase.
// ============================================================
import fs from 'node:fs';
import vm from 'node:vm';

const SB_URL = 'https://lozwipoeacpvplgkrxkq.supabase.co';
const KEY = process.env.GEM_SUPABASE_SERVICE_KEY;
const PUB = 'sb_publishable_ggKEEebc5zjgQDVsF92Upw_6uoLmKe9';
if (!KEY) { console.error('GEM_SUPABASE_SERVICE_KEY ausente'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

// as regras da página: de "const BANDAS=" até os utilitários
const html = fs.readFileSync(new URL('../compra-pneus/index.html', import.meta.url), 'utf8');
const ini = html.indexOf('const BANDAS='), fim = html.indexOf('/* ── utilitários ── */');
if (ini < 0 || fim < 0) { console.error('não achei o bloco de regras na página'); process.exit(1); }
const ctx = {}; vm.createContext(ctx);
vm.runInContext(html.slice(ini, fim).replace(/^const /gm, 'var ') + '\n;var __ok=1;', ctx);
const { BRANCH, MEDIDAS, medOpcao, premissa, ultEixoCarretas, ehCarreta } = ctx;
console.log(`regras da página carregadas: ${Object.keys(BRANCH).length} unidades · ${MEDIDAS.length} medidas`);

let falhas = 0;
const af = (t, v, e = '') => { console.log(`${v ? '✓' : '✗'} ${t}${e !== '' ? '  (' + e + ')' : ''}`); if (!v) falhas++; };

// ── tabelas ──
const le = async (t, q, h = H) => { const r = await fetch(`${SB_URL}/rest/v1/${t}?${q}`, { headers: h }); return { st: r.status, j: r.ok ? await r.json() : await r.text() }; };
const pr = await le('pneu_preco', 'select=medida,produto,valor,ativo');
af('pneu_preco existe e tem produtos', pr.st === 200 && pr.j.length > 0, pr.st === 200 ? pr.j.length + ' produtos' : pr.st);
const pp = await le('pneu_pedido', 'select=id,vigencia,unidade,medida,qtd,qtd_aprovada');
af('pneu_pedido existe', pp.st === 200, pp.st === 200 ? pp.j.length + ' pedidos' : pp.st + ' ' + String(pp.j).slice(0, 120));
const anon = await le('pneu_pedido', 'select=id&limit=1', { apikey: PUB, Authorization: 'Bearer ' + PUB });
af('anônimo não lê pedido (RLS)', anon.st !== 200 || anon.j.length === 0, anon.st + ' · ' + (Array.isArray(anon.j) ? anon.j.length + ' linha(s)' : ''));
if (pr.st === 200) {
  const semPreco = MEDIDAS.filter(m => !pr.j.some(p => p.medida === m && p.ativo !== false));
  console.log(`medidas sem preço ativo: ${semPreco.join(', ') || 'nenhuma'}`);
}

// ── Prolog ──
const est = {}, nec = {}, carretas = {}, semMed = {};
const D = { instCarreta: 0, eixos: {}, ultEixo: 0, ultBaixo: 0, ultBaixoVida: {} };
let ult = null;
for (const bid of Object.keys(BRANCH)) {
  let rows = [];
  for (let a = 0; a < 5; a++) {
    const r = await fetch(`${SB_URL}/rest/v1/snapshot?branch_id=eq.${bid}&endpoint=in.(tires,vehicles)&select=endpoint,data,updated_at`, { headers: H });
    if (r.ok) { rows = await r.json(); break; }
    await new Promise(s => setTimeout(s, 1500));
  }
  const uni = BRANCH[bid];
  const tr = rows.find(x => x.endpoint === 'tires'), vr = rows.find(x => x.endpoint === 'vehicles');
  if (!tr) { console.log(`${uni}: sem snapshot de pneus`); continue; }
  if (tr.updated_at && (!ult || tr.updated_at > ult)) ult = tr.updated_at;
  const veic = vr && Array.isArray(vr.data) ? vr.data : [];
  const ultE = ultEixoCarretas(veic);
  veic.filter(v => ehCarreta(v.tipo)).forEach(v => { const k = `${v.tipo} → eixo ${ultE[v.id]}`; carretas[k] = (carretas[k] || 0) + 1; });
  for (const t of tr.data || []) {
    if (String(t.status || '').toUpperCase() === 'INSTALLED' && ultE[t.veiculoId]) {
      const e = ultE[t.veiculoId], pos = String(t.nomePosicao || '').toUpperCase().trim(), mm = +t.menorMM, v = +t.cicloVida || 1;
      D.instCarreta++; const eixo = (pos.match(/^\d+/) || ['?'])[0]; D.eixos[eixo] = (D.eixos[eixo] || 0) + 1;
      if (pos.startsWith(String(e))) { D.ultEixo++; if (mm > 0 && mm < 4) { D.ultBaixo++; D.ultBaixoVida['vida ' + v] = (D.ultBaixoVida['vida ' + v] || 0) + 1; } }
    }
    const m = medOpcao(t.medida); const st = String(t.status || '').toUpperCase();
    if (!m) { if (st === 'INVENTORY' || st === 'INSTALLED') semMed[t.medida || '(vazio)'] = (semMed[t.medida || '(vazio)'] || 0) + 1; continue; }
    const k = uni + '|' + m;
    if (st === 'INVENTORY') { const s = est[k] = est[k] || { n: 0, novos: 0 }; s.n++; if ((+t.cicloVida || 1) === 1) s.novos++; continue; }
    if (st !== 'INSTALLED') continue;
    const p = premissa(t, ultE); if (!p) continue;
    const s = nec[k] = nec[k] || { n: 0, p: { 1: 0, 2: 0, 3: 0 } }; s.n++; s.p[p]++;
  }
}
console.log(`\nsnapshot do Prolog: ${ult}`);
console.log(`carretas: ${D.instCarreta} pneus instalados casados pelo veiculoId · por eixo ${JSON.stringify(D.eixos)} · no último eixo ${D.ultEixo} · abaixo de 4 mm ${D.ultBaixo} ${JSON.stringify(D.ultBaixoVida)}`);
console.log('\n== carretas: tipo → último eixo ==');
Object.entries(carretas).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`   ${String(n).padStart(4)}  ${k}`));
console.log('\n== por unidade × medida ==  (estoque [novos] · necessidade = 1ª vida dianteiro + 4ª recap + último eixo carreta)');
const chaves = [...new Set([...Object.keys(est), ...Object.keys(nec)])].sort();
let tE = 0, tN = 0; const tp = { 1: 0, 2: 0, 3: 0 };
for (const k of chaves) {
  const e = est[k] || { n: 0, novos: 0 }, n = nec[k] || { n: 0, p: { 1: 0, 2: 0, 3: 0 } };
  tE += e.n; tN += n.n; [1, 2, 3].forEach(i => { tp[i] += n.p[i]; });
  const [u, m] = k.split('|');
  console.log(`   ${u.padEnd(10)} ${m.padEnd(8)} estoque ${String(e.n).padStart(4)} [${String(e.novos).padStart(3)}] · necessidade ${String(n.n).padStart(3)} = ${n.p[1]} + ${n.p[2]} + ${n.p[3]}`);
}
console.log(`\nTOTAL estoque ${tE} · necessidade ${tN} = ${tp[1]} (1ª vida dianteiro) + ${tp[2]} (4ª recapagem) + ${tp[3]} (último eixo carreta)`);
console.log('\n== medidas do Prolog que NÃO caem em opção do pedido (estoque/instalado) ==');
Object.entries(semMed).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`   ${String(n).padStart(5)}  ${k}`));
process.exit(falhas ? 1 : 0);
