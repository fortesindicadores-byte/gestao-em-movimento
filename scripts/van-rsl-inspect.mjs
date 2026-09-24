// ============================================================
// R$/L remunerado da VAN = o do ROTA da mesma unidade (Renan, 24/09/2026).
// Depois da troca, a Árvore mostrou VAN com Rem 6,58 = Real 6,58 — igual demais
// para ser o preço do ROTA. Este script refaz, com as MESMAS abas e a MESMA
// busca do painel (remPriceFor + _vanRota), a conta por unidade × vigência:
//   · VAN: litros, R$ real/L, R$ rem/L (pela busca), quantas linhas acharam preço
//     e em qual chave (própria, ROTA com combustível, ROTA sem combustível)
//   · ROTA da mesma unidade: R$ real/L e R$ rem/L
// Mostra também os cabeçalhos da aba R$/L e as chaves de VAN/ROTA que ela tem.
// Uso (Actions): VIG=2026-08 node scripts/van-rsl-inspect.mjs  (VIG vazio = 2026 inteiro)
// ============================================================
const KML_ID = '1ZZdvG_RK5cTBLdPl3TWCbNeqw-Y4fTYwWsQV4w-e__A';
const VIG = (process.env.VIG || '').trim();

const parse = t => { const s = t.indexOf('{'), e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)); };
const num = c => { if (!c || c.v == null) return 0; const n = Number(c.v); return isFinite(n) ? n : 0; };
const txt = c => c ? String(c.v != null ? c.v : (c.f != null ? c.f : '')) : '';
const MM = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
function gvig(c) {
  if (!c) return null; let m = String(c.v).match(/Date\((\d+),(\d+)/); if (m) return m[1] + '-' + String(+m[2] + 1).padStart(2, '0');
  const f = String(c.f != null ? c.f : (c.v != null ? c.v : ''));
  m = f.match(/([a-zç]{3,})\.?[\/\-](\d{4})/i); if (m && MM[m[1].toLowerCase().slice(0, 3)]) return m[2] + '-' + String(MM[m[1].toLowerCase().slice(0, 3)]).padStart(2, '0');
  m = f.match(/(\d{1,2})\/(\d{4})/); if (m) return m[2] + '-' + m[1].padStart(2, '0');
  if (typeof c.v === 'number') { const d = new Date(1899, 11, 30); d.setDate(d.getDate() + Math.round(c.v)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  return null;
}
const _nk = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const _nf = s => { let x = String(s || ''); const i = x.indexOf(':'); if (i >= 0) x = x.slice(i + 1); return _nk(x); };
const _vanRota = p => { const m = String(p).match(/^(?:ROTA \(VAN\)|VAN)\s*-\s*(.+)$/); return m ? 'ROTA - ' + m[1] : null; };

async function aba(sheet) {
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${KML_ID}/gviz/tq?sheet=${encodeURIComponent(sheet)}&tqx=out:json`);
  const j = parse(await r.text()); if (j.status !== 'ok') throw new Error(sheet + ': gviz ' + j.status);
  return { labels: (j.table.cols || []).map(c => String(c.label || '')), rows: (j.table.rows || []).map(x => x.c || []) };
}
const [KL, RL] = await Promise.all([aba('Km/L'), aba('R$/L')]);

// ── R$/L: mesma leitura do buildRemLookup do painel ──
const rlLow = RL.labels.map(l => l.toLowerCase());
const rfi = (...t) => rlLow.findIndex(c => t.some(x => c.includes(x)));
const cProj = rfi('unidade benner');
let cVig = -1; for (let i = 0; i < rlLow.length; i++) { if (rlLow[i].includes('vigência') || rlLow[i].includes('vigencia')) { const sv = RL.rows.find(r => r[i] && r[i].v != null)?.[i]; if (gvig(sv)) { cVig = i; break; } } } if (cVig < 0) cVig = 3;
const cPreco = rfi('precooperadora', 'preco operadora'), cFuel = rfi('tipocombustivel', 'combustivel', 'combustível');
console.log(`Aba R$/L: ${RL.rows.length} linhas · colunas usadas: projeto="${RL.labels[cProj]}" vig="${RL.labels[cVig]}" preço="${RL.labels[cPreco]}" combustível="${RL.labels[cFuel]}"`);
console.log('Todos os cabeçalhos da R$/L:', JSON.stringify(RL.labels));
const L1 = new Map(), L2 = new Map(), projsRL = new Map();
RL.rows.forEach(r => {
  const p = _nk(txt(r[cProj])), ym = gvig(r[cVig]); if (!p || !ym) return; const fu = _nf(txt(r[cFuel])), v = num(r[cPreco]); if (!(v > 0)) return;
  projsRL.set(p, (projsRL.get(p) || 0) + 1);
  for (const [M, k] of [[L1, `${p}|${ym}|${fu}`], [L2, `${p}|${ym}`]]) { const o = M.get(k) || { s: 0, n: 0 }; o.s += v; o.n++; M.set(k, o); }
});
const vanNaRL = [...projsRL.keys()].filter(p => /VAN/.test(p));
console.log(`Chaves da R$/L com "VAN": ${vanNaRL.length ? vanNaRL.join(' · ') : 'nenhuma'}`);

// ── Km/L: mesmas colunas do detKmlSrc da Árvore ──
const klLow = KL.labels.map(l => l.toLowerCase());
const kfi = (...t) => klLow.findIndex(c => t.some(x => c.includes(x)));
const K = { proj: kfi('projeto'), litros: kfi('qtd total de litro', 'qtd litro', 'qtd total', 'litro'), tot: kfi('totas r$', 'total r$', 'total geral'), fuel: kfi('tipo combust', 'combustivel', 'combustível') };
console.log(`Aba Km/L: ${KL.rows.length} linhas · colunas: projeto="${KL.labels[K.proj]}" litros="${KL.labels[K.litros]}" total="${KL.labels[K.tot]}" combustível="${KL.labels[K.fuel]}"`);

const preco = (p, ym, fu) => {
  let e = L1.get(`${p}|${ym}|${fu}`), via = 'própria c/ comb.'; if (!e) { e = L2.get(`${p}|${ym}`); via = 'própria s/ comb.'; }
  if (!e) { const q = _vanRota(p); if (q) { e = L1.get(`${q}|${ym}|${fu}`); via = 'ROTA c/ comb.'; if (!e) { e = L2.get(`${q}|${ym}`); via = 'ROTA s/ comb.'; } } }
  return e && e.n > 0 ? { v: e.s / e.n, via } : { v: null, via: 'sem preço' };
};
const G = {};
KL.rows.forEach(r => {
  const ym = gvig(r[0]); if (!ym || !ym.startsWith('2026') || (VIG && ym !== VIG)) return;
  const p = _nk(txt(r[K.proj])); const m = p.match(/^(ROTA \(VAN\)|VAN|ROTA)\s*-\s*(.+)$/); if (!m) return;
  const tipo = m[1] === 'ROTA' ? 'ROTA' : 'VAN', uni = m[2].replace(/\s*\(INATIVO\)/, '').trim();
  const lit = num(r[K.litros]), tot = num(r[K.tot]), fu = _nf(txt(r[K.fuel])), pr = preco(p, ym, fu);
  const k = `${ym}|${uni}`; const g = G[k] || (G[k] = { ROTA: null, VAN: null });
  const o = g[tipo] || (g[tipo] = { lit: 0, tot: 0, rxl: 0, litR: 0, via: {}, fuels: {} });
  o.lit += lit; if (tot > 0) o.tot += tot; if (pr.v > 0) { o.rxl += pr.v * lit; o.litR += lit; }
  o.via[pr.via] = (o.via[pr.via] || 0) + 1; o.fuels[fu || '(vazio)'] = (o.fuels[fu || '(vazio)'] || 0) + 1;
});
const f2 = v => v == null ? '—' : v.toFixed(2);
console.log('\nvig      unid   | VAN: litros  real  rem   (busca)                         combustível         | ROTA: real  rem');
Object.entries(G).filter(([, g]) => g.VAN).sort().forEach(([k, g]) => {
  const [ym, uni] = k.split('|'), v = g.VAN, r = g.ROTA;
  const vr = v.lit ? v.tot / v.lit : null, vm = v.litR ? v.rxl / v.litR : null;
  const rr = r && r.lit ? r.tot / r.lit : null, rm = r && r.litR ? r.rxl / r.litR : null;
  const igual = vr != null && vm != null && Math.abs(vr - vm) < 0.005 ? '  ⚠ rem = real' : '';
  console.log(`${ym}  ${uni.padEnd(6)} | ${Math.round(v.lit).toString().padStart(8)}  ${f2(vr)}  ${f2(vm)}  ${JSON.stringify(v.via).padEnd(32)} ${JSON.stringify(v.fuels).padEnd(20)}| ${f2(rr)}  ${f2(rm)}${igual}`);
});
