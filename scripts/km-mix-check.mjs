// ============================================================
// KM MIX CHECK — por que o Δ km do Painel KM pode ser POSITIVO com impacto
// NEGATIVO (Renan, 10/09/2026: "1% positivo e impacto verde???").
//
// Reproduz a conta do /painel-km/ (Dispersão de km + Frota do DRE + Balanço
// de Massa pela coluna "Valor 85%") para uma janela de vigências e imprime,
// por chave projeto|unidade: km remunerado (já com o balanço), km real, Δ,
// R$/km da chave e impacto = Δ × R$/km. O total do Δ e o total do impacto
// são somas de chaves com R$/km DIFERENTES — km economizado onde o R$/km é
// caro pesa mais do que km estourado onde é barato. Não grava nada.
// Uso: DE=01/2026 ATE=07/2026 node scripts/km-mix-check.mjs
// ============================================================
const DISP_ID = '1wCoRGsvOgmIvfLW4F9Sxr-5AX9Go-aFlRVjrQ_B2ilM';
const COST_ID = '1qcTy2ppLCGBKKqZCxCYWCTL9kTAuWfHBMyBfWJOyih8';
const DE = process.env.DE || '01/2026', ATE = process.env.ATE || '12/2026';

const parse = t => { const s = t.indexOf('{'), e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)); };
async function sheet(id, tab) {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
  const j = parse(await (await fetch(url)).text());
  if (j.status !== 'ok') throw new Error(`${tab}: ${JSON.stringify(j.errors || j.status)}`);
  const cols = (j.table.cols || []).map(c => String((c && (c.label || c.id)) || '').trim());
  const rows = (j.table.rows || []).map(r => (r.c || []).map(c => c ? { v: c.v, f: c.f } : null));
  return { cols, rows };
}
const MES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
function vigDe(cell) {
  if (!cell || cell.v == null) return '';
  const s = String(cell.v);
  let m = s.match(/Date\((\d+),(\d+)/); if (m) return String(+m[2] + 1).padStart(2, '0') + '/' + m[1];
  const f = String(cell.f != null ? cell.f : s).trim().toLowerCase();
  m = f.match(/^(\d{1,2})\/(\d{4})$/); if (m) return m[1].padStart(2, '0') + '/' + m[2];
  m = f.match(/^([a-zç]{3})[a-zç]*\.?\s*\/\s*(\d{2,4})$/); if (m && MES[m[1]]) { let y = +m[2]; if (y < 100) y += 2000; return String(MES[m[1]]).padStart(2, '0') + '/' + y; }
  return '';
}
const ord = v => { const [m, y] = v.split('/'); return +y * 100 + +m; };
const naJanela = v => v && ord(v) >= ord(DE) && ord(v) <= ord(ATE);
const NK = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s*\(INATIVO\)\s*/g, '').replace(/\s+/g, ' ').trim();
const num = c => { const n = parseFloat(c && c.v); return isFinite(n) ? n : 0; };
const br = (v, d = 0) => (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sg = (v, d = 0) => (v > 0 ? '+' : '') + br(v, d);

const ALIAS = { 'COMBUSTIVEIS VEICULOS E EQUIPAMENTOS': 'COMBUSTIVEIS', 'FLUIDOS (ARLA)': 'ARLA',
  'PERSONALIZACAO/PADRONIZACAO DE VEICULOS': 'PERSONALIZACAO/PADRONIZACAO', 'PERSONALIZACAO E PADRONIZACAO DE VEICULOS': 'PERSONALIZACAO/PADRONIZACAO',
  'MANUTENCAO DE VEICULOS E EQUIPAMENTOS': 'MANUTENCAO DE VEICULOS E EQUIP.', 'CONSERTOS E RECAPAGENS DE PNEUS': 'RECAPAGENS E OUTROS SERVICOS', 'PNEUS E CAMARAS': 'PNEUS NOVOS' };
const PAC = { 'COMBUSTIVEIS': 1, 'ARLA': 1, 'MANUTENCAO DE CARROCERIAS': 1, 'CONTRATOS DE MANUTENCAO FABRICANTE': 1, 'MATERIAIS E FERRAMENTAS DE OFICINA': 1,
  'PERSONALIZACAO/PADRONIZACAO': 1, 'LAVACAO DE VEICULOS': 1, 'MANUTENCAO DE VEICULOS E EQUIP.': 1, 'RECAPAGENS E OUTROS SERVICOS': 1, 'PNEUS NOVOS': 1 };
const CIDADE = { CUIABA: 'CBA', PIRAI: 'PIR', MACACU: 'MCC', 'CACHOEIRAS DE MACACU': 'MCC', 'CAMPO GRANDE': 'CGR', 'RIO DE JANEIRO': 'CGR',
  PELOTAS: 'PLT', FLORIANOPOLIS: 'FLP', GUARULHOS: 'GRL', 'NOVA FRIBURGO': 'NFR', RONDONOPOLIS: 'RON', 'BALNEARIO CAMBORIU': 'BLC', CAMBORIU: 'BLC' };
function chaveBM(unidade) {
  const partes = NK(unidade).split(' '); const proj = partes.pop(); const cid = partes.join(' ');
  const cod = CIDADE[cid] || CIDADE[partes[partes.length - 1]] || null;
  return cod ? `${proj}|${cod}` : null;
}

const [disp, frota, bm] = await Promise.all([sheet(DISP_ID, 'Dispersão de km'), sheet(COST_ID, 'Frota'), sheet(DISP_ID, 'Balanço de Massa')]);
console.log(`janela ${DE} → ${ATE} · Dispersão: ${disp.rows.length} · Frota: ${frota.rows.length} · Balanço: ${bm.rows.length}`);

// linhas do painel (col 0 vig · col 14 "PROJ - COD" · col 31 rem · col 32 real)
const linhas = [];
disp.rows.forEach(r => { const vig = vigDe(r[0]); const n3 = String((r[14] && r[14].v) || ''); if (!vig || !n3.includes('-')) return;
  const i = n3.indexOf('-'); const proj = NK(n3.slice(0, i)), cod = NK(n3.slice(i + 1));
  const rem = num(r[31]), real = num(r[32]); if (!(rem > 0 || real > 0)) return;
  linhas.push({ vig, k: `${vig}|${proj}|${cod}`, ch: `${proj}|${cod}`, rem0: rem, rem, real, recomp: 0 }); });
const km0 = {}; linhas.forEach(l => { km0[l.k] = (km0[l.k] || 0) + l.rem0; });

// R$/km remunerado da chave (todas as contas dos 3 pacotes)
const fi = (...t) => frota.cols.findIndex(c => t.some(x => c.toLowerCase().includes(x)));
const K = { vig: fi('vigência', 'vigencia'), n3: fi('nível 3', 'nivel 3'), cta: fi('conta'), rem: fi('remunerado') };
const custo = {};
frota.rows.forEach(r => { const vig = vigDe(r[K.vig]); const n3 = String((r[K.n3] && r[K.n3].v) || ''); if (!vig || !n3.includes('-')) return;
  const i = n3.indexOf('-'); const k = `${vig}|${NK(n3.slice(0, i))}|${NK(n3.slice(i + 1))}`;
  const cta = NK(r[K.cta] && r[K.cta].v); if (!PAC[ALIAS[cta] || cta]) return;
  custo[k] = (custo[k] || 0) + (-num(r[K.rem])); });
const taxa = k => (custo[k] > 0 && km0[k] > 0) ? custo[k] / km0[k] : 0;

// Balanço de Massa (Valor 85%) → km recomposto rateado
const bi = (...t) => bm.cols.findIndex(c => t.some(x => c.toLowerCase().includes(x)));
const b85 = bm.cols.findIndex(c => /valor/i.test(c) && /85/.test(c));
const B = { uni: bi('unidade'), vig: bi('vig'), val: b85 >= 0 ? b85 : bi('valor') };
console.log(`Balanço de Massa · coluna "${bm.cols[B.val]}"`);
bm.rows.forEach(r => { const vig = vigDe(r[B.vig]); const valor = num(r[B.val]); const ch = chaveBM(r[B.uni] && r[B.uni].v);
  if (!vig || !valor || !ch) return; const k = `${vig}|${ch}`; const t = taxa(k); if (!(t > 0) || !(km0[k] > 0)) return;
  const kmRec = valor / t;
  linhas.forEach(l => { if (l.k !== k) return; l.recomp += kmRec * (l.rem0 / km0[k]); l.rem = l.rem0 + l.recomp; }); });
linhas.forEach(l => { l.taxa = taxa(l.k); l.imp = (l.real - l.rem) * l.taxa; });

// agrega por chave projeto|unidade na janela
const agg = {};
linhas.filter(l => naJanela(l.vig)).forEach(l => { const a = (agg[l.ch] = agg[l.ch] || { rem: 0, real: 0, imp: 0, semTaxa: 0 });
  a.rem += l.rem; a.real += l.real; a.imp += l.imp; if (!l.taxa) a.semTaxa++; });
const rows = Object.entries(agg).map(([ch, a]) => ({ ch, ...a, d: a.real - a.rem, tx: (a.real - a.rem) ? a.imp / (a.real - a.rem) : 0 }))
  .sort((x, y) => x.imp - y.imp);
console.log('\n── por chave (Δ = real − remunerado já com o balanço · R$/km médio = impacto ÷ Δ) ──');
console.log('chave                          km rem       km real          Δ km    R$/km    impacto R$   sem taxa');
rows.forEach(r => console.log(`${r.ch.padEnd(28)} ${br(r.rem).padStart(11)} ${br(r.real).padStart(13)} ${sg(r.d).padStart(13)} ${br(r.tx, 2).padStart(8)} ${sg(r.imp).padStart(13)} ${r.semTaxa ? String(r.semTaxa).padStart(9) : ''}`));
const T = rows.reduce((s, r) => ({ rem: s.rem + r.rem, real: s.real + r.real, imp: s.imp + r.imp }), { rem: 0, real: 0, imp: 0 });
console.log(`\nTOTAL: km rem ${br(T.rem)} · km real ${br(T.real)} · Δ ${sg(T.real - T.rem)} (${sg((T.real - T.rem) / T.rem * 100, 1)}%) · impacto R$ ${sg(T.imp)}`);
const pos = rows.filter(r => r.d > 0), neg = rows.filter(r => r.d < 0);
const sum = (a, f) => a.reduce((s, r) => s + f(r), 0);
console.log(`chaves com Δ POSITIVO (estouraram): ${pos.length} · Δ ${sg(sum(pos, r => r.d))} km · impacto ${sg(sum(pos, r => r.imp))} · R$/km médio ${br(sum(pos, r => r.imp) / sum(pos, r => r.d), 2)}`);
console.log(`chaves com Δ NEGATIVO (economizaram): ${neg.length} · Δ ${sg(sum(neg, r => r.d))} km · impacto ${sg(sum(neg, r => r.imp))} · R$/km médio ${br(sum(neg, r => r.imp) / sum(neg, r => r.d), 2)}`);
